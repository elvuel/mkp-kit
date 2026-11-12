from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any

from .keycodes import KEY_NAME_TO_HEXCODE, KEY_NAME_TO_NCODE, MOD_KEY_NAMES, MOD_KEY_SHORT_NAMES, SYMBOL_EXPANSIONS

_kpad_state_lock = RLock()
_pressed_mod_keys: list[str] = []
_pressed_keys: list[str] = []


def reset_kpad_pressed_caches() -> None:
    with _kpad_state_lock:
        _pressed_mod_keys.clear()
        _pressed_keys.clear()


def _append_once(items: list[str], value: str) -> list[str]:
    if value not in items:
        items.append(value)
    return items


def _remove_once(items: list[str], value: str) -> list[str]:
    if value in items:
        items.remove(value)
    return items


def normalize_kpad_key(key: str) -> str:
    key = key.strip().upper()
    if not key:
        return ""
    aliases = {
        "CTRL": "MOD_LCTRL",
        "SHIFT": "MOD_LSHIFT",
        "ALT": "MOD_LALT",
        "META": "MOD_LMETA",
        "LEFTBRACKET": "LEFTBRACE",
        "RIGHTBRACKET": "RIGHTBRACE",
    }
    if key in aliases:
        return aliases[key]
    if key in MOD_KEY_SHORT_NAMES:
        return f"MOD_{key}"
    return key


def expand_kpad_input_key(key: str) -> list[str]:
    if key in SYMBOL_EXPANSIONS:
        return SYMBOL_EXPANSIONS[key]
    normalized = normalize_kpad_key(key)
    return [normalized] if normalized else []


def _mod_status(mod_keys: list[str]) -> str:
    if not mod_keys:
        return ""
    code = 0
    for key in mod_keys:
        code |= KEY_NAME_TO_NCODE[key]
    return f"0x{code:02x}"


@dataclass(slots=True)
class SN:
    sn: str


@dataclass(slots=True)
class FileNode:
    name: str
    path: str
    type: str
    size: int = 0
    displayName: str | None = None
    contents: list["FileNode"] = field(default_factory=list)


@dataclass(slots=True)
class FileSystem:
    rootDir: FileNode | None = None
    error: str | None = None


@dataclass(slots=True)
class Heartbeat:
    timetamp: int


@dataclass(slots=True)
class LogOption:
    width: int = 0
    height: int = 0
    stposx: int = -1
    stposy: int = -1

    def cli_args(self) -> list[str]:
        args: list[str] = []
        if self.width > 0:
            args += ["--width", str(self.width)]
        if self.height > 0:
            args += ["--heigh", str(self.height)]
        if self.stposx > -1:
            args += ["--stposx", str(self.stposx)]
        if self.stposy > -1:
            args += ["--stposy", str(self.stposy)]
        return args


@dataclass(slots=True)
class JoinOption:
    ssid: str = ""
    password: str = ""

    def cli_args(self) -> list[str]:
        args: list[str] = []
        if self.ssid:
            args.append(self.ssid)
        if self.password:
            args.append(self.password)
        return args


@dataclass(slots=True)
class WifiAutoOption:
    state: str = ""

    def cli_args(self) -> list[str]:
        return [self.state] if self.state else []


@dataclass(slots=True)
class AGetOption:
    filepath: str = ""

    def cli_args(self) -> list[str]:
        return [self.filepath] if self.filepath else []


@dataclass(slots=True)
class APutOption:
    filepath: str = ""

    def cli_args(self) -> list[str]:
        return [self.filepath] if self.filepath else []


@dataclass(slots=True)
class AJSON2LogOption:
    jsonpath: str = ""
    outputlogpath: str = ""

    def cli_args(self) -> list[str]:
        if not self.jsonpath:
            return []
        args = [self.jsonpath]
        if self.outputlogpath:
            args += ["-o", self.outputlogpath]
        return args


@dataclass(slots=True)
class AHTTPBaseOption:
    url: str = ""

    def cli_args(self) -> list[str]:
        return [self.url] if self.url else []


@dataclass(slots=True)
class AHTTPBase:
    ahttpbase: str


@dataclass(slots=True)
class AdumjOption:
    logPath: str = ""

    def cli_args(self) -> list[str]:
        return [self.logPath] if self.logPath else []


