use crate::error::{DirectiveTimeoutError, MkpError, Result};
use crate::models::{
    AGetOption, AHTTPBase, AHTTPBaseOption, AJSON2LogOption, APutOption, ActionDump, FileSystem,
    Heartbeat, JoinOption, KpadOption, LogInfo, LogLength, LogOption, M10Option, MKPVersion, SN,
    SerialPortStatus, WifiAutoOption, reset_kpad_pressed_caches,
};
use crate::parser::{EOF_CLI, EOF_DEFAULT, ParsedOutput, get_raw_directive_output_parser};
use serialport::{ClearBuffer, SerialPortType};
use std::fs;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

fn extract_sync_output(buffer: &str, directive: &str, eof_flag: &str) -> (Option<String>, String) {
    let Some(hit_idx) = buffer.find(directive) else {
        return (None, buffer.to_string());
    };
    let segment = &buffer[hit_idx..];
    let output_completed_idx = if eof_flag == EOF_CLI {
        segment.find(EOF_CLI).map(|idx| idx as isize).unwrap_or(-1)
    } else {
        let mut candidates = Vec::new();
        if let Some(idx) = segment.find(EOF_DEFAULT) {
            candidates.push(idx);
        }
        if let Some(idx) = segment.find(EOF_CLI) {
            candidates.push(idx);
        }
        candidates
            .into_iter()
            .min()
            .map(|idx| idx as isize)
            .unwrap_or(-1)
    };
    if output_completed_idx < 0 {
        return (None, buffer.to_string());
    }
    (
        Some(segment[..output_completed_idx as usize].to_string()),
        String::new(),
    )
}

fn directive_slug(directive: &str) -> String {
    directive
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '_' })
        .collect::<String>()
        .trim_matches('_')
        .chars()
        .take(64)
        .collect()
}

fn now_millis_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn preview_text(data: &str, max_lines: usize, max_chars: usize) -> String {
    let parts: Vec<String> = data
        .replace('\r', "")
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .take(max_lines)
        .map(ToString::to_string)
        .collect();
    let preview = parts.join(" | ");
    if preview.len() <= max_chars {
        preview
    } else {
        format!("{}...", &preview[..max_chars.saturating_sub(3)])
    }
}

fn summarize_debug_capture(
    kind: &str,
    directive: &str,
    raw_output: &str,
    parsed_output: Option<&str>,
    error: Option<&MkpError>,
    pending_buffer: &str,
    last_sync_directive: &str,
    last_sync_output: &str,
) -> Vec<String> {
    let combined = if raw_output.is_empty() {
        pending_buffer
    } else {
        raw_output
    };
    let saw_echo = combined.contains(directive);
    let saw_eof = combined.contains(EOF_DEFAULT) || combined.contains(EOF_CLI);
    let reply_preview = preview_text(
        if combined.is_empty() {
            last_sync_output
        } else {
            combined
        },
        3,
        180,
    );
    let (stage, hint): (String, String) = if kind == "timeout" {
        if !saw_echo {
            (
                "timed out before current directive echo appeared".to_string(),
                "device may have returned only stale prompt/noise or not answered this directive yet".to_string(),
            )
        } else if !saw_eof {
            (
                "timed out after directive echo but before EOF marker".to_string(),
                "device started replying, but the completion marker never arrived".to_string(),
            )
        } else {
            (
                "timed out even though output looked partially complete".to_string(),
                "check parser EOF mode or truncated serial reads".to_string(),
            )
        }
    } else if matches!(error, Some(MkpError::RawDirectiveExecutionFailed(_))) {
        (
            "device reported directive execution failure".to_string(),
            "check the raw output for firmware-side error lines or HTTP/status failures"
                .to_string(),
        )
    } else if matches!(error, Some(MkpError::RawDirectiveParseFailed(_))) {
        if !saw_echo {
            (
                "parser never saw the current directive echo".to_string(),
                "serial stream likely contained stale prompt/noise instead of the requested reply"
                    .to_string(),
            )
        } else {
            (
                "parser could not extract the expected payload".to_string(),
                "device replied, but output format differed from the expected parser".to_string(),
            )
        }
    } else if parsed_output.unwrap_or_default().is_empty()
        && matches!(error, Some(MkpError::Json(_)))
    {
        (
            "parser produced an empty payload before JSON decode".to_string(),
            "device replied, but no JSON line/blob survived parser extraction".to_string(),
        )
    } else {
        (
            format!("{kind} while handling parsed directive output"),
            "inspect raw output and pending buffer for unexpected device behavior".to_string(),
        )
    };

    let mut summary = vec![format!("- stage: {stage}")];
    if !reply_preview.is_empty() {
        summary.push(format!("- device_reply: {reply_preview}"));
    }
    if !pending_buffer.is_empty() && pending_buffer != raw_output {
        summary.push(format!(
            "- pending_buffer: {}",
            preview_text(pending_buffer, 3, 180)
        ));
    }
    if !last_sync_output.is_empty()
        && !last_sync_directive.is_empty()
        && last_sync_directive != directive
    {
        summary.push(format!(
            "- previous_sync: {} -> {}",
            last_sync_directive,
            preview_text(last_sync_output, 3, 180)
        ));
    }
    summary.push(format!("- hint: {hint}"));
    summary
}

