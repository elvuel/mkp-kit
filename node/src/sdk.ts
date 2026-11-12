import { SerialPort as NativeSerialPort } from "serialport";

import { KpadOption, M10Option } from "./models.js";
import { EOF_CLI, getRawDirectiveOutputParser, parseDirectiveOutput } from "./parser.js";
import type {
  AGetOption,
  AHTTPBase,
  AHTTPBaseOption,
  AJSON2LogOption,
  APutOption,
  ActionDump,
  FileSystem,
  Heartbeat,
  JoinOption,
  LogInfo,
  LogLength,
  LogOption,
  MKPVersion,
  SN,
  SerialPortStatus,
  WifiAutoOption
} from "./models.js";

function buildAlogDirective(logName: string, opt?: LogOption): string {
  const args: string[] = [composeLogFullpath(logName)];
  if (opt?.width !== undefined && opt.width > 0) {
    args.push("--width", String(opt.width));
  }
  if (opt?.height !== undefined && opt.height > 0) {
    args.push("--height", String(opt.height));
  }
  if (opt?.stposx !== undefined && opt.stposx > -1) {
    args.push("--stposx", String(opt.stposx));
  }
  if (opt?.stposy !== undefined && opt.stposy > -1) {
    args.push("--stposy", String(opt.stposy));
  }
  return ["alog", ...args].join(" ");
}

export interface DirectiveTransport {
  open?(): Promise<void> | void;
  close?(): Promise<void> | void;
  send(directive: string): Promise<void> | void;
  sendAndReceive(directive: string, timeoutMs: number): Promise<string> | string;
  getSentDirectives?(): string[];
  isOpen?(): boolean;
}

export interface SerialPortOptions {
  name?: string;
  mousePortFlag?: string;
  keyboardPortFlag?: string;
  syncOutputTimeoutMs?: number;
  transport?: DirectiveTransport | undefined;
  baudRate?: number | undefined;
}

export interface NodeSerialTransportOptions {
  baudRate?: number | undefined;
}

export interface SerialPortDiscoveryItem {
  path: string;
  productId?: string | null | undefined;
  vendorId?: string | null | undefined;
}

export class TransportNotConfiguredError extends Error {
  constructor() {
    super("transport not configured");
    this.name = "TransportNotConfiguredError";
  }
}

export class DirectiveTimeoutError extends Error {
  constructor(directive: string, timeoutMs: number) {
    super("directive timeout: " + directive + " after " + String(timeoutMs) + "ms");
    this.name = "DirectiveTimeoutError";
  }
}

export class DryRunTransport implements DirectiveTransport {
  private readonly sent: string[] = [];

  async send(directive: string): Promise<void> {
    this.sent.push(directive);
  }

  async sendAndReceive(directive: string): Promise<string> {
    this.sent.push(directive);
    return directive + "\ncli>";
  }

  getSentDirectives(): string[] {
    return [...this.sent];
  }

  isOpen(): boolean {
    return true;
  }
}

function normalizeDirectiveLabel(directive: string): string {
  return directive.startsWith("alog") ? "alog" : directive;
}

function resolveDirectiveEofFlag(directive: string): string {
  try {
    return getRawDirectiveOutputParser(directive).eofFlag;
  } catch {
    return EOF_CLI;
  }
}

export function extractSyncOutput(
  buffer: string,
  directive: string,
  eofFlag: string
): { output?: string; remaining: string } {
  const hitIndex = buffer.indexOf(directive);
  if (hitIndex < 0) {
    return { remaining: buffer };
  }

  const segment = buffer.slice(hitIndex);
  let outputCompletedIndex = -1;
  if (eofFlag === EOF_CLI) {
    outputCompletedIndex = segment.indexOf(EOF_CLI);
  } else {
    const candidates = [segment.indexOf("<EOF>"), segment.indexOf(EOF_CLI)].filter((value) => value >= 0);
    outputCompletedIndex = candidates.length > 0 ? Math.min(...candidates) : -1;
  }

  if (outputCompletedIndex < 0) {
    return { remaining: buffer };
  }

  return {
    output: segment.slice(0, outputCompletedIndex),
    remaining: ""
  };
}

export function normalizeUsbHex(value: string | null | undefined): string {
  return (value ?? "").replace(/^0x/iu, "").toUpperCase();
}

