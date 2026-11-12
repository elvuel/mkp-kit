import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const MAGIC_V1 = "MKv1";
export const MAGIC_V2 = "MKv2";
export const MAGIC_LENGTH = 4;
export const META_LENGTH = 12;
export const HEADER_LENGTH_V1 = MAGIC_LENGTH;
export const HEADER_LENGTH_V2 = MAGIC_LENGTH + META_LENGTH;
export const RECORD_HEADER_SIZE = 7;
export const MAX_PAYLOAD_LENGTH = 64;
export const KBD_MAX_KEYS = 6;

export interface Meta {
  width: number;
  height: number;
  startX: number;
  startY: number;
}

export interface LogHeader {
  version: string;
  meta: Meta;
}

export interface LogRecord {
  port: number;
  delta: number;
  length: number;
  payload: Uint8Array;
}

export interface MetaJSON {
  width: number;
  height: number;
  startX: number;
  startY: number;
}

export interface MouseMoveEvent {
  x: number;
  y: number;
  ts: number;
}

export interface ButtonEvent {
  button: string;
  ts: number;
}

export interface WheelEvent {
  delta: number;
  ts: number;
}

export interface KeyEvent {
  keys: string[];
  ts: number;
}

export type Event =
  | { typeName: "MouseMove"; mouseMove: MouseMoveEvent }
  | { typeName: "MouseDown"; mouseDown: ButtonEvent }
  | { typeName: "MouseUp"; mouseUp: ButtonEvent }
  | { typeName: "Wheel"; wheel: WheelEvent }
  | { typeName: "KeyDown"; keyDown: KeyEvent }
  | { typeName: "KeyUp"; keyUp: KeyEvent };

export interface Envelope {
  format: string;
  version: string;
  meta: MetaJSON;
  events: Event[];
}

export interface MouseReport {
  button: number;
  x: number;
  y: number;
  wheel: number;
}

export enum Direction {
  Unknown = "unknown",
  LogToJson = "log-to-json",
  JsonToLog = "json-to-log"
}

export interface JsonToLogResult {
  header: LogHeader;
  records: LogRecord[];
  hasMouse: boolean;
  hasKeyboard: boolean;
}

export interface ConverterRunIO {
  out(message: string): void;
  err(message: string): void;
}

const MOUSE_BUTTON_LEFT = 0x01;
const MOUSE_BUTTON_RIGHT = 0x02;
const MOUSE_BUTTON_MIDDLE = 0x04;
const MOD_LCTRL = 0x01;
const MOD_LSHIFT = 0x02;
const MOD_LALT = 0x04;
const MOD_LGUI = 0x08;
const MOD_RCTRL = 0x10;
const MOD_RSHIFT = 0x20;
const MOD_RALT = 0x40;
const MOD_RGUI = 0x80;

