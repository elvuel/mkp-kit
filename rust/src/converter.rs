use crate::error::{MkpError, Result};
use once_cell::sync::Lazy;
use serde::de::{self, MapAccess, Visitor};
use serde::ser::SerializeMap;
use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::collections::HashMap;
use std::fmt;
use std::fs;
use std::io::{self, Read, Write};
use std::path::Path;

pub const MAGIC_V1: &str = "MKv1";
pub const MAGIC_V2: &str = "MKv2";
const MAGIC_LENGTH: usize = 4;
const META_LENGTH: usize = 12;
const RECORD_HEADER_SIZE: usize = 1 + 4 + 2;
const MAX_PAYLOAD_LENGTH: usize = 64;
const KBD_MAX_KEYS: usize = 6;
const MOUSE_BUTTON_LEFT: u8 = 0x01;
const MOUSE_BUTTON_RIGHT: u8 = 0x02;
const MOUSE_BUTTON_MIDDLE: u8 = 0x04;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    Unknown,
    LogToJson,
    JsonToLog,
}

impl Direction {
    pub fn target_ext(self) -> &'static str {
        match self {
            Self::LogToJson => ".json",
            Self::JsonToLog => ".log",
            Self::Unknown => "",
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Meta {
    pub width: u16,
    pub height: u16,
    pub start_x: u16,
    pub start_y: u16,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LogHeader {
    pub version: String,
    pub meta: Meta,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Record {
    pub port: u8,
    pub delta: i32,
    pub length: u16,
    pub payload: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct MetaJson {
    #[serde(default)]
    pub width: u16,
    #[serde(default)]
    pub height: u16,
    #[serde(default, rename = "startX")]
    pub start_x: i16,
    #[serde(default, rename = "startY")]
    pub start_y: i16,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct Envelope {
    #[serde(default = "default_format")]
    pub format: String,
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default)]
    pub meta: MetaJson,
    #[serde(default)]
    pub events: Vec<Event>,
}

fn default_format() -> String {
    "mkp-action-v1".to_string()
}

fn default_version() -> String {
    MAGIC_V1.to_string()
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Event {
    MouseMove(MouseMoveEvent),
    MouseDown(ButtonEvent),
    MouseUp(ButtonEvent),
    Wheel(WheelEvent),
    KeyDown(KeyEvent),
    KeyUp(KeyEvent),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MouseMoveEvent {
    pub x: i16,
    pub y: i16,
    pub ts: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ButtonEvent {
    pub button: String,
    pub ts: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WheelEvent {
    pub delta: i8,
    pub ts: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct KeyEvent {
    pub keys: Vec<String>,
    pub ts: i32,
}

impl Serialize for Event {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut map = serializer.serialize_map(Some(1))?;
        match self {
            Event::MouseMove(value) => map.serialize_entry("MouseMove", value)?,
            Event::MouseDown(value) => map.serialize_entry("MouseDown", value)?,
            Event::MouseUp(value) => map.serialize_entry("MouseUp", value)?,
            Event::Wheel(value) => map.serialize_entry("Wheel", value)?,
            Event::KeyDown(value) => map.serialize_entry("KeyDown", value)?,
            Event::KeyUp(value) => map.serialize_entry("KeyUp", value)?,
        }
        map.end()
    }
}

impl<'de> Deserialize<'de> for Event {
    fn deserialize<D>(deserializer: D) -> std::result::Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        struct EventVisitor;

        impl<'de> Visitor<'de> for EventVisitor {
            type Value = Event;

            fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("a single-key MKP event object")
            }

            fn visit_map<A>(self, mut map: A) -> std::result::Result<Self::Value, A::Error>
            where
                A: MapAccess<'de>,
            {
                let Some(key) = map.next_key::<String>()? else {
                    return Err(de::Error::custom("event must contain exactly one key"));
                };
                let value = match key.as_str() {
                    "MouseMove" => Event::MouseMove(map.next_value()?),
                    "MouseDown" => Event::MouseDown(map.next_value()?),
                    "MouseUp" => Event::MouseUp(map.next_value()?),
                    "Wheel" => Event::Wheel(map.next_value()?),
                    "KeyDown" => Event::KeyDown(map.next_value()?),
                    "KeyUp" => Event::KeyUp(map.next_value()?),
                    _ => return Err(de::Error::custom(format!("unknown event type {key}"))),
                };
                if map.next_key::<String>()?.is_some() {
                    return Err(de::Error::custom("event must contain exactly one key"));
                }
                Ok(value)
            }
        }

        deserializer.deserialize_map(EventVisitor)
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct MouseReport {
    pub button: u8,
    pub x: i16,
    pub y: i16,
    pub wheel: i8,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
struct MouseState {
    prev_button: u8,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
struct KeyboardState {
    prev_modifier: u8,
    prev_keys: [u8; KBD_MAX_KEYS],
}

const MOD_LCTRL: u8 = 0x01;
const MOD_LSHIFT: u8 = 0x02;
const MOD_LALT: u8 = 0x04;
const MOD_LGUI: u8 = 0x08;
const MOD_RCTRL: u8 = 0x10;
const MOD_RSHIFT: u8 = 0x20;
const MOD_RALT: u8 = 0x40;
const MOD_RGUI: u8 = 0x80;

static HID_KEY_SPECS: &[(&str, u8)] = &[
    ("none", 0x00),
    ("err_ovf", 0x01),
    ("a", 0x04),
    ("b", 0x05),
    ("c", 0x06),
    ("d", 0x07),
    ("e", 0x08),
    ("f", 0x09),
    ("g", 0x0a),
    ("h", 0x0b),
    ("i", 0x0c),
    ("j", 0x0d),
    ("k", 0x0e),
    ("l", 0x0f),
    ("m", 0x10),
    ("n", 0x11),
    ("o", 0x12),
    ("p", 0x13),
    ("q", 0x14),
    ("r", 0x15),
    ("s", 0x16),
    ("t", 0x17),
    ("u", 0x18),
    ("v", 0x19),
    ("w", 0x1a),
    ("x", 0x1b),
    ("y", 0x1c),
    ("z", 0x1d),
    ("1", 0x1e),
    ("2", 0x1f),
    ("3", 0x20),
    ("4", 0x21),
    ("5", 0x22),
    ("6", 0x23),
    ("7", 0x24),
    ("8", 0x25),
    ("9", 0x26),
    ("0", 0x27),
    ("enter", 0x28),
    ("esc", 0x29),
    ("backspace", 0x2a),
    ("tab", 0x2b),
    ("space", 0x2c),
    ("minus", 0x2d),
    ("equal", 0x2e),
    ("leftbrace", 0x2f),
    ("rightbrace", 0x30),
    ("backslash", 0x31),
    ("hashtilde", 0x32),
    ("semicolon", 0x33),
    ("apostrophe", 0x34),
    ("grave", 0x35),
    ("comma", 0x36),
    ("dot", 0x37),
    ("slash", 0x38),
    ("capslock", 0x39),
    ("f1", 0x3a),
    ("f2", 0x3b),
    ("f3", 0x3c),
    ("f4", 0x3d),
    ("f5", 0x3e),
    ("f6", 0x3f),
    ("f7", 0x40),
    ("f8", 0x41),
    ("f9", 0x42),
    ("f10", 0x43),
    ("f11", 0x44),
    ("f12", 0x45),
    ("sysrq", 0x46),
    ("scrolllock", 0x47),
    ("pause", 0x48),
    ("insert", 0x49),
    ("home", 0x4a),
    ("pageup", 0x4b),
    ("delete", 0x4c),
    ("end", 0x4d),
    ("pagedown", 0x4e),
    ("right", 0x4f),
    ("left", 0x50),
    ("down", 0x51),
    ("up", 0x52),
    ("numlock", 0x53),
    ("kpslash", 0x54),
    ("kpasterisk", 0x55),
    ("kpminus", 0x56),
    ("kpplus", 0x57),
    ("kpenter", 0x58),
    ("kp1", 0x59),
    ("kp2", 0x5a),
    ("kp3", 0x5b),
    ("kp4", 0x5c),
    ("kp5", 0x5d),
    ("kp6", 0x5e),
    ("kp7", 0x5f),
    ("kp8", 0x60),
    ("kp9", 0x61),
    ("kp0", 0x62),
    ("kpdot", 0x63),
    ("102nd", 0x64),
    ("compose", 0x65),
    ("power", 0x66),
    ("kpequal", 0x67),
    ("f13", 0x68),
    ("f14", 0x69),
    ("f15", 0x6a),
    ("f16", 0x6b),
    ("f17", 0x6c),
    ("f18", 0x6d),
    ("f19", 0x6e),
    ("f20", 0x6f),
    ("f21", 0x70),
    ("f22", 0x71),
    ("f23", 0x72),
    ("f24", 0x73),
    ("open", 0x74),
    ("help", 0x75),
    ("props", 0x76),
    ("front", 0x77),
    ("stop", 0x78),
    ("again", 0x79),
    ("undo", 0x7a),
    ("cut", 0x7b),
    ("copy", 0x7c),
    ("paste", 0x7d),
    ("find", 0x7e),
    ("mute", 0x7f),
    ("volumeup", 0x80),
    ("volumedown", 0x81),
    ("kpcomma", 0x85),
    ("ro", 0x87),
    ("katakanahiragana", 0x88),
    ("yen", 0x89),
    ("henkan", 0x8a),
    ("muhenkan", 0x8b),
    ("kpjpcomma", 0x8c),
    ("hangeul", 0x90),
    ("hanja", 0x91),
    ("katakana", 0x92),
    ("hiragana", 0x93),
    ("zenkakuhankaku", 0x94),
    ("kpleftparen", 0xb6),
    ("kprightparen", 0xb7),
    ("leftctrl", 0xe0),
    ("leftshift", 0xe1),
    ("leftalt", 0xe2),
    ("leftmeta", 0xe3),
    ("rightctrl", 0xe4),
    ("rightshift", 0xe5),
    ("rightalt", 0xe6),
    ("rightmeta", 0xe7),
    ("media_playpause", 0xe8),
    ("media_stopcd", 0xe9),
    ("media_previoussong", 0xea),
    ("media_nextsong", 0xeb),
    ("media_ejectcd", 0xec),
    ("media_volumeup", 0xed),
    ("media_volumedown", 0xee),
    ("media_mute", 0xef),
    ("media_www", 0xf0),
    ("media_back", 0xf1),
    ("media_forward", 0xf2),
    ("media_stop", 0xf3),
    ("media_find", 0xf4),
    ("media_scrollup", 0xf5),
    ("media_scrolldown", 0xf6),
    ("media_edit", 0xf7),
    ("media_sleep", 0xf8),
    ("media_coffee", 0xf9),
    ("media_refresh", 0xfa),
    ("media_calc", 0xfb),
];

static NAME_TO_SCAN: Lazy<HashMap<&'static str, u8>> =
    Lazy::new(|| HID_KEY_SPECS.iter().copied().collect());
static SCAN_TO_NAME: Lazy<HashMap<u8, &'static str>> = Lazy::new(|| {
    let mut map = HashMap::new();
    for (name, code) in HID_KEY_SPECS {
        map.insert(*code, *name);
    }
    map
});
static SCAN_NAME_ALIASES: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    HashMap::from([
        ("printscreen", "sysrq"),
        ("leftbracket", "leftbrace"),
        ("rightbracket", "rightbrace"),
    ])
});
static MOD_ALIASES: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    HashMap::from([
        ("ctrl", "lctrl"),
        ("shift", "lshift"),
        ("alt", "lalt"),
        ("meta", "lmeta"),
        ("lgui", "lmeta"),
        ("rgui", "rmeta"),
    ])
});
static MOD_NAME_TO_BIT: Lazy<HashMap<&'static str, u8>> = Lazy::new(|| {
    HashMap::from([
        ("lctrl", MOD_LCTRL),
        ("lshift", MOD_LSHIFT),
        ("lalt", MOD_LALT),
        ("lmeta", MOD_LGUI),
        ("rctrl", MOD_RCTRL),
        ("rshift", MOD_RSHIFT),
        ("ralt", MOD_RALT),
        ("rmeta", MOD_RGUI),
    ])
});

pub fn direction_from_path(path: impl AsRef<Path>) -> Direction {
    match path
        .as_ref()
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("log") => Direction::LogToJson,
        Some("json") => Direction::JsonToLog,
        _ => Direction::Unknown,
    }
}

pub fn read_log_file(path: impl AsRef<Path>) -> Result<(LogHeader, Vec<Record>)> {
    let mut file = fs::File::open(path)?;
    let header = read_log_header(&mut file)?;
    let mut records = Vec::new();
    loop {
        match read_record(&mut file) {
            Ok(record) => records.push(record),
            Err(MkpError::Io(error)) if error.kind() == io::ErrorKind::UnexpectedEof => break,
            Err(error) => return Err(error),
        }
    }
    Ok((header, records))
}

pub fn write_log_file(
    path: impl AsRef<Path>,
    header: &LogHeader,
    records: &[Record],
    has_mouse: bool,
    has_keyboard: bool,
) -> Result<()> {
    let mut file = fs::File::create(path)?;
    write_log_header(&mut file, header)?;
    for record in records {
        write_record(&mut file, record)?;
    }
    write_stop_trailer(&mut file, has_mouse, has_keyboard)?;
    Ok(())
}

pub fn read_json_file(path: impl AsRef<Path>) -> Result<Envelope> {
    let data = fs::read_to_string(path)?;
    let mut env: Envelope = serde_json::from_str(&data)?;
    if env.format.is_empty() {
        env.format = default_format();
    }
    if env.version.is_empty() {
        env.version = default_version();
    }
    Ok(env)
}

pub fn write_json_file(path: impl AsRef<Path>, env: &Envelope) -> Result<()> {
    fs::write(path, serde_json::to_string_pretty(env)? + "\n")?;
    Ok(())
}

pub fn log_to_json(header: &LogHeader, records: &[Record]) -> Envelope {
    let mut env = Envelope {
        format: default_format(),
        version: header.version.clone(),
        meta: MetaJson {
            width: header.meta.width,
            height: header.meta.height,
            start_x: header.meta.start_x as i16,
            start_y: header.meta.start_y as i16,
        },
        events: Vec::new(),
    };

    let mut mouse_state = MouseState::default();
    let mut keyboard_state = KeyboardState::default();
    let mut ts = 0i32;

    for record in records {
        ts += record.delta;
        match (record.port, record.length) {
            (1, 5) if record.payload.len() >= 5 => {
                let mut payload = [0u8; 5];
                payload.copy_from_slice(&record.payload[..5]);
                emit_mouse_events(&mut env, mouse_decode(payload), &mut mouse_state, ts);
            }
            (2, 8) if record.payload.len() >= 8 => {
                let modifier = record.payload[0];
                let mut keys = [0u8; KBD_MAX_KEYS];
                keys.copy_from_slice(&record.payload[2..2 + KBD_MAX_KEYS]);
                emit_keyboard_events(&mut env, modifier, keys, &mut keyboard_state, ts);
            }
            _ => {}
        }
    }

    env
}

pub fn json_to_log(env: &Envelope) -> Result<(LogHeader, Vec<Record>, bool, bool)> {
    let version = match env.version.as_str() {
        MAGIC_V1 | MAGIC_V2 => env.version.clone(),
        _ => MAGIC_V1.to_string(),
    };
    let header = LogHeader {
        version,
        meta: Meta {
            width: env.meta.width,
            height: env.meta.height,
            start_x: env.meta.start_x as u16,
            start_y: env.meta.start_y as u16,
        },
    };

    let mut records = Vec::new();
    let mut cur_button = 0u8;
    let mut keyboard_state = KeyboardState::default();
    let mut prev_ts = 0i32;
    let mut first = true;
    let mut has_mouse = false;
    let mut has_keyboard = false;

    for (index, event) in env.events.iter().enumerate() {
        let ts = event_ts(event);
        let mut delta = if first {
            first = false;
            ts
        } else {
            ts - prev_ts
        };
        if delta < 0 {
            delta = 0;
        }
        prev_ts = ts;

        match event {
            Event::MouseMove(value) => {
                let payload = mouse_encode(cur_button, value.x, value.y, 0);
                records.push(Record {
                    port: 1,
                    delta,
                    length: 5,
                    payload: payload.to_vec(),
                });
                has_mouse = true;
            }
            Event::MouseDown(value) => {
                let bit = button_bit(&value.button).ok_or_else(|| {
                    MkpError::InvalidArgument(format!(
                        "event {index} MouseDown: unknown button \"{}\"",
                        value.button
                    ))
                })?;
                cur_button |= bit;
                let payload = mouse_encode(cur_button, 0, 0, 0);
                records.push(Record {
                    port: 1,
                    delta,
                    length: 5,
                    payload: payload.to_vec(),
                });
                has_mouse = true;
            }
            Event::MouseUp(value) => {
                let bit = button_bit(&value.button).ok_or_else(|| {
                    MkpError::InvalidArgument(format!(
                        "event {index} MouseUp: unknown button \"{}\"",
                        value.button
                    ))
                })?;
                cur_button &= !bit;
                let payload = mouse_encode(cur_button, 0, 0, 0);
                records.push(Record {
                    port: 1,
                    delta,
                    length: 5,
                    payload: payload.to_vec(),
                });
                has_mouse = true;
            }
            Event::Wheel(value) => {
                let payload = mouse_encode(cur_button, 0, 0, value.delta);
                records.push(Record {
                    port: 1,
                    delta,
                    length: 5,
                    payload: payload.to_vec(),
                });
                has_mouse = true;
            }
            Event::KeyDown(value) => {
                apply_keyboard_names(&mut keyboard_state, &value.keys, true).map_err(|error| {
                    MkpError::InvalidArgument(format!("event {index} KeyDown: {error}"))
                })?;
                let report = build_keyboard_report(&keyboard_state);
                records.push(Record {
                    port: 2,
                    delta,
                    length: 8,
                    payload: report.to_vec(),
                });
                has_keyboard = true;
            }
            Event::KeyUp(value) => {
                apply_keyboard_names(&mut keyboard_state, &value.keys, false).map_err(|error| {
                    MkpError::InvalidArgument(format!("event {index} KeyUp: {error}"))
                })?;
                let report = build_keyboard_report(&keyboard_state);
                records.push(Record {
                    port: 2,
                    delta,
                    length: 8,
                    payload: report.to_vec(),
                });
                has_keyboard = true;
            }
        }
    }

    Ok((header, records, has_mouse, has_keyboard))
}

pub fn convert_log_file_to_json_file(
    in_path: impl AsRef<Path>,
    out_path: impl AsRef<Path>,
) -> Result<()> {
    let (header, records) = read_log_file(in_path)?;
    let env = log_to_json(&header, &records);
    write_json_file(out_path, &env)
}

pub fn convert_json_file_to_log_file(
    in_path: impl AsRef<Path>,
    out_path: impl AsRef<Path>,
) -> Result<()> {
    let env = read_json_file(in_path)?;
    let (header, records, has_mouse, has_keyboard) = json_to_log(&env)?;
    write_log_file(out_path, &header, &records, has_mouse, has_keyboard)
}

pub fn mouse_encode(button: u8, x: i16, y: i16, wheel: i8) -> [u8; 5] {
    let mut out = [0u8; 5];
    out[0] = button;
    let ux = (x as u16) & 0x0fff;
    let uy = (y as u16) & 0x0fff;
    out[1] = (ux & 0xff) as u8;
    out[2] = ((ux >> 8) as u8 & 0x0f) | (((uy & 0x0f) as u8) << 4);
    out[3] = ((uy >> 4) & 0xff) as u8;
    out[4] = wheel as u8;
    out
}

pub fn mouse_decode(payload: [u8; 5]) -> MouseReport {
    let button = payload[0];
    let wheel = payload[4] as i8;
    let ux = payload[1] as u16 | ((payload[2] as u16 & 0x0f) << 8);
    let uy = ((payload[2] as u16) >> 4) | ((payload[3] as u16) << 4);

    let mut x = ux & 0x0fff;
    if x & 0x0800 != 0 {
        x |= 0xf000;
    }
    let mut y = uy & 0x0fff;
    if y & 0x0800 != 0 {
        y |= 0xf000;
    }

    MouseReport {
        button,
        x: x as i16,
        y: y as i16,
        wheel,
    }
}

fn emit_mouse_events(env: &mut Envelope, report: MouseReport, state: &mut MouseState, ts: i32) {
    if report.x != 0 || report.y != 0 {
        env.events.push(Event::MouseMove(MouseMoveEvent {
            x: report.x,
            y: report.y,
            ts,
        }));
    }

    let down = report.button & !state.prev_button;
    let up = state.prev_button & !report.button;

    for bit in [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE] {
        if let Some(name) = button_name(bit) {
            if down & bit != 0 {
                env.events.push(Event::MouseDown(ButtonEvent {
                    button: name.to_string(),
                    ts,
                }));
            }
            if up & bit != 0 {
                env.events.push(Event::MouseUp(ButtonEvent {
                    button: name.to_string(),
                    ts,
                }));
            }
        }
    }

    if report.wheel != 0 {
        env.events.push(Event::Wheel(WheelEvent {
            delta: report.wheel,
            ts,
        }));
    }

    state.prev_button = report.button;
}

fn emit_keyboard_events(
    env: &mut Envelope,
    modifier: u8,
    keys: [u8; KBD_MAX_KEYS],
    state: &mut KeyboardState,
    ts: i32,
) {
    let mod_down = (modifier ^ state.prev_modifier) & modifier;
    let mod_up = (modifier ^ state.prev_modifier) & state.prev_modifier;

    let mut down_names = Vec::new();
    let mut up_names = Vec::new();

    for bit in 0..8u8 {
        if mod_down & (1 << bit) != 0
            && let Some(name) = mod_name(bit)
        {
            down_names.push(name.to_string());
        }
        if mod_up & (1 << bit) != 0
            && let Some(name) = mod_name(bit)
        {
            up_names.push(name.to_string());
        }
    }

    for key in keys {
        if key == 0 {
            continue;
        }
        if !state.prev_keys.contains(&key)
            && let Some(name) = scan_name(key)
        {
            down_names.push(name.to_string());
        }
    }

    for key in state.prev_keys {
        if key == 0 {
            continue;
        }
        if !keys.contains(&key)
            && let Some(name) = scan_name(key)
        {
            up_names.push(name.to_string());
        }
    }

    if !down_names.is_empty() {
        env.events.push(Event::KeyDown(KeyEvent {
            keys: down_names,
            ts,
        }));
    }
    if !up_names.is_empty() {
        env.events
            .push(Event::KeyUp(KeyEvent { keys: up_names, ts }));
    }

    state.prev_modifier = modifier;
    state.prev_keys = keys;
}

fn event_ts(event: &Event) -> i32 {
    match event {
        Event::MouseMove(value) => value.ts,
        Event::MouseDown(value) => value.ts,
        Event::MouseUp(value) => value.ts,
        Event::Wheel(value) => value.ts,
        Event::KeyDown(value) => value.ts,
        Event::KeyUp(value) => value.ts,
    }
}

fn normalize_scan_name(name: &str) -> String {
    let key = name.trim().to_ascii_lowercase();
    SCAN_NAME_ALIASES
        .get(key.as_str())
        .copied()
        .unwrap_or(key.as_str())
        .to_string()
}

fn normalize_mod_name(name: &str) -> String {
    let mut key = name.trim().to_ascii_lowercase();
    if let Some(stripped) = key.strip_prefix("mod_") {
        key = stripped.to_string();
    }
    MOD_ALIASES
        .get(key.as_str())
        .copied()
        .unwrap_or(key.as_str())
        .to_string()
}

fn scan_code(name: &str) -> Option<u8> {
    NAME_TO_SCAN
        .get(normalize_scan_name(name).as_str())
        .copied()
}

fn scan_name(code: u8) -> Option<&'static str> {
    SCAN_TO_NAME.get(&code).copied()
}