@dataclass(slots=True)
class ActionDumpMeta:
    width: int
    height: int
    startX: int
    startY: int


@dataclass(slots=True)
class ActionDump:
    format: str
    version: str
    meta: dict[str, Any]
    events: list[dict[str, Any]]


@dataclass(slots=True)
class LogLength:
    seconds: int = 0
    milsec: int = 0

    @property
    def milliseconds(self) -> int:
        return self.milsec


@dataclass(slots=True)
class LogInfo:
    seconds: int = 0
    milsec: int = 0
    width: int = 0
    heigh: int = 0
    stpos: dict[str, int] | None = None


@dataclass(slots=True)
class MKPVersion:
    uver: str = ""
    aver: str = ""


@dataclass(slots=True)
class M10Option:
    button: int | None = None
    x: int | None = None
    y: int | None = None
    wheel: int | None = None
    async_mode: bool = True
    sync_ignore_output: bool = False

    def reset(self) -> "M10Option":
        self.button = self.x = self.y = self.wheel = None
        return self

    def set_button(self, value: int) -> "M10Option":
        self.button = value
        return self

    with_button = set_button

    def without_button(self) -> "M10Option":
        self.button = None
        return self

    def with_left_button(self) -> "M10Option":
        return self.set_button(1)

    def with_right_button(self) -> "M10Option":
        return self.set_button(2)

    def with_both_left_right_button(self) -> "M10Option":
        return self.set_button(3)

    def with_middle_button(self) -> "M10Option":
        return self.set_button(4)

    def with_back_button(self) -> "M10Option":
        return self.set_button(8)

    def with_forward_button(self) -> "M10Option":
        return self.set_button(16)

    def set_x(self, value: int) -> "M10Option":
        self.x = value
        return self

    def set_y(self, value: int) -> "M10Option":
        self.y = value
        return self

    def set_wheel(self, value: int) -> "M10Option":
        self.wheel = value
        return self

    def with_async(self, async_mode: bool) -> "M10Option":
        self.async_mode = async_mode
        self.sync_ignore_output = not async_mode
        return self

    def with_sync_ignore_output(self, sync_ignore_output: bool) -> "M10Option":
        self.sync_ignore_output = sync_ignore_output
        self.async_mode = not sync_ignore_output
        return self

    def is_async(self) -> bool:
        return self.async_mode and not self.sync_ignore_output

    def is_sync_ignore_output(self) -> bool:
        return self.sync_ignore_output or not self.async_mode

    def to_cli_fragment(self) -> str:
        args: list[str] = []
        if self.button is not None:
            args += ["--b", str(self.button)]
        if self.x is not None:
            args += ["--x", str(self.x)]
        if self.y is not None:
            args += ["--y", str(self.y)]
        if self.wheel is not None:
            args += ["--w", str(self.wheel)]
        return " ".join(args)


