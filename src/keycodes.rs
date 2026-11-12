use once_cell::sync::Lazy;
use std::collections::HashMap;

pub const MOD_KEY_NAMES: [&str; 8] = [
    "MOD_LCTRL",
    "MOD_LSHIFT",
    "MOD_LALT",
    "MOD_LMETA",
    "MOD_RCTRL",
    "MOD_RSHIFT",
    "MOD_RALT",
    "MOD_RMETA",
];

pub const MOD_KEY_SHORT_NAMES: [&str; 8] = [
    "LCTRL", "LSHIFT", "LALT", "LMETA", "RCTRL", "RSHIFT", "RALT", "RMETA",
];

const KEY_NAME_TO_NCODE_PAIRS: [(&str, u16); 176] = [
    ("MOD_LCTRL", 1),
    ("MOD_LSHIFT", 2),
    ("MOD_LALT", 4),
    ("MOD_LMETA", 8),
    ("MOD_RCTRL", 16),
    ("MOD_RSHIFT", 32),
    ("MOD_RALT", 64),
    ("MOD_RMETA", 128),
    ("NONE", 0),
    ("ERR_OVF", 1),
    ("A", 4),
    ("B", 5),
    ("C", 6),
    ("D", 7),
    ("E", 8),
    ("F", 9),
    ("G", 10),
    ("H", 11),
    ("I", 12),
    ("J", 13),
    ("K", 14),
    ("L", 15),
    ("M", 16),
    ("N", 17),
    ("O", 18),
    ("P", 19),
    ("Q", 20),
    ("R", 21),
    ("S", 22),
    ("T", 23),
    ("U", 24),
    ("V", 25),
    ("W", 26),
    ("X", 27),
    ("Y", 28),
    ("Z", 29),
    ("1", 30),
    ("2", 31),
    ("3", 32),
    ("4", 33),
    ("5", 34),
    ("6", 35),
    ("7", 36),
    ("8", 37),
    ("9", 38),
    ("0", 39),
    ("ENTER", 40),
    ("ESC", 41),
    ("BACKSPACE", 42),
    ("TAB", 43),
    ("SPACE", 44),
    ("MINUS", 45),
    ("EQUAL", 46),
    ("LEFTBRACE", 47),
    ("RIGHTBRACE", 48),
    ("BACKSLASH", 49),
    ("HASHTILDE", 50),
    ("SEMICOLON", 51),
    ("APOSTROPHE", 52),
    ("GRAVE", 53),
    ("COMMA", 54),
    ("DOT", 55),
    ("SLASH", 56),
    ("CAPSLOCK", 57),
    ("F1", 58),
    ("F2", 59),
    ("F3", 60),
    ("F4", 61),
    ("F5", 62),
    ("F6", 63),
    ("F7", 64),
    ("F8", 65),
    ("F9", 66),
    ("F10", 67),
    ("F11", 68),
    ("F12", 69),
    ("SYSRQ", 70),
    ("SCROLLLOCK", 71),
    ("PAUSE", 72),
    ("INSERT", 73),
    ("HOME", 74),
    ("PAGEUP", 75),
    ("DELETE", 76),
    ("END", 77),
    ("PAGEDOWN", 78),
    ("RIGHT", 79),
    ("LEFT", 80),
    ("DOWN", 81),
    ("UP", 82),
    ("NUMLOCK", 83),
    ("KPSLASH", 84),
    ("KPASTERISK", 85),
    ("KPMINUS", 86),
    ("KPPLUS", 87),
    ("KPENTER", 88),
    ("KP1", 89),
    ("KP2", 90),
    ("KP3", 91),
    ("KP4", 92),
    ("KP5", 93),
    ("KP6", 94),
    ("KP7", 95),
    ("KP8", 96),
    ("KP9", 97),
    ("KP0", 98),
    ("KPDOT", 99),
    ("102ND", 100),
    ("COMPOSE", 101),
    ("POWER", 102),
    ("KPEQUAL", 103),
    ("F13", 104),
    ("F14", 105),
    ("F15", 106),
    ("F16", 107),
    ("F17", 108),
    ("F18", 109),
    ("F19", 110),
    ("F20", 111),
    ("F21", 112),
    ("F22", 113),
    ("F23", 114),
    ("F24", 115),
    ("OPEN", 116),
    ("HELP", 117),
    ("PROPS", 118),
    ("FRONT", 119),
    ("STOP", 120),
    ("AGAIN", 121),
    ("UNDO", 122),
    ("CUT", 123),
    ("COPY", 124),
    ("PASTE", 125),
    ("FIND", 126),
    ("MUTE", 127),
    ("VOLUMEUP", 128),
    ("VOLUMEDOWN", 129),
    ("KPCOMMA", 133),
    ("RO", 135),
    ("KATAKANAHIRAGANA", 136),
    ("YEN", 137),
    ("HENKAN", 138),
    ("MUHENKAN", 139),
    ("KPJPCOMMA", 140),
    ("HANGEUL", 144),
    ("HANJA", 145),
    ("KATAKANA", 146),
    ("HIRAGANA", 147),
    ("ZENKAKUHANKAKU", 148),
    ("LEFTCTRL", 224),
    ("LEFTSHIFT", 225),
    ("LEFTALT", 226),
    ("LEFTMETA", 227),
    ("RIGHTCTRL", 228),
    ("RIGHTSHIFT", 229),
    ("RIGHTALT", 230),
    ("RIGHTMETA", 231),
    ("MEDIA_PLAYPAUSE", 232),
    ("MEDIA_STOPCD", 233),
    ("MEDIA_PREVIOUSSONG", 234),
    ("MEDIA_NEXTSONG", 235),
    ("MEDIA_EJECTCD", 236),
    ("MEDIA_VOLUMEUP", 237),
    ("MEDIA_VOLUMEDOWN", 238),
    ("MEDIA_MUTE", 239),
    ("MEDIA_WWW", 240),
    ("MEDIA_BACK", 241),
    ("MEDIA_FORWARD", 242),
    ("MEDIA_STOP", 243),
    ("MEDIA_FIND", 244),
    ("MEDIA_SCROLLUP", 245),
    ("MEDIA_SCROLLDOWN", 246),
    ("MEDIA_EDIT", 247),
    ("MEDIA_SLEEP", 248),
    ("MEDIA_COFFEE", 249),
    ("MEDIA_REFRESH", 250),
    ("MEDIA_CALC", 251),
];

