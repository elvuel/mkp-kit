import { buildTextTapOptions } from "./helper.js";
import { KpadOption, M10Option } from "./models.js";
import { checkSFSerialPort, newSFSerialPort } from "./sdk.js";
import type {
  AGetOption,
  AHTTPBaseOption,
  AJSON2LogOption,
  APutOption,
  JoinOption,
  SFSerialPort,
  WifiAutoOption
} from "./index.js";

export interface CliSerialPort {
  open(): Promise<void>;
  close(): Promise<void>;
  sendDirective?(directive: string, timeoutMs?: number): Promise<string>;
  sendDirectiveAsync?(directive: string): Promise<void>;
  sn(timeoutMs?: number): Promise<unknown>;
  alive(timeoutMs?: number): Promise<unknown>;
  aversion(timeoutMs?: number): Promise<unknown>;
  atime(path: string, timeoutMs?: number): Promise<unknown>;
  ainsp(path: string, timeoutMs?: number): Promise<unknown>;
  listDir(path: string, timeoutMs?: number): Promise<unknown>;
  cleanDir(path: string, timeoutMs?: number): Promise<string>;
  deleteFile(path: string, timeoutMs?: number): Promise<string>;
  join(opt: JoinOption, timeoutMs?: number): Promise<string>;
  wifiAuto(opt?: WifiAutoOption, timeoutMs?: number): Promise<string>;
  ahttpbase(opt?: AHTTPBaseOption, timeoutMs?: number): Promise<unknown>;
  aget(opt: AGetOption, timeoutMs?: number): Promise<string>;
  aput(opt: APutOption, timeoutMs?: number): Promise<string>;
  adumj(path: string, timeoutMs?: number): Promise<unknown>;
  ajson2log(opt: AJSON2LogOption, timeoutMs?: number): Promise<string>;
  startRecording(args?: string): Promise<void>;
  stopRecording(): Promise<string>;
  cancelReplay(): Promise<unknown>;
  mouse10(opt: M10Option): Promise<void>;
  keypad(opt: KpadOption): Promise<void>;
}

export interface CliIO {
  out(message: string): void;
  err(message: string): void;
}

export interface CliDeps {
  io: CliIO;
  env: NodeJS.ProcessEnv;
  createPort(config: CliPortConfig): CliSerialPort;
  detectPort(): Promise<string>;
}

export interface CliPortConfig {
  name: string;
  mousePortFlag?: string | undefined;
  keyboardPortFlag?: string | undefined;
  syncOutputTimeoutMs?: number | undefined;
}

interface ParsedArgs {
  flags: Map<string, string | true>;
  positionals: string[];
}

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_PORT_NAME = "COM3";
const COMMON_VALUE_FLAGS = new Set(["--port", "--timeout", "--mouse-port", "--keyboard-port"]);
const COMMON_BOOLEAN_FLAGS = new Set(["--help", "-h", "--json"]);

function defaultIo(): CliIO {
  return {
    out(message: string): void {
      process.stdout.write(message + "\n");
    },
    err(message: string): void {
      process.stderr.write(message + "\n");
    }
  };
}

function defaultDeps(): CliDeps {
  return {
    io: defaultIo(),
    env: process.env,
    createPort(config: CliPortConfig): CliSerialPort {
      return newSFSerialPort({
        name: config.name,
        ...(config.mousePortFlag !== undefined ? { mousePortFlag: config.mousePortFlag } : {}),
        ...(config.keyboardPortFlag !== undefined ? { keyboardPortFlag: config.keyboardPortFlag } : {}),
        ...(config.syncOutputTimeoutMs !== undefined ? { syncOutputTimeoutMs: config.syncOutputTimeoutMs } : {})
      }) as unknown as SFSerialPort;
    },
    detectPort: checkSFSerialPort
  };
}

function usage(): string {
  return [
    "Usage:",
    "  mkp [--port COM3] [--timeout 10000] <command> [args...]",
    "",
    "Commands:",
    "  sn | alive | aversion",
    "  atime <path>",
    "  ainsp <path>",
    "  list_dir <path>",
    "  clean_dir <path>",
    "  delete_file <path>",
    "  join <ssid> [password]",
    "  wifi_auto [state]",
    "  ahttpbase [url]",
    "  aget <filepath>",
    "  aput <filepath>",
    "  adumj <log_path>",
    "  ajson2log <jsonpath> [savepath]",
    "  alog [raw args...]",
    "  astop",
    "  acancel",
    "  m10 --x <n> [--y <n>] [--w <n>] [--b <n>] [--async]",
    "  kpad [text] [--text <text>] [--key <key>] [--delay <ms>] [--rel <n>] [--async]",
    "  raw <directive...>",
    "  raw-async <directive...>",
    "",
    "Global flags:",
    "  --port COM3",
    "  --timeout 10000",
    "  --mouse-port 1",
    "  --keyboard-port 2",
    "  --json"
  ].join("\n");
}