const HID_KEY_SPECS: Array<[string, number]> = [
  ["none", 0x00],
  ["err_ovf", 0x01],
  ["a", 0x04], ["b", 0x05], ["c", 0x06], ["d", 0x07], ["e", 0x08],
  ["f", 0x09], ["g", 0x0a], ["h", 0x0b], ["i", 0x0c], ["j", 0x0d],
  ["k", 0x0e], ["l", 0x0f], ["m", 0x10], ["n", 0x11], ["o", 0x12],
  ["p", 0x13], ["q", 0x14], ["r", 0x15], ["s", 0x16], ["t", 0x17],
  ["u", 0x18], ["v", 0x19], ["w", 0x1a], ["x", 0x1b], ["y", 0x1c],
  ["z", 0x1d],
  ["1", 0x1e], ["2", 0x1f], ["3", 0x20], ["4", 0x21], ["5", 0x22],
  ["6", 0x23], ["7", 0x24], ["8", 0x25], ["9", 0x26], ["0", 0x27],
  ["enter", 0x28],
  ["esc", 0x29],
  ["backspace", 0x2a],
  ["tab", 0x2b],
  ["space", 0x2c],
  ["minus", 0x2d],
  ["equal", 0x2e],
  ["leftbrace", 0x2f],
  ["rightbrace", 0x30],
  ["backslash", 0x31],
  ["hashtilde", 0x32],
  ["semicolon", 0x33],
  ["apostrophe", 0x34],
  ["grave", 0x35],
  ["comma", 0x36],
  ["dot", 0x37],
  ["slash", 0x38],
  ["capslock", 0x39],
  ["f1", 0x3a], ["f2", 0x3b], ["f3", 0x3c], ["f4", 0x3d],
  ["f5", 0x3e], ["f6", 0x3f], ["f7", 0x40], ["f8", 0x41],
  ["f9", 0x42], ["f10", 0x43], ["f11", 0x44], ["f12", 0x45],
  ["sysrq", 0x46],
  ["scrolllock", 0x47],
  ["pause", 0x48],
  ["insert", 0x49],
  ["home", 0x4a],
  ["pageup", 0x4b],
  ["delete", 0x4c],
  ["end", 0x4d],
  ["pagedown", 0x4e],
  ["right", 0x4f],
  ["left", 0x50],
  ["down", 0x51],
  ["up", 0x52],
  ["numlock", 0x53],
  ["kpslash", 0x54],
  ["kpasterisk", 0x55],
  ["kpminus", 0x56],
  ["kpplus", 0x57],
  ["kpenter", 0x58],
  ["kp1", 0x59], ["kp2", 0x5a], ["kp3", 0x5b], ["kp4", 0x5c],
  ["kp5", 0x5d], ["kp6", 0x5e], ["kp7", 0x5f], ["kp8", 0x60],
  ["kp9", 0x61], ["kp0", 0x62], ["kpdot", 0x63],
  ["102nd", 0x64],
  ["compose", 0x65],
  ["power", 0x66],
  ["kpequal", 0x67],
  ["f13", 0x68], ["f14", 0x69], ["f15", 0x6a], ["f16", 0x6b],
  ["f17", 0x6c], ["f18", 0x6d], ["f19", 0x6e], ["f20", 0x6f],
  ["f21", 0x70], ["f22", 0x71], ["f23", 0x72], ["f24", 0x73],
  ["open", 0x74],
  ["help", 0x75],
  ["props", 0x76],
  ["front", 0x77],
  ["stop", 0x78],
  ["again", 0x79],
  ["undo", 0x7a],
  ["cut", 0x7b],
  ["copy", 0x7c],
  ["paste", 0x7d],
  ["find", 0x7e],
  ["mute", 0x7f],
  ["volumeup", 0x80],
  ["volumedown", 0x81],
  ["kpcomma", 0x85],
  ["ro", 0x87],
  ["katakanahiragana", 0x88],
  ["yen", 0x89],
  ["henkan", 0x8a],
  ["muhenkan", 0x8b],
  ["kpjpcomma", 0x8c],
  ["hangeul", 0x90],
  ["hanja", 0x91],
  ["katakana", 0x92],
  ["hiragana", 0x93],
  ["zenkakuhankaku", 0x94],
  ["kpleftparen", 0xb6],
  ["kprightparen", 0xb7],
  ["leftctrl", 0xe0],
  ["leftshift", 0xe1],
  ["leftalt", 0xe2],
  ["leftmeta", 0xe3],
  ["rightctrl", 0xe4],
  ["rightshift", 0xe5],
  ["rightalt", 0xe6],
  ["rightmeta", 0xe7],
  ["media_playpause", 0xe8],
  ["media_stopcd", 0xe9],
  ["media_previoussong", 0xea],
  ["media_nextsong", 0xeb],
  ["media_ejectcd", 0xec],
  ["media_volumeup", 0xed],
  ["media_volumedown", 0xee],
  ["media_mute", 0xef],
  ["media_www", 0xf0],
  ["media_back", 0xf1],
  ["media_forward", 0xf2],
  ["media_stop", 0xf3],
  ["media_find", 0xf4],
  ["media_scrollup", 0xf5],
  ["media_scrolldown", 0xf6],
  ["media_edit", 0xf7],
  ["media_sleep", 0xf8],
  ["media_coffee", 0xf9],
  ["media_refresh", 0xfa],
  ["media_calc", 0xfb]
];

const SCAN_NAME_ALIASES: Record<string, string> = {
  printscreen: "sysrq",
  leftbracket: "leftbrace",
  rightbracket: "rightbrace"
};

const NAME_TO_SCAN = new Map(HID_KEY_SPECS);
const SCAN_TO_NAME = new Map(HID_KEY_SPECS.map(([name, code]) => [code, name]));

