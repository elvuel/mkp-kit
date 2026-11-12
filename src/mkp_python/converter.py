from __future__ import annotations

import json
import os
import struct
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

MAGIC_V1 = 'MKv1'
MAGIC_V2 = 'MKv2'
MAGIC_LENGTH = 4
HEADER_LENGTH_V1 = 4
HEADER_LENGTH_V2 = 16
RECORD_HEADER_SIZE = 7
MAX_PAYLOAD_LENGTH = 64
KBD_MAX_KEYS = 6
MOUSE_BUTTON_LEFT = 0x01
MOUSE_BUTTON_RIGHT = 0x02
MOUSE_BUTTON_MIDDLE = 0x04


@dataclass(slots=True)
class Meta:
    width: int = 0
    height: int = 0
    start_x: int = 0
    start_y: int = 0


@dataclass(slots=True)
class LogHeader:
    version: str = MAGIC_V1
    meta: Meta = field(default_factory=Meta)


@dataclass(slots=True)
class Record:
    port: int
    delta: int
    length: int
    payload: bytes


@dataclass(slots=True)
class MetaJSON:
    width: int = 0
    height: int = 0
    startX: int = 0
    startY: int = 0


@dataclass(slots=True)
class MouseMoveEv:
    x: int
    y: int
    ts: int


@dataclass(slots=True)
class ButtonEv:
    button: str
    ts: int


@dataclass(slots=True)
class WheelEv:
    delta: int
    ts: int


@dataclass(slots=True)
class KeyEvent:
    keys: list[str]
    ts: int


@dataclass(slots=True)
class Event:
    TypeName: str
    MouseMove: MouseMoveEv | None = None
    MouseDown: ButtonEv | None = None
    MouseUp: ButtonEv | None = None
    Wheel: WheelEv | None = None
    KeyDown: KeyEvent | None = None
    KeyUp: KeyEvent | None = None

    @staticmethod
    def from_json_obj(obj: dict[str, Any]) -> 'Event':
        if len(obj) != 1:
            raise ValueError(f'event must have exactly one key, got {len(obj)}')
        key, value = next(iter(obj.items()))
        if key == 'MouseMove':
            return Event(TypeName=key, MouseMove=MouseMoveEv(**value))
        if key == 'MouseDown':
            return Event(TypeName=key, MouseDown=ButtonEv(**value))
        if key == 'MouseUp':
            return Event(TypeName=key, MouseUp=ButtonEv(**value))
        if key == 'Wheel':
            return Event(TypeName=key, Wheel=WheelEv(**value))
        if key == 'KeyDown':
            return Event(TypeName=key, KeyDown=KeyEvent(**value))
        if key == 'KeyUp':
            return Event(TypeName=key, KeyUp=KeyEvent(**value))
        raise ValueError(f'unknown event type {key!r}')

    def to_json_obj(self) -> dict[str, Any]:
        if self.MouseMove is not None:
            return {self.TypeName or 'MouseMove': asdict(self.MouseMove)}
        if self.MouseDown is not None:
            return {self.TypeName or 'MouseDown': asdict(self.MouseDown)}
        if self.MouseUp is not None:
            return {self.TypeName or 'MouseUp': asdict(self.MouseUp)}
        if self.Wheel is not None:
            return {self.TypeName or 'Wheel': asdict(self.Wheel)}
        if self.KeyDown is not None:
            return {self.TypeName or 'KeyDown': asdict(self.KeyDown)}
        if self.KeyUp is not None:
            return {self.TypeName or 'KeyUp': asdict(self.KeyUp)}
        raise ValueError('empty event')


@dataclass(slots=True)
class Envelope:
    format: str = 'mkp-action-v1'
    version: str = MAGIC_V1
    meta: MetaJSON = field(default_factory=MetaJSON)
    events: list[Event] = field(default_factory=list)


@dataclass(slots=True)
class MouseReport:
    button: int
    x: int
    y: int
    wheel: int


