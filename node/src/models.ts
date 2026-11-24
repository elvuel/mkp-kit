import { expandKpadInputKey, isModKey, keyNameToHexcode, modStatus, normalizeKpadKey, splitKeys } from "./keycodes.js";

const pressedModKeys: string[] = [];
const pressedKeys: string[] = [];

function appendOnce(items: string[], value: string): void {
  if (!items.includes(value)) {
    items.push(value);
  }
}

function removeOnce(items: string[], value: string): void {
  const index = items.indexOf(value);
  if (index >= 0) {
    items.splice(index, 1);
  }
}

function emptyKeys(): string[] {
  return ["", "", "", "", "", ""];
}

export function resetKpadPressedCaches(): void {
  pressedModKeys.length = 0;
  pressedKeys.length = 0;
}

export interface SN {
  sn: string;
}

export interface Heartbeat {
  timetamp: number;
}

export interface MKPVersion {
  uver?: string;
  aver?: string;
  app?: string;
  boot?: string;
  hw?: string;
  raw?: unknown;
}

export interface LogLength {
  seconds: number;
  milsec: number;
}

export interface StPos {
  x: number;
  y: number;
}

export interface LogInfo {
  seconds?: number;
  milsec?: number;
  width?: number;
  heigh?: number;
  stpos?: StPos;
  name?: string;
  path?: string;
  size?: number;
  raw?: unknown;
}

export interface AHTTPBase {
  ahttpbase: string;
}

export interface FileNode {
  name: string;
  path?: string;
  type?: string;
  size?: number;
  displayName?: string;
  contents?: FileNode[];
}

export interface FileSystem {
  rootDir?: FileNode;
  error?: string;
  raw?: unknown;
}

export interface ActionDump {
  actions?: unknown[];
  meta?: Record<string, unknown>;
  raw?: unknown;
}

export interface SerialPortStatus {
  name: string;
  portOpen: boolean;
  syncOutputTimeoutMs: number;
  transportConfigured: boolean;
}

export interface LogOption {
  width?: number;
  height?: number;
  stposx?: number;
  stposy?: number;
}

export interface JoinOption {
  ssid: string;
  password: string;
}

export interface WifiAutoOption {
  state?: string;
}

export interface AGetOption {
  filepath: string;
}

export interface APutOption {
  filepath: string;
}

export interface AJSON2LogOption {
  jsonpath: string;
  savepath?: string;
}

export interface AHTTPBaseOption {
  ahttpbase?: string;
}

export function mouseButtonMask(name: string): number {
  switch (name.trim().toLowerCase()) {
    case "left":
      return 1;
    case "right":
      return 2;
    case "both":
      return 3;
    case "middle":
      return 4;
    case "backword":
    case "backward":
      return 8;
    case "forword":
    case "forward":
      return 16;
    default:
      return 0;
  }
}

export class MouseMoveOffset {
  wheel: number | undefined;
  button: number | undefined;
  pause: number | undefined;

  constructor(
    public x = 0,
    public y = 0
  ) {}

  withWheel(value: number): this {
    this.wheel = value;
    return this;
  }

  withoutWheel(): this {
    this.wheel = undefined;
    return this;
  }

  withPause(pauseMs: number): this {
    this.pause = pauseMs;
    return this;
  }

  withoutPause(): this {
    this.pause = undefined;
    return this;
  }

  withButton(button: string): this {
    this.button = mouseButtonMask(button);
    return this;
  }

  withButtonMask(button: number): this {
    this.button = button;
    return this;
  }

  withoutButton(): this {
    this.button = 0;
    return this;
  }
}

export class M10Option {
  button: number | undefined;
  x: number | undefined;
  y: number | undefined;
  wheel: number | undefined;
  asyncMode = true;
  syncIgnoreOutput = false;
  syncOutputTimeoutMs: number | undefined;

  setButton(value: number): this {
    this.button = value;
    return this;
  }

  withButton(value: number): this {
    return this.setButton(value);
  }

  withoutButton(): this {
    this.button = undefined;
    return this;
  }

  setX(value: number): this {
    this.x = value;
    return this;
  }

  setY(value: number): this {
    this.y = value;
    return this;
  }

  setWheel(value: number): this {
    this.wheel = value;
    return this;
  }

  withAsync(asyncMode: boolean): this {
    this.asyncMode = asyncMode;
    this.syncIgnoreOutput = !asyncMode;
    return this;
  }

  withSyncIgnoreOutput(syncIgnoreOutput: boolean): this {
    this.syncIgnoreOutput = syncIgnoreOutput;
    this.asyncMode = !syncIgnoreOutput;
    return this;
  }

  withSyncOutputTimeout(syncOutputTimeoutMs: number): this {
    this.syncOutputTimeoutMs = syncOutputTimeoutMs;
    return this;
  }

  isAsync(): boolean {
    return this.asyncMode && !this.syncIgnoreOutput;
  }

  toCliFragment(): string {
    const args: string[] = [];
    if (this.button !== undefined) {
      args.push("--b", String(this.button));
    }
    if (this.x !== undefined) {
      args.push("--x", String(this.x));
    }
    if (this.y !== undefined) {
      args.push("--y", String(this.y));
    }
    if (this.wheel !== undefined) {
      args.push("--w", String(this.wheel));
    }
    return args.join(" ");
  }
}