struct SyncState {
    sync_directive: String,
    sync_ignored: bool,
    sync_reply: Option<Sender<String>>,
    read_buffer: String,
    read_closed: bool,
    read_loop_running: bool,
    last_read_at: Option<String>,
    last_read_error: Option<String>,
    last_read_error_at: Option<String>,
    last_sync_output: String,
    last_sync_directive: String,
    last_sync_output_at: Option<String>,
}

impl Default for SyncState {
    fn default() -> Self {
        Self {
            sync_directive: String::new(),
            sync_ignored: false,
            sync_reply: None,
            read_buffer: String::new(),
            read_closed: false,
            read_loop_running: false,
            last_read_at: None,
            last_read_error: None,
            last_read_error_at: None,
            last_sync_output: String::new(),
            last_sync_directive: String::new(),
            last_sync_output_at: None,
        }
    }
}

pub struct SerialPort {
    pub name: String,
    pub vid: String,
    pub pid: String,
    pub serial_num: String,
    pub product: String,
    pub is_usb: bool,
    pub mouse_port_flag: String,
    pub keyboard_port_flag: String,
    pub verbose: bool,
    pub verbose_directive: bool,
    pub sync_output_timeout: Duration,
    sync_output_enabled: Arc<AtomicBool>,
    port: Option<Arc<Mutex<Box<dyn serialport::SerialPort>>>>,
    directive_lock: Mutex<()>,
    state: Arc<Mutex<SyncState>>,
    reader_stop: Arc<AtomicBool>,
    reader_thread: Option<JoinHandle<()>>,
}

pub type SFSerialPort = SerialPort;

impl Default for SerialPort {
    fn default() -> Self {
        Self {
            name: String::new(),
            vid: String::new(),
            pid: String::new(),
            serial_num: String::new(),
            product: String::new(),
            is_usb: false,
            mouse_port_flag: "1".to_string(),
            keyboard_port_flag: "2".to_string(),
            verbose: false,
            verbose_directive: false,
            sync_output_timeout: Duration::from_secs(15),
            sync_output_enabled: Arc::new(AtomicBool::new(true)),
            port: None,
            directive_lock: Mutex::new(()),
            state: Arc::new(Mutex::new(SyncState::default())),
            reader_stop: Arc::new(AtomicBool::new(false)),
            reader_thread: None,
        }
    }
}

impl Drop for SerialPort {
    fn drop(&mut self) {
        let _ = self.close();
    }
}

impl SerialPort {
    pub fn sync_output_enabled(&self) -> bool {
        self.sync_output_enabled.load(Ordering::SeqCst)
    }

    pub fn set_sync_output_enabled(&mut self, enabled: bool) {
        self.sync_output_enabled.store(enabled, Ordering::SeqCst);
    }

