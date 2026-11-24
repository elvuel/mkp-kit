from __future__ import annotations

import ctypes
import json
import os
import queue
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import serial
from serial.tools import list_ports

from .models import (
    AGetOption,
    AHTTPBase,
    AHTTPBaseOption,
    AJSON2LogOption,
    APutOption,
    ActionDump,
    FileNode,
    FileSystem,
    Heartbeat,
    JoinOption,
    KpadOption,
    LogInfo,
    LogLength,
    LogOption,
    M10Option,
    MKPVersion,
    SN,
    SerialPortStatus,
    WifiAutoOption,
    reset_kpad_pressed_caches,
)
from .parser import EOF_CLI, EOF_DEFAULT, ErrDirectiveParserMissing, get_raw_directive_output_parser, init_parsers


class DirectiveTimeoutError(TimeoutError):
    pass


def _extract_sync_output(buffer: str, directive: str, eof_flag: str) -> tuple[str | None, str]:
    hit_idx = buffer.find(directive)
    if hit_idx < 0:
        return None, buffer

    segment = buffer[hit_idx:]
    if eof_flag == EOF_CLI:
        output_completed_idx = segment.find(EOF_CLI)
    else:
        candidates = [idx for idx in (segment.find(EOF_DEFAULT), segment.find(EOF_CLI)) if idx >= 0]
        output_completed_idx = min(candidates) if candidates else -1

    if output_completed_idx < 0:
        return None, buffer

    return segment[:output_completed_idx], ""


def _directive_slug(directive: str) -> str:
    slug = "".join(ch if ch.isalnum() else "_" for ch in directive).strip("_")
    return (slug or "directive")[:64]


def _append_exception_note(exc: BaseException, note: str) -> None:
    add_note = getattr(exc, "add_note", None)
    if callable(add_note):
        add_note(note)


def _preview_text(data: str, max_lines: int = 3, max_chars: int = 180) -> str:
    parts = [line.strip() for line in data.replace("\r", "").splitlines() if line.strip()]
    preview = " | ".join(parts[:max_lines])
    return preview if len(preview) <= max_chars else preview[: max_chars - 3] + "..."


def _summarize_debug_capture(
    kind: str,
    directive: str,
    raw_output: str = "",
    *,
    parsed_output: str | None = None,
    error: BaseException | None = None,
    pending_buffer: str = "",
    last_sync_directive: str = "",
    last_sync_output: str = "",
) -> list[str]:
    combined = raw_output or pending_buffer
    saw_echo = directive in combined
    saw_eof = EOF_DEFAULT in combined or EOF_CLI in combined
    reply_preview = _preview_text(combined or last_sync_output)
    if kind == "timeout":
        if not saw_echo:
            stage = "timed out before current directive echo appeared"
            hint = "device likely only returned a stale prompt/noise, or did not answer this directive"
        elif not saw_eof:
            stage = "timed out after directive echo but before EOF marker"
            hint = "device started replying, but the completion marker never arrived"
        else:
            stage = "timed out even though output looked partially complete"
            hint = "check for mismatched parser EOF mode or truncated serial reads"
    elif error is not None and isinstance(error, json.JSONDecodeError):
        if not parsed_output:
            stage = "parser produced an empty payload before JSON decode"
            hint = "device replied, but no JSON line/blob survived parser extraction"
        else:
            stage = "JSON decode failed on parsed payload"
            hint = "device reply reached parser, but resulting payload was not valid JSON"
    elif error is not None and type(error).__name__ == "ErrRawDirectiveExecutionFailed":
        stage = "device reported directive execution failure"
        hint = "check the raw output for firmware-side error lines or HTTP/status failures"
    elif error is not None and type(error).__name__ == "ErrRawDirectiveParseFailed":
        if not saw_echo:
            stage = "parser never saw the current directive echo"
            hint = "serial stream likely contained stale prompt/noise instead of the requested reply"
        else:
            stage = "parser could not extract the expected payload"
            hint = "device replied, but output format differed from the expected directive parser"
    else:
        stage = f"{kind} while handling parsed directive output"
        hint = "inspect the raw output and pending buffer for unexpected device behavior"

    summary = [f"- stage: {stage}"]
    if reply_preview:
        summary.append(f"- device_reply: {reply_preview}")
    if pending_buffer and pending_buffer != raw_output:
        summary.append(f"- pending_buffer: {_preview_text(pending_buffer)}")
    if last_sync_output and last_sync_directive and last_sync_directive != directive:
        summary.append(f"- previous_sync: {last_sync_directive} -> {_preview_text(last_sync_output)}")
    summary.append(f"- hint: {hint}")
    return summary