const CANONICAL_NAME_TO_MOD_BIT = new Map<string, number>([
  ["lctrl", MOD_LCTRL],
  ["lshift", MOD_LSHIFT],
  ["lalt", MOD_LALT],
  ["lmeta", MOD_LGUI],
  ["rctrl", MOD_RCTRL],
  ["rshift", MOD_RSHIFT],
  ["ralt", MOD_RALT],
  ["rmeta", MOD_RGUI]
]);

const MOD_NAME_ALIASES: Record<string, string> = {
  ctrl: "lctrl",
  shift: "lshift",
  alt: "lalt",
  meta: "lmeta",
  lgui: "lmeta",
  rgui: "rmeta"
};

const MOD_BIT_TO_NAME = ["lctrl", "lshift", "lalt", "lmeta", "rctrl", "rshift", "ralt", "rmeta"] as const;

const NAME_TO_BUTTON_BIT = new Map<string, number>([
  ["left", MOUSE_BUTTON_LEFT],
  ["right", MOUSE_BUTTON_RIGHT],
  ["middle", MOUSE_BUTTON_MIDDLE]
]);

function defaultMeta(): Meta {
  return { width: 0, height: 0, startX: 0, startY: 0 };
}

function normalizeScanName(name: string): string {
  const normalized = name.trim().toLowerCase();
  return SCAN_NAME_ALIASES[normalized] ?? normalized;
}

function scanCode(name: string): number | undefined {
  return NAME_TO_SCAN.get(normalizeScanName(name));
}

function scanName(code: number): string {
  return SCAN_TO_NAME.get(code) ?? "";
}

function normalizeModName(name: string): string {
  let normalized = name.trim().toLowerCase();
  if (normalized.startsWith("mod_")) {
    normalized = normalized.slice(4);
  }
  return MOD_NAME_ALIASES[normalized] ?? normalized;
}

function isModName(name: string): boolean {
  return CANONICAL_NAME_TO_MOD_BIT.has(normalizeModName(name));
}

function modBit(name: string): number {
  return CANONICAL_NAME_TO_MOD_BIT.get(normalizeModName(name)) ?? 0;
}

function modName(bit: number): string {
  return MOD_BIT_TO_NAME[bit] ?? "";
}

function buttonBit(name: string): number | undefined {
  return NAME_TO_BUTTON_BIT.get(name.trim().toLowerCase());
}

function buttonName(bit: number): string {
  switch (bit) {
    case MOUSE_BUTTON_LEFT:
      return "left";
    case MOUSE_BUTTON_RIGHT:
      return "right";
    case MOUSE_BUTTON_MIDDLE:
      return "middle";
    default:
      return "";
  }
}

function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

function toInt16(value: number): number {
  const masked = value & 0xffff;
  return masked & 0x8000 ? masked - 0x10000 : masked;
}

function toUint16(value: number): number {
  return value & 0xffff;
}

function containsKey(values: readonly number[], target: number): boolean {
  return values.includes(target);
}

function formatKeyList(keys: readonly string[]): string {
  return keys.map((key) => JSON.stringify(key)).join(", ");
}

function formatEvent(event: Event): string {
  const pad = (typeName: string): string => {
    const innerAlign = 10;
    return typeName.length >= innerAlign ? " " : " ".repeat(innerAlign - typeName.length);
  };

  switch (event.typeName) {
    case "MouseMove":
      return `{ "MouseMove":${pad("MouseMove")}{ "x": ${event.mouseMove.x}, "y": ${event.mouseMove.y}, "ts": ${event.mouseMove.ts} } }`;
    case "MouseDown":
      return `{ "MouseDown":${pad("MouseDown")}{ "button": ${JSON.stringify(event.mouseDown.button)}, "ts": ${event.mouseDown.ts} } }`;
    case "MouseUp":
      return `{ "MouseUp":${pad("MouseUp")}{ "button": ${JSON.stringify(event.mouseUp.button)}, "ts": ${event.mouseUp.ts} } }`;
    case "Wheel":
      return `{ "Wheel":${pad("Wheel")}{ "delta": ${event.wheel.delta}, "ts": ${event.wheel.ts} } }`;
    case "KeyDown":
      return `{ "KeyDown":${pad("KeyDown")}{ "keys": [${formatKeyList(event.keyDown.keys)}], "ts": ${event.keyDown.ts} } }`;
    case "KeyUp":
      return `{ "KeyUp":${pad("KeyUp")}{ "keys": [${formatKeyList(event.keyUp.keys)}], "ts": ${event.keyUp.ts} } }`;
  }
}

