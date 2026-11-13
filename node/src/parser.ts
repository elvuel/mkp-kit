import type { AHTTPBase, LogInfo, MKPVersion, StPos } from "./models.js";

export const EOF_DEFAULT = "<EOF>";
export const EOF_CLI = "cli>";

export class DirectiveParserMissingError extends Error {
  constructor(directive: string) {
    super("directive parser missing: " + directive);
    this.name = "DirectiveParserMissingError";
  }
}

export class RawDirectiveParseFailedError extends Error {
  constructor(kind: string) {
    super(kind);
    this.name = "RawDirectiveParseFailedError";
  }
}

export interface DirectiveParser<T = unknown> {
  name: string;
  eofFlag: string;
  parse(cli: string, data: string): T;
}

function directiveName(directive: string): string {
  return directive.trim().split(/\s+/, 1)[0] ?? directive.trim();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstNonBlank(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function parseStPos(value: unknown): StPos | undefined {
  const root = asRecord(value);
  const x = getNumber(root, "x");
  const y = getNumber(root, "y");
  if (x === undefined && y === undefined) {
    return undefined;
  }
  return {
    x: x ?? 0,
    y: y ?? 0
  };
}

function parseVersion(value: unknown): MKPVersion {
  const root = asRecord(value);
  const uver = firstNonBlank(getString(root, "uver"), getString(root, "app"));
  const aver = firstNonBlank(getString(root, "aver"), getString(root, "boot"));
  return {
    ...(uver !== undefined ? { uver } : {}),
    ...(aver !== undefined ? { aver } : {})
  };
}

function parseLogInfo(value: unknown): LogInfo {
  const root = asRecord(value);
  const seconds = getNumber(root, "seconds");
  const milsec = getNumber(root, "milsec");
  const width = getNumber(root, "width");
  const heigh = getNumber(root, "heigh");
  const stpos = parseStPos(root.stpos);
  return {
    ...(seconds !== undefined ? { seconds } : {}),
    ...(milsec !== undefined ? { milsec } : {}),
    ...(width !== undefined ? { width } : {}),
    ...(heigh !== undefined ? { heigh } : {}),
    ...(stpos !== undefined ? { stpos } : {})
  };
}

function preflight(data: string, eofFlag: string): string {
  let current = data.replace(/\r/g, "").trim();
  if (eofFlag === EOF_CLI) {
    current = current.replace(/cli>\s*$/u, "").trim();
  } else {
    current = current.replace(/<EOF>\s*$/u, "").trim();
    current = current.replace(/cli>\s*$/u, "").trim();
  }
  return current;
}

function trimCliOutput(data: string, cli: string): string {
  const hitIndex = data.indexOf(cli);
  const current = hitIndex >= 0 ? data.slice(hitIndex + cli.length) : data;
  return current.replace(/^\n+/u, "").trim();
}

function extractJsonBlob(data: string): string {
  const startCurly = data.indexOf("{");
  const startSquare = data.indexOf("[");
  const candidates = [startCurly, startSquare].filter((value) => value >= 0);
  if (candidates.length === 0) {
    throw new RawDirectiveParseFailedError("json");
  }
  const start = Math.min(...candidates);
  const endCurly = data.lastIndexOf("}");
  const endSquare = data.lastIndexOf("]");
  const end = Math.max(endCurly, endSquare);
  if (end < start) {
    throw new RawDirectiveParseFailedError("json");
  }
  return data.slice(start, end + 1);
}

function parseJsonBlob(cli: string, data: string, eofFlag: string): unknown {
  const normalized = trimCliOutput(preflight(data, eofFlag), cli);
  return JSON.parse(extractJsonBlob(normalized));
}

function parseRawJsonText(cli: string, data: string, eofFlag: string, allowEmpty = false): unknown {
  const normalized = trimCliOutput(preflight(data, eofFlag), cli);
  if (!normalized && allowEmpty) {
    return "";
  }
  try {
    return JSON.parse(extractJsonBlob(normalized));
  } catch {
    if (!normalized && allowEmpty) {
      return "";
    }
    return JSON.parse(normalized);
  }
}

function parseLineJson(cli: string, data: string, eofFlag: string, requiredFragments: string[] = []): unknown {
  const normalized = trimCliOutput(preflight(data, eofFlag), cli);
  for (const line of normalized.split("\n")) {
    const candidate = line.trim();
    if (!candidate.startsWith("{") && !candidate.startsWith("[")) {
      continue;
    }
    if (requiredFragments.length > 0 && !requiredFragments.every((fragment) => candidate.includes(fragment))) {
      continue;
    }
    return JSON.parse(candidate);
  }
  return JSON.parse(extractJsonBlob(normalized));
}

function parsePlainText(cli: string, data: string, eofFlag: string): string {
  return trimCliOutput(preflight(data, eofFlag), cli);
}

function parseAhttpbase(cli: string, data: string): AHTTPBase {
  const normalized = trimCliOutput(preflight(data, EOF_CLI), cli);
  try {
    return JSON.parse(extractJsonBlob(normalized)) as AHTTPBase;
  } catch {
    const line = normalized
      .split("\n")
      .map((item) => item.trim())
      .find((item) => item.startsWith("http://") || item.startsWith("https://"));
    if (!line) {
      throw new RawDirectiveParseFailedError("ahttpbase");
    }
    return { ahttpbase: line };
  }
}

function createJsonBlobParser(name: string, eofFlag = EOF_DEFAULT): DirectiveParser {
  return { name, eofFlag, parse: (cli, data) => parseJsonBlob(cli, data, eofFlag) };
}

function createRawJsonTextParser(name: string, eofFlag = EOF_DEFAULT, allowEmpty = false): DirectiveParser {
  return { name, eofFlag, parse: (cli, data) => parseRawJsonText(cli, data, eofFlag, allowEmpty) };
}

function createLineJsonParser(name: string, eofFlag = EOF_DEFAULT, requiredFragments: string[] = []): DirectiveParser {
  return { name, eofFlag, parse: (cli, data) => parseLineJson(cli, data, eofFlag, requiredFragments) };
}

function createTextParser(name: string, eofFlag = EOF_CLI): DirectiveParser<string> {
  return { name, eofFlag, parse: (cli, data) => parsePlainText(cli, data, eofFlag) };
}

export const PARSERS: Record<string, DirectiveParser> = {
  sn: createJsonBlobParser("sn"),
  alive: createJsonBlobParser("alive"),
  aversion: { name: "aversion", eofFlag: EOF_DEFAULT, parse: (cli, data) => parseVersion(parseJsonBlob(cli, data, EOF_DEFAULT)) },
  atime: createLineJsonParser("atime", EOF_DEFAULT, ["\"seconds\":"]),
  ainsp: { name: "ainsp", eofFlag: EOF_DEFAULT, parse: (cli, data) => parseLogInfo(parseLineJson(cli, data, EOF_DEFAULT, ["\"seconds\":", "\"width\":"])) },
  list_dir: createJsonBlobParser("list_dir"),
  adumj: createJsonBlobParser("adumj", EOF_CLI),
  ahttpbase: { name: "ahttpbase", eofFlag: EOF_CLI, parse: (cli, data) => parseAhttpbase(cli, data) },
  acancel: createRawJsonTextParser("acancel", EOF_DEFAULT, true),
  ajson2log: createTextParser("ajson2log", EOF_CLI),
  alog: createTextParser("alog", EOF_CLI),
  astop: createTextParser("astop", EOF_CLI),
  clean_dir: createTextParser("clean_dir", EOF_CLI),
  delete_file: createTextParser("delete_file", EOF_CLI),
  join: createTextParser("join", EOF_CLI),
  wifi_auto: createTextParser("wifi_auto", EOF_CLI),
  aget: createTextParser("aget", EOF_CLI),
  aput: createTextParser("aput", EOF_CLI)
};

export function getRawDirectiveOutputParser(directive: string): DirectiveParser {
  const name = directiveName(directive);
  const parser = PARSERS[name];
  if (!parser) {
    throw new DirectiveParserMissingError(directive);
  }
  return parser;
}

export function parseDirectiveOutput<T = unknown>(directive: string, raw: string): T {
  return getRawDirectiveOutputParser(directive).parse(directive, raw) as T;
}

export { directiveName, extractJsonBlob, trimCliOutput };
