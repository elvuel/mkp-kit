import { setTimeout as sleep } from "node:timers/promises";

import { expandKpadInputKey } from "./keycodes.js";
import { KpadOption, M10Option } from "./models.js";
import { SerialPort } from "./sdk.js";

const AUTO_M10_DURATION_MIN_MS = 60;
const AUTO_M10_DURATION_MAX_MS = 360;

function cloneKpadBase(base?: KpadOption): KpadOption {
  const next = new KpadOption();
  if (!base) {
    return next;
  }
  next.modKeys = [...base.modKeys];
  next.keys = [...base.keys];
  next.release = base.release;
  next.delay = base.delay;
  next.verbose = base.verbose;
  next.asyncMode = base.asyncMode;
  next.syncIgnoreOutput = base.syncIgnoreOutput;
  return next;
}

function cloneM10Base(base?: M10Option): M10Option {
  const next = new M10Option();
  if (!base) {
    return next;
  }
  next.button = base.button;
  next.x = base.x;
  next.y = base.y;
  next.wheel = base.wheel;
  next.asyncMode = base.asyncMode;
  next.syncIgnoreOutput = base.syncIgnoreOutput;
  return next;
}

export async function m10(sfport: SerialPort, opt: M10Option): Promise<void> {
  await sfport.mouse10(opt);
}

export function pixelsToM10Units(distancePixels: number, pixelsPerM10Unit: number): number {
  if (pixelsPerM10Unit <= 0) {
    return 0;
  }
  return distancePixels / pixelsPerM10Unit;
}

export function autoM10Duration(distanceM10Units: number, m10UnitsPerSecond: number): number {
  const distance = Math.abs(distanceM10Units);
  if (distance <= 0 || m10UnitsPerSecond <= 0) {
    return 0;
  }
  const durationMs = (distance / m10UnitsPerSecond) * 1000;
  return Math.max(AUTO_M10_DURATION_MIN_MS, Math.min(AUTO_M10_DURATION_MAX_MS, durationMs));
}

export function buildTextTapOptions(text: string, base?: KpadOption): KpadOption[] {
  return Array.from(text).map((char) => cloneKpadBase(base).withKeys(expandKpadInputKey(char)).withAutoRelease());
}

export async function keyTap(sfport: SerialPort, key: string, base?: KpadOption): Promise<void> {
  await sfport.keypad(cloneKpadBase(base).withKeys(expandKpadInputKey(key)).withAutoRelease());
}

export async function typeText(sfport: SerialPort, text: string, base?: KpadOption): Promise<void> {
  for (const option of buildTextTapOptions(text, base)) {
    await sfport.keypad(option);
  }
}

export async function keyPresses(sfport: SerialPort, keys: string[], sleepMs = 0, base?: KpadOption): Promise<void> {
  for (let index = 0; index < keys.length; index += 1) {
    await keyTap(sfport, keys[index] ?? "", base);
    if (sleepMs > 0 && index + 1 < keys.length) {
      await sleep(sleepMs);
    }
  }
}

export async function keyDown(sfport: SerialPort, key: string, base?: KpadOption): Promise<void> {
  await sfport.keypad(cloneKpadBase(base).keyDown(key));
}

export async function keyUp(sfport: SerialPort, key: string, base?: KpadOption): Promise<void> {
  const options = cloneKpadBase(base).keyUp(key);
  if (options.release) {
    await sfport.keypad(options.release);
  }
  if (options.remain) {
    await sfport.keypad(options.remain);
  }
}

export async function keypadRelease(sfport: SerialPort, base?: KpadOption): Promise<void> {
  await sfport.keypad(cloneKpadBase(base).withKey("NONE").withHold());
}

export async function keypadReleaseAll(sfport: SerialPort, base?: KpadOption): Promise<void> {
  await sfport.keypad(cloneKpadBase(base).withRelease(0).withDelay(base?.delay ?? 0));
}

export async function mouseReleaseAll(sfport: SerialPort, base?: M10Option): Promise<void> {
  const option = cloneM10Base(base);
  option.setButton(0).setX(0).setY(0).withSyncIgnoreOutput(true);
  await sfport.mouse10(option);
}
