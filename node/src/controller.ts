import { setTimeout as sleep } from "node:timers/promises";

import {
  AGetOption,
  AHTTPBase,
  AHTTPBaseOption,
  AJSON2LogOption,
  APutOption,
  ActionDump,
  FileSystem,
  Heartbeat,
  JoinOption,
  KpadOption,
  LogInfo,
  LogLength,
  LogOption,
  M10Option,
  MKPVersion,
  MouseMoveOffset,
  SN,
  SerialPortStatus,
  WifiAutoOption,
  mouseButtonMask
} from "./models.js";
import {
  autoM10Duration,
  keyDown,
  keyPresses,
  keyTap,
  keyUp,
  keypadRelease,
  keypadReleaseAll,
  mouseReleaseAll,
  pixelsToM10Units,
  typeText
} from "./helper.js";
import { composeLogDirectory, composeLogFullpath, SFSerialPort } from "./sdk.js";

const DEFAULT_CLICK_SLEEP_MS = 120;
const DEFAULT_M10_STEP_MS = 8;
const DEFAULT_M10_UNITS_PER_SECOND = 2600;

function baseM10Option(override?: M10Option): M10Option {
  const next = new M10Option();
  if (!override) {
    return next;
  }
  next.asyncMode = override.asyncMode;
  next.syncIgnoreOutput = override.syncIgnoreOutput;
  next.syncOutputTimeoutMs = override.syncOutputTimeoutMs;
  return next;
}

function stepCount(intervalMs: number, relX: number, relY: number): number {
  const intervalSteps = Math.floor(Math.max(intervalMs, 0) / DEFAULT_M10_STEP_MS);
  const distanceSteps = Math.min(Math.max(Math.abs(relX), Math.abs(relY)), 64);
  return Math.max(intervalSteps, distanceSteps, 1);
}

function splitAxis(total: number, steps: number): number[] {
  if (steps <= 0) {
    return [];
  }
  const values: number[] = [];
  let sent = 0;
  for (let index = 1; index <= steps; index += 1) {
    const target = Math.trunc((total * index) / steps);
    values.push(target - sent);
    sent = target;
  }
  return values;
}

function splitRelativeSteps(relX: number, relY: number, steps: number): Array<[number, number]> {
  const xs = splitAxis(relX, steps);
  const ys = splitAxis(relY, steps);
  return xs.map((x, index) => [x, ys[index] ?? 0]);
}

function buttonField(defaultButtonMask: number): number | undefined {
  return defaultButtonMask === 0 ? undefined : defaultButtonMask;
}

export class Controller {
  constructor(public sfport: SFSerialPort) {}

  bindSFPort(sfport: SFSerialPort): void {
    this.sfport = sfport;
  }

  async open(): Promise<void> {
    await this.sfport.open();
  }

  async close(): Promise<void> {
    await this.sfport.close();
  }

  composeLogDirectory(logDir: string): string {
    return composeLogDirectory(logDir);
  }

  composeLogFullpath(logPath: string): string {
    return composeLogFullpath(logPath);
  }

  async startRecord(logName: string, opt?: LogOption): Promise<void> {
    const parts: string[] = [composeLogFullpath(logName)];
    if (opt?.width !== undefined) {
      parts.push("--width", String(opt.width));
    }
    if (opt?.height !== undefined) {
      parts.push("--height", String(opt.height));
    }
    if (opt?.stposx !== undefined) {
      parts.push("--stx", String(opt.stposx));
    }
    if (opt?.stposy !== undefined) {
      parts.push("--sty", String(opt.stposy));
    }
    await this.sfport.startRecording(parts.join(" "));
  }

  async stopRecord(): Promise<string> {
    return this.sfport.stopRecording();
  }

  async alog(logName: string, opt?: LogOption, timeoutMs?: number): Promise<string> {
    return this.sfport.alog(logName, opt, timeoutMs);
  }

  async astop(): Promise<string> {
    return this.sfport.stopRecording();
  }

  async cancel(): Promise<unknown> {
    return this.sfport.cancelReplay();
  }

  async join(opt: JoinOption, timeoutMs?: number): Promise<string> {
    return this.sfport.join(opt, timeoutMs);
  }

  async wifiAuto(opt?: WifiAutoOption, timeoutMs?: number): Promise<string> {
    return this.sfport.wifiAuto(opt, timeoutMs);
  }

  async deviceSn(timeoutMs?: number): Promise<SN> {
    return this.sfport.sn(timeoutMs);
  }

  async listDir(path: string, timeoutMs?: number): Promise<FileSystem> {
    return this.sfport.listDir(path, timeoutMs);
  }

  async cleanDir(path: string, timeoutMs?: number): Promise<string> {
    return this.sfport.cleanDir(path, timeoutMs);
  }

  async deleteFile(path: string, timeoutMs?: number): Promise<string> {
    return this.sfport.deleteFile(path, timeoutMs);
  }

  async alive(timeoutMs?: number): Promise<Heartbeat> {
    return this.sfport.alive(timeoutMs);
  }

  async atime(path: string, timeoutMs?: number): Promise<LogLength> {
    return this.sfport.atime(path, timeoutMs);
  }