    pub fn open(&mut self) -> Result<()> {
        if self.port.is_some() {
            return Ok(());
        }
        let builder = serialport::new(&self.name, 115_200).timeout(Duration::from_millis(200));
        let port = builder.open()?;
        self.port = Some(Arc::new(Mutex::new(port)));
        {
            let mut state = self.state.lock().expect("sync state poisoned");
            state.read_closed = false;
            state.read_buffer.clear();
        }
        self.empty_sync_directive();
        self.reset_input_buffer()?;
        Ok(())
    }

    pub fn reset_input_buffer(&mut self) -> Result<()> {
        let Some(port) = &self.port else {
            return Ok(());
        };
        port.lock()
            .expect("serial mutex poisoned")
            .clear(ClearBuffer::Input)?;
        self.state
            .lock()
            .expect("sync state poisoned")
            .read_buffer
            .clear();
        Ok(())
    }

    fn write_debug_capture(
        &self,
        kind: &str,
        directive: &str,
        raw_output: &str,
        parsed_output: Option<&str>,
        error: Option<&MkpError>,
    ) -> Option<PathBuf> {
        let root =
            std::env::var("MKP_DEBUG_SERIAL_DIR").unwrap_or_else(|_| ".mkp-debug".to_string());
        let root = PathBuf::from(root);
        if fs::create_dir_all(&root).is_err() {
            return None;
        }
        let state = self.state.lock().expect("sync state poisoned");
        let path = root.join(format!(
            "{}_{}_{}.log",
            now_millis_string(),
            kind,
            directive_slug(directive)
        ));
        let summary = summarize_debug_capture(
            kind,
            directive,
            raw_output,
            parsed_output,
            error,
            &state.read_buffer,
            &state.last_sync_directive,
            &state.last_sync_output,
        );
        let mut lines = vec![
            format!("time: {}", now_millis_string()),
            format!("kind: {kind}"),
            format!("port: {}", self.name),
            format!("directive: {directive}"),
            format!("last_sync_directive: {}", state.last_sync_directive),
            format!(
                "last_sync_output_at: {}",
                state.last_sync_output_at.clone().unwrap_or_default()
            ),
            format!(
                "last_read_at: {}",
                state.last_read_at.clone().unwrap_or_default()
            ),
            format!(
                "last_read_error: {}",
                state.last_read_error.clone().unwrap_or_default()
            ),
            format!(
                "last_read_error_at: {}",
                state.last_read_error_at.clone().unwrap_or_default()
            ),
            String::new(),
            "[summary]".to_string(),
        ];
        lines.extend(summary);
        lines.extend([
            String::new(),
            "[raw_output]".to_string(),
            raw_output.to_string(),
        ]);
        if let Some(parsed_output) = parsed_output {
            lines.extend([
                String::new(),
                "[parsed_output]".to_string(),
                parsed_output.to_string(),
            ]);
        }
        if !state.read_buffer.is_empty() {
            lines.extend([
                String::new(),
                "[pending_read_buffer]".to_string(),
                state.read_buffer.clone(),
            ]);
        }
        if !state.last_sync_output.is_empty() {
            lines.extend([
                String::new(),
                "[last_sync_output]".to_string(),
                state.last_sync_output.clone(),
            ]);
        }
        if let Some(error) = error {
            lines.extend([String::new(), "[error]".to_string(), error.to_string()]);
        }
        if fs::write(&path, lines.join("\n")).is_ok() {
            Some(path)
        } else {
            None
        }
    }

    pub fn close(&mut self) -> Result<()> {
        self.reader_stop.store(true, Ordering::SeqCst);
        if let Some(handle) = self.reader_thread.take() {
            let _ = handle.join();
        }
        if let Some(port) = self.port.take() {
            let _ = port.lock().expect("serial mutex poisoned").flush();
        }
        self.state.lock().expect("sync state poisoned").read_closed = true;
        self.empty_sync_directive();
        Ok(())
    }