HID_KEY_SPECS: list[tuple[str, int]] = [
    ('none', 0x00), ('err_ovf', 0x01),
    ('a', 0x04), ('b', 0x05), ('c', 0x06), ('d', 0x07), ('e', 0x08), ('f', 0x09), ('g', 0x0A), ('h', 0x0B), ('i', 0x0C), ('j', 0x0D), ('k', 0x0E), ('l', 0x0F), ('m', 0x10), ('n', 0x11), ('o', 0x12), ('p', 0x13), ('q', 0x14), ('r', 0x15), ('s', 0x16), ('t', 0x17), ('u', 0x18), ('v', 0x19), ('w', 0x1A), ('x', 0x1B), ('y', 0x1C), ('z', 0x1D),
    ('1', 0x1E), ('2', 0x1F), ('3', 0x20), ('4', 0x21), ('5', 0x22), ('6', 0x23), ('7', 0x24), ('8', 0x25), ('9', 0x26), ('0', 0x27),
    ('enter', 0x28), ('esc', 0x29), ('backspace', 0x2A), ('tab', 0x2B), ('space', 0x2C), ('minus', 0x2D), ('equal', 0x2E), ('leftbrace', 0x2F), ('rightbrace', 0x30), ('backslash', 0x31), ('hashtilde', 0x32), ('semicolon', 0x33), ('apostrophe', 0x34), ('grave', 0x35), ('comma', 0x36), ('dot', 0x37), ('slash', 0x38), ('capslock', 0x39),
    ('f1', 0x3A), ('f2', 0x3B), ('f3', 0x3C), ('f4', 0x3D), ('f5', 0x3E), ('f6', 0x3F), ('f7', 0x40), ('f8', 0x41), ('f9', 0x42), ('f10', 0x43), ('f11', 0x44), ('f12', 0x45),
    ('sysrq', 0x46), ('scrolllock', 0x47), ('pause', 0x48), ('insert', 0x49), ('home', 0x4A), ('pageup', 0x4B), ('delete', 0x4C), ('end', 0x4D), ('pagedown', 0x4E), ('right', 0x4F), ('left', 0x50), ('down', 0x51), ('up', 0x52),
    ('numlock', 0x53), ('kpslash', 0x54), ('kpasterisk', 0x55), ('kpminus', 0x56), ('kpplus', 0x57), ('kpenter', 0x58), ('kp1', 0x59), ('kp2', 0x5A), ('kp3', 0x5B), ('kp4', 0x5C), ('kp5', 0x5D), ('kp6', 0x5E), ('kp7', 0x5F), ('kp8', 0x60), ('kp9', 0x61), ('kp0', 0x62), ('kpdot', 0x63),
    ('102nd', 0x64), ('compose', 0x65), ('power', 0x66), ('kpequal', 0x67), ('f13', 0x68), ('f14', 0x69), ('f15', 0x6A), ('f16', 0x6B), ('f17', 0x6C), ('f18', 0x6D), ('f19', 0x6E), ('f20', 0x6F), ('f21', 0x70), ('f22', 0x71), ('f23', 0x72), ('f24', 0x73),
    ('open', 0x74), ('help', 0x75), ('props', 0x76), ('front', 0x77), ('stop', 0x78), ('again', 0x79), ('undo', 0x7A), ('cut', 0x7B), ('copy', 0x7C), ('paste', 0x7D), ('find', 0x7E), ('mute', 0x7F), ('volumeup', 0x80), ('volumedown', 0x81),
    ('kpcomma', 0x85), ('ro', 0x87), ('katakanahiragana', 0x88), ('yen', 0x89), ('henkan', 0x8A), ('muhenkan', 0x8B), ('kpjpcomma', 0x8C),
    ('hangeul', 0x90), ('hanja', 0x91), ('katakana', 0x92), ('hiragana', 0x93), ('zenkakuhankaku', 0x94),
    ('kpleftparen', 0xB6), ('kprightparen', 0xB7),
    ('leftctrl', 0xE0), ('leftshift', 0xE1), ('leftalt', 0xE2), ('leftmeta', 0xE3), ('rightctrl', 0xE4), ('rightshift', 0xE5), ('rightalt', 0xE6), ('rightmeta', 0xE7),
]
SCAN_NAME_ALIASES = {'printscreen': 'sysrq', 'leftbracket': 'leftbrace', 'rightbracket': 'rightbrace'}
NAME_TO_SCAN = {name: code for name, code in HID_KEY_SPECS}
SCAN_TO_NAME = {code: name for name, code in HID_KEY_SPECS}
CANONICAL_NAME_TO_MOD_BIT = {'lctrl': 0x01, 'lshift': 0x02, 'lalt': 0x04, 'lmeta': 0x08, 'rctrl': 0x10, 'rshift': 0x20, 'ralt': 0x40, 'rmeta': 0x80}
MOD_NAME_ALIASES = {'ctrl': 'lctrl', 'shift': 'lshift', 'alt': 'lalt', 'meta': 'lmeta', 'lgui': 'lmeta', 'rgui': 'rmeta'}
MOD_BIT_TO_NAME = ['lctrl', 'lshift', 'lalt', 'lmeta', 'rctrl', 'rshift', 'ralt', 'rmeta']
NAME_TO_BUTTON_BIT = {'left': MOUSE_BUTTON_LEFT, 'right': MOUSE_BUTTON_RIGHT, 'middle': MOUSE_BUTTON_MIDDLE}