export class KpadOption {
  modKeys: string[] = [];
  keys: string[] = emptyKeys();
  release = 0;
  delay = 0;
  verbose = false;
  asyncMode = true;
  syncIgnoreOutput = false;
  syncOutputTimeoutMs: number | undefined;
  private commitKeys: { keys: string[]; isDown: boolean } | undefined;

  withKeys(keys: string[]): this {
    const normalized = keys.map((key) => normalizeKpadKey(key)).filter(Boolean);
    const { modKeys, normalKeys } = splitKeys(normalized);
    this.modKeys = [...modKeys];
    this.keys = emptyKeys();
    normalKeys.slice(0, 6).forEach((key, index) => {
      this.keys[index] = key;
    });
    return this;
  }

  withKey(key: string): this {
    this.keys = emptyKeys();
    this.keys[0] = normalizeKpadKey(key);
    return this;
  }

  withModKeys(modKeys: string[]): this {
    this.modKeys = [...modKeys];
    return this;
  }

  withDelay(delay: number): this {
    this.delay = delay;
    return this;
  }

  withRelease(release: number): this {
    this.release = release;
    return this;
  }

  withHold(): this {
    this.release = 0;
    return this;
  }

  withAutoRelease(): this {
    this.release = 1;
    return this;
  }

  withDuration(duration: number): this {
    if (duration > 1) {
      this.release = duration;
    }
    return this;
  }

  withVerbose(verbose: boolean): this {
    this.verbose = verbose;
    return this;
  }

  withAsync(asyncMode: boolean): this {
    this.asyncMode = asyncMode;
    this.syncIgnoreOutput = !asyncMode;
    return this;
  }

  withSyncIgnoreOutput(syncIgnoreOutput: boolean): this {
    this.syncIgnoreOutput = syncIgnoreOutput;
    this.asyncMode = !syncIgnoreOutput;
    return this;
  }

  withSyncOutputTimeout(syncOutputTimeoutMs: number): this {
    this.syncOutputTimeoutMs = syncOutputTimeoutMs;
    return this;
  }

  isAsync(): boolean {
    return this.asyncMode && !this.syncIgnoreOutput;
  }

  toCliFragment(): string {
    const args: string[] = [];
    const status = modStatus(this.modKeys);
    if (status) {
      args.push("--s", status);
    }
    this.keys.forEach((key, index) => {
      if (!key) {
        return;
      }
      const code = keyNameToHexcode(key);
      if (!code) {
        throw new Error("unknown key name: " + key);
      }
      args.push("--x" + String(index + 1), code);
    });
    args.push("--rel", String(this.release), "--d", String(this.delay));
    if (this.verbose) {
      args.push("--v", "1");
    }
    return args.join(" ");
  }

  keyDown(key: string): this {
    const commitKeys = expandKpadInputKey(key);
    if (commitKeys.length === 0) {
      return this;
    }
    const nextMod = [...pressedModKeys];
    const nextKeys = [...pressedKeys];
    for (const item of commitKeys) {
      if (isModKey(item)) {
        appendOnce(nextMod, item);
      } else {
        appendOnce(nextKeys, item);
      }
    }
    this.withKeys([...nextMod, ...nextKeys]).withModKeys(nextMod).withHold();
    this.commitKeys = { keys: commitKeys, isDown: true };
    return this;
  }

  keyUp(key: string): { release?: KpadOption; remain?: KpadOption } {
    const releaseKeys = expandKpadInputKey(key);
    if (releaseKeys.length === 0) {
      return {};
    }
    const releaseMod = [...pressedModKeys];
    const nextMod = [...pressedModKeys];
    const nextKeys = [...pressedKeys];
    for (const item of releaseKeys) {
      if (isModKey(item)) {
        removeOnce(nextMod, item);
      } else {
        removeOnce(nextKeys, item);
      }
    }

    const releaseOpt = new KpadOption()
      .withDelay(this.delay)
      .withVerbose(this.verbose)
      .withAsync(this.asyncMode)
      .withKeys(releaseKeys)
      .withAutoRelease();
    releaseOpt.syncIgnoreOutput = this.syncIgnoreOutput;
    releaseOpt.syncOutputTimeoutMs = this.syncOutputTimeoutMs;
    if (releaseKeys.some((item) => isModKey(item))) {
      releaseOpt.withModKeys(releaseMod);
    }

    const remainOpt = new KpadOption().withDelay(this.delay).withVerbose(this.verbose).withAsync(this.asyncMode);
    remainOpt.syncIgnoreOutput = this.syncIgnoreOutput;
    remainOpt.syncOutputTimeoutMs = this.syncOutputTimeoutMs;
    const remain = [...nextMod, ...nextKeys];
    if (remain.length > 0) {
      remainOpt.withKeys(remain);
      if (releaseKeys.some((item) => isModKey(item))) {
        remainOpt.withModKeys(nextMod);
      }
    } else {
      remainOpt.withKey("NONE").withHold();
    }
    remainOpt.commitKeys = { keys: releaseKeys, isDown: false };
    return { release: releaseOpt, remain: remainOpt };
  }

  commitState(): void {
    if (!this.commitKeys) {
      return;
    }
    for (const item of this.commitKeys.keys) {
      if (isModKey(item)) {
        if (this.commitKeys.isDown) {
          appendOnce(pressedModKeys, item);
        } else {
          removeOnce(pressedModKeys, item);
        }
      } else if (this.commitKeys.isDown) {
        appendOnce(pressedKeys, item);
      } else {
        removeOnce(pressedKeys, item);
      }
    }
    this.commitKeys = undefined;
  }
}