fn is_mod_name(name: &str) -> bool {
    MOD_NAME_TO_BIT.contains_key(normalize_mod_name(name).as_str())
}

fn mod_bit(name: &str) -> u8 {
    MOD_NAME_TO_BIT
        .get(normalize_mod_name(name).as_str())
        .copied()
        .unwrap_or(0)
}

fn mod_name(bit: u8) -> Option<&'static str> {
    match bit {
        0 => Some("lctrl"),
        1 => Some("lshift"),
        2 => Some("lalt"),
        3 => Some("lmeta"),
        4 => Some("rctrl"),
        5 => Some("rshift"),
        6 => Some("ralt"),
        7 => Some("rmeta"),
        _ => None,
    }
}

fn button_bit(name: &str) -> Option<u8> {
    match name.trim().to_ascii_lowercase().as_str() {
        "left" => Some(MOUSE_BUTTON_LEFT),
        "right" => Some(MOUSE_BUTTON_RIGHT),
        "middle" => Some(MOUSE_BUTTON_MIDDLE),
        _ => None,
    }
}

fn button_name(bit: u8) -> Option<&'static str> {
    match bit {
        MOUSE_BUTTON_LEFT => Some("left"),
        MOUSE_BUTTON_RIGHT => Some("right"),
        MOUSE_BUTTON_MIDDLE => Some("middle"),
        _ => None,
    }
}