    pub fn start_read_loop(&mut self) -> Result<()> {
        if self
            .reader_thread
            .as_ref()
            .is_some_and(|handle| !handle.is_finished())
        {
            return Ok(());
        }
        let Some(port) = &self.port else {
            return Err(MkpError::PortNotOpen(self.name.clone()));
        };
        self.reader_stop.store(false, Ordering::SeqCst);
        let port = Arc::clone(port);
        let state = Arc::clone(&self.state);
        let reader_stop = Arc::clone(&self.reader_stop);
        let sync_output_enabled = Arc::clone(&self.sync_output_enabled);
        self.reader_thread = Some(thread::spawn(move || {
            {
                let mut state = state.lock().expect("sync state poisoned");
                state.read_loop_running = true;
            }
            while !reader_stop.load(Ordering::SeqCst) {
                let mut raw = vec![0u8; 1024];
                let read_result = {
                    let mut port = port.lock().expect("serial mutex poisoned");
                    match port.bytes_to_read() {
                        Ok(0) => port.read(&mut raw[..1]),
                        Ok(waiting) => {
                            let amount =
                                usize::try_from(waiting).unwrap_or(1).min(raw.len()).max(1);
                            port.read(&mut raw[..amount])
                        }
                        Err(_) => port.read(&mut raw[..1]),
                    }
                };
                let raw = match read_result {
                    Ok(size) if size > 0 => raw[..size].to_vec(),
                    Ok(_) => continue,
                    Err(error) => {
                        let mut state = state.lock().expect("sync state poisoned");
                        state.last_read_error = Some(error.to_string());
                        state.last_read_error_at = Some(now_millis_string());
                        state.read_closed = true;
                        break;
                    }
                };
                let text = String::from_utf8_lossy(&raw).to_string();
                let (directive, ignored, reply) = {
                    let mut state = state.lock().expect("sync state poisoned");
                    state.last_read_at = Some(now_millis_string());
                    state.last_read_error = None;
                    state.last_read_error_at = None;
                    state.read_buffer.push_str(&text);
                    (
                        state.sync_directive.clone(),
                        state.sync_ignored,
                        state.sync_reply.clone(),
                    )
                };
                if !sync_output_enabled.load(Ordering::SeqCst) || directive.is_empty() {
                    continue;
                }
                let Some(reply) = reply else {
                    continue;
                };
                let eof_flag = get_raw_directive_output_parser(&directive)
                    .map(|parser| parser.eof_flag)
                    .unwrap_or(EOF_CLI);
                let (output, remaining) = {
                    let state = state.lock().expect("sync state poisoned");
                    extract_sync_output(&state.read_buffer, &directive, eof_flag)
                };
                let Some(output) = output else {
                    continue;
                };
                {
                    let mut state = state.lock().expect("sync state poisoned");
                    state.read_buffer = remaining;
                    state.last_sync_directive = directive.clone();
                    state.last_sync_output = output.clone();
                    state.last_sync_output_at = Some(now_millis_string());
                    state.sync_directive.clear();
                    state.sync_ignored = false;
                    state.sync_reply = None;
                }
                let _ = reply.send(if ignored { String::new() } else { output });
            }
            state.lock().expect("sync state poisoned").read_loop_running = false;
        }));
        Ok(())
    }

    fn write_bytes(&self, data: &[u8]) -> Result<()> {
        let Some(port) = &self.port else {
            return Err(MkpError::PortNotOpen(self.name.clone()));
        };
        let mut port = port.lock().expect("serial mutex poisoned");
        port.write_all(data)?;
        Ok(())
    }

    fn set_sync_directive(&self, directive: &str, ignored: bool, reply: Option<Sender<String>>) {
        let mut state = self.state.lock().expect("sync state poisoned");
        state.sync_directive = directive.to_string();
        state.sync_ignored = ignored;
        state.sync_reply = reply;
    }

    fn empty_sync_directive(&self) {
        self.set_sync_directive("", false, None);
    }