def _summary_note(summary_lines: list[str]) -> str:
    cleaned = [line[2:] if line.startswith("- ") else line for line in summary_lines[:3]]
    return "; ".join(cleaned)


class SerialPort:
    def __init__(self) -> None:
        self.name = ""
        self.vid = ""
        self.pid = ""
        self.serial_num = ""
        self.product = ""
        self.is_usb = False
        self.mouse_port_flag = "1"
        self.keyboard_port_flag = "2"
        self.verbose = False
        self.verbose_directive = False
        self.sync_output_enabled = True
        self.sync_output_timeout = 15.0
        self._port: serial.Serial | None = None
        self._lock = threading.RLock()
        self._directive_lock = threading.RLock()
        self._state_lock = threading.RLock()
        self._sync_directive = ""
        self._sync_ignored = False
        self._sync_reply: queue.Queue[str] | None = None
        self._reader_thread: threading.Thread | None = None
        self._reader_stop = threading.Event()
        self._read_buffer = ""
        self._read_closed = False
        self._read_loop_running = False
        self._last_read_at: datetime | None = None
        self._last_read_error: str | None = None
        self._last_read_error_at: datetime | None = None
        self._last_sync_output = ""
        self._last_sync_directive = ""
        self._last_sync_output_at: datetime | None = None

    def open(self) -> None:
        with self._lock:
            if self._port is not None:
                return
            self._port = serial.Serial(self.name, 115200, timeout=0.2)
            self._read_closed = False
        self.empty_sync_directive()
        self._read_buffer = ""
        self.reset_input_buffer()

    def reset_input_buffer(self) -> None:
        with self._lock:
            port = self._port
        if port is not None:
            reset = getattr(port, "reset_input_buffer", None)
            if callable(reset):
                reset()
            else:
                flush_input = getattr(port, "flushInput", None)
                if callable(flush_input):
                    flush_input()
        self._read_buffer = ""

    def _record_sync_output(self, directive: str, output: str) -> None:
        self._last_sync_directive = directive
        self._last_sync_output = output
        self._last_sync_output_at = datetime.now(timezone.utc)

    def _write_debug_capture(self, kind: str, directive: str, raw_output: str = "", *, parsed_output: str | None = None, error: BaseException | None = None) -> str | None:
        try:
            root = Path(os.getenv("MKP_DEBUG_SERIAL_DIR") or ".mkp-debug")
            root.mkdir(parents=True, exist_ok=True)
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S_%fZ")
            path = root / f"{stamp}_{kind}_{_directive_slug(directive)}.log"
            summary_lines = _summarize_debug_capture(
                kind,
                directive,
                raw_output,
                parsed_output=parsed_output,
                error=error,
                pending_buffer=self._read_buffer,
                last_sync_directive=self._last_sync_directive,
                last_sync_output=self._last_sync_output,
            )
            lines = [
                f"time: {datetime.now(timezone.utc).isoformat()}",
                f"kind: {kind}",
                f"port: {self.name}",
                f"directive: {directive}",
                f"last_sync_directive: {self._last_sync_directive}",
                f"last_sync_output_at: {self._last_sync_output_at.isoformat() if self._last_sync_output_at else ''}",
                f"last_read_at: {self._last_read_at.isoformat() if self._last_read_at else ''}",
                f"last_read_error: {self._last_read_error or ''}",
                f"last_read_error_at: {self._last_read_error_at.isoformat() if self._last_read_error_at else ''}",
                "",
                "[summary]",
                *summary_lines,
                "",
                "[raw_output]",
                raw_output,
            ]
            if parsed_output is not None:
                lines += ["", "[parsed_output]", parsed_output]
            if self._read_buffer:
                lines += ["", "[pending_read_buffer]", self._read_buffer]
            if self._last_sync_output:
                lines += ["", "[last_sync_output]", self._last_sync_output]
            if error is not None:
                lines += ["", "[error]", f"{type(error).__name__}: {error}"]
            path.write_text("\n".join(lines), encoding="utf-8")
            return str(path)
        except Exception:
            return None

    def close(self) -> None:
        self._reader_stop.set()
        with self._lock:
            if self._port is not None:
                self._port.close()
            self._port = None
            self._read_closed = True
        self.empty_sync_directive()

    def start_read_loop(self) -> None:
        if self._reader_thread and self._reader_thread.is_alive():
            return
        self._reader_stop.clear()
        self._reader_thread = threading.Thread(target=self._read_loop, name="mkp-reader", daemon=True)
        self._reader_thread.start()

    def _read_loop(self) -> None:
        self._read_loop_running = True
        try:
            while not self._reader_stop.is_set():
                with self._lock:
                    port = self._port
                if port is None:
                    break
                try:
                    raw = port.read(port.in_waiting or 1)
                except Exception as exc:  # noqa: BLE001
                    self._last_read_error = str(exc)
                    self._last_read_error_at = datetime.now(timezone.utc)
                    self._read_closed = True
                    break
                if not raw:
                    continue
                self._last_read_at = datetime.now(timezone.utc)
                self._last_read_error = None
                self._last_read_error_at = None
                self._read_buffer += raw.decode("utf-8", errors="ignore")
                directive, ignored, reply = self.get_sync_directive_state()
                if not self.sync_output_enabled or not directive or reply is None:
                    continue
                try:
                    parser = get_raw_directive_output_parser(directive)
                    eof_flag = parser.eof_flag
                except ErrDirectiveParserMissing:
                    eof_flag = EOF_CLI
                output, remaining = _extract_sync_output(self._read_buffer, directive, eof_flag)
                if output is None:
                    continue
                self._read_buffer = remaining
                self._record_sync_output(directive, output)
                self.empty_sync_directive()
                reply.put("" if ignored else output)
        finally:
            self._read_loop_running = False

    def write(self, data: bytes) -> None:
        with self._lock:
            if self._port is None:
                raise RuntimeError(f"serial port {self.name} is not open")
            self._port.write(data)

    def set_sync_directive(self, directive: str, ignored: bool, reply: queue.Queue[str] | None) -> None:
        with self._state_lock:
            self._sync_directive = directive
            self._sync_ignored = ignored
            self._sync_reply = reply

    def get_sync_directive_state(self) -> tuple[str, bool, queue.Queue[str] | None]:
        with self._state_lock:
            return self._sync_directive, self._sync_ignored, self._sync_reply

    def empty_sync_directive(self) -> None:
        self.set_sync_directive("", False, None)

    def send_directive(self, directive: str, ignore_output: bool = False, timeout: float | None = None) -> str:
        if not timeout or timeout <= 0:
            timeout = self.sync_output_timeout
        with self._directive_lock:
            if self.sync_output_enabled:
                reply: queue.Queue[str] = queue.Queue(maxsize=1)
                sync_directive = "alog" if directive.startswith("alog") else directive
                self.set_sync_directive(sync_directive, ignore_output, reply)
                self.write((directive + "\r\n").encode())
                try:
                    return reply.get(timeout=timeout)
                except queue.Empty as exc:
                    self.empty_sync_directive()
                    err = DirectiveTimeoutError(f"timeout waiting for sync output: {directive}")
                    debug_path = self._write_debug_capture("timeout", directive, self._read_buffer, error=err)
                    if debug_path:
                        summary = _summary_note(
                            _summarize_debug_capture(
                                "timeout",
                                directive,
                                self._read_buffer,
                                error=err,
                                pending_buffer=self._read_buffer,
                                last_sync_directive=self._last_sync_directive,
                                last_sync_output=self._last_sync_output,
                            )
                        )
                        _append_exception_note(err, f"serial summary: {summary}")
                        _append_exception_note(err, f"serial debug saved to {debug_path}")
                    raise err from exc
            self.write((directive + "\r\n").encode())
            return ""

    def send_directive_async(self, directive: str) -> None:
        self.write((directive + "\r\n").encode())

    def start_recording(self, args: str) -> None:
        self.send_directive_async(f"alog {args}".strip())

    def start_replaying(self, log_name: str, delay: int) -> None:
        self.send_directive_async(f"aplay {log_name} --delay {delay}")

    def stop_recording(self) -> None:
        self.send_parsed("astop")

    def cancel_replay(self) -> None:
        self.send_parsed("acancel")

    def mouse10(self, opt: M10Option) -> None:
        directive = f"m10 --port {self.mouse_port_flag}"
        fragment = opt.to_cli_fragment().strip()
        if fragment:
            directive += " " + fragment
        if opt.is_async():
            self.send_directive_async(directive)
        else:
            self.send_directive(directive, ignore_output=True, timeout=opt.sync_output_timeout)

    def keypad(self, opt: KpadOption) -> None:
        directive = f"kpad --port {self.keyboard_port_flag}"
        fragment = opt.to_cli_fragment().strip()
        if fragment:
            directive += " " + fragment
        if opt.is_async():
            self.send_directive_async(directive)
        else:
            self.send_directive(directive, ignore_output=True, timeout=opt.sync_output_timeout)
        opt.commit_state()

    def send_parsed(self, directive: str, timeout: float | None = None) -> Any:
        parser = get_raw_directive_output_parser(directive)
        raw = self.send_directive(directive, timeout=timeout)
        parsed = None
        try:
            parsed = parser.parse(directive, raw)
            return parser.unmarshal_to(parsed) if parser.json_output else parsed
        except Exception as exc:
            debug_path = self._write_debug_capture("parse_failed", directive, raw, parsed_output=parsed, error=exc)
            if debug_path:
                summary = _summary_note(
                    _summarize_debug_capture(
                        "parse_failed",
                        directive,
                        raw,
                        parsed_output=parsed,
                        error=exc,
                        pending_buffer=self._read_buffer,
                        last_sync_directive=self._last_sync_directive,
                        last_sync_output=self._last_sync_output,
                    )
                )
                _append_exception_note(exc, f"serial summary: {summary}")
                _append_exception_note(exc, f"serial debug saved to {debug_path}")
            raise

    def snapshot_status(self) -> SerialPortStatus:
        return SerialPortStatus(
            name=self.name,
            port_open=self._port is not None,
            read_closed=self._read_closed,
            read_loop_running=self._read_loop_running,
            sync_output_enabled=self.sync_output_enabled,
            sync_output_timeout_ms=int(self.sync_output_timeout * 1000),
            current_sync_directive=self._sync_directive,
            sync_output_ignored=self._sync_ignored,
            async_marked=False,
            last_read_at=self._last_read_at.isoformat() if self._last_read_at else None,
            last_read_error=self._last_read_error,
            last_read_error_at=self._last_read_error_at.isoformat() if self._last_read_error_at else None,
        )