def normalize_scan_name(name: str) -> str:
    key = name.strip().lower()
    return SCAN_NAME_ALIASES.get(key, key)


def scan_code(name: str) -> tuple[int, bool]:
    key = normalize_scan_name(name)
    return NAME_TO_SCAN.get(key, 0), key in NAME_TO_SCAN


def scan_name(code: int) -> str:
    return SCAN_TO_NAME.get(code, '')


def normalize_mod_name(name: str) -> str:
    key = name.strip().lower()
    if key.startswith('mod_'):
        key = key[4:]
    return MOD_NAME_ALIASES.get(key, key)


def mod_bit(name: str) -> int:
    return CANONICAL_NAME_TO_MOD_BIT.get(normalize_mod_name(name), 0)


def is_mod_name(name: str) -> bool:
    return normalize_mod_name(name) in CANONICAL_NAME_TO_MOD_BIT


def mod_name(bit: int) -> str:
    return MOD_BIT_TO_NAME[bit] if 0 <= bit < len(MOD_BIT_TO_NAME) else ''


def button_bit(name: str) -> tuple[int, bool]:
    key = name.strip().lower()
    return NAME_TO_BUTTON_BIT.get(key, 0), key in NAME_TO_BUTTON_BIT


def button_name(bit: int) -> str:
    return {MOUSE_BUTTON_LEFT: 'left', MOUSE_BUTTON_RIGHT: 'right', MOUSE_BUTTON_MIDDLE: 'middle'}.get(bit, '')


def mouse_encode(button: int, x: int, y: int, wheel: int) -> bytes:
    ux = x & 0x0FFF
    uy = y & 0x0FFF
    return bytes([
        button & 0xFF,
        ux & 0xFF,
        ((ux >> 8) & 0x0F) | ((uy & 0x0F) << 4),
        (uy >> 4) & 0xFF,
        wheel & 0xFF,
    ])


def mouse_decode(payload: bytes) -> MouseReport:
    if len(payload) != 5:
        raise ValueError(f'mouse payload must be 5 bytes, got {len(payload)}')
    ux = payload[1] | ((payload[2] & 0x0F) << 8)
    uy = (payload[2] >> 4) | (payload[3] << 4)
    if ux & 0x0800:
        ux |= 0xF000
    if uy & 0x0800:
        uy |= 0xF000
    x = struct.unpack('<h', struct.pack('<H', ux))[0]
    y = struct.unpack('<h', struct.pack('<H', uy))[0]
    wheel = struct.unpack('<b', bytes([payload[4]]))[0]
    return MouseReport(button=payload[0], x=x, y=y, wheel=wheel)


def contains_key(items: list[int], value: int) -> bool:
    return value in items


def emit_mouse_events(env: Envelope, report: MouseReport, state: dict[str, int], ts: int) -> None:
    if report.x != 0 or report.y != 0:
        env.events.append(Event(TypeName='MouseMove', MouseMove=MouseMoveEv(x=report.x, y=report.y, ts=ts)))
    prev_button = state.get('prev_button', 0)
    down = report.button & (~prev_button & 0xFF)
    up = prev_button & (~report.button & 0xFF)
    for bit in (MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE):
        name = button_name(bit)
        if not name:
            continue
        if down & bit:
            env.events.append(Event(TypeName='MouseDown', MouseDown=ButtonEv(button=name, ts=ts)))
        if up & bit:
            env.events.append(Event(TypeName='MouseUp', MouseUp=ButtonEv(button=name, ts=ts)))
    if report.wheel != 0:
        env.events.append(Event(TypeName='Wheel', Wheel=WheelEv(delta=report.wheel, ts=ts)))
    state['prev_button'] = report.button


def emit_kbd_events(env: Envelope, modifier: int, keys: list[int], state: dict[str, Any], ts: int) -> None:
    prev_modifier = state.get('prev_modifier', 0)
    prev_keys = state.get('prev_keys', [0] * KBD_MAX_KEYS)
    mod_down = (modifier ^ prev_modifier) & modifier
    mod_up = (modifier ^ prev_modifier) & prev_modifier
    down_names: list[str] = []
    up_names: list[str] = []
    for bit in range(8):
        if mod_down & (1 << bit):
            name = mod_name(bit)
            if name:
                down_names.append(name)
        if mod_up & (1 << bit):
            name = mod_name(bit)
            if name:
                up_names.append(name)
    for key in keys:
        if key and key not in prev_keys:
            down_names.append(scan_name(key))
    for key in prev_keys:
        if key and key not in keys:
            up_names.append(scan_name(key))
    if down_names:
        env.events.append(Event(TypeName='KeyDown', KeyDown=KeyEvent(keys=down_names, ts=ts)))
    if up_names:
        env.events.append(Event(TypeName='KeyUp', KeyUp=KeyEvent(keys=up_names, ts=ts)))
    state['prev_modifier'] = modifier
    state['prev_keys'] = keys[:]