  async aversion(timeoutMs?: number): Promise<MKPVersion> {
    return this.sfport.aversion(timeoutMs);
  }

  async aget(opt: AGetOption, timeoutMs?: number): Promise<string> {
    return this.sfport.aget(opt, timeoutMs);
  }

  async aput(opt: APutOption, timeoutMs?: number): Promise<string> {
    return this.sfport.aput(opt, timeoutMs);
  }

  async auploadToMkp(opt: AGetOption, timeoutMs?: number): Promise<string> {
    return this.aget(opt, timeoutMs);
  }

  async adownloadFromMkp(opt: APutOption, timeoutMs?: number): Promise<string> {
    return this.aput(opt, timeoutMs);
  }

  async ajson2log(opt: AJSON2LogOption, timeoutMs?: number): Promise<string> {
    return this.sfport.ajson2log(opt, timeoutMs);
  }

  async ahttpbase(opt?: AHTTPBaseOption, timeoutMs?: number): Promise<AHTTPBase> {
    return this.sfport.ahttpbase(opt, timeoutMs);
  }

  async adumj(logPath: string, timeoutMs?: number): Promise<ActionDump> {
    return this.sfport.adumj(logPath, timeoutMs);
  }

  async ainsp(path: string, timeoutMs?: number): Promise<LogInfo> {
    return this.sfport.ainsp(path, timeoutMs);
  }

  async ainspect(path: string, timeoutMs?: number): Promise<LogInfo> {
    return this.ainsp(path, timeoutMs);
  }

  async startReplaying(logName: string, delay = 0): Promise<void> {
    await this.sfport.startReplaying(logName, delay);
  }

  snapshotStatus(): SerialPortStatus {
    return this.sfport.snapshotStatus();
  }

  async mouseMove(x: number, y: number, option?: M10Option): Promise<void> {
    const next = option ?? new M10Option();
    next.setX(x).setY(y);
    await this.sfport.mouse10(next);
  }

  async mouseReleaseAll(option?: M10Option): Promise<void> {
    await mouseReleaseAll(this.sfport, option);
  }

  async keyTap(key: string, option?: KpadOption): Promise<void> {
    await keyTap(this.sfport, key, option);
  }

  async keyDown(key: string, option?: KpadOption): Promise<void> {
    await keyDown(this.sfport, key, option);
  }

  async keyUp(key: string, option?: KpadOption): Promise<void> {
    await keyUp(this.sfport, key, option);
  }

  async keyPresses(keys: string[], sleepMsOrOption?: number | KpadOption, option?: KpadOption): Promise<void> {
    const sleepMs = typeof sleepMsOrOption === "number" ? sleepMsOrOption : 0;
    const resolvedOption = typeof sleepMsOrOption === "number" ? option : sleepMsOrOption;
    await keyPresses(this.sfport, keys, sleepMs, resolvedOption);
  }

  async keypadRelease(option?: KpadOption): Promise<void> {
    await keypadRelease(this.sfport, option);
  }

  async keypadReleaseAll(option?: KpadOption): Promise<void> {
    await keypadReleaseAll(this.sfport, option);
  }

  async typeText(text: string, option?: KpadOption): Promise<void> {
    await typeText(this.sfport, text, option);
  }

  async mouseDown(button: string, option?: M10Option): Promise<void> {
    const directive = baseM10Option(option).setButton(mouseButtonMask(button)).setX(0).setY(0);
    await this.sfport.mouse10(directive);
  }

  async mouseUp(option?: M10Option): Promise<void> {
    await mouseReleaseAll(this.sfport, baseM10Option(option));
  }

  async mouseClick(button: string, double = false, sleepIntervalMs = 0, option?: M10Option): Promise<void> {
    await this.mouseClickWithButtonMask(mouseButtonMask(button), double, sleepIntervalMs, option);
  }

  async mouseClickWithButtonMask(button: number, double = false, sleepIntervalMs = 0, option?: M10Option): Promise<void> {
    await this.sfport.mouse10(baseM10Option(option).setButton(button).setX(0).setY(0));
    await this.mouseReleaseAll(option);
    if (!double) {
      return;
    }
    await sleep(sleepIntervalMs > 0 ? sleepIntervalMs : DEFAULT_CLICK_SLEEP_MS);
    await this.sfport.mouse10(baseM10Option(option).setButton(button).setX(0).setY(0));
    await this.mouseReleaseAll(option);
  }

  async mouseScroll(dir: string, steps: number, sleepIntervalMs = 0, option?: M10Option): Promise<void> {
    if (steps <= 0) {
      return;
    }
    const wheel = dir.trim().toLowerCase() === "up" ? 1 : -1;
    for (let index = 0; index < steps; index += 1) {
      await this.sfport.mouse10(baseM10Option(option).setX(0).setY(0).setWheel(wheel));
      await sleep(DEFAULT_M10_STEP_MS);
      await this.mouseReleaseAll(option);
      if (index + 1 < steps) {
        await sleep(sleepIntervalMs > 0 ? sleepIntervalMs : DEFAULT_CLICK_SLEEP_MS);
      }
    }
  }