    pub fn send_directive(
        &mut self,
        directive: &str,
        ignore_output: bool,
        timeout: Option<Duration>,
    ) -> Result<String> {
        let timeout = timeout.unwrap_or(self.sync_output_timeout);
        let _guard = self.directive_lock.lock().expect("directive lock poisoned");
        if self.sync_output_enabled() {
            let (sender, receiver) = mpsc::channel();
            let sync_directive = if directive.starts_with("alog") {
                "alog"
            } else {
                directive
            };
            self.set_sync_directive(sync_directive, ignore_output, Some(sender));
            self.write_bytes(format!("{directive}\r\n").as_bytes())?;
            match receiver.recv_timeout(timeout) {
                Ok(output) => Ok(output),
                Err(_) => {
                    self.empty_sync_directive();
                    let err = MkpError::Timeout(DirectiveTimeoutError {
                        directive: directive.to_string(),
                    });
                    let _ = self.write_debug_capture(
                        "timeout",
                        directive,
                        &self
                            .state
                            .lock()
                            .expect("sync state poisoned")
                            .read_buffer
                            .clone(),
                        None,
                        Some(&err),
                    );
                    Err(err)
                }
            }
        } else {
            self.write_bytes(format!("{directive}\r\n").as_bytes())?;
            Ok(String::new())
        }
    }

    pub fn send_directive_async(&mut self, directive: &str) -> Result<()> {
        self.write_bytes(format!("{directive}\r\n").as_bytes())
    }

    pub fn start_recording(&mut self, args: &str) -> Result<()> {
        self.send_directive_async(format!("alog {args}").trim().to_string().as_str())
    }

    pub fn start_replaying(&mut self, log_name: &str, delay: i32) -> Result<()> {
        self.send_directive_async(&format!("aplay {log_name} --delay {delay}"))
    }

    pub fn stop_recording(&mut self) -> Result<()> {
        self.send_parsed("astop", None).map(|_| ())
    }

    pub fn cancel_replay(&mut self) -> Result<()> {
        self.send_parsed("acancel", None).map(|_| ())
    }

    pub fn mouse10(&mut self, opt: M10Option) -> Result<()> {
        let mut directive = format!("m10 --port {}", self.mouse_port_flag);
        let fragment = opt.to_cli_fragment();
        if !fragment.is_empty() {
            directive.push(' ');
            directive.push_str(&fragment);
        }
        if opt.is_async() {
            self.send_directive_async(&directive)
        } else {
            self.send_directive(&directive, true, None).map(|_| ())
        }
    }

    pub fn keypad(&mut self, mut opt: KpadOption) -> Result<()> {
        let mut directive = format!("kpad --port {}", self.keyboard_port_flag);
        let fragment = opt.to_cli_fragment();
        if !fragment.is_empty() {
            directive.push(' ');
            directive.push_str(&fragment);
        }
        let result = if opt.is_async() {
            self.send_directive_async(&directive)
        } else {
            self.send_directive(&directive, true, None).map(|_| ())
        };
        if result.is_ok() {
            opt.commit_state();
        }
        result
    }

    pub fn send_parsed(
        &mut self,
        directive: &str,
        timeout: Option<Duration>,
    ) -> Result<ParsedOutput> {
        let parser = get_raw_directive_output_parser(directive)?;
        let raw = self.send_directive(directive, false, timeout)?;
        match parser.parse(directive, &raw) {
            Ok(parsed) => Ok(parsed),
            Err(error) => {
                let _ =
                    self.write_debug_capture("parse_failed", directive, &raw, None, Some(&error));
                Err(error)
            }
        }
    }

    pub fn snapshot_status(&self) -> SerialPortStatus {
        let state = self.state.lock().expect("sync state poisoned");
        SerialPortStatus {
            name: self.name.clone(),
            port_open: self.port.is_some(),
            read_closed: state.read_closed,
            read_loop_running: state.read_loop_running,
            sync_output_enabled: self.sync_output_enabled(),
            sync_output_timeout_ms: self.sync_output_timeout.as_millis() as u64,
            current_sync_directive: state.sync_directive.clone(),
            sync_output_ignored: state.sync_ignored,
            async_marked: false,
            last_read_at: state.last_read_at.clone(),
            last_read_error: state.last_read_error.clone(),
            last_read_error_at: state.last_read_error_at.clone(),
        }
    }
}