def log_to_json(header: LogHeader, records: list[Record]) -> Envelope:
    env = Envelope(format='mkp-action-v1', version=header.version, meta=MetaJSON(width=header.meta.width, height=header.meta.height, startX=header.meta.start_x, startY=header.meta.start_y))
    mouse_state = {'prev_button': 0}
    kbd_state: dict[str, Any] = {'prev_modifier': 0, 'prev_keys': [0] * KBD_MAX_KEYS}
    ts = 0
    for record in records:
        ts += record.delta
        if record.port == 1 and record.length == 5:
            emit_mouse_events(env, mouse_decode(record.payload[:5]), mouse_state, ts)
        elif record.port == 2 and record.length == 8 and len(record.payload) >= 8:
            emit_kbd_events(env, record.payload[0], list(record.payload[2:8]), kbd_state, ts)
    return env


def event_ts(event: Event) -> int:
    for value in (event.MouseMove, event.MouseDown, event.MouseUp, event.Wheel, event.KeyDown, event.KeyUp):
        if value is not None:
            return value.ts
    return 0


def apply_kbd_names(state: dict[str, Any], names: list[str], is_down: bool) -> None:
    modifier = state.get('prev_modifier', 0)
    keys = state.get('prev_keys', [0] * KBD_MAX_KEYS)[:]
    for name in names:
        if is_mod_name(name):
            bit = mod_bit(name)
            if is_down:
                modifier |= bit
            else:
                modifier &= (~bit & 0xFF)
            continue
        code, ok = scan_code(name)
        if not ok:
            raise ValueError(f'unknown key name {name!r}')
        if is_down:
            if code not in keys:
                for idx, current in enumerate(keys):
                    if current == 0:
                        keys[idx] = code
                        break
                else:
                    raise ValueError(f'too many simultaneous keys: {names!r}')
        else:
            keys = [0 if current == code else current for current in keys]
    state['prev_modifier'] = modifier
    state['prev_keys'] = keys


def build_kbd_report(state: dict[str, Any]) -> bytes:
    modifier = state.get('prev_modifier', 0)
    keys = state.get('prev_keys', [0] * KBD_MAX_KEYS)
    return bytes([modifier, 0, *keys[:KBD_MAX_KEYS]])


def json_to_log(env: Envelope) -> tuple[LogHeader, list[Record], bool, bool]:
    header = LogHeader(version=env.version if env.version in (MAGIC_V1, MAGIC_V2) else MAGIC_V1, meta=Meta(width=env.meta.width, height=env.meta.height, start_x=env.meta.startX & 0xFFFF, start_y=env.meta.startY & 0xFFFF))
    records: list[Record] = []
    cur_button = 0
    kbd_state: dict[str, Any] = {'prev_modifier': 0, 'prev_keys': [0] * KBD_MAX_KEYS}
    prev_ts = 0
    first = True
    has_mouse = False
    has_kbd = False
    for index, event in enumerate(env.events):
        ts = event_ts(event)
        delta = ts if first else ts - prev_ts
        if delta < 0:
            delta = 0
        first = False
        prev_ts = ts
        if event.MouseMove is not None:
            payload = mouse_encode(cur_button, event.MouseMove.x, event.MouseMove.y, 0)
            records.append(Record(port=1, delta=delta, length=5, payload=payload))
            has_mouse = True
        elif event.MouseDown is not None:
            bit, ok = button_bit(event.MouseDown.button)
            if not ok:
                raise ValueError(f'event {index} MouseDown: unknown button {event.MouseDown.button!r}')
            cur_button |= bit
            records.append(Record(port=1, delta=delta, length=5, payload=mouse_encode(cur_button, 0, 0, 0)))
            has_mouse = True
        elif event.MouseUp is not None:
            bit, ok = button_bit(event.MouseUp.button)
            if not ok:
                raise ValueError(f'event {index} MouseUp: unknown button {event.MouseUp.button!r}')
            cur_button &= (~bit & 0xFF)
            records.append(Record(port=1, delta=delta, length=5, payload=mouse_encode(cur_button, 0, 0, 0)))
            has_mouse = True
        elif event.Wheel is not None:
            records.append(Record(port=1, delta=delta, length=5, payload=mouse_encode(cur_button, 0, 0, event.Wheel.delta)))
            has_mouse = True
        elif event.KeyDown is not None:
            apply_kbd_names(kbd_state, event.KeyDown.keys, True)
            records.append(Record(port=2, delta=delta, length=8, payload=build_kbd_report(kbd_state)))
            has_kbd = True
        elif event.KeyUp is not None:
            apply_kbd_names(kbd_state, event.KeyUp.keys, False)
            records.append(Record(port=2, delta=delta, length=8, payload=build_kbd_report(kbd_state)))
            has_kbd = True
    return header, records, has_mouse, has_kbd