@dataclass(slots=True)
class KpadOption:
    mod_keys: list[str] = field(default_factory=list)
    keys: list[str] = field(default_factory=lambda: [""] * 6)
    release: int = 0
    delay: int = 0
    verbose: bool = False
    async_mode: bool = True
    sync_ignore_output: bool = False
    _commit_keys: tuple[list[str], bool] | None = None

    def to_cli_fragment(self) -> str:
        args: list[str] = []
        status = _mod_status(self.mod_keys)
        if status:
            args += ["--s", status]
        for idx, key in enumerate(self.keys, start=1):
            if key:
                if key not in KEY_NAME_TO_HEXCODE:
                    raise KeyError(f"unknown key name: {key}")
                args += [f"--x{idx}", KEY_NAME_TO_HEXCODE[key]]
        args += ["--rel", str(self.release), "--d", str(self.delay)]
        if self.verbose:
            args += ["--v", "1"]
        return " ".join(args)

    def with_keys(self, keys: list[str]) -> "KpadOption":
        normalized = [normalize_kpad_key(key) for key in keys if normalize_kpad_key(key)]
        self.mod_keys = [key for key in normalized if key in MOD_KEY_NAMES]
        normal = [key for key in normalized if key not in MOD_KEY_NAMES][:6]
        self.keys = normal + [""] * (6 - len(normal))
        return self

    def with_delay(self, delay: int) -> "KpadOption":
        self.delay = delay
        return self

    def with_release(self, release: int) -> "KpadOption":
        self.release = release
        return self

    def with_hold(self) -> "KpadOption":
        self.release = 0
        return self

    def with_auto_release(self) -> "KpadOption":
        self.release = 1
        return self

    def with_duration(self, duration: int) -> "KpadOption":
        if duration > 1:
            self.release = duration
        return self

    def with_verbose(self, verbose: bool) -> "KpadOption":
        self.verbose = verbose
        return self

    def with_async(self, async_mode: bool) -> "KpadOption":
        self.async_mode = async_mode
        self.sync_ignore_output = not async_mode
        return self

    def with_sync_ignore_output(self, sync_ignore_output: bool) -> "KpadOption":
        self.sync_ignore_output = sync_ignore_output
        self.async_mode = not sync_ignore_output
        return self

    def is_async(self) -> bool:
        return self.async_mode and not self.sync_ignore_output

    def is_sync_ignore_output(self) -> bool:
        return self.sync_ignore_output or not self.async_mode

    def with_mod_keys(self, mod_keys: list[str]) -> "KpadOption":
        self.mod_keys = mod_keys[:]
        return self

    def with_key(self, key: str) -> "KpadOption":
        normalized = normalize_kpad_key(key)
        self.keys = [normalized] + [""] * 5
        return self

    def key_down(self, key: str) -> "KpadOption":
        commit_keys = expand_kpad_input_key(key)
        if not commit_keys:
            return self
        with _kpad_state_lock:
            next_mod = _pressed_mod_keys[:]
            next_keys = _pressed_keys[:]
            for item in commit_keys:
                if item in MOD_KEY_NAMES:
                    _append_once(next_mod, item)
                else:
                    _append_once(next_keys, item)
        self.with_keys(next_mod + next_keys).with_mod_keys(next_mod).with_hold()
        self._commit_keys = (commit_keys, True)
        return self

    def key_up(self, key: str) -> tuple["KpadOption" | None, "KpadOption" | None]:
        release_keys = expand_kpad_input_key(key)
        if not release_keys:
            return None, None
        with _kpad_state_lock:
            release_mod = _pressed_mod_keys[:]
            next_mod = _pressed_mod_keys[:]
            next_keys = _pressed_keys[:]
            for item in release_keys:
                if item in MOD_KEY_NAMES:
                    _remove_once(next_mod, item)
                else:
                    _remove_once(next_keys, item)
        release_opt = KpadOption().with_delay(self.delay).with_verbose(self.verbose).with_async(self.async_mode).with_keys(release_keys).with_auto_release()
        release_opt.sync_ignore_output = self.sync_ignore_output
        if any(item in MOD_KEY_NAMES for item in release_keys):
            release_opt.with_mod_keys(release_mod)
        remain_opt = KpadOption().with_delay(self.delay).with_verbose(self.verbose).with_async(self.async_mode)
        remain_opt.sync_ignore_output = self.sync_ignore_output
        remain = next_mod + next_keys
        if remain:
            remain_opt.with_keys(remain)
            if any(item in MOD_KEY_NAMES for item in release_keys):
                remain_opt.with_mod_keys(next_mod)
        else:
            remain_opt.with_key("NONE").with_hold()
        remain_opt._commit_keys = (release_keys, False)
        return release_opt, remain_opt

    def commit_state(self) -> None:
        if self._commit_keys is None:
            return
        commit_keys, is_down = self._commit_keys
        with _kpad_state_lock:
            for item in commit_keys:
                if item in MOD_KEY_NAMES:
                    (_append_once if is_down else _remove_once)(_pressed_mod_keys, item)
                else:
                    (_append_once if is_down else _remove_once)(_pressed_keys, item)
        self._commit_keys = None


@dataclass(slots=True)
class SerialPortStatus:
    name: str
    port_open: bool
    read_closed: bool
    read_loop_running: bool
    sync_output_enabled: bool
    sync_output_timeout_ms: int
    current_sync_directive: str = ""
    sync_output_ignored: bool = False
    async_marked: bool = False
    last_read_at: str | None = None
    last_read_error: str | None = None
    last_read_error_at: str | None = None