  async mouseScrollWithOption(dir: string, steps: number, sleepIntervalMs = 0, option?: M10Option): Promise<void> {
    await this.mouseScroll(dir, steps, sleepIntervalMs, option);
  }

  async mouseScrollWithButton(
    dir: string,
    steps: number,
    button: string,
    sleepIntervalMs = 0,
    option?: M10Option
  ): Promise<void> {
    if (steps <= 0) {
      return;
    }
    const buttonMask = mouseButtonMask(button);
    const wheel = dir.trim().toLowerCase() === "up" ? 1 : -1;
    const holdButton = button.trim() !== "" && buttonMask !== 0;

    if (holdButton) {
      await this.mouseDown(button, option);
    }

    for (let index = 0; index < steps; index += 1) {
      const directive = baseM10Option(option).setX(0).setY(0).setWheel(wheel);
      if (holdButton) {
        directive.setButton(buttonMask);
      }
      await this.sfport.mouse10(directive);
      await sleep(DEFAULT_M10_STEP_MS);
      if (!holdButton) {
        await this.mouseReleaseAll(option);
      }
      if (index + 1 < steps) {
        await sleep(sleepIntervalMs > 0 ? sleepIntervalMs : DEFAULT_CLICK_SLEEP_MS);
      }
    }

    if (holdButton) {
      await this.mouseReleaseAll(option);
    }
  }

  async mouseScrollWithButtonOption(
    dir: string,
    steps: number,
    button: string,
    sleepIntervalMs = 0,
    option?: M10Option
  ): Promise<void> {
    await this.mouseScrollWithButton(dir, steps, button, sleepIntervalMs, option);
  }

  async m10Move(option: M10Option): Promise<void> {
    await this.sfport.mouse10(option);
  }

  async moveCursor(x: number, y: number, option?: M10Option): Promise<void> {
    await this.mouseMoveRelative("", x, y, 0, option);
  }

  async mouseMoveRelative(
    button: string,
    relX: number,
    relY: number,
    intervalMs: number,
    option?: M10Option
  ): Promise<void> {
    if (relX === 0 && relY === 0) {
      return;
    }
    const buttonMask = mouseButtonMask(button);
    const steps = stepCount(intervalMs, relX, relY);
    const parts = splitRelativeSteps(relX, relY, steps);
    const perStepDelay = steps > 1 ? Math.floor(Math.max(intervalMs, 0) / steps) : 0;

    for (const [dx, dy] of parts) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const directive = baseM10Option(option).setX(dx).setY(dy);
      const field = buttonField(buttonMask);
      if (field !== undefined) {
        directive.setButton(field);
      }
      await this.sfport.mouse10(directive);
      if (perStepDelay > 0) {
        await sleep(perStepDelay);
      }
    }

    await this.mouseReleaseAll(option);
  }

  async mouseMoveWithOffsets(button: string, offsets: readonly MouseMoveOffset[], option?: M10Option): Promise<void> {
    if (offsets.length === 0) {
      return;
    }

    const defaultButton = mouseButtonMask(button);
    const needRelease = defaultButton !== 0 || offsets.some((offset) => offset.button !== undefined && offset.button !== 0);

    for (const offset of offsets) {
      const buttonMask = offset.button ?? defaultButton;
      const wheel = offset.wheel;
      if (offset.x === 0 && offset.y === 0) {
        if (buttonMask !== 0 || wheel !== undefined) {
          const directive = baseM10Option(option).setX(0).setY(0);
          if (buttonMask !== 0) {
            directive.setButton(buttonMask);
          }
          if (wheel !== undefined) {
            directive.setWheel(wheel);
          }
          await this.sfport.mouse10(directive);
        }
        if (offset.pause !== undefined && offset.pause > 0) {
          await sleep(offset.pause);
        }
        continue;
      }

      const distance = Math.sqrt(offset.x ** 2 + offset.y ** 2);
      const durationMs = autoM10Duration(distance, DEFAULT_M10_UNITS_PER_SECOND);
      const steps = stepCount(durationMs, offset.x, offset.y);
      const parts = splitRelativeSteps(offset.x, offset.y, steps);
      const perStepDelay = steps > 1 ? Math.floor(durationMs / steps) : 0;
      let wheelSent = false;

      for (const [dx, dy] of parts) {
        if (dx === 0 && dy === 0) {
          continue;
        }
        const directive = baseM10Option(option).setX(dx).setY(dy);
        if (buttonMask !== 0) {
          directive.setButton(buttonMask);
        }
        if (wheel !== undefined && !wheelSent) {
          directive.setWheel(wheel);
          wheelSent = true;
        }
        await this.sfport.mouse10(directive);
        if (perStepDelay > 0) {
          await sleep(perStepDelay);
        }
      }

      if (offset.pause !== undefined && offset.pause > 0) {
        await sleep(offset.pause);
      }
    }

    if (needRelease) {
      await this.mouseReleaseAll(option);
    }
  }

  pixelsToM10Units(distancePixels: number, pixelsPerM10Unit: number): number {
    return pixelsToM10Units(distancePixels, pixelsPerM10Unit);
  }
}