pub fn new_sf_serial_port() -> SFSerialPort {
    let mut sp = SFSerialPort::default();
    sp.name = "COM3".to_string();
    sp.vid = "1A86".to_string();
    sp.pid = "55D3".to_string();
    sp.serial_num = "5ABA089859".to_string();
    sp.product = "USB-Enhanced-SERIAL CH343 (COM3)".to_string();
    sp.is_usb = true;
    sp
}

pub fn check_sf_serial_port() -> Result<String> {
    for port in serialport::available_ports()? {
        if let SerialPortType::UsbPort(info) = port.port_type {
            if info.vid == 0x1A86 && info.pid == 0x55D3 {
                return Ok(port.port_name);
            }
        }
    }
    Err(MkpError::State(
        "failed to auto-detect SF serial port".to_string(),
    ))
}

pub fn compose_log_directory(log_dir: &str) -> String {
    if log_dir.starts_with("/eMMC/applog") {
        log_dir.to_string()
    } else {
        format!("/eMMC/applog/{log_dir}")
    }
}

pub fn compose_log_fullpath(log_path: &str) -> String {
    let mut log_path = log_path.to_string();
    if !log_path.ends_with(".log") {
        log_path.push_str(".log");
    }
    if log_path.starts_with("/eMMC/applog/") {
        log_path
    } else {
        format!("/eMMC/applog/{log_path}")
    }
}

fn require_sync(sfport: &SerialPort) -> Result<()> {
    if !sfport.sync_output_enabled() {
        return Err(MkpError::SyncOutputDisabled);
    }
    Ok(())
}

pub fn start_record(
    sfport: &mut SFSerialPort,
    log_name: &str,
    opt: Option<LogOption>,
) -> Result<()> {
    let mut args = vec![log_name.to_string()];
    if let Some(opt) = opt {
        args.extend(opt.cli_args());
    }
    sfport.start_recording(args.join(" ").trim())
}

pub fn stop_record(sfport: &mut SFSerialPort) -> Result<()> {
    sfport.stop_recording()
}

pub fn alog(
    sfport: &mut SFSerialPort,
    log_name: &str,
    opt: Option<LogOption>,
    timeout: Option<Duration>,
) -> Result<String> {
    require_sync(sfport)?;
    let mut args = vec![log_name.to_string()];
    if let Some(opt) = opt {
        args.extend(opt.cli_args());
    }
    sfport
        .send_parsed(&format!("alog {}", args.join(" ").trim()), timeout)?
        .into_text()
}

pub fn astop(sfport: &mut SFSerialPort, timeout: Option<Duration>) -> Result<String> {
    require_sync(sfport)?;
    sfport.send_parsed("astop", timeout)?.into_text()
}

pub fn cancel(sfport: &mut SFSerialPort, timeout: Option<Duration>) -> Result<ParsedOutput> {
    require_sync(sfport)?;
    sfport.send_parsed("acancel", timeout)
}

pub fn join(
    sfport: &mut SFSerialPort,
    opt: Option<JoinOption>,
    timeout: Option<Duration>,
) -> Result<String> {
    require_sync(sfport)?;
    let args = opt.map(|item| item.cli_args()).unwrap_or_default();
    let directive = if args.is_empty() {
        "join".to_string()
    } else {
        format!("join {}", args.join(" "))
    };
    sfport.send_parsed(&directive, timeout)?.into_text()
}

pub fn wifi_auto(
    sfport: &mut SFSerialPort,
    opt: Option<WifiAutoOption>,
    timeout: Option<Duration>,
) -> Result<String> {
    if let Some(ref opt) = opt {
        if !matches!(opt.state.as_str(), "" | "0" | "1") {
            return Err(MkpError::InvalidArgument(
                "wifi_auto state must be \"1\" or \"0\"".to_string(),
            ));
        }
    }
    require_sync(sfport)?;
    let args = opt.map(|item| item.cli_args()).unwrap_or_default();
    let directive = if args.is_empty() {
        "wifi_auto".to_string()
    } else {
        format!("wifi_auto {}", args.join(" "))
    };
    sfport.send_parsed(&directive, timeout)?.into_text()
}