function parseArgs(argv: readonly string[], booleanFlags: ReadonlySet<string>): ParsedArgs {
  const flags = new Map<string, string | true>();
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (COMMON_BOOLEAN_FLAGS.has(token) || booleanFlags.has(token)) {
      flags.set(token, true);
      continue;
    }
    if (COMMON_VALUE_FLAGS.has(token)) {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error("missing value for " + token);
      }
      flags.set(token, value);
      index += 1;
      continue;
    }
    if (token.startsWith("--")) {
      const value = argv[index + 1];
      if (value !== undefined && !value.startsWith("--")) {
        flags.set(token, value);
        index += 1;
      } else {
        flags.set(token, true);
      }
      continue;
    }
    positionals.push(token);
  }

  return { flags, positionals };
}

function getFlagString(parsed: ParsedArgs, name: string): string | undefined {
  const value = parsed.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

function hasFlag(parsed: ParsedArgs, name: string): boolean {
  return parsed.flags.get(name) === true;
}

function requirePositional(parsed: ParsedArgs, name: string, index = 0): string {
  const value = parsed.positionals[index];
  if (!value) {
    throw new Error("missing required argument: " + name);
  }
  return value;
}

function parseInteger(value: string | undefined, name: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("invalid number for " + name + ": " + value);
  }
  return parsed;
}

function renderValue(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

async function resolvePortName(parsed: ParsedArgs, deps: CliDeps): Promise<string> {
  const explicit = getFlagString(parsed, "--port") ?? deps.env.MKP_SERIAL_PORT;
  if (explicit) {
    return explicit;
  }
  try {
    return await deps.detectPort();
  } catch {
    return DEFAULT_PORT_NAME;
  }
}

function findCommandIndex(argv: readonly string[]): number {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (COMMON_BOOLEAN_FLAGS.has(token)) {
      continue;
    }
    if (COMMON_VALUE_FLAGS.has(token)) {
      index += 1;
      continue;
    }
    return index;
  }
  return -1;
}
function buildPortConfig(parsed: ParsedArgs, deps: CliDeps): Promise<CliPortConfig> {
  return resolvePortName(parsed, deps).then((name) => ({
    name,
    mousePortFlag: getFlagString(parsed, "--mouse-port"),
    keyboardPortFlag: getFlagString(parsed, "--keyboard-port"),
    syncOutputTimeoutMs: parseInteger(getFlagString(parsed, "--timeout"), "--timeout") ?? DEFAULT_TIMEOUT_MS
  }));
}

async function executeM10(sfport: CliSerialPort, parsed: ParsedArgs): Promise<string> {
  const option = new M10Option();
  const button = parseInteger(getFlagString(parsed, "--b"), "--b");
  const x = parseInteger(getFlagString(parsed, "--x"), "--x");
  const y = parseInteger(getFlagString(parsed, "--y"), "--y");
  const wheel = parseInteger(getFlagString(parsed, "--w"), "--w");
  if (button === undefined && x === undefined && y === undefined && wheel === undefined) {
    throw new Error("m10 requires at least one of --b, --x, --y, or --w");
  }
  if (button !== undefined) {
    option.setButton(button);
  }
  if (x !== undefined) {
    option.setX(x);
  }
  if (y !== undefined) {
    option.setY(y);
  }
  if (wheel !== undefined) {
    option.setWheel(wheel);
  }
  if (hasFlag(parsed, "--async")) {
    option.withAsync(true);
  } else {
    option.withSyncIgnoreOutput(true);
  }
  await sfport.mouse10(option);
  return "ok";
}

async function executeKpad(sfport: CliSerialPort, parsed: ParsedArgs): Promise<string> {
  const option = new KpadOption();
  const delay = parseInteger(getFlagString(parsed, "--delay"), "--delay");
  const release = parseInteger(getFlagString(parsed, "--rel"), "--rel");
  if (delay !== undefined) {
    option.withDelay(delay);
  }
  if (release !== undefined) {
    option.withRelease(release);
  } else {
    option.withAutoRelease();
  }
  if (hasFlag(parsed, "--async")) {
    option.withAsync(true);
  } else {
    option.withSyncIgnoreOutput(true);
  }
  if (hasFlag(parsed, "--verbose")) {
    option.withVerbose(true);
  }

  const key = getFlagString(parsed, "--key");
  const text = getFlagString(parsed, "--text") ?? (parsed.positionals.length > 0 ? parsed.positionals.join(" ") : undefined);

  if (key) {
    for (const item of buildTextTapOptions(key, option)) {
      await sfport.keypad(item);
    }
    return "ok";
  }
  if (text) {
    for (const item of buildTextTapOptions(text, option)) {
      await sfport.keypad(item);
    }
    return "ok";
  }
  throw new Error("kpad requires text or --key");
}