SFSerialPort = SerialPort


def new_sf_serial_port() -> SFSerialPort:
    init_parsers()
    sp = SFSerialPort()
    sp.name = "COM3"
    sp.vid = "1A86"
    sp.pid = "55D3"
    sp.serial_num = "5ABA089859"
    sp.product = "USB-Enhanced-SERIAL CH343 (COM3)"
    sp.is_usb = True
    return sp


def check_sf_serial_port() -> str:
    for port in list_ports.comports():
        vid = f"{port.vid:04X}" if port.vid is not None else ""
        pid = f"{port.pid:04X}" if port.pid is not None else ""
        if vid == "1A86" and pid == "55D3":
            return port.device
    raise RuntimeError("failed to auto-detect SF serial port")


def compose_log_directory(log_dir: str) -> str:
    return log_dir if log_dir.startswith("/eMMC/applog") else f"/eMMC/applog/{log_dir}"


def compose_log_fullpath(log_path: str) -> str:
    if not log_path.endswith(".log"):
        log_path += ".log"
    return log_path if log_path.startswith("/eMMC/applog/") else f"/eMMC/applog/{log_path}"


def _to_file_node(payload: dict[str, Any]) -> FileNode:
    return FileNode(
        name=payload.get("name", ""),
        path=payload.get("path", ""),
        type=payload.get("type", ""),
        size=payload.get("size", 0),
        displayName=payload.get("displayName"),
        contents=[_to_file_node(item) for item in payload.get("contents", [])],
    )