pub fn device_sn(sfport: &mut SFSerialPort, timeout: Option<Duration>) -> Result<SN> {
    require_sync(sfport)?;
    sfport.send_parsed("sn", timeout)?.deserialize()
}

pub fn list_dir(
    sfport: &mut SFSerialPort,
    path: &str,
    timeout: Option<Duration>,
) -> Result<FileSystem> {
    require_sync(sfport)?;
    let fs: FileSystem = sfport
        .send_parsed(&format!("list_dir {path}"), timeout)?
        .deserialize()?;
    if let Some(error) = &fs.error {
        return Err(MkpError::State(error.clone()));
    }
    Ok(fs)
}

pub fn clean_dir(
    sfport: &mut SFSerialPort,
    path: &str,
    timeout: Option<Duration>,
) -> Result<String> {
    if !path.starts_with("/eMMC/applog") {
        return Err(MkpError::InvalidArgument(
            "only can clean directory in working directory".to_string(),
        ));
    }
    require_sync(sfport)?;
    sfport
        .send_parsed(&format!("clean_dir {path}"), timeout)?
        .into_text()
}

pub fn delete_file(
    sfport: &mut SFSerialPort,
    path: &str,
    timeout: Option<Duration>,
) -> Result<String> {
    let fullpath = compose_log_fullpath(path);
    if !fullpath.starts_with("/eMMC/applog") {
        return Err(MkpError::InvalidArgument(
            "only can delete file in working directory".to_string(),
        ));
    }
    require_sync(sfport)?;
    sfport
        .send_parsed(&format!("delete_file {fullpath}"), timeout)?
        .into_text()
}

pub fn alive(sfport: &mut SFSerialPort, timeout: Option<Duration>) -> Result<Heartbeat> {
    require_sync(sfport)?;
    sfport.send_parsed("alive", timeout)?.deserialize()
}

pub fn atime(
    sfport: &mut SFSerialPort,
    path: &str,
    timeout: Option<Duration>,
) -> Result<LogLength> {
    require_sync(sfport)?;
    sfport
        .send_parsed(&format!("atime {path}"), timeout)?
        .deserialize()
}

pub fn aversion(sfport: &mut SFSerialPort, timeout: Option<Duration>) -> Result<MKPVersion> {
    require_sync(sfport)?;
    sfport.send_parsed("aversion", timeout)?.deserialize()
}

pub fn aupload_to_mkp(
    sfport: &mut SFSerialPort,
    opt: AGetOption,
    timeout: Option<Duration>,
) -> Result<String> {
    if opt.filepath.is_empty() {
        return Err(MkpError::InvalidArgument(
            "aget file path is required".to_string(),
        ));
    }
    require_sync(sfport)?;
    sfport
        .send_parsed(&format!("aget {}", opt.cli_args().join(" ")), timeout)?
        .into_text()
}

pub fn adownload_from_mkp(
    sfport: &mut SFSerialPort,
    opt: APutOption,
    timeout: Option<Duration>,
) -> Result<String> {
    if opt.filepath.is_empty() {
        return Err(MkpError::InvalidArgument(
            "aput file path is required".to_string(),
        ));
    }
    require_sync(sfport)?;
    sfport
        .send_parsed(&format!("aput {}", opt.cli_args().join(" ")), timeout)?
        .into_text()
}

pub fn ajson2log(
    sfport: &mut SFSerialPort,
    opt: AJSON2LogOption,
    timeout: Option<Duration>,
) -> Result<String> {
    if opt.jsonpath.is_empty() {
        return Err(MkpError::InvalidArgument(
            "ajson2log json path is required".to_string(),
        ));
    }
    if opt.outputlogpath.is_empty() {
        return Err(MkpError::InvalidArgument(
            "ajson2log output log path is required".to_string(),
        ));
    }
    require_sync(sfport)?;
    sfport
        .send_parsed(&format!("ajson2log {}", opt.cli_args().join(" ")), timeout)?
        .into_text()
}

