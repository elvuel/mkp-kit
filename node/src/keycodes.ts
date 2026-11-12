export const MOD_KEY_NAMES = [
  "MOD_LCTRL",
  "MOD_LSHIFT",
  "MOD_LALT",
  "MOD_LMETA",
  "MOD_RCTRL",
  "MOD_RSHIFT",
  "MOD_RALT",
  "MOD_RMETA",
] as const;

export const MOD_KEY_SHORT_NAMES = ["LCTRL", "LSHIFT", "LALT", "LMETA", "RCTRL", "RSHIFT", "RALT", "RMETA"] as const;

export const KEY_NAME_TO_NCODE: Record<string, number> = {
  MOD_LCTRL: 0x01,
  MOD_LSHIFT: 0x02,
  MOD_LALT: 0x04,
  MOD_LMETA: 0x08,
  MOD_RCTRL: 0x10,
  MOD_RSHIFT: 0x20,
  MOD_RALT: 0x40,
  MOD_RMETA: 0x80,
  NONE: 0x00,
  A: 0x04,
  B: 0x05,
  C: 0x06,
  D: 0x07,
  E: 0x08,
  F: 0x09,
  G: 0x0a,
  H: 0x0b,
  I: 0x0c,
  J: 0x0d,
  K: 0x0e,
  L: 0x0f,
  M: 0x10,
  N: 0x11,
  O: 0x12,
  P: 0x13,
  Q: 0x14,
  R: 0x15,
  S: 0x16,
  T: 0x17,
  U: 0x18,
  V: 0x19,
  W: 0x1a,
  X: 0x1b,
  Y: 0x1c,
  Z: 0x1d,
  "1": 0x1e,
  "2": 0x1f,
  "3": 0x20,
  "4": 0x21,
  "5": 0x22,
  "6": 0x23,
  "7": 0x24,
  "8": 0x25,
  "9": 0x26,
  "0": 0x27,
  ENTER: 0x28,
  ESC: 0x29,
  BACKSPACE: 0x2a,
  TAB: 0x2b,
  SPACE: 0x2c,
  MINUS: 0x2d,
  EQUAL: 0x2e,
  LEFTBRACE: 0x2f,
  RIGHTBRACE: 0x30,
  BACKSLASH: 0x31,
  SEMICOLON: 0x33,
  APOSTROPHE: 0x34,
  GRAVE: 0x35,
  COMMA: 0x36,
  DOT: 0x37,
  SLASH: 0x38,
  RIGHT: 0x4f,
  LEFT: 0x50,
  DOWN: 0x51,
  UP: 0x52
};

export const KEY_NAME_TO_HEXCODE: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_NAME_TO_NCODE).map(([name, code]) => [name, "0x" + code.toString(16).padStart(2, "0")]),
);

export const SYMBOL_EXPANSIONS: Record<string, string[]> = {
  "!": ["MOD_LSHIFT", "1"],
  "@": ["MOD_LSHIFT", "2"],
  "#": ["MOD_LSHIFT", "3"],
  "$": ["MOD_LSHIFT", "4"],
  "%": ["MOD_LSHIFT", "5"],
  "^": ["MOD_LSHIFT", "6"],
  "&": ["MOD_LSHIFT", "7"],
  "*": ["MOD_LSHIFT", "8"],
  "(": ["MOD_LSHIFT", "9"],
  ")": ["MOD_LSHIFT", "0"],
  " ": ["SPACE"],
  "-": ["MINUS"],
  "_": ["MOD_LSHIFT", "MINUS"],
  "=": ["EQUAL"],
  "+": ["MOD_LSHIFT", "EQUAL"],
  "[": ["LEFTBRACE"],
  "{": ["MOD_LSHIFT", "LEFTBRACE"],
  "]": ["RIGHTBRACE"],
  "}": ["MOD_LSHIFT", "RIGHTBRACE"],
  "\\": ["BACKSLASH"],
  "|": ["MOD_LSHIFT", "BACKSLASH"],
  ";": ["SEMICOLON"],
  ":": ["MOD_LSHIFT", "SEMICOLON"],
  "'": ["APOSTROPHE"],
  '"': ["MOD_LSHIFT", "APOSTROPHE"],
  "`": ["GRAVE"],
  "~": ["MOD_LSHIFT", "GRAVE"],
  ",": ["COMMA"],
  "<": ["MOD_LSHIFT", "COMMA"],
  ".": ["DOT"],
  ">": ["MOD_LSHIFT", "DOT"],
  "/": ["SLASH"],
  "?": ["MOD_LSHIFT", "SLASH"]
};

export function isModKey(key: string): boolean {
  return MOD_KEY_NAMES.includes(key as (typeof MOD_KEY_NAMES)[number]);
}

export function keyNameToHexcode(key: string): string | undefined {
  return KEY_NAME_TO_HEXCODE[key];
}

export function normalizeKpadKey(key: string): string {
  const normalized = key.trim().toUpperCase();
  if (!normalized) {
    return "";
  }
  switch (normalized) {
    case "CTRL":
      return "MOD_LCTRL";
    case "SHIFT":
      return "MOD_LSHIFT";
    case "ALT":
      return "MOD_LALT";
    case "META":
      return "MOD_LMETA";
    case "LEFTBRACKET":
      return "LEFTBRACE";
    case "RIGHTBRACKET":
      return "RIGHTBRACE";
    default:
      return MOD_KEY_SHORT_NAMES.includes(normalized as (typeof MOD_KEY_SHORT_NAMES)[number]) ? "MOD_" + normalized : normalized;
  }
}

export function expandKpadInputKey(key: string): string[] {
  if (SYMBOL_EXPANSIONS[key] !== undefined) {
    return [...SYMBOL_EXPANSIONS[key]];
  }
  if (key.length === 1 && key >= "a" && key <= "z") {
    return [key.toUpperCase()];
  }
  if (key.length === 1 && key >= "A" && key <= "Z") {
    return ["MOD_LSHIFT", key];
  }
  const normalized = normalizeKpadKey(key);
  return normalized ? [normalized] : [];
}

export function modStatus(modKeys: string[]): string {
  if (modKeys.length === 0) {
    return "";
  }
  const code = modKeys.reduce((acc, key) => acc | (KEY_NAME_TO_NCODE[key] ?? 0), 0);
  return "0x" + code.toString(16).padStart(2, "0");
}

export function splitKeys(keys: string[]): { modKeys: string[]; normalKeys: string[] } {
  const modKeys: string[] = [];
  const normalKeys: string[] = [];
  for (const key of keys) {
    if (isModKey(key)) {
      modKeys.push(key);
    } else {
      normalKeys.push(key);
    }
  }
  return { modKeys, normalKeys };
}