def _require_sync(sfport: SFSerialPort) -> None:
    if not sfport.sync_output_enabled:
        raise RuntimeError("please enable sync mode first")


def start_record(sfport: SFSerialPort, log_name: str, opt: LogOption | None = None) -> None:
    args = [log_name, *(opt.cli_args() if opt else [])]
    sfport.start_recording(" ".join(args).strip())


def stop_record(sfport: SFSerialPort) -> None:
    sfport.stop_recording()


def alog(sfport: SFSerialPort, log_name: str, opt: LogOption | None = None, timeout: float | None = None) -> str:
    _require_sync(sfport)
    args = [log_name, *(opt.cli_args() if opt else [])]
    return sfport.send_parsed("alog " + " ".join(args).strip(), timeout=timeout)


def astop(sfport: SFSerialPort, timeout: float | None = None) -> str:
    _require_sync(sfport)
    return sfport.send_parsed("astop", timeout=timeout)


def cancel(sfport: SFSerialPort, timeout: float | None = None) -> Any:
    _require_sync(sfport)
    return sfport.send_parsed("acancel", timeout=timeout)


def join(sfport: SFSerialPort, opt: JoinOption | None = None, timeout: float | None = None) -> str:
    _require_sync(sfport)
    args = opt.cli_args() if opt else []
    directive = "join" + ((" " + " ".join(args)) if args else "")
    return sfport.send_parsed(directive, timeout=timeout)