fn apply_keyboard_names(
    state: &mut KeyboardState,
    names: &[String],
    is_down: bool,
) -> std::result::Result<(), String> {
    for name in names {
        if is_mod_name(name) {
            let bit = mod_bit(name);
            if is_down {
                state.prev_modifier |= bit;
            } else {
                state.prev_modifier &= !bit;
            }
            continue;
        }

        let code = scan_code(name).ok_or_else(|| format!("unknown key name \"{name}\""))?;
        if code == 0 {
            return Err(format!("unknown key name \"{name}\""));
        }

        if is_down {
            if state.prev_keys.contains(&code) {
                continue;
            }
            let mut inserted = false;
            for slot in &mut state.prev_keys {
                if *slot == 0 {
                    *slot = code;
                    inserted = true;
                    break;
                }
            }
            if !inserted {
                return Err(format!("too many simultaneous keys (max {KBD_MAX_KEYS})"));
            }
        } else {
            for slot in &mut state.prev_keys {
                if *slot == code {
                    *slot = 0;
                    break;
                }
            }
        }
    }
    Ok(())
}

fn build_keyboard_report(state: &KeyboardState) -> [u8; 8] {
    let mut report = [0u8; 8];
    report[0] = state.prev_modifier;
    for (index, key) in state.prev_keys.iter().enumerate() {
        report[2 + index] = *key;
    }
    report
}