const SYMBOL_EXPANSION_PAIRS: [(&str, &[&str]); 32] = [
    ("!", &["MOD_LSHIFT", "1"]),
    ("@", &["MOD_LSHIFT", "2"]),
    ("#", &["MOD_LSHIFT", "3"]),
    ("$", &["MOD_LSHIFT", "4"]),
    ("%", &["MOD_LSHIFT", "5"]),
    ("^", &["MOD_LSHIFT", "6"]),
    ("&", &["MOD_LSHIFT", "7"]),
    ("*", &["MOD_LSHIFT", "8"]),
    ("(", &["MOD_LSHIFT", "9"]),
    (")", &["MOD_LSHIFT", "0"]),
    (" ", &["SPACE"]),
    ("-", &["MINUS"]),
    ("_", &["MOD_LSHIFT", "MINUS"]),
    ("=", &["EQUAL"]),
    ("+", &["MOD_LSHIFT", "EQUAL"]),
    ("[", &["LEFTBRACE"]),
    ("{", &["MOD_LSHIFT", "LEFTBRACE"]),
    ("]", &["RIGHTBRACE"]),
    ("}", &["MOD_LSHIFT", "RIGHTBRACE"]),
    ("\\", &["BACKSLASH"]),
    ("|", &["MOD_LSHIFT", "BACKSLASH"]),
    (";", &["SEMICOLON"]),
    (":", &["MOD_LSHIFT", "SEMICOLON"]),
    ("'", &["APOSTROPHE"]),
    ("\"", &["MOD_LSHIFT", "APOSTROPHE"]),
    ("`", &["GRAVE"]),
    ("~", &["MOD_LSHIFT", "GRAVE"]),
    (",", &["COMMA"]),
    ("<", &["MOD_LSHIFT", "COMMA"]),
    (".", &["DOT"]),
    (">", &["MOD_LSHIFT", "DOT"]),
    ("/", &["SLASH"]),
];