def wifi_auto(sfport: SFSerialPort, opt: WifiAutoOption | None = None, timeout: float | None = None) -> str:
    if opt is not None and opt.state not in ("", "0", "1"):
        raise RuntimeError('wifi_auto state must be "1" or "0"')
    _require_sync(sfport)
    args = opt.cli_args() if opt else []
    directive = "wifi_auto" + ((" " + " ".join(args)) if args else "")
    return sfport.send_parsed(directive, timeout=timeout)


def device_sn(sfport: SFSerialPort, timeout: float | None = None) -> SN:
    _require_sync(sfport)
    payload = sfport.send_parsed("sn", timeout=timeout)
    return SN(**payload)


def list_dir(sfport: SFSerialPort, path: str, timeout: float | None = None) -> FileSystem:
    _require_sync(sfport)
    payload = sfport.send_parsed(f"list_dir {path}", timeout=timeout)
    root = payload.get("rootDir") if isinstance(payload, dict) else None
    fs = FileSystem(rootDir=_to_file_node(root) if root else None, error=payload.get("error") if isinstance(payload, dict) else None)
    if fs.error:
        raise RuntimeError(fs.error)
    return fs


def clean_dir(sfport: SFSerialPort, path: str, timeout: float | None = None) -> str:
    if not path.startswith("/eMMC/applog"):
        raise RuntimeError("only can clean directory in working directory")
    _require_sync(sfport)
    return sfport.send_parsed(f"clean_dir {path}", timeout=timeout)


def delete_file(sfport: SFSerialPort, path: str, timeout: float | None = None) -> str:
    fullpath = compose_log_fullpath(path)
    if not fullpath.startswith("/eMMC/applog"):
        raise RuntimeError("only can delete file in working directory")
    _require_sync(sfport)
    return sfport.send_parsed(f"delete_file {fullpath}", timeout=timeout)