fn read_log_header<R: Read>(reader: &mut R) -> Result<LogHeader> {
    let mut magic = [0u8; MAGIC_LENGTH];
    reader.read_exact(&mut magic)?;
    match std::str::from_utf8(&magic).unwrap_or_default() {
        MAGIC_V1 => Ok(LogHeader {
            version: MAGIC_V1.to_string(),
            meta: Meta::default(),
        }),
        MAGIC_V2 => {
            let mut meta_bytes = [0u8; META_LENGTH];
            reader.read_exact(&mut meta_bytes)?;
            Ok(LogHeader {
                version: MAGIC_V2.to_string(),
                meta: Meta {
                    width: u16::from_le_bytes([meta_bytes[0], meta_bytes[1]]),
                    height: u16::from_le_bytes([meta_bytes[2], meta_bytes[3]]),
                    start_x: u16::from_le_bytes([meta_bytes[4], meta_bytes[5]]),
                    start_y: u16::from_le_bytes([meta_bytes[6], meta_bytes[7]]),
                },
            })
        }
        value => Err(MkpError::InvalidArgument(format!("bad magic \"{value}\""))),
    }
}

fn read_record<R: Read>(reader: &mut R) -> Result<Record> {
    let mut header = [0u8; RECORD_HEADER_SIZE];
    reader.read_exact(&mut header)?;
    let length = u16::from_le_bytes([header[5], header[6]]);
    if length as usize > MAX_PAYLOAD_LENGTH {
        return Err(MkpError::InvalidArgument(format!(
            "record length {length} exceeds cap {MAX_PAYLOAD_LENGTH}"
        )));
    }
    let mut payload = vec![0u8; length as usize];
    if length > 0 {
        reader.read_exact(&mut payload)?;
    }
    Ok(Record {
        port: header[0],
        delta: u32::from_le_bytes([header[1], header[2], header[3], header[4]]) as i32,
        length,
        payload,
    })
}

