import { checkSFSerialPort, newSFSerialPort, type SFSerialPort } from "../src/index.js";
import type { DirectiveTransport } from "../src/sdk.js";

function directiveName(directive: string): string {
  return directive.trim().split(/\s+/, 1)[0] ?? directive.trim();
}

export class FixtureTransport implements DirectiveTransport {
  private readonly sent: string[] = [];

  async send(directive: string): Promise<void> {
    this.sent.push(directive);
  }

  async sendAndReceive(directive: string): Promise<string> {
    this.sent.push(directive);
    const name = directiveName(directive);
    switch (name) {
      case "sn":
        return 'sn\n{"sn":"SAMPLE-SN"}\n<EOF>';
      case "alive":
        return 'alive\n{"timetamp":1731398400}\n<EOF>';
      case "aversion":
        return 'aversion\n{"app":"1.0.0","boot":"1.0.0","hw":"demo"}\n<EOF>';
      case "atime": {
        const path = directive.slice("atime".length).trim() || "/eMMC/applog/demo.log";
        return `atime ${path}\n{"seconds":6,"milsec":950}\n<EOF>`;
      }
      case "ainsp": {
        const path = directive.slice("ainsp".length).trim() || "/eMMC/applog/demo.log";
        const nameOnly = path.split("/").filter(Boolean).pop() ?? "demo.log";
        return `ainsp ${path}\n{"name":"${nameOnly}","path":"${path}","size":128}\n<EOF>`;
      }
      case "list_dir": {
        const path = directive.slice("list_dir".length).trim() || "/eMMC/applog";
        const dirName = path.split("/").filter(Boolean).pop() ?? "applog";
        return `list_dir ${path}\n{"rootDir":{"name":"${dirName}","path":"${path}","type":"dir","contents":[{"name":"demo.log","path":"${path}/demo.log","type":"file","size":128}]}}\n<EOF>`;
      }
      case "adumj": {
        const path = directive.slice("adumj".length).trim() || "/eMMC/applog/demo.log";
        return `adumj ${path}\n{"actions":[],"meta":{"name":"${path.split("/").filter(Boolean).pop() ?? "demo.log"}"}}\ncli>`;
      }
      case "ahttpbase":
        return 'ahttpbase\nhttp://127.0.0.1:8080\ncli>';
      case "acancel":
        return 'acancel\n{"ok":true}\n<EOF>';
      case "alog":
        return `${directive}\nok\ncli>`;
      case "astop":
        return 'astop\nstopped\ncli>';
      case "clean_dir":
        return `${directive}\ncleaned\ncli>`;
      case "delete_file":
        return `${directive}\ndeleted\ncli>`;
      case "join":
        return `${directive}\njoined\ncli>`;
      case "wifi_auto":
        return `${directive}\nok\ncli>`;
      case "aget":
        return `${directive}\ndownloaded\ncli>`;
      case "aput":
        return `${directive}\nuploaded\ncli>`;
      case "ajson2log":
        return `${directive}\nsaved\ncli>`;
      default:
        return directive + "\ncli>";
    }
  }

  getSentDirectives(): string[] {
    return [...this.sent];
  }
}

export interface ExampleArgs {
  fixture: boolean;
  help: boolean;
  port?: string | undefined;
  positionals: string[];
}

export interface ExamplePortContext {
  sfport: SFSerialPort;
  fixtureTransport?: FixtureTransport | undefined;
  portName?: string | undefined;
  positionals: string[];
  usingFixture: boolean;
}

export interface DirectiveExampleSpec {
  summaryZh: string;
  summaryEn: string;
  usage: string;
  allowedCounts: number[];
}

function readOption(args: readonly string[], flag: string): string | undefined {
  const hit = args.indexOf(flag);
  if (hit >= 0 && hit + 1 < args.length) {
    return args[hit + 1];
  }
  return undefined;
}

export function parseExampleArgs(args: readonly string[] = process.argv.slice(2)): ExampleArgs {
  const positionals: string[] = [];
  let fixture = false;
  let help = false;
  let port: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index] ?? "";
    if (token === "--fixture") {
      fixture = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      help = true;
      continue;
    }
    if (token === "--port") {
      const value = args[index + 1];
      if (!value) {
        throw new Error("missing value for --port");
      }
      port = value;
      index += 1;
      continue;
    }
    positionals.push(token);
  }

  return { fixture, help, ...(port ? { port } : {}), positionals };
}

function formatCountList(counts: readonly number[]): string {
  return counts.map((count) => String(count)).join(" or ");
}

export function formatDirectiveExampleHelp(spec: DirectiveExampleSpec): string {
  return [
    spec.summaryZh,
    spec.summaryEn,
    "",
    "Usage:",
    `  ${spec.usage}`,
    "",
    "Options:",
    "  --port <name>  指定串口 / Use explicit serial port",
    "  --fixture      使用桩响应，不连接真实设备 / Use canned fixture response instead of a real device",
    "  -h, --help     显示帮助 / Show this help message"
  ].join("\n");
}

export function parseDirectiveExampleArgs(
  spec: DirectiveExampleSpec,
  args: readonly string[] = process.argv.slice(2),
  write: (message: string) => void = console.log
): ExampleArgs | null {
  const parsed = parseExampleArgs(args);
  if (parsed.help) {
    write(formatDirectiveExampleHelp(spec));
    return null;
  }
  if (!spec.allowedCounts.includes(parsed.positionals.length)) {
    throw new Error(`usage: ${spec.usage} (expected positional count: ${formatCountList(spec.allowedCounts)})`);
  }
  return parsed;
}

async function withParsedExamplePort<T>(
  parsed: ExampleArgs,
  run: (context: ExamplePortContext) => Promise<T>
): Promise<T> {
  if (parsed.fixture) {
    const fixtureTransport = new FixtureTransport();
    const sfport = newSFSerialPort({ transport: fixtureTransport });
    return run({ sfport, fixtureTransport, positionals: parsed.positionals, usingFixture: true });
  }

  const explicit = parsed.port ?? process.env.MKP_SERIAL_PORT ?? readOption(process.argv.slice(2), "--port");
  const portName = explicit || await checkSFSerialPort();
  const sfport = newSFSerialPort({ name: portName });
  await sfport.open();
  try {
    return await run({ sfport, portName, positionals: parsed.positionals, usingFixture: false });
  } finally {
    await sfport.close();
  }
}

export async function resolveExamplePort(args: readonly string[] = process.argv.slice(2)): Promise<string> {
  const parsed = parseExampleArgs(args);
  const explicit = parsed.port ?? process.env.MKP_SERIAL_PORT;
  if (explicit) {
    return explicit;
  }
  return checkSFSerialPort();
}

export async function withExamplePort<T>(
  run: (context: ExamplePortContext) => Promise<T>,
  args: readonly string[] = process.argv.slice(2)
): Promise<T> {
  return withParsedExamplePort(parseExampleArgs(args), run);
}

export async function runDirectiveExample<T>(
  spec: DirectiveExampleSpec,
  run: (context: ExamplePortContext) => Promise<T>,
  args: readonly string[] = process.argv.slice(2)
): Promise<T | undefined> {
  const parsed = parseDirectiveExampleArgs(spec, args);
  if (!parsed) {
    return undefined;
  }
  return withParsedExamplePort(parsed, run);
}

export function log(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}