def read_json_file(path: str | os.PathLike[str]) -> Envelope:
    payload = json.loads(Path(path).read_text(encoding='utf-8'))
    env = Envelope(format=payload.get('format') or 'mkp-action-v1', version=payload.get('version') or MAGIC_V1, meta=MetaJSON(**payload.get('meta', {})), events=[Event.from_json_obj(item) for item in payload.get('events', [])])
    return env


def write_json_file(path: str | os.PathLike[str], env: Envelope) -> None:
    obj = {'format': env.format, 'version': env.version, 'meta': asdict(env.meta), 'events': [event.to_json_obj() for event in env.events]}
    Path(path).write_text(json.dumps(obj, ensure_ascii=False, indent=4) + '\n', encoding='utf-8')


def read_log_file(path: str | os.PathLike[str]) -> tuple[LogHeader, list[Record]]:
    data = Path(path).read_bytes()
    if len(data) < MAGIC_LENGTH:
        raise ValueError('empty log file')
    magic = data[:MAGIC_LENGTH].decode('ascii', errors='strict')
    offset = MAGIC_LENGTH
    if magic == MAGIC_V1:
        header = LogHeader(version=MAGIC_V1)
    elif magic == MAGIC_V2:
        width, height, start_x, start_y, _reserved = struct.unpack_from('<HHHHI', data, offset)
        header = LogHeader(version=MAGIC_V2, meta=Meta(width=width, height=height, start_x=start_x, start_y=start_y))
        offset += 12
    else:
        raise ValueError(f'bad magic {magic!r}')
    records: list[Record] = []
    while offset < len(data):
        if offset + RECORD_HEADER_SIZE > len(data):
            raise ValueError('truncated record header')
        port = data[offset]
        delta = struct.unpack_from('<I', data, offset + 1)[0]
        length = struct.unpack_from('<H', data, offset + 5)[0]
        offset += RECORD_HEADER_SIZE
        if length > MAX_PAYLOAD_LENGTH:
            raise ValueError(f'record length {length} exceeds cap {MAX_PAYLOAD_LENGTH}')
        payload = data[offset:offset + length]
        if len(payload) != length:
            raise ValueError('truncated record payload')
        offset += length
        records.append(Record(port=port, delta=delta, length=length, payload=payload))
    return header, records


def write_log_file(path: str | os.PathLike[str], header: LogHeader, records: list[Record], has_mouse: bool, has_keyboard: bool) -> None:
    chunks = bytearray()
    if header.version == MAGIC_V2:
        chunks.extend(MAGIC_V2.encode('ascii'))
        chunks.extend(struct.pack('<HHHHI', header.meta.width, header.meta.height, header.meta.start_x, header.meta.start_y, 0))
    else:
        chunks.extend(MAGIC_V1.encode('ascii'))
    for record in records:
        chunks.extend(struct.pack('<BIH', record.port, record.delta & 0xFFFFFFFF, record.length))
        chunks.extend(record.payload)
    if has_mouse:
        for _ in range(3):
            chunks.extend(struct.pack('<BIH', 1, 8, 5))
            chunks.extend(b'\x00' * 5)
    if has_keyboard:
        chunks.extend(struct.pack('<BIH', 2, 8, 8))
        chunks.extend(b'\x00' * 8)
    Path(path).write_bytes(bytes(chunks))


def convert_log_file_to_json_file(input_path: str, output_path: str) -> None:
    header, records = read_log_file(input_path)
    env = log_to_json(header, records)
    write_json_file(output_path, env)


def convert_json_file_to_log_file(input_path: str, output_path: str) -> None:
    env = read_json_file(input_path)
    header, records, has_mouse, has_keyboard = json_to_log(env)
    write_log_file(output_path, header, records, has_mouse, has_keyboard)