export function resolveSFSerialPortPath(ports: readonly SerialPortDiscoveryItem[]): string | undefined {
  for (const port of ports) {
    if (normalizeUsbHex(port.vendorId) === "1A86" && normalizeUsbHex(port.productId) === "55D3") {
      return port.path;
    }
  }
  return undefined;
}

function openNativePort(port: NativeSerialPort): Promise<void> {
  if (port.isOpen) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    port.open((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function closeNativePort(port: NativeSerialPort): Promise<void> {
  if (!port.isOpen) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    port.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function flushNativePort(port: NativeSerialPort): Promise<void> {
  return new Promise((resolve, reject) => {
    port.flush((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function drainNativePort(port: NativeSerialPort): Promise<void> {
  return new Promise((resolve, reject) => {
    port.drain((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function writeNativePort(port: NativeSerialPort, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    port.write(data, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export class NodeSerialTransport implements DirectiveTransport {
  readonly path: string;
  readonly baudRate: number;

  private port: NativeSerialPort | undefined;
  private readBuffer = "";
  private readClosed = true;
  private readLoopRunning = false;
  private directiveChain: Promise<void> = Promise.resolve();
  private syncDirective = "";
  private syncIgnored = false;
  private syncResolve: ((output: string) => void) | undefined;
  private syncReject: ((error: Error) => void) | undefined;
  private lastSyncDirective = "";
  private lastSyncOutput = "";
  private lastSyncOutputAt: Date | undefined;

  constructor(path: string, options: NodeSerialTransportOptions = {}) {
    this.path = path;
    this.baudRate = options.baudRate ?? 115200;
  }

  isOpen(): boolean {
    return this.port?.isOpen ?? false;
  }

  async open(): Promise<void> {
    const port = this.getOrCreatePort();
    await openNativePort(port);
    this.readClosed = false;
    this.readLoopRunning = true;
    await this.resetInputBuffer();
  }

  async close(): Promise<void> {
    this.clearSyncWait();
    const port = this.port;
    if (!port) {
      return;
    }
    await closeNativePort(port);
    this.readClosed = true;
    this.readLoopRunning = false;
    this.readBuffer = "";
  }

  async send(directive: string): Promise<void> {
    await this.withDirectiveLock(async () => {
      await this.ensureOpen();
      const port = this.requirePort();
      await writeNativePort(port, directive + "\r\n");
      await drainNativePort(port);
    });
  }

  async sendAndReceive(directive: string, timeoutMs: number): Promise<string> {
    return this.withDirectiveLock(async () => {
      await this.ensureOpen();
      await this.resetInputBuffer();

      const syncDirective = normalizeDirectiveLabel(directive);
      const outputPromise = new Promise<string>((resolve, reject) => {
        this.syncDirective = syncDirective;
        this.syncIgnored = false;
        this.syncResolve = resolve;
        this.syncReject = reject;
      });

      const port = this.requirePort();
      try {
        await writeNativePort(port, directive + "\r\n");
        await drainNativePort(port);
      } catch (error) {
        this.clearSyncWait();
        throw error;
      }

      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<string>((_, reject) => {
        timer = setTimeout(() => {
          this.clearSyncWait();
          reject(new DirectiveTimeoutError(directive, timeoutMs));
        }, timeoutMs);
      });

      try {
        return await Promise.race([outputPromise, timeoutPromise]);
      } finally {
        if (timer) {
          clearTimeout(timer);
        }
      }
    });
  }

  private getOrCreatePort(): NativeSerialPort {
    if (!this.port) {
      this.port = new NativeSerialPort({
        path: this.path,
        baudRate: this.baudRate,
        autoOpen: false
      });
      this.port.on("data", (chunk: Buffer) => {
        this.handleData(chunk);
      });
      this.port.on("close", () => {
        this.readClosed = true;
        this.readLoopRunning = false;
      });
      this.port.on("error", (error: Error) => {
        if (!this.syncReject) {
          return;
        }
        const reject = this.syncReject;
        this.clearSyncWait();
        reject(error);
      });
    }
    return this.port;
  }

  private requirePort(): NativeSerialPort {
    const port = this.port;
    if (!port) {
      throw new TransportNotConfiguredError();
    }
    return port;
  }

  private async ensureOpen(): Promise<void> {
    await this.open();
  }

  private async resetInputBuffer(): Promise<void> {
    const port = this.requirePort();
    try {
      await flushNativePort(port);
    } catch {
    }
    this.readBuffer = "";
  }

  private handleData(chunk: Buffer): void {
    this.readClosed = false;
    this.readLoopRunning = true;
    this.readBuffer += chunk.toString("utf8");

    if (!this.syncDirective || !this.syncResolve) {
      return;
    }

    const { output, remaining } = extractSyncOutput(
      this.readBuffer,
      this.syncDirective,
      resolveDirectiveEofFlag(this.syncDirective)
    );
    if (output === undefined) {
      return;
    }

    this.readBuffer = remaining;
    this.lastSyncDirective = this.syncDirective;
    this.lastSyncOutput = output;
    this.lastSyncOutputAt = new Date();

    const ignored = this.syncIgnored;
    const resolve = this.syncResolve;
    this.clearSyncWait();
    resolve(ignored ? "" : output);
  }

  private clearSyncWait(): void {
    this.syncDirective = "";
    this.syncIgnored = false;
    this.syncResolve = undefined;
    this.syncReject = undefined;
  }

  private async withDirectiveLock<T>(action: () => Promise<T>): Promise<T> {
    const previous = this.directiveChain;
    let release: (() => void) | undefined;
    this.directiveChain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await action();
    } finally {
      release?.();
    }
  }
}

export class SerialPort {
  name: string;
  mousePortFlag: string;
  keyboardPortFlag: string;
  syncOutputTimeoutMs: number;
  protected transport: DirectiveTransport | undefined;

  constructor(options: SerialPortOptions = {}) {
    this.name = options.name ?? "COM3";
    this.mousePortFlag = options.mousePortFlag ?? "1";
    this.keyboardPortFlag = options.keyboardPortFlag ?? "2";
    this.syncOutputTimeoutMs = options.syncOutputTimeoutMs ?? 10000;
    this.transport = options.transport ?? new NodeSerialTransport(this.name, { baudRate: options.baudRate });
  }

  setTransport(transport: DirectiveTransport): this {
    this.transport = transport;
    return this;
  }

  async open(): Promise<void> {
    if (!this.transport) {
      throw new TransportNotConfiguredError();
    }
    await this.transport.open?.();
  }

  async close(): Promise<void> {
    await this.transport?.close?.();
  }

  protected requireTransport(): DirectiveTransport {
    if (!this.transport) {
      throw new TransportNotConfiguredError();
    }
    return this.transport;
  }

  async sendDirective(directive: string, timeoutMs = this.syncOutputTimeoutMs): Promise<string> {
    const transport = this.requireTransport();
    return await Promise.resolve(transport.sendAndReceive(directive, timeoutMs));
  }

  async sendDirectiveAsync(directive: string): Promise<void> {
    await Promise.resolve(this.requireTransport().send(directive));
  }

  async sendParsed<T = unknown>(directive: string, timeoutMs = this.syncOutputTimeoutMs): Promise<T> {
    const raw = await this.sendDirective(directive, timeoutMs);
    return parseDirectiveOutput<T>(directive, raw);
  }

  async startRecording(args = ""): Promise<void> {
    const directive = ["alog", args].filter(Boolean).join(" ");
    await this.sendDirectiveAsync(directive);
  }

  async alog(logName: string, opt?: LogOption, timeoutMs = this.syncOutputTimeoutMs): Promise<string> {
    return this.sendParsed<string>(buildAlogDirective(logName, opt), timeoutMs);
  }

  async startReplaying(logName: string, delay = 0): Promise<void> {
    await this.sendDirectiveAsync("aplay " + logName + " --delay " + String(delay));
  }

  async stopRecording(): Promise<string> {
    return this.sendParsed<string>("astop");
  }

  async cancelReplay(): Promise<unknown> {
    return this.sendParsed("acancel");
  }

  async mouse10(opt: M10Option): Promise<void> {
    let directive = "m10 --port " + this.mousePortFlag;
    const fragment = opt.toCliFragment().trim();
    if (fragment) {
      directive += " " + fragment;
    }
    if (opt.isAsync()) {
      await this.sendDirectiveAsync(directive);
    } else {
      await this.sendDirective(directive);
    }
  }

  async keypad(opt: KpadOption): Promise<void> {
    let directive = "kpad --port " + this.keyboardPortFlag;
    const fragment = opt.toCliFragment().trim();
    if (fragment) {
      directive += " " + fragment;
    }
    if (opt.isAsync()) {
      await this.sendDirectiveAsync(directive);
    } else {
      await this.sendDirective(directive);
    }
    opt.commitState();
  }

  async sn(timeoutMs?: number): Promise<SN> {
    return this.sendParsed<SN>("sn", timeoutMs);
  }

  async alive(timeoutMs?: number): Promise<Heartbeat> {
    return this.sendParsed<Heartbeat>("alive", timeoutMs);
  }

  async aversion(timeoutMs?: number): Promise<MKPVersion> {
    return this.sendParsed<MKPVersion>("aversion", timeoutMs);
  }

  async atime(path: string, timeoutMs?: number): Promise<LogLength> {
    return this.sendParsed<LogLength>("atime " + composeLogFullpath(path), timeoutMs);
  }

  async ainsp(path: string, timeoutMs?: number): Promise<LogInfo> {
    return this.sendParsed<LogInfo>("ainsp " + composeLogFullpath(path), timeoutMs);
  }

  async listDir(path: string, timeoutMs?: number): Promise<FileSystem> {
    return this.sendParsed<FileSystem>("list_dir " + path, timeoutMs);
  }

  async cleanDir(path: string, timeoutMs?: number): Promise<string> {
    if (!path.startsWith("/eMMC/applog")) {
      throw new Error("clean_dir is restricted to /eMMC/applog");
    }
    return this.sendParsed<string>("clean_dir " + path, timeoutMs);
  }

  async deleteFile(path: string, timeoutMs?: number): Promise<string> {
    if (!path.startsWith("/eMMC/applog")) {
      throw new Error("delete_file is restricted to /eMMC/applog");
    }
    return this.sendParsed<string>("delete_file " + path, timeoutMs);
  }

  async join(opt: JoinOption, timeoutMs?: number): Promise<string> {
    return this.sendParsed<string>("join " + [opt.ssid, opt.password].filter(Boolean).join(" "), timeoutMs);
  }

  async wifiAuto(opt?: WifiAutoOption, timeoutMs?: number): Promise<string> {
    const suffix = opt?.state ? " " + opt.state : "";
    return this.sendParsed<string>("wifi_auto" + suffix, timeoutMs);
  }

  async ahttpbase(opt?: AHTTPBaseOption, timeoutMs?: number): Promise<AHTTPBase> {
    const suffix = opt?.ahttpbase ? " " + opt.ahttpbase : "";
    return this.sendParsed<AHTTPBase>("ahttpbase" + suffix, timeoutMs);
  }

  async aget(opt: AGetOption, timeoutMs?: number): Promise<string> {
    return this.sendParsed<string>("aget " + opt.filepath, timeoutMs);
  }

  async aput(opt: APutOption, timeoutMs?: number): Promise<string> {
    return this.sendParsed<string>("aput " + opt.filepath, timeoutMs);
  }

  async adumj(path: string, timeoutMs?: number): Promise<ActionDump> {
    return this.sendParsed<ActionDump>("adumj " + composeLogFullpath(path), timeoutMs);
  }

  async ajson2log(opt: AJSON2LogOption, timeoutMs?: number): Promise<string> {
    const args = [opt.jsonpath, opt.savepath].filter(Boolean).join(" ");
    return this.sendParsed<string>("ajson2log " + args, timeoutMs);
  }

  snapshotStatus(): SerialPortStatus {
    const transport = this.transport;
    return {
      name: this.name,
      portOpen: transport?.isOpen?.() ?? false,
      syncOutputTimeoutMs: this.syncOutputTimeoutMs,
      transportConfigured: transport !== undefined
    };
  }
}

export type SFSerialPort = SerialPort;

export function newSFSerialPort(options: SerialPortOptions = {}): SFSerialPort {
  return new SerialPort({
    name: options.name ?? "COM3",
    mousePortFlag: options.mousePortFlag ?? "1",
    keyboardPortFlag: options.keyboardPortFlag ?? "2",
    syncOutputTimeoutMs: options.syncOutputTimeoutMs ?? 10000,
    transport: options.transport,
    baudRate: options.baudRate
  });
}

export async function checkSFSerialPort(): Promise<string> {
  const path = resolveSFSerialPortPath(await NativeSerialPort.list());
  if (!path) {
    throw new Error("failed to auto-detect SF serial port");
  }
  return path;
}

export function composeLogDirectory(logDir: string): string {
  return logDir.startsWith("/eMMC/applog") ? logDir : "/eMMC/applog/" + logDir;
}

export function composeLogFullpath(logPath: string): string {
  const normalized = logPath.endsWith(".log") ? logPath : logPath + ".log";
  return normalized.startsWith("/eMMC/applog/") ? normalized : "/eMMC/applog/" + normalized;
}

export async function startRecord(sfport: SFSerialPort, logName: string, opt?: LogOption): Promise<void> {
  const directive = buildAlogDirective(logName, opt).replace(/^alog\s+/u, "");
  await sfport.startRecording(directive);
}

export async function stopRecord(sfport: SFSerialPort): Promise<string> {
  return sfport.stopRecording();
}

export async function alog(sfport: SFSerialPort, logName: string, opt?: LogOption, timeoutMs?: number): Promise<string> {
  return sfport.alog(logName, opt, timeoutMs);
}

export async function astop(sfport: SFSerialPort, timeoutMs?: number): Promise<string> {
  return sfport.stopRecording();
}

export async function cancel(sfport: SFSerialPort): Promise<unknown> {
  return sfport.cancelReplay();
}

export async function join(sfport: SFSerialPort, opt: JoinOption, timeoutMs?: number): Promise<string> {
  return sfport.join(opt, timeoutMs);
}

export async function wifiAuto(sfport: SFSerialPort, opt?: WifiAutoOption, timeoutMs?: number): Promise<string> {
  return sfport.wifiAuto(opt, timeoutMs);
}

export async function deviceSn(sfport: SFSerialPort, timeoutMs?: number): Promise<SN> {
  return sfport.sn(timeoutMs);
}

export async function listDir(sfport: SFSerialPort, path: string, timeoutMs?: number): Promise<FileSystem> {
  return sfport.listDir(path, timeoutMs);
}

export async function cleanDir(sfport: SFSerialPort, path: string, timeoutMs?: number): Promise<string> {
  return sfport.cleanDir(path, timeoutMs);
}

export async function deleteFile(sfport: SFSerialPort, path: string, timeoutMs?: number): Promise<string> {
  return sfport.deleteFile(path, timeoutMs);
}

export async function alive(sfport: SFSerialPort, timeoutMs?: number): Promise<Heartbeat> {
  return sfport.alive(timeoutMs);
}

export async function atime(sfport: SFSerialPort, path: string, timeoutMs?: number): Promise<LogLength> {
  return sfport.atime(path, timeoutMs);
}

export async function aversion(sfport: SFSerialPort, timeoutMs?: number): Promise<MKPVersion> {
  return sfport.aversion(timeoutMs);
}

export async function auploadToMkp(sfport: SFSerialPort, opt: AGetOption, timeoutMs?: number): Promise<string> {
  return sfport.aget(opt, timeoutMs);
}

export async function adownloadFromMkp(sfport: SFSerialPort, opt: APutOption, timeoutMs?: number): Promise<string> {
  return sfport.aput(opt, timeoutMs);
}

export async function ajson2log(sfport: SFSerialPort, opt: AJSON2LogOption, timeoutMs?: number): Promise<string> {
  return sfport.ajson2log(opt, timeoutMs);
}

export async function ahttpbase(sfport: SFSerialPort, opt?: AHTTPBaseOption, timeoutMs?: number): Promise<AHTTPBase> {
  return sfport.ahttpbase(opt, timeoutMs);
}

export async function adumj(sfport: SFSerialPort, logPath: string, timeoutMs?: number): Promise<ActionDump> {
  return sfport.adumj(logPath, timeoutMs);
}

export async function ainspect(sfport: SFSerialPort, path: string, timeoutMs?: number): Promise<LogInfo> {
  return sfport.ainsp(path, timeoutMs);
}

export async function ainsp(sfport: SFSerialPort, path: string, timeoutMs?: number): Promise<LogInfo> {
  return sfport.ainsp(path, timeoutMs);
}