def alive(sfport: SFSerialPort, timeout: float | None = None) -> Heartbeat:
    _require_sync(sfport)
    return Heartbeat(**sfport.send_parsed("alive", timeout=timeout))


def atime(sfport: SFSerialPort, path: str, timeout: float | None = None) -> LogLength:
    _require_sync(sfport)
    return LogLength(**sfport.send_parsed(f"atime {path}", timeout=timeout))


def aversion(sfport: SFSerialPort, timeout: float | None = None) -> MKPVersion:
    _require_sync(sfport)
    return MKPVersion(**sfport.send_parsed("aversion", timeout=timeout))


def aupload_to_mkp(sfport: SFSerialPort, opt: AGetOption, timeout: float | None = None) -> str:
    if not opt.filepath:
        raise RuntimeError("aget file path is required")
    _require_sync(sfport)
    return sfport.send_parsed("aget " + " ".join(opt.cli_args()), timeout=timeout)


def adownload_from_mkp(sfport: SFSerialPort, opt: APutOption, timeout: float | None = None) -> str:
    if not opt.filepath:
        raise RuntimeError("aput file path is required")
    _require_sync(sfport)
    return sfport.send_parsed("aput " + " ".join(opt.cli_args()), timeout=timeout)


def ajson2log(sfport: SFSerialPort, opt: AJSON2LogOption, timeout: float | None = None) -> str:
    if not opt.jsonpath:
        raise RuntimeError("ajson2log json path is required")
    if not opt.outputlogpath:
        raise RuntimeError("ajson2log output log path is required")
    _require_sync(sfport)
    return sfport.send_parsed("ajson2log " + " ".join(opt.cli_args()), timeout=timeout)


def ahttpbase(sfport: SFSerialPort, opt: AHTTPBaseOption | None = None, timeout: float | None = None) -> AHTTPBase:
    _require_sync(sfport)
    args = opt.cli_args() if opt else []
    directive = "ahttpbase" + ((" " + " ".join(args)) if args else "")
    return AHTTPBase(**sfport.send_parsed(directive, timeout=timeout))


def adumj(sfport: SFSerialPort, log_path: str, timeout: float | None = None) -> ActionDump:
    if not log_path:
        raise RuntimeError("adumj log path is required")
    _require_sync(sfport)
    return ActionDump(**sfport.send_parsed(f"adumj {log_path}", timeout=timeout))


def ainspect(sfport: SFSerialPort, path: str, timeout: float | None = None) -> LogInfo:
    _require_sync(sfport)
    return LogInfo(**sfport.send_parsed(f"ainsp {path}", timeout=timeout))


def key_down(sfport: SFSerialPort, key: str, opt: KpadOption | None = None) -> None:
    option = opt or KpadOption()
    sfport.keypad(option.key_down(key))


def key_up(sfport: SFSerialPort, key: str, opt: KpadOption | None = None) -> None:
    option = opt or KpadOption()
    release_opt, remain_opt = option.key_up(key)
    if release_opt is not None:
        sfport.keypad(release_opt)
    if remain_opt is not None:
        sfport.keypad(remain_opt)


def key_tap(sfport: SFSerialPort, key: str, opt: KpadOption | None = None) -> None:
    option = (opt or KpadOption()).key_down(key).with_auto_release()
    sfport.keypad(option)


def key_presses(sfport: SFSerialPort, keys: list[str], sleep_ms: int = 0, opt: KpadOption | None = None) -> None:
    for key in keys:
        key_tap(sfport, key, opt)
        if sleep_ms > 0:
            time.sleep(sleep_ms / 1000.0)


def keypad_release(sfport: SFSerialPort, opt: KpadOption | None = None) -> None:
    option = opt or KpadOption()
    sfport.keypad(option.with_delay(0).with_key("NONE"))


def keypad_release_all(sfport: SFSerialPort, opt: KpadOption | None = None) -> None:
    option = opt or KpadOption()
    sfport.keypad(option.with_delay(0).with_release(0))
    reset_kpad_pressed_caches()