async function executeCommand(command: string, parsed: ParsedArgs, deps: CliDeps): Promise<string> {
  const config = await buildPortConfig(parsed, deps);
  const timeoutMs = config.syncOutputTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const sfport = deps.createPort(config);
  await sfport.open();
  try {
    switch (command) {
      case "sn":
        return renderValue(await sfport.sn(timeoutMs));
      case "alive":
        return renderValue(await sfport.alive(timeoutMs));
      case "aversion":
        return renderValue(await sfport.aversion(timeoutMs));
      case "atime":
        return renderValue(await sfport.atime(requirePositional(parsed, "path"), timeoutMs));
      case "ainsp":
        return renderValue(await sfport.ainsp(requirePositional(parsed, "path"), timeoutMs));
      case "list_dir":
        return renderValue(await sfport.listDir(requirePositional(parsed, "path"), timeoutMs));
      case "clean_dir":
        return renderValue(await sfport.cleanDir(requirePositional(parsed, "path"), timeoutMs));
      case "delete_file":
        return renderValue(await sfport.deleteFile(requirePositional(parsed, "path"), timeoutMs));
      case "join":
        return renderValue(
          await sfport.join(
            { ssid: requirePositional(parsed, "ssid"), password: parsed.positionals[1] ?? "" },
            timeoutMs
          )
        );
      case "wifi_auto":
        return renderValue(await sfport.wifiAuto(parsed.positionals[0] ? { state: parsed.positionals[0] } : undefined, timeoutMs));
      case "ahttpbase":
        return renderValue(
          await sfport.ahttpbase(parsed.positionals[0] ? { ahttpbase: parsed.positionals[0] } : undefined, timeoutMs)
        );
      case "aget":
        return renderValue(await sfport.aget({ filepath: requirePositional(parsed, "filepath") }, timeoutMs));
      case "aput":
        return renderValue(await sfport.aput({ filepath: requirePositional(parsed, "filepath") }, timeoutMs));
      case "adumj":
        return renderValue(await sfport.adumj(requirePositional(parsed, "log_path"), timeoutMs));
      case "ajson2log":
        return renderValue(
          await sfport.ajson2log(
            {
              jsonpath: requirePositional(parsed, "jsonpath"),
              ...(parsed.positionals[1] !== undefined ? { savepath: parsed.positionals[1] } : {})
            },
            timeoutMs
          )
        );
      case "alog":
        await sfport.startRecording(parsed.positionals.join(" "));
        return "ok";
      case "astop":
        return renderValue(await sfport.stopRecording());
      case "acancel":
        return renderValue(await sfport.cancelReplay());
      case "m10":
        return await executeM10(sfport, parsed);
      case "kpad":
        return await executeKpad(sfport, parsed);
      case "raw": {
        if (!sfport.sendDirective) {
          throw new Error("raw directive is not supported by the configured transport");
        }
        return renderValue(await sfport.sendDirective(parsed.positionals.join(" "), timeoutMs));
      }
      case "raw-async": {
        if (!sfport.sendDirectiveAsync) {
          throw new Error("raw-async directive is not supported by the configured transport");
        }
        await sfport.sendDirectiveAsync(parsed.positionals.join(" "));
        return "ok";
      }
      default:
        throw new Error("unknown command: " + command);
    }
  } finally {
    await sfport.close();
  }
}

export async function runCli(argv: readonly string[] = process.argv.slice(2), customDeps: Partial<CliDeps> = {}): Promise<number> {
  const deps = { ...defaultDeps(), ...customDeps };
  const args = [...argv];
  const commandIndex = findCommandIndex(args);

  if (commandIndex < 0) {
    deps.io.out(usage());
    return 0;
  }

  const command = args[commandIndex] ?? "";
  const rest = [...args.slice(0, commandIndex), ...args.slice(commandIndex + 1)];

  if (command === "help" || command === "--help" || command === "-h") {
    deps.io.out(usage());
    return 0;
  }

  try {
    const parsed = parseArgs(rest, new Set(["--async", "--verbose"]));
    if (hasFlag(parsed, "--help") || hasFlag(parsed, "-h")) {
      deps.io.out(usage());
      return 0;
    }
    const output = await executeCommand(command, parsed, deps);
    if (output) {
      deps.io.out(output);
    }
    return 0;
  } catch (error) {
    deps.io.err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}