fn write_log_header<W: Write>(writer: &mut W, header: &LogHeader) -> Result<()> {
    match header.version.as_str() {
        MAGIC_V2 => {
            writer.write_all(MAGIC_V2.as_bytes())?;
            writer.write_all(&header.meta.width.to_le_bytes())?;
            writer.write_all(&header.meta.height.to_le_bytes())?;
            writer.write_all(&header.meta.start_x.to_le_bytes())?;
            writer.write_all(&header.meta.start_y.to_le_bytes())?;
            writer.write_all(&0u32.to_le_bytes())?;
        }
        _ => writer.write_all(MAGIC_V1.as_bytes())?,
    }
    Ok(())
}

fn write_record<W: Write>(writer: &mut W, record: &Record) -> Result<()> {
    writer.write_all(&[record.port])?;
    writer.write_all(&(record.delta as u32).to_le_bytes())?;
    writer.write_all(&record.length.to_le_bytes())?;
    if !record.payload.is_empty() {
        writer.write_all(&record.payload)?;
    }
    Ok(())
}

fn write_stop_trailer<W: Write>(writer: &mut W, has_mouse: bool, has_keyboard: bool) -> Result<()> {
    const DELTA: i32 = 8;
    if has_mouse {
        for _ in 0..3 {
            write_record(
                writer,
                &Record {
                    port: 1,
                    delta: DELTA,
                    length: 5,
                    payload: vec![0; 5],
                },
            )?;
        }
    }
    if has_keyboard {
        write_record(
            writer,
            &Record {
                port: 2,
                delta: DELTA,
                length: 8,
                payload: vec![0; 8],
            },
        )?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        ButtonEvent, Envelope, Event, KeyEvent, LogHeader, MAGIC_V1, MetaJson, MouseMoveEvent,
        Record, WheelEvent, json_to_log, log_to_json, mouse_decode, mouse_encode,
    };

    #[test]
    fn mouse_codec_round_trip() {
        let encoded = mouse_encode(1, 12, -7, 1);
        let decoded = mouse_decode(encoded);
        assert_eq!(decoded.button, 1);
        assert_eq!(decoded.x, 12);
        assert_eq!(decoded.y, -7);
        assert_eq!(decoded.wheel, 1);
    }

    #[test]
    fn envelope_round_trip_keeps_event_shapes() {
        let env = Envelope {
            format: "mkp-action-v1".to_string(),
            version: MAGIC_V1.to_string(),
            meta: MetaJson::default(),
            events: vec![
                Event::MouseMove(MouseMoveEvent { x: 5, y: -3, ts: 0 }),
                Event::MouseDown(ButtonEvent {
                    button: "left".to_string(),
                    ts: 8,
                }),
                Event::Wheel(WheelEvent { delta: 1, ts: 16 }),
                Event::MouseUp(ButtonEvent {
                    button: "left".to_string(),
                    ts: 24,
                }),
                Event::KeyDown(KeyEvent {
                    keys: vec!["lshift".to_string(), "a".to_string()],
                    ts: 32,
                }),
                Event::KeyUp(KeyEvent {
                    keys: vec!["a".to_string(), "lshift".to_string()],
                    ts: 40,
                }),
            ],
        };

        let (header, records, has_mouse, has_keyboard) = json_to_log(&env).expect("json to log");
        assert_eq!(header.version, MAGIC_V1);
        assert!(has_mouse);
        assert!(has_keyboard);
        let round_trip = log_to_json(
            &LogHeader {
                version: MAGIC_V1.to_string(),
                meta: Default::default(),
            },
            &records,
        );
        assert!(!round_trip.events.is_empty());
    }

    #[test]
    fn log_to_json_decodes_records() {
        let records = vec![
            Record {
                port: 1,
                delta: 0,
                length: 5,
                payload: mouse_encode(0, 5, -3, 0).to_vec(),
            },
            Record {
                port: 2,
                delta: 8,
                length: 8,
                payload: vec![0, 0, 0x04, 0, 0, 0, 0, 0],
            },
        ];
        let env = log_to_json(
            &LogHeader {
                version: MAGIC_V1.to_string(),
                meta: Default::default(),
            },
            &records,
        );
        assert_eq!(env.events.len(), 2);
    }
}