def mouse_release_all(sfport: SFSerialPort, opt: M10Option | None = None) -> None:
    release_opt = M10Option(async_mode=True).set_button(0)
    if opt is not None:
        release_opt.async_mode = opt.async_mode
        release_opt.sync_ignore_output = opt.sync_ignore_output
        release_opt.sync_output_timeout = opt.sync_output_timeout
    sfport.mouse10(release_opt)


def _move_cursor(x: int, y: int) -> None:
    try:
        ctypes.windll.user32.SetCursorPos(int(x), int(y))
    except Exception:  # noqa: BLE001
        pass


class Controller:
    def __init__(self, sfport: SFSerialPort) -> None:
        self.sfport = sfport

    def bind_sfport(self, sfport: SFSerialPort) -> None:
        self.sfport = sfport

    def open(self) -> None:
        self.sfport.open()
        self.sfport.start_read_loop()

    def close(self) -> None:
        self.sfport.close()

    def compose_log_directory(self, log_dir: str) -> str:
        return compose_log_directory(log_dir)

    def compose_log_fullpath(self, log_path: str) -> str:
        return compose_log_fullpath(log_path)

    def start_record(self, log_name: str, opt: LogOption | None = None) -> None:
        start_record(self.sfport, log_name, opt)

    def stop_record(self) -> None:
        stop_record(self.sfport)

    def alog(self, log_name: str, opt: LogOption | None = None, timeout: float | None = None) -> str:
        return alog(self.sfport, log_name, opt, timeout)

    def astop(self, timeout: float | None = None) -> str:
        return astop(self.sfport, timeout)

    def cancel(self, timeout: float | None = None) -> Any:
        return cancel(self.sfport, timeout)

    def join(self, opt: JoinOption | None = None, timeout: float | None = None) -> str:
        return join(self.sfport, opt, timeout)

    def wifi_auto(self, opt: WifiAutoOption | None = None, timeout: float | None = None) -> str:
        return wifi_auto(self.sfport, opt, timeout)

    def device_sn(self, timeout: float | None = None) -> SN:
        return device_sn(self.sfport, timeout)

    def list_dir(self, path: str, timeout: float | None = None) -> FileSystem:
        return list_dir(self.sfport, path, timeout)

    def clean_dir(self, path: str, timeout: float | None = None) -> str:
        return clean_dir(self.sfport, path, timeout)

    def delete_file(self, path: str, timeout: float | None = None) -> str:
        return delete_file(self.sfport, path, timeout)

    def alive(self, timeout: float | None = None) -> Heartbeat:
        return alive(self.sfport, timeout)

    def atime(self, path: str, timeout: float | None = None) -> LogLength:
        return atime(self.sfport, path, timeout)

    def aversion(self, timeout: float | None = None) -> MKPVersion:
        return aversion(self.sfport, timeout)

    def aupload_to_mkp(self, opt: AGetOption, timeout: float | None = None) -> str:
        return aupload_to_mkp(self.sfport, opt, timeout)

    def adownload_from_mkp(self, opt: APutOption, timeout: float | None = None) -> str:
        return adownload_from_mkp(self.sfport, opt, timeout)

    def ajson2log(self, opt: AJSON2LogOption, timeout: float | None = None) -> str:
        return ajson2log(self.sfport, opt, timeout)

    def ahttpbase(self, opt: AHTTPBaseOption | None = None, timeout: float | None = None) -> AHTTPBase:
        return ahttpbase(self.sfport, opt, timeout)

    def adumj(self, log_path: str, timeout: float | None = None) -> ActionDump:
        return adumj(self.sfport, log_path, timeout)

    def ainspect(self, path: str, timeout: float | None = None) -> LogInfo:
        return ainspect(self.sfport, path, timeout)

    def start_replaying(self, log_name: str, delay: int) -> None:
        self.sfport.start_replaying(log_name, delay)

    def snapshot_status(self) -> SerialPortStatus:
        return self.sfport.snapshot_status()

    def move_cursor(self, x: int, y: int) -> None:
        _move_cursor(x, y)