pub fn ahttpbase(
    sfport: &mut SFSerialPort,
    opt: Option<AHTTPBaseOption>,
    timeout: Option<Duration>,
) -> Result<AHTTPBase> {
    require_sync(sfport)?;
    let args = opt.map(|item| item.cli_args()).unwrap_or_default();
    let directive = if args.is_empty() {
        "ahttpbase".to_string()
    } else {
        format!("ahttpbase {}", args.join(" "))
    };
    sfport.send_parsed(&directive, timeout)?.deserialize()
}

pub fn adumj(
    sfport: &mut SFSerialPort,
    log_path: &str,
    timeout: Option<Duration>,
) -> Result<ActionDump> {
    if log_path.is_empty() {
        return Err(MkpError::InvalidArgument(
            "adumj log path is required".to_string(),
        ));
    }
    require_sync(sfport)?;
    sfport
        .send_parsed(&format!("adumj {log_path}"), timeout)?
        .deserialize()
}

pub fn ainspect(
    sfport: &mut SFSerialPort,
    path: &str,
    timeout: Option<Duration>,
) -> Result<LogInfo> {
    require_sync(sfport)?;
    sfport
        .send_parsed(&format!("ainsp {path}"), timeout)?
        .deserialize()
}

pub fn key_down(sfport: &mut SFSerialPort, key: &str, opt: Option<KpadOption>) -> Result<()> {
    let option = opt.unwrap_or_default().key_down(key);
    sfport.keypad(option)
}

pub fn key_up(sfport: &mut SFSerialPort, key: &str, opt: Option<KpadOption>) -> Result<()> {
    let option = opt.unwrap_or_default();
    let (release_opt, remain_opt) = option.key_up(key);
    if let Some(release_opt) = release_opt {
        sfport.keypad(release_opt)?;
    }
    if let Some(remain_opt) = remain_opt {
        sfport.keypad(remain_opt)?;
    }
    Ok(())
}

pub fn key_tap(sfport: &mut SFSerialPort, key: &str, opt: Option<KpadOption>) -> Result<()> {
    let option = opt.unwrap_or_default().key_down(key).with_auto_release();
    sfport.keypad(option)
}

pub fn key_presses(
    sfport: &mut SFSerialPort,
    keys: &[&str],
    sleep_ms: u64,
    opt: Option<KpadOption>,
) -> Result<()> {
    for key in keys {
        key_tap(sfport, key, opt.clone())?;
        if sleep_ms > 0 {
            thread::sleep(Duration::from_millis(sleep_ms));
        }
    }
    Ok(())
}

pub fn keypad_release(sfport: &mut SFSerialPort, opt: Option<KpadOption>) -> Result<()> {
    let option = opt.unwrap_or_default().with_delay(0).with_key("NONE");
    sfport.keypad(option)
}

pub fn keypad_release_all(sfport: &mut SFSerialPort, opt: Option<KpadOption>) -> Result<()> {
    let option = opt.unwrap_or_default().with_delay(0).with_release(0);
    sfport.keypad(option)?;
    reset_kpad_pressed_caches();
    Ok(())
}

pub fn mouse_release_all(sfport: &mut SFSerialPort, opt: Option<M10Option>) -> Result<()> {
    let mut release_opt = M10Option::default().set_button(0);
    if let Some(opt) = opt {
        release_opt.async_mode = opt.async_mode;
        release_opt.sync_ignore_output = opt.sync_ignore_output;
    }
    sfport.mouse10(release_opt)
}

#[cfg(test)]
mod tests {
    use super::{compose_log_directory, compose_log_fullpath};

    #[test]
    fn composes_log_directory() {
        assert_eq!(compose_log_directory("demo"), "/eMMC/applog/demo");
        assert_eq!(
            compose_log_directory("/eMMC/applog/demo"),
            "/eMMC/applog/demo"
        );
    }

    #[test]
    fn composes_log_fullpath() {
        assert_eq!(compose_log_fullpath("demo"), "/eMMC/applog/demo.log");
        assert_eq!(
            compose_log_fullpath("/eMMC/applog/demo.log"),
            "/eMMC/applog/demo.log"
        );
    }
}