pub static KEY_NAME_TO_NCODE: Lazy<HashMap<&'static str, u16>> =
    Lazy::new(|| KEY_NAME_TO_NCODE_PAIRS.into_iter().collect());

pub static SYMBOL_EXPANSIONS: Lazy<HashMap<&'static str, &'static [&'static str]>> =
    Lazy::new(|| SYMBOL_EXPANSION_PAIRS.into_iter().collect());

pub fn is_mod_key(key: &str) -> bool {
    MOD_KEY_NAMES.contains(&key)
}

pub fn key_name_to_ncode(key: &str) -> Option<u16> {
    KEY_NAME_TO_NCODE.get(key).copied()
}

pub fn key_name_to_hexcode(key: &str) -> Option<String> {
    key_name_to_ncode(key).map(|code| format!("0x{code:02x}"))
}

pub fn normalize_kpad_key(key: &str) -> String {
    let normalized = key.trim().to_uppercase();
    if normalized.is_empty() {
        return String::new();
    }
    match normalized.as_str() {
        "CTRL" => "MOD_LCTRL".to_string(),
        "SHIFT" => "MOD_LSHIFT".to_string(),
        "ALT" => "MOD_LALT".to_string(),
        "META" => "MOD_LMETA".to_string(),
        "LEFTBRACKET" => "LEFTBRACE".to_string(),
        "RIGHTBRACKET" => "RIGHTBRACE".to_string(),
        short if MOD_KEY_SHORT_NAMES.contains(&short) => format!("MOD_{short}"),
        _ => normalized,
    }
}

pub fn expand_kpad_input_key(key: &str) -> Vec<String> {
    if let Some(keys) = SYMBOL_EXPANSIONS.get(key) {
        return keys.iter().map(|item| (*item).to_string()).collect();
    }
    let normalized = normalize_kpad_key(key);
    if normalized.is_empty() {
        Vec::new()
    } else {
        vec![normalized]
    }
}

pub fn mod_status(mod_keys: &[String]) -> String {
    if mod_keys.is_empty() {
        return String::new();
    }
    let code = mod_keys
        .iter()
        .filter_map(|key| key_name_to_ncode(key))
        .fold(0u16, |acc, value| acc | value);
    format!("0x{code:02x}")
}

pub fn split_keys(keys: &[String]) -> (Vec<String>, Vec<String>) {
    let mut mod_keys = Vec::new();
    let mut normal_keys = Vec::new();
    for key in keys {
        if is_mod_key(key) {
            mod_keys.push(key.clone());
        } else {
            normal_keys.push(key.clone());
        }
    }
    (mod_keys, normal_keys)
}

#[cfg(test)]
mod tests {
    use super::{expand_kpad_input_key, key_name_to_hexcode, mod_status, normalize_kpad_key};

    #[test]
    fn normalizes_aliases() {
        assert_eq!(normalize_kpad_key("ctrl"), "MOD_LCTRL");
        assert_eq!(normalize_kpad_key("rightbracket"), "RIGHTBRACE");
    }

    #[test]
    fn expands_symbol() {
        assert_eq!(expand_kpad_input_key("!"), vec!["MOD_LSHIFT", "1"]);
    }

    #[test]
    fn computes_modifier_status() {
        assert_eq!(
            mod_status(&["MOD_LSHIFT".into(), "MOD_LCTRL".into()]),
            "0x03"
        );
    }

    #[test]
    fn returns_hexcode() {
        assert_eq!(key_name_to_hexcode("A").as_deref(), Some("0x04"));
    }
}