export function formatEnvelope(envelope: Envelope): string {
  const lines = [
    "{",
    `  \"format\": \"mkp-action-v1\",`,
    `  \"version\": ${JSON.stringify(envelope.version)},`,
    `  \"meta\": { \"width\": ${envelope.meta.width}, \"height\": ${envelope.meta.height}, \"startX\": ${envelope.meta.startX}, \"startY\": ${envelope.meta.startY} },`,
    "  \"events\": ["
  ];
  envelope.events.forEach((event, index) => {
    if (index > 0) {
      lines.push("    ,");
    }
    lines.push(`    ${formatEvent(event)}`);
  });
  lines.push("  ]");
  lines.push("}");
  return lines.join("\n") + "\n";
}

function expectObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function numberField(record: Record<string, unknown>, key: string, fallback = 0): number {
  const value = record[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number`);
  }
  return Math.trunc(value);
}

function stringField(record: Record<string, unknown>, key: string, fallback = ""): string {
  const value = record[key];
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "string") {
    throw new Error(`${key} must be a string`);
  }
  return value;
}

function stringArrayField(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error(`${key} must be an array`);
  }
  return value.map((item) => {
    if (typeof item !== "string") {
      throw new Error(`${key} entries must be strings`);
    }
    return item;
  });
}

function parseEvent(raw: unknown): Event {
  const record = expectObject(raw, "event");
  const keys = Object.keys(record);
  if (keys.length !== 1) {
    throw new Error(`event must have exactly one key, got ${keys.length}`);
  }
  const [typeName] = keys;
  if (!typeName) {
    throw new Error("event type is required");
  }
  const payload = expectObject(record[typeName], `${typeName} payload`);

  switch (typeName) {
    case "MouseMove":
      return {
        typeName,
        mouseMove: { x: numberField(payload, "x"), y: numberField(payload, "y"), ts: numberField(payload, "ts") }
      };
    case "MouseDown":
      return {
        typeName,
        mouseDown: { button: stringField(payload, "button"), ts: numberField(payload, "ts") }
      };
    case "MouseUp":
      return {
        typeName,
        mouseUp: { button: stringField(payload, "button"), ts: numberField(payload, "ts") }
      };
    case "Wheel":
      return {
        typeName,
        wheel: { delta: numberField(payload, "delta"), ts: numberField(payload, "ts") }
      };
    case "KeyDown":
      return {
        typeName,
        keyDown: { keys: stringArrayField(payload, "keys"), ts: numberField(payload, "ts") }
      };
    case "KeyUp":
      return {
        typeName,
        keyUp: { keys: stringArrayField(payload, "keys"), ts: numberField(payload, "ts") }
      };
    default:
      throw new Error(`unknown event type ${JSON.stringify(typeName)}`);
  }
}

function eventToJson(event: Event): Record<string, unknown> {
  switch (event.typeName) {
    case "MouseMove":
      return { MouseMove: event.mouseMove };
    case "MouseDown":
      return { MouseDown: event.mouseDown };
    case "MouseUp":
      return { MouseUp: event.mouseUp };
    case "Wheel":
      return { Wheel: event.wheel };
    case "KeyDown":
      return { KeyDown: event.keyDown };
    case "KeyUp":
      return { KeyUp: event.keyUp };
  }
}

export function readJSONFile(filePath: string): Envelope {
  const data = readFileSync(filePath, "utf8");
  const parsed = expectObject(JSON.parse(data), filePath);
  const meta = expectObject(parsed.meta ?? {}, "meta");
  const eventsRaw = parsed.events;
  if (!Array.isArray(eventsRaw)) {
    throw new Error(`parse ${filePath}: events must be an array`);
  }
  return {
    format: stringField(parsed, "format", "mkp-action-v1") || "mkp-action-v1",
    version: stringField(parsed, "version", MAGIC_V1) || MAGIC_V1,
    meta: {
      width: numberField(meta, "width"),
      height: numberField(meta, "height"),
      startX: numberField(meta, "startX"),
      startY: numberField(meta, "startY")
    },
    events: eventsRaw.map((item) => parseEvent(item))
  };
}

export function writeJSONFile(filePath: string, envelope: Envelope): void {
  const parentDir = path.dirname(filePath);
  if (parentDir && parentDir !== ".") {
    mkdirSync(parentDir, { recursive: true });
  }
  writeFileSync(filePath, formatEnvelope(envelope));
}

export function mouseEncode(button: number, x: number, y: number, wheel: number): Uint8Array {
  const output = new Uint8Array(5);
  output[0] = button & 0xff;
  const encodedX = toUint16(x) & 0x0fff;
  const encodedY = toUint16(y) & 0x0fff;
  output[1] = encodedX & 0xff;
  output[2] = ((encodedX >> 8) & 0x0f) | ((encodedY & 0x0f) << 4);
  output[3] = (encodedY >> 4) & 0xff;
  output[4] = wheel & 0xff;
  return output;
}

export function mouseDecode(payload: Uint8Array): MouseReport {
  if (payload.length < 5) {
    throw new Error("mouse payload must be 5 bytes");
  }
  const encodedX = (payload[1] ?? 0) | (((payload[2] ?? 0) & 0x0f) << 8);
  const encodedY = ((payload[2] ?? 0) >> 4) | ((payload[3] ?? 0) << 4);
  let x = encodedX & 0x0fff;
  if ((x & 0x0800) !== 0) {
    x |= 0xf000;
  }
  let y = encodedY & 0x0fff;
  if ((y & 0x0800) !== 0) {
    y |= 0xf000;
  }
  return {
    button: payload[0] ?? 0,
    x: toInt16(x),
    y: toInt16(y),
    wheel: (((payload[4] ?? 0) << 24) >> 24)
  };
}

export function readLogFile(filePath: string): { header: LogHeader; records: LogRecord[] } {
  const data = readFileSync(filePath);
  if (data.length < MAGIC_LENGTH) {
    throw new Error("empty log file");
  }

  const magic = data.subarray(0, MAGIC_LENGTH).toString("utf8");
  let offset = MAGIC_LENGTH;
  const header: LogHeader = { version: magic, meta: defaultMeta() };

  if (magic === MAGIC_V2) {
    if (data.length < HEADER_LENGTH_V2) {
      throw new Error("truncated MKv2 header");
    }
    header.meta = {
      width: data.readUInt16LE(offset),
      height: data.readUInt16LE(offset + 2),
      startX: data.readUInt16LE(offset + 4),
      startY: data.readUInt16LE(offset + 6)
    };
    offset += META_LENGTH;
  } else if (magic !== MAGIC_V1) {
    throw new Error(`bad magic ${JSON.stringify(magic)}`);
  }

  const records: LogRecord[] = [];
  while (offset < data.length) {
    if (offset + RECORD_HEADER_SIZE > data.length) {
      throw new Error("truncated record header");
    }
    const port = data.readUInt8(offset);
    const delta = data.readInt32LE(offset + 1);
    const length = data.readUInt16LE(offset + 5);
    offset += RECORD_HEADER_SIZE;
    if (length > MAX_PAYLOAD_LENGTH) {
      throw new Error(`record length ${length} exceeds cap ${MAX_PAYLOAD_LENGTH}`);
    }
    if (offset + length > data.length) {
      throw new Error("truncated record payload");
    }
    const payload = new Uint8Array(data.subarray(offset, offset + length));
    offset += length;
    records.push({ port, delta, length, payload });
  }

  return { header, records };
}

function writeRecord(record: LogRecord): Buffer {
  const buffer = Buffer.alloc(RECORD_HEADER_SIZE + record.length);
  buffer.writeUInt8(record.port & 0xff, 0);
  buffer.writeUInt32LE(record.delta >>> 0, 1);
  buffer.writeUInt16LE(record.length, 5);
  Buffer.from(record.payload).copy(buffer, RECORD_HEADER_SIZE, 0, record.length);
  return buffer;
}

export function writeLogFile(
  filePath: string,
  header: LogHeader,
  records: readonly LogRecord[],
  hasMouse: boolean,
  hasKeyboard: boolean
): void {
  const parts: Buffer[] = [];
  const magic = header.version === MAGIC_V2 ? MAGIC_V2 : MAGIC_V1;
  parts.push(Buffer.from(magic, "utf8"));
  if (magic === MAGIC_V2) {
    const meta = Buffer.alloc(META_LENGTH);
    meta.writeUInt16LE(header.meta.width, 0);
    meta.writeUInt16LE(header.meta.height, 2);
    meta.writeUInt16LE(toUint16(header.meta.startX), 4);
    meta.writeUInt16LE(toUint16(header.meta.startY), 6);
    meta.writeUInt32LE(0, 8);
    parts.push(meta);
  }
  records.forEach((record) => {
    parts.push(writeRecord(record));
  });
  if (hasMouse) {
    for (let index = 0; index < 3; index += 1) {
      parts.push(writeRecord({ port: 1, delta: 8, length: 5, payload: new Uint8Array(5) }));
    }
  }
  if (hasKeyboard) {
    parts.push(writeRecord({ port: 2, delta: 8, length: 8, payload: new Uint8Array(8) }));
  }

  const parentDir = path.dirname(filePath);
  if (parentDir && parentDir !== ".") {
    mkdirSync(parentDir, { recursive: true });
  }
  writeFileSync(filePath, Buffer.concat(parts));
}

function emitMouseEvents(events: Event[], report: MouseReport, state: { prevButton: number }, timestamp: number): void {
  if (report.x !== 0 || report.y !== 0) {
    events.push({ typeName: "MouseMove", mouseMove: { x: report.x, y: report.y, ts: timestamp } });
  }
  const down = report.button & ~state.prevButton;
  const up = state.prevButton & ~report.button;
  for (const bit of [MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE]) {
    const name = buttonName(bit);
    if (!name) {
      continue;
    }
    if ((down & bit) !== 0) {
      events.push({ typeName: "MouseDown", mouseDown: { button: name, ts: timestamp } });
    }
    if ((up & bit) !== 0) {
      events.push({ typeName: "MouseUp", mouseUp: { button: name, ts: timestamp } });
    }
  }
  if (report.wheel !== 0) {
    events.push({ typeName: "Wheel", wheel: { delta: report.wheel, ts: timestamp } });
  }
  state.prevButton = report.button;
}

function emitKbdEvents(
  events: Event[],
  modifier: number,
  keys: readonly number[],
  state: { prevModifier: number; prevKeys: number[] },
  timestamp: number
): void {
  const downNames: string[] = [];
  const upNames: string[] = [];
  const modDown = (modifier ^ state.prevModifier) & modifier;
  const modUp = (modifier ^ state.prevModifier) & state.prevModifier;

  for (let bit = 0; bit < 8; bit += 1) {
    if ((modDown & (1 << bit)) !== 0) {
      const name = modName(bit);
      if (name) {
        downNames.push(name);
      }
    }
    if ((modUp & (1 << bit)) !== 0) {
      const name = modName(bit);
      if (name) {
        upNames.push(name);
      }
    }
  }

  keys.forEach((keyCode) => {
    if (keyCode !== 0 && !containsKey(state.prevKeys, keyCode)) {
      downNames.push(scanName(keyCode));
    }
  });
  state.prevKeys.forEach((keyCode) => {
    if (keyCode !== 0 && !containsKey(keys, keyCode)) {
      upNames.push(scanName(keyCode));
    }
  });

  if (downNames.length > 0) {
    events.push({ typeName: "KeyDown", keyDown: { keys: downNames, ts: timestamp } });
  }
  if (upNames.length > 0) {
    events.push({ typeName: "KeyUp", keyUp: { keys: upNames, ts: timestamp } });
  }

  state.prevModifier = modifier;
  state.prevKeys = [...keys];
}

export function logToJson(header: LogHeader, records: readonly LogRecord[]): Envelope {
  const envelope: Envelope = {
    format: "mkp-action-v1",
    version: header.version,
    meta: {
      width: header.meta.width,
      height: header.meta.height,
      startX: toInt16(header.meta.startX),
      startY: toInt16(header.meta.startY)
    },
    events: []
  };
  const mouseState = { prevButton: 0 };
  const keyboardState = { prevModifier: 0, prevKeys: Array.from({ length: KBD_MAX_KEYS }, () => 0) };
  let timestamp = 0;

  records.forEach((record) => {
    timestamp += record.delta;
    if (record.port === 1 && record.length === 5) {
      emitMouseEvents(envelope.events, mouseDecode(record.payload), mouseState, timestamp);
      return;
    }
    if (record.port === 2 && record.length === 8 && record.payload.length >= 8) {
      emitKbdEvents(
        envelope.events,
        record.payload[0] ?? 0,
        Array.from(record.payload.subarray(2, 8)),
        keyboardState,
        timestamp
      );
    }
  });

  return envelope;
}

function eventTimestamp(event: Event): number {
  switch (event.typeName) {
    case "MouseMove":
      return event.mouseMove.ts;
    case "MouseDown":
      return event.mouseDown.ts;
    case "MouseUp":
      return event.mouseUp.ts;
    case "Wheel":
      return event.wheel.ts;
    case "KeyDown":
      return event.keyDown.ts;
    case "KeyUp":
      return event.keyUp.ts;
  }
}

function applyKbdNames(state: { prevModifier: number; prevKeys: number[] }, names: readonly string[], isDown: boolean): void {
  names.forEach((name) => {
    if (isModName(name)) {
      const value = modBit(name);
      if (isDown) {
        state.prevModifier |= value;
      } else {
        state.prevModifier &= ~value;
      }
      return;
    }

    const code = scanCode(name);
    if (!code) {
      throw new Error(`unknown key name ${JSON.stringify(name)}`);
    }
    if (isDown) {
      if (containsKey(state.prevKeys, code)) {
        return;
      }
      const emptyIndex = state.prevKeys.findIndex((value) => value === 0);
      if (emptyIndex < 0) {
        throw new Error(`too many simultaneous keys (max ${KBD_MAX_KEYS})`);
      }
      state.prevKeys[emptyIndex] = code;
      return;
    }
    const currentIndex = state.prevKeys.findIndex((value) => value === code);
    if (currentIndex >= 0) {
      state.prevKeys[currentIndex] = 0;
    }
  });
}

function buildKbdReport(state: { prevModifier: number; prevKeys: number[] }): Uint8Array {
  const report = new Uint8Array(8);
  report[0] = state.prevModifier;
  for (let index = 0; index < KBD_MAX_KEYS; index += 1) {
    report[2 + index] = state.prevKeys[index] ?? 0;
  }
  return report;
}

export function jsonToLog(envelope: Envelope): JsonToLogResult {
  const header: LogHeader = {
    version: envelope.version === MAGIC_V1 || envelope.version === MAGIC_V2 ? envelope.version : MAGIC_V1,
    meta: {
      width: envelope.meta.width,
      height: envelope.meta.height,
      startX: toUint16(envelope.meta.startX),
      startY: toUint16(envelope.meta.startY)
    }
  };
  const records: LogRecord[] = [];
  let currentButton = 0;
  const keyboardState = { prevModifier: 0, prevKeys: Array.from({ length: KBD_MAX_KEYS }, () => 0) };
  let previousTimestamp = 0;
  let first = true;
  let hasMouse = false;
  let hasKeyboard = false;

  envelope.events.forEach((event, index) => {
    const timestamp = eventTimestamp(event);
    let delta = first ? timestamp : timestamp - previousTimestamp;
    if (delta < 0) {
      delta = 0;
    }
    first = false;
    previousTimestamp = timestamp;

    switch (event.typeName) {
      case "MouseMove": {
        const payload = mouseEncode(currentButton, event.mouseMove.x, event.mouseMove.y, 0);
        records.push({ port: 1, delta, length: 5, payload });
        hasMouse = true;
        break;
      }
      case "MouseDown": {
        const bit = buttonBit(event.mouseDown.button);
        if (!bit) {
          throw new Error(`event ${index} MouseDown: unknown button ${JSON.stringify(event.mouseDown.button)}`);
        }
        currentButton |= bit;
        records.push({ port: 1, delta, length: 5, payload: mouseEncode(currentButton, 0, 0, 0) });
        hasMouse = true;
        break;
      }
      case "MouseUp": {
        const bit = buttonBit(event.mouseUp.button);
        if (!bit) {
          throw new Error(`event ${index} MouseUp: unknown button ${JSON.stringify(event.mouseUp.button)}`);
        }
        currentButton &= ~bit;
        records.push({ port: 1, delta, length: 5, payload: mouseEncode(currentButton, 0, 0, 0) });
        hasMouse = true;
        break;
      }
      case "Wheel": {
        records.push({ port: 1, delta, length: 5, payload: mouseEncode(currentButton, 0, 0, event.wheel.delta) });
        hasMouse = true;
        break;
      }
      case "KeyDown": {
        try {
          applyKbdNames(keyboardState, event.keyDown.keys, true);
        } catch (error) {
          throw new Error(`event ${index} KeyDown: ${error instanceof Error ? error.message : String(error)}`);
        }
        records.push({ port: 2, delta, length: 8, payload: buildKbdReport(keyboardState) });
        hasKeyboard = true;
        break;
      }
      case "KeyUp": {
        try {
          applyKbdNames(keyboardState, event.keyUp.keys, false);
        } catch (error) {
          throw new Error(`event ${index} KeyUp: ${error instanceof Error ? error.message : String(error)}`);
        }
        records.push({ port: 2, delta, length: 8, payload: buildKbdReport(keyboardState) });
        hasKeyboard = true;
        break;
      }
    }
  });

  return { header, records, hasMouse, hasKeyboard };
}

export function directionFromPath(filePath: string): Direction {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".log":
      return Direction.LogToJson;
    case ".json":
      return Direction.JsonToLog;
    default:
      return Direction.Unknown;
  }
}

function targetExtension(direction: Direction): string {
  switch (direction) {
    case Direction.LogToJson:
      return ".json";
    case Direction.JsonToLog:
      return ".log";
    default:
      return "";
  }
}

export function swapExt(filePath: string, newExtension: string): string {
  return filePath.slice(0, filePath.length - path.extname(filePath).length) + newExtension;
}

export function convertLogFileToJSONFile(inputPath: string, outputPath: string): Envelope {
  const { header, records } = readLogFile(inputPath);
  const envelope = logToJson(header, records);
  writeJSONFile(outputPath, envelope);
  return envelope;
}

export function convertJSONFileToLogFile(inputPath: string, outputPath: string): JsonToLogResult {
  const envelope = readJSONFile(inputPath);
  const result = jsonToLog(envelope);
  writeLogFile(outputPath, result.header, result.records, result.hasMouse, result.hasKeyboard);
  return result;
}

function usageText(): string {
  return [
    "usage: mkp-converter -f <input> [-o <output>]",
    "",
    "Convert between binary applog (.log) and JSON action envelope (.json).",
    "The direction is decided by the input file extension.",
    "",
    "Flags:",
    "  -f <input>   input file (.log or .json)",
    "  -o <output>  output file (default: same name with opposite extension)",
    "  -h, --help   show this message"
  ].join("\n");
}

export function runConverter(
  argv: readonly string[] = process.argv.slice(2),
  io: ConverterRunIO = {
    out: (message: string): void => console.log(message),
    err: (message: string): void => console.error(message)
  }
): number {
  let inputPath = "";
  let outputPath = "";

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    switch (token) {
      case "-h":
      case "--help":
        io.out(usageText());
        return 0;
      case "-f":
        inputPath = argv[index + 1] ?? "";
        index += 1;
        break;
      case "-o":
        outputPath = argv[index + 1] ?? "";
        index += 1;
        break;
      default:
        io.err(`converter: unknown argument ${token}`);
        io.err(usageText());
        return 1;
    }
  }

  if (!inputPath) {
    io.err(usageText());
    io.err("converter: missing -f");
    return 1;
  }

  const direction = directionFromPath(inputPath);
  if (direction === Direction.Unknown) {
    io.err(`converter: unrecognized input extension on ${JSON.stringify(inputPath)} (expected .log or .json)`);
    return 1;
  }

  const resolvedOutput = outputPath
    ? (outputPath.toLowerCase().endsWith(targetExtension(direction)) ? outputPath : outputPath + targetExtension(direction))
    : swapExt(inputPath, targetExtension(direction));

  try {
    switch (direction) {
      case Direction.LogToJson: {
        const envelope = convertLogFileToJSONFile(inputPath, resolvedOutput);
        io.out(`log -> json: ${resolvedOutput} (${envelope.events.length} events)`);
        return 0;
      }
      case Direction.JsonToLog: {
        const result = convertJSONFileToLogFile(inputPath, resolvedOutput);
        io.out(
          `json -> log: ${resolvedOutput} (version=${result.header.version}, mouse=${boolToInt(result.hasMouse)}, kbd=${boolToInt(result.hasKeyboard)})`
        );
        return 0;
      }
      default:
        io.err("converter: internal: unhandled direction");
        return 1;
    }
  } catch (error) {
    io.err(`converter: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

export function envelopeToJSONObject(envelope: Envelope): Record<string, unknown> {
  return {
    format: envelope.format,
    version: envelope.version,
    meta: envelope.meta,
    events: envelope.events.map((event) => eventToJson(event))
  };
}
