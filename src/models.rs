use crate::keycodes::{
    MOD_KEY_NAMES, expand_kpad_input_key, is_mod_key, key_name_to_hexcode, mod_status,
    normalize_kpad_key, split_keys,
};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::sync::Mutex;

static PRESSED_MOD_KEYS: Lazy<Mutex<Vec<String>>> = Lazy::new(|| Mutex::new(Vec::new()));
static PRESSED_KEYS: Lazy<Mutex<Vec<String>>> = Lazy::new(|| Mutex::new(Vec::new()));

fn append_once(items: &mut Vec<String>, value: &str) {
    if !items.iter().any(|item| item == value) {
        items.push(value.to_string());
    }
}

fn remove_once(items: &mut Vec<String>, value: &str) {
    if let Some(index) = items.iter().position(|item| item == value) {
        items.remove(index);
    }
}

fn empty_keys() -> [String; 6] {
    std::array::from_fn(|_| String::new())
}

pub fn reset_kpad_pressed_caches() {
    PRESSED_MOD_KEYS.lock().expect("mod cache poisoned").clear();
    PRESSED_KEYS.lock().expect("key cache poisoned").clear();
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct SN {
    #[serde(default)]
    pub sn: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileNode {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub path: String,
    #[serde(default)]
    pub r#type: String,
    #[serde(default)]
    pub size: i64,
    #[serde(default, rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(default)]
    pub contents: Vec<FileNode>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct FileSystem {
    #[serde(default, rename = "rootDir")]
    pub root_dir: Option<FileNode>,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct Heartbeat {
    #[serde(default)]
    pub timetamp: i64,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct StPos {
    #[serde(default)]
    pub x: i32,
    #[serde(default)]
    pub y: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LogOption {
    #[serde(default)]
    pub width: i32,
    #[serde(default, rename = "heigh")]
    pub height: i32,
    #[serde(default)]
    pub stposx: i32,
    #[serde(default)]
    pub stposy: i32,
}

impl Default for LogOption {
    fn default() -> Self {
        Self {
            width: 0,
            height: 0,
            stposx: -1,
            stposy: -1,
        }
    }
}

impl LogOption {
    pub fn cli_args(&self) -> Vec<String> {
        let mut args = Vec::new();
        if self.width > 0 {
            args.extend(["--width".to_string(), self.width.to_string()]);
        }
        if self.height > 0 {
            args.extend(["--heigh".to_string(), self.height.to_string()]);
        }
        if self.stposx > -1 {
            args.extend(["--stposx".to_string(), self.stposx.to_string()]);
        }
        if self.stposy > -1 {
            args.extend(["--stposy".to_string(), self.stposy.to_string()]);
        }
        args
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct JoinOption {
    #[serde(default)]
    pub ssid: String,
    #[serde(default)]
    pub password: String,
}

impl JoinOption {
    pub fn cli_args(&self) -> Vec<String> {
        let mut args = Vec::new();
        if !self.ssid.is_empty() {
            args.push(self.ssid.clone());
        }
        if !self.password.is_empty() {
            args.push(self.password.clone());
        }
        args
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct WifiAutoOption {
    #[serde(default)]
    pub state: String,
}

impl WifiAutoOption {
    pub fn cli_args(&self) -> Vec<String> {
        if self.state.is_empty() {
            Vec::new()
        } else {
            vec![self.state.clone()]
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct AGetOption {
    #[serde(default)]
    pub filepath: String,
}

impl AGetOption {
    pub fn cli_args(&self) -> Vec<String> {
        if self.filepath.is_empty() {
            Vec::new()
        } else {
            vec![self.filepath.clone()]
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct APutOption {
    #[serde(default)]
    pub filepath: String,
}

impl APutOption {
    pub fn cli_args(&self) -> Vec<String> {
        if self.filepath.is_empty() {
            Vec::new()
        } else {
            vec![self.filepath.clone()]
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct AJSON2LogOption {
    #[serde(default)]
    pub jsonpath: String,
    #[serde(default)]
    pub outputlogpath: String,
}

impl AJSON2LogOption {
    pub fn cli_args(&self) -> Vec<String> {
        if self.jsonpath.is_empty() {
            return Vec::new();
        }
        let mut args = vec![self.jsonpath.clone()];
        if !self.outputlogpath.is_empty() {
            args.extend(["-o".to_string(), self.outputlogpath.clone()]);
        }
        args
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct AHTTPBaseOption {
    #[serde(default)]
    pub url: String,
}

impl AHTTPBaseOption {
    pub fn cli_args(&self) -> Vec<String> {
        if self.url.is_empty() {
            Vec::new()
        } else {
            vec![self.url.clone()]
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct AHTTPBase {
    #[serde(default)]
    pub ahttpbase: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct AdumjOption {
    #[serde(default, rename = "logPath")]
    pub log_path: String,
}

impl AdumjOption {
    pub fn cli_args(&self) -> Vec<String> {
        if self.log_path.is_empty() {
            Vec::new()
        } else {
            vec![self.log_path.clone()]
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct ActionDumpMeta {
    #[serde(default)]
    pub width: i32,
    #[serde(default)]
    pub height: i32,
    #[serde(default, rename = "startX")]
    pub start_x: i32,
    #[serde(default, rename = "startY")]
    pub start_y: i32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct ActionDump {
    #[serde(default)]
    pub format: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub meta: ActionDumpMeta,
    #[serde(default)]
    pub events: Vec<Map<String, Value>>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct LogLength {
    #[serde(default)]
    pub seconds: i32,
    #[serde(default, rename = "milsec")]
    pub milsec: i32,
}

impl LogLength {
    pub fn milliseconds(&self) -> i32 {
        self.milsec
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct LogInfo {
    #[serde(default)]
    pub seconds: i32,
    #[serde(default, rename = "milsec")]
    pub milsec: i32,
    #[serde(default)]
    pub width: i32,
    #[serde(default, rename = "heigh")]
    pub heigh: i32,
    #[serde(default)]
    pub stpos: Option<StPos>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct MKPVersion {
    #[serde(default)]
    pub uver: String,
    #[serde(default)]
    pub aver: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct M10Option {
    #[serde(default)]
    pub button: Option<i32>,
    #[serde(default)]
    pub x: Option<i32>,
    #[serde(default)]
    pub y: Option<i32>,
    #[serde(default)]
    pub wheel: Option<i32>,
    #[serde(default = "default_true", rename = "async_mode")]
    pub async_mode: bool,
    #[serde(default)]
    pub sync_ignore_output: bool,
}

fn default_true() -> bool {
    true
}

impl Default for M10Option {
    fn default() -> Self {
        Self {
            button: None,
            x: None,
            y: None,
            wheel: None,
            async_mode: true,
            sync_ignore_output: false,
        }
    }
}

impl M10Option {
    pub fn reset(mut self) -> Self {
        self.button = None;
        self.x = None;
        self.y = None;
        self.wheel = None;
        self
    }

    pub fn set_button(mut self, value: i32) -> Self {
        self.button = Some(value);
        self
    }
    pub fn with_button(self, value: i32) -> Self {
        self.set_button(value)
    }
    pub fn without_button(mut self) -> Self {
        self.button = None;
        self
    }
    pub fn with_left_button(self) -> Self {
        self.set_button(1)
    }
    pub fn with_right_button(self) -> Self {
        self.set_button(2)
    }
    pub fn with_both_left_right_button(self) -> Self {
        self.set_button(3)
    }
    pub fn with_middle_button(self) -> Self {
        self.set_button(4)
    }
    pub fn with_back_button(self) -> Self {
        self.set_button(8)
    }
    pub fn with_forward_button(self) -> Self {
        self.set_button(16)
    }
    pub fn set_x(mut self, value: i32) -> Self {
        self.x = Some(value);
        self
    }
    pub fn set_y(mut self, value: i32) -> Self {
        self.y = Some(value);
        self
    }
    pub fn set_wheel(mut self, value: i32) -> Self {
        self.wheel = Some(value);
        self
    }

    pub fn with_async(mut self, async_mode: bool) -> Self {
        self.async_mode = async_mode;
        self.sync_ignore_output = !async_mode;
        self
    }

    pub fn with_sync_ignore_output(mut self, sync_ignore_output: bool) -> Self {
        self.sync_ignore_output = sync_ignore_output;
        self.async_mode = !sync_ignore_output;
        self
    }

    pub fn is_async(&self) -> bool {
        self.async_mode && !self.sync_ignore_output
    }

    pub fn is_sync_ignore_output(&self) -> bool {
        self.sync_ignore_output || !self.async_mode
    }

    pub fn to_cli_fragment(&self) -> String {
        let mut args = Vec::new();
        if let Some(value) = self.button {
            args.extend(["--b".to_string(), value.to_string()]);
        }
        if let Some(value) = self.x {
            args.extend(["--x".to_string(), value.to_string()]);
        }
        if let Some(value) = self.y {
            args.extend(["--y".to_string(), value.to_string()]);
        }
        if let Some(value) = self.wheel {
            args.extend(["--w".to_string(), value.to_string()]);
        }
        args.join(" ")
    }
}

pub fn mouse_button_mask(name: &str) -> i32 {
    match name.trim().to_ascii_lowercase().as_str() {
        "left" => 1,
        "right" => 2,
        "both" => 3,
        "middle" => 4,
        "backword" | "backward" => 8,
        "forword" | "forward" => 16,
        _ => 0,
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct MouseMoveOffset {
    #[serde(default)]
    pub x: i32,
    #[serde(default)]
    pub y: i32,
    #[serde(default)]
    pub wheel: Option<i32>,
    #[serde(default)]
    pub button: Option<i32>,
    #[serde(default)]
    pub pause: Option<i32>,
}

impl MouseMoveOffset {
    pub fn new(x: i32, y: i32) -> Self {
        Self {
            x,
            y,
            wheel: None,
            button: None,
            pause: None,
        }
    }

    pub fn with_wheel(mut self, wheel: i32) -> Self {
        self.wheel = Some(wheel);
        self
    }

    pub fn without_wheel(mut self) -> Self {
        self.wheel = None;
        self
    }

    pub fn with_pause(mut self, pause_ms: i32) -> Self {
        self.pause = Some(pause_ms);
        self
    }

    pub fn without_pause(mut self) -> Self {
        self.pause = None;
        self
    }

    pub fn with_button(mut self, button: &str) -> Self {
        self.button = Some(mouse_button_mask(button));
        self
    }

    pub fn with_button_mask(mut self, button: i32) -> Self {
        self.button = Some(button);
        self
    }

    pub fn without_button(mut self) -> Self {
        self.button = Some(0);
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct KpadOption {
    #[serde(default)]
    pub mod_keys: Vec<String>,
    #[serde(default = "empty_keys")]
    pub keys: [String; 6],
    #[serde(default)]
    pub release: i32,
    #[serde(default)]
    pub delay: i32,
    #[serde(default)]
    pub verbose: bool,
    #[serde(default = "default_true", rename = "async_mode")]
    pub async_mode: bool,
    #[serde(default)]
    pub sync_ignore_output: bool,
    #[serde(skip)]
    commit_keys: Option<(Vec<String>, bool)>,
}

impl Default for KpadOption {
    fn default() -> Self {
        Self {
            mod_keys: Vec::new(),
            keys: empty_keys(),
            release: 0,
            delay: 0,
            verbose: false,
            async_mode: true,
            sync_ignore_output: false,
            commit_keys: None,
        }
    }
}

impl KpadOption {
    pub fn to_cli_fragment(&self) -> String {
        let mut args = Vec::new();
        let status = mod_status(&self.mod_keys);
        if !status.is_empty() {
            args.extend(["--s".to_string(), status]);
        }
        for (idx, key) in self.keys.iter().enumerate() {
            if key.is_empty() {
                continue;
            }
            if let Some(code) = key_name_to_hexcode(key) {
                args.extend([format!("--x{}", idx + 1), code]);
            }
        }
        args.extend([
            "--rel".to_string(),
            self.release.to_string(),
            "--d".to_string(),
            self.delay.to_string(),
        ]);
        if self.verbose {
            args.extend(["--v".to_string(), "1".to_string()]);
        }
        args.join(" ")
    }

    pub fn with_keys(mut self, keys: Vec<String>) -> Self {
        let normalized: Vec<String> = keys
            .into_iter()
            .map(|key| normalize_kpad_key(&key))
            .filter(|key| !key.is_empty())
            .collect();
        let (mod_keys, normal_keys) = split_keys(&normalized);
        self.mod_keys = mod_keys;
        self.keys = empty_keys();
        for (index, key) in normal_keys.into_iter().take(6).enumerate() {
            self.keys[index] = key;
        }
        self
    }

    pub fn with_delay(mut self, delay: i32) -> Self {
        self.delay = delay;
        self
    }
    pub fn with_release(mut self, release: i32) -> Self {
        self.release = release;
        self
    }
    pub fn with_hold(mut self) -> Self {
        self.release = 0;
        self
    }
    pub fn with_auto_release(mut self) -> Self {
        self.release = 1;
        self
    }
    pub fn with_duration(mut self, duration: i32) -> Self {
        if duration > 1 {
            self.release = duration;
        }
        self
    }
    pub fn with_verbose(mut self, verbose: bool) -> Self {
        self.verbose = verbose;
        self
    }

    pub fn with_async(mut self, async_mode: bool) -> Self {
        self.async_mode = async_mode;
        self.sync_ignore_output = !async_mode;
        self
    }

    pub fn with_sync_ignore_output(mut self, sync_ignore_output: bool) -> Self {
        self.sync_ignore_output = sync_ignore_output;
        self.async_mode = !sync_ignore_output;
        self
    }

    pub fn is_async(&self) -> bool {
        self.async_mode && !self.sync_ignore_output
    }

    pub fn is_sync_ignore_output(&self) -> bool {
        self.sync_ignore_output || !self.async_mode
    }

    pub fn with_mod_keys(mut self, mod_keys: Vec<String>) -> Self {
        self.mod_keys = mod_keys;
        self
    }

    pub fn with_key(mut self, key: &str) -> Self {
        self.keys = empty_keys();
        self.keys[0] = normalize_kpad_key(key);
        self
    }

    pub fn key_down(mut self, key: &str) -> Self {
        let commit_keys = expand_kpad_input_key(key);
        if commit_keys.is_empty() {
            return self;
        }
        let mut next_mod = PRESSED_MOD_KEYS.lock().expect("mod cache poisoned").clone();
        let mut next_keys = PRESSED_KEYS.lock().expect("key cache poisoned").clone();
        for item in &commit_keys {
            if is_mod_key(item) {
                append_once(&mut next_mod, item);
            } else {
                append_once(&mut next_keys, item);
            }
        }
        self = self
            .with_keys(next_mod.iter().chain(next_keys.iter()).cloned().collect())
            .with_mod_keys(next_mod)
            .with_hold();
        self.commit_keys = Some((commit_keys, true));
        self
    }

    pub fn key_up(self, key: &str) -> (Option<Self>, Option<Self>) {
        let release_keys = expand_kpad_input_key(key);
        if release_keys.is_empty() {
            return (None, None);
        }
        let release_mod = PRESSED_MOD_KEYS.lock().expect("mod cache poisoned").clone();
        let mut next_mod = release_mod.clone();
        let mut next_keys = PRESSED_KEYS.lock().expect("key cache poisoned").clone();
        for item in &release_keys {
            if MOD_KEY_NAMES.contains(&item.as_str()) {
                remove_once(&mut next_mod, item);
            } else {
                remove_once(&mut next_keys, item);
            }
        }
        let mut release_opt = KpadOption::default()
            .with_delay(self.delay)
            .with_verbose(self.verbose)
            .with_async(self.async_mode)
            .with_keys(release_keys.clone())
            .with_auto_release();
        release_opt.sync_ignore_output = self.sync_ignore_output;
        if release_keys
            .iter()
            .any(|item| MOD_KEY_NAMES.contains(&item.as_str()))
        {
            release_opt = release_opt.with_mod_keys(release_mod);
        }

        let mut remain_opt = KpadOption::default()
            .with_delay(self.delay)
            .with_verbose(self.verbose)
            .with_async(self.async_mode);
        remain_opt.sync_ignore_output = self.sync_ignore_output;
        let remain: Vec<String> = next_mod.iter().chain(next_keys.iter()).cloned().collect();
        if remain.is_empty() {
            remain_opt = remain_opt.with_key("NONE").with_hold();
        } else {
            remain_opt = remain_opt.with_keys(remain);
            if release_keys
                .iter()
                .any(|item| MOD_KEY_NAMES.contains(&item.as_str()))
            {
                remain_opt = remain_opt.with_mod_keys(next_mod);
            }
        }
        remain_opt.commit_keys = Some((release_keys, false));
        (Some(release_opt), Some(remain_opt))
    }

    pub fn commit_state(&mut self) {
        let Some((commit_keys, is_down)) = self.commit_keys.take() else {
            return;
        };
        let mut mod_keys = PRESSED_MOD_KEYS.lock().expect("mod cache poisoned");
        let mut keys = PRESSED_KEYS.lock().expect("key cache poisoned");
        for item in commit_keys {
            if is_mod_key(&item) {
                if is_down {
                    append_once(&mut mod_keys, &item);
                } else {
                    remove_once(&mut mod_keys, &item);
                }
            } else if is_down {
                append_once(&mut keys, &item);
            } else {
                remove_once(&mut keys, &item);
            }
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct SerialPortStatus {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub port_open: bool,
    #[serde(default)]
    pub read_closed: bool,
    #[serde(default)]
    pub read_loop_running: bool,
    #[serde(default)]
    pub sync_output_enabled: bool,
    #[serde(default)]
    pub sync_output_timeout_ms: u64,
    #[serde(default)]
    pub current_sync_directive: String,
    #[serde(default)]
    pub sync_output_ignored: bool,
    #[serde(default)]
    pub async_marked: bool,
    #[serde(default)]
    pub last_read_at: Option<String>,
    #[serde(default)]
    pub last_read_error: Option<String>,
    #[serde(default)]
    pub last_read_error_at: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::{KpadOption, LogOption, M10Option, reset_kpad_pressed_caches};

    #[test]
    fn log_option_formats_cli() {
        let option = LogOption {
            width: 1920,
            height: 1080,
            stposx: 10,
            stposy: 20,
        };
        assert_eq!(
            option.cli_args(),
            vec![
                "--width", "1920", "--heigh", "1080", "--stposx", "10", "--stposy", "20"
            ]
        );
    }

    #[test]
    fn m10_option_formats_cli() {
        let option = M10Option::default()
            .set_x(-400)
            .set_y(50)
            .with_left_button();
        assert_eq!(option.to_cli_fragment(), "--b 1 --x -400 --y 50");
    }

    #[test]
    fn kpad_option_formats_cli() {
        let option = KpadOption::default()
            .with_keys(vec!["MOD_LSHIFT".into(), "H".into()])
            .with_auto_release();
        assert_eq!(option.to_cli_fragment(), "--s 0x02 --x1 0x0b --rel 1 --d 0");
    }

    #[test]
    fn key_state_roundtrip() {
        reset_kpad_pressed_caches();
        let down = KpadOption::default().key_down("A");
        let (_release, remain) = KpadOption::default().key_up("A");
        assert!(down.commit_keys.is_some());
        assert!(remain.is_some());
    }
}
