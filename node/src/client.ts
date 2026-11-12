import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { APP_VERSION } from "./server.js";

export interface ClientIO {
  out(message: string): void;
  err(message: string): void;
}

export interface ClientDeps {
  env: NodeJS.ProcessEnv;
  fetchFn: typeof fetch;
  io: ClientIO;
  now(): Date;
}

interface ClientConfig {
  server_addr?: string | undefined;
  mode?: string | undefined;
  token?: string | undefined;
  token_expires_at?: string | undefined;
  username?: string | undefined;
  password?: string | undefined;
  timeout_seconds?: number | undefined;
  version_cache?: VersionCacheEntry | undefined;
}

interface VersionCacheEntry {
  server_addr?: string | undefined;
  cached_at?: string | undefined;
  response?: VersionResponse | undefined;
}

interface VersionResponse {
  ok?: boolean | undefined;
  directive?: string | undefined;
  mkp_server?: string | undefined;
  mkp_device?: Record<string, unknown> | undefined;
  error?: string | undefined;
}

interface ParsedArgs {
  flags: Map<string, string | true>;
  positionals: string[];
}

interface GlobalFlags {
  server?: string | undefined;
  mode?: string | undefined;
  token?: string | undefined;
  username?: string | undefined;
  password?: string | undefined;
  config?: string | undefined;
  timeoutMs?: number | undefined;
}

interface RuntimeConfig {
  configPath: string;
  explicitToken: boolean;
  mode: string;
  password: string;
  serverAddr: string;
  timeoutMs: number;
  token: string;
  username: string;
}

const CLIENT_VERSION = APP_VERSION;
const DEFAULT_SERVER_ENDPOINT = "http://127.0.0.1:8080";
const DEFAULT_HTTP_TIMEOUT_MS = 15000;
const DEFAULT_CLIENT_MODE = "release";
const TOKEN_REFRESH_SKEW_MS = 30000;
const VERSION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function defaultIO(): ClientIO {
  return {
    out(message: string): void {
      process.stdout.write(message + "\n");
    },
    err(message: string): void {
      process.stderr.write(message + "\n");
    }
  };
}

function defaultDeps(): ClientDeps {
  return {
    env: process.env,
    fetchFn: fetch,
    io: defaultIO(),
    now(): Date {
      return new Date();
    }
  };
}

function usage(): string {
  return [
    "Usage:",
    "  mkp-client [global flags] <command> [subcommand] [flags]",
    "",
    "Commands:",
    "  auth login [--username admin --password admin123]",
    "  auth token",
    "  auth revoke [--forget]",
    "  list [-l 10] [-n name]",
    "  recording [-n name] [--width 0] [--height 0] [--stposx 0] [--stposy 0]",
    "  remove -i <record-id>",
    "  replay -i <record-id>",
    "  stop",
    "  version",
    "",
    "Global flags:",
    "  -s, --server <url>",
    "  --mode <debug|release>",
    "  --token <jwt>",
    "  --username <name>",
    "  --password <password>",
    "  --config <path>",
    "  --timeout <ms>",
    "  -h, --help"
  ].join("\n");
}

function normalizeArg(token: string, aliases: Readonly<Record<string, string>>): string {
  return aliases[token] ?? token;
}

function parseArgs(
  argv: readonly string[],
  valueFlags: ReadonlySet<string>,
  booleanFlags: ReadonlySet<string>,
  aliases: Readonly<Record<string, string>> = {}
): ParsedArgs {
  const flags = new Map<string, string | true>();
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index] ?? "";
    const token = normalizeArg(raw, aliases);
    if (booleanFlags.has(token)) {
      flags.set(token, true);
      continue;
    }
    if (valueFlags.has(token)) {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error("missing value for " + raw);
      }
      flags.set(token, value);
      index += 1;
      continue;
    }
    if (token.startsWith("--")) {
      const value = argv[index + 1];
      if (value !== undefined && !value.startsWith("-")) {
        flags.set(token, value);
        index += 1;
      } else {
        flags.set(token, true);
      }
      continue;
    }
    positionals.push(raw);
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

function parsePositiveNumber(raw: string | undefined, name: string): number | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`invalid number for ${name}: ${raw}`);
  }
  return parsed;
}

function requireFlagString(parsed: ParsedArgs, name: string): string {
  const value = getFlagString(parsed, name);
  if (!value?.trim()) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

function formatJSON(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function escapeTableValue(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ").replaceAll("\r", " ");
}

function formatLength(seconds: number, milliseconds: number): string {
  return `${seconds}s ${milliseconds}ms`;
}

function formatTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function normalizeServerAddr(addr: string): string {
  return addr.trim().replace(/\/+$/, "");
}

function isDebugMode(mode: string): boolean {
  return mode.trim().toLowerCase() === "debug";
}

function tokenStillValid(expiresAt: string | undefined, now: Date): boolean {
  if (!expiresAt?.trim()) {
    return false;
  }
  const parsed = Date.parse(expiresAt);
  if (!Number.isFinite(parsed)) {
    return false;
  }
  return now.getTime() + TOKEN_REFRESH_SKEW_MS < parsed;
}

async function resolveClientConfigPath(explicitPath: string | undefined, env: NodeJS.ProcessEnv): Promise<string> {
  if (explicitPath?.trim()) {
    return explicitPath.trim();
  }
  const envPath = env.MKP_CONFIG_PATH?.trim();
  if (envPath) {
    return envPath;
  }

  const localPath = join(process.cwd(), "client.json");
  if (existsSync(localPath)) {
    return localPath;
  }

  return join(homedir(), ".mkp", "client.json");
}

async function loadClientConfig(configPath: string): Promise<ClientConfig> {
  try {
    const data = await readFile(configPath, "utf8");
    if (!data.trim()) {
      return {};
    }
    return JSON.parse(data) as ClientConfig;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function saveClientConfig(configPath: string, config: ClientConfig): Promise<void> {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf8");
}

async function buildRuntimeConfig(globalFlags: GlobalFlags, deps: ClientDeps): Promise<RuntimeConfig> {
  const configPath = await resolveClientConfigPath(globalFlags.config, deps.env);
  const saved = await loadClientConfig(configPath);

  const explicitToken = Boolean(globalFlags.token?.trim() || deps.env.MKP_TOKEN?.trim());
  const serverAddr = normalizeServerAddr(
    globalFlags.server?.trim() || deps.env.MKP_SERVER?.trim() || saved.server_addr?.trim() || DEFAULT_SERVER_ENDPOINT
  );
  const mode = (globalFlags.mode?.trim() || deps.env.MKP_MODE?.trim() || saved.mode?.trim() || DEFAULT_CLIENT_MODE).toLowerCase();
  const token = globalFlags.token?.trim() || deps.env.MKP_TOKEN?.trim() || saved.token?.trim() || "";
  const username = globalFlags.username?.trim() || deps.env.MKP_USER?.trim() || saved.username?.trim() || "";
  const password = globalFlags.password?.trim() || deps.env.MKP_PASSWORD?.trim() || saved.password?.trim() || "";
  const timeoutMs =
    globalFlags.timeoutMs ??
    parsePositiveNumber(deps.env.MKP_TIMEOUT_MS ?? undefined, "MKP_TIMEOUT_MS") ??
    (typeof saved.timeout_seconds === "number" && saved.timeout_seconds > 0 ? saved.timeout_seconds * 1000 : DEFAULT_HTTP_TIMEOUT_MS);

  return {
    configPath,
    explicitToken,
    mode,
    password,
    serverAddr,
    timeoutMs,
    token,
    username
  };
}

async function doJSONRequest(
  runtime: RuntimeConfig,
  deps: ClientDeps,
  method: string,
  path: string,
  payload: unknown,
  bearerToken: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const headers = new Headers({ accept: "application/json" });
  let body: string | undefined;
  if (payload !== undefined && payload !== null) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(payload);
  }
  if (bearerToken.trim()) {
    headers.set("authorization", `Bearer ${bearerToken.trim()}`);
  }

  const response = await deps.fetchFn(runtime.serverAddr + path, {
    method,
    headers,
    ...(body === undefined ? {} : { body }),
    signal: AbortSignal.timeout(runtime.timeoutMs)
  });
  const text = await response.text();
  const parsed = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {};
  return { status: response.status, body: parsed };
}

function formatAPIError(status: number, body: Record<string, unknown>): Error {
  const message = typeof body.error === "string" && body.error.trim() ? body.error.trim() : `request failed with status ${status}`;
  return new Error(message);
}

async function fetchToken(runtime: RuntimeConfig, deps: ClientDeps, username: string, password: string): Promise<{ token: string; expiresAt: Date }> {
  const result = await doJSONRequest(runtime, deps, "POST", "/api/v1/auth/token", { username, password }, "");
  if (result.status >= 400) {
    throw formatAPIError(result.status, result.body);
  }

  const token = typeof result.body.token === "string" ? result.body.token.trim() : "";
  if (!token) {
    throw new Error("token response is missing token");
  }
  const expiresIn = typeof result.body.expires_in === "number" ? result.body.expires_in : 86400;
  return {
    token,
    expiresAt: new Date(deps.now().getTime() + Math.max(expiresIn, 1) * 1000)
  };
}

async function ensureManagedToken(runtime: RuntimeConfig, deps: ClientDeps, forceRefresh: boolean): Promise<string> {
  const saved = await loadClientConfig(runtime.configPath);
  if (!forceRefresh && saved.token?.trim() && tokenStillValid(saved.token_expires_at, deps.now())) {
    return saved.token.trim();
  }

  const username = runtime.username || saved.username?.trim() || "";
  const password = runtime.password || saved.password?.trim() || "";
  if (!username || !password) {
    throw new Error("username/password are required");
  }

  const issued = await fetchToken(runtime, deps, username, password);
  const nextState: ClientConfig = {
    ...saved,
    server_addr: runtime.serverAddr,
    mode: runtime.mode,
    username,
    password,
    token: issued.token,
    token_expires_at: issued.expiresAt.toISOString(),
    timeout_seconds: Math.ceil(runtime.timeoutMs / 1000)
  };
  await saveClientConfig(runtime.configPath, nextState);
  runtime.token = issued.token;
  return issued.token;
}

async function sendJSON(
  runtime: RuntimeConfig,
  deps: ClientDeps,
  method: string,
  path: string,
  payload: unknown,
  requireAuth: boolean
): Promise<Record<string, unknown>> {
  const needsAuth = requireAuth && !isDebugMode(runtime.mode);
  let token = runtime.token.trim();
  if (needsAuth && !token) {
    token = await ensureManagedToken(runtime, deps, false);
  }

  let result = await doJSONRequest(runtime, deps, method, path, payload, needsAuth ? token : "");
  if (result.status === 401 && needsAuth && !runtime.explicitToken) {
    token = await ensureManagedToken(runtime, deps, true);
    result = await doJSONRequest(runtime, deps, method, path, payload, token);
  }

  if (result.status >= 400) {
    throw formatAPIError(result.status, result.body);
  }
  return result.body;
}

function renderListTable(records: Array<Record<string, unknown>>): string {
  const headers = ["Name", "RID", "Location", "Cursor Initial Position", "Screen Size", "OS", "Length", "Created At"];
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`
  ];

  for (const record of records) {
    lines.push(
      `| ${[
        escapeTableValue(String(record.name ?? "")),
        escapeTableValue(String(record.unique_id ?? "")),
        escapeTableValue(String(record.mkp_path ?? "")),
        escapeTableValue(`(${Number(record.start_point_x ?? 0)},${Number(record.start_point_y ?? 0)})`),
        escapeTableValue(`${Number(record.screen_width ?? 0)}x${Number(record.screen_height ?? 0)}`),
        escapeTableValue(String(record.os ?? "")),
        escapeTableValue(formatLength(Number(record.seconds ?? 0), Number(record.milliseconds ?? 0))),
        escapeTableValue(String(record.created_at ?? ""))
      ].join(" | ")} |`
    );
  }

  return lines.join("\n");
}

function renderVersionTable(info: VersionResponse): string {
  const rows: Array<[string, string]> = [
    ["mkp agent server", info.mkp_server?.trim() || "unknown"],
    ["mkp agent client", CLIENT_VERSION]
  ];

  const device = info.mkp_device ?? {};
  for (const key of ["app", "boot", "hw", "uver", "aver"]) {
    const value = device[key];
    if (typeof value === "string" && value.trim()) {
      rows.push([`mkp device ${key}`, value.trim()]);
    }
  }

  if (rows.length === 2) {
    rows.push(["mkp device", "unknown"]);
  }

  const lines = ["| Component | Version |", "| --- | --- |"]; 
  for (const [component, version] of rows) {
    lines.push(`| ${escapeTableValue(component)} | ${escapeTableValue(version)} |`);
  }
  return lines.join("\n");
}

function cachedVersionResponse(config: ClientConfig | undefined, serverAddr: string, now: Date): VersionResponse | undefined {
  const cache = config?.version_cache;
  if (!cache?.response || normalizeServerAddr(cache.server_addr ?? "") !== normalizeServerAddr(serverAddr)) {
    return undefined;
  }
  const cachedAtMs = Date.parse(cache.cached_at ?? "");
  if (!Number.isFinite(cachedAtMs) || now.getTime() - cachedAtMs > VERSION_CACHE_TTL_MS) {
    return undefined;
  }
  return cache.response;
}

async function executeAuthLogin(parsed: ParsedArgs, runtime: RuntimeConfig, deps: ClientDeps): Promise<string> {
  const username = getFlagString(parsed, "--username")?.trim() || runtime.username;
  const password = getFlagString(parsed, "--password")?.trim() || runtime.password;
  if (!username || !password) {
    throw new Error("username/password are required");
  }

  const issued = await fetchToken(runtime, deps, username, password);
  const saved = await loadClientConfig(runtime.configPath);
  await saveClientConfig(runtime.configPath, {
    ...saved,
    server_addr: runtime.serverAddr,
    mode: runtime.mode,
    username,
    password,
    token: issued.token,
    token_expires_at: issued.expiresAt.toISOString(),
    timeout_seconds: Math.ceil(runtime.timeoutMs / 1000)
  });
  runtime.token = issued.token;
  return `token saved (expires at ${issued.expiresAt.toISOString()})`;
}

async function executeAuthToken(runtime: RuntimeConfig, deps: ClientDeps): Promise<string> {
  return runtime.token.trim() || ensureManagedToken(runtime, deps, false);
}

async function executeAuthRevoke(parsed: ParsedArgs, runtime: RuntimeConfig): Promise<string> {
  const forget = hasFlag(parsed, "--forget");
  const saved = await loadClientConfig(runtime.configPath);
  saved.token = "";
  saved.token_expires_at = "";
  if (forget) {
    saved.username = "";
    saved.password = "";
  }
  await saveClientConfig(runtime.configPath, saved);
  return forget ? "local token and credentials cleared" : "local token cleared";
}

async function executeList(parsed: ParsedArgs, runtime: RuntimeConfig, deps: ClientDeps): Promise<string> {
  const limits = parsePositiveNumber(getFlagString(parsed, "--limits") ?? "10", "limits") ?? 10;
  const name = getFlagString(parsed, "--name")?.trim() || "";
  const query = new URLSearchParams({ limits: String(limits) });
  if (name) {
    query.set("name", name);
  }
  const response = await sendJSON(runtime, deps, "GET", `/api/v1/directives/list?${query.toString()}`, undefined, true);
  const records = Array.isArray(response.records) ? (response.records as Array<Record<string, unknown>>) : [];
  return records.length === 0 ? "No records found" : renderListTable(records);
}

async function executeRecording(parsed: ParsedArgs, runtime: RuntimeConfig, deps: ClientDeps): Promise<string> {
  const logName = getFlagString(parsed, "--name")?.trim() || `mkp-${formatTimestamp(deps.now())}`;
  const width = Number.parseInt(getFlagString(parsed, "--width") ?? "0", 10) || 0;
  const height = Number.parseInt(getFlagString(parsed, "--height") ?? "0", 10) || 0;
  const payload: Record<string, unknown> = { log_name: logName, width, height };
  const stposx = getFlagString(parsed, "--stposx");
  const stposy = getFlagString(parsed, "--stposy");
  if (stposx !== undefined) {
    payload.stposx = Number.parseInt(stposx, 10) || 0;
  }
  if (stposy !== undefined) {
    payload.stposy = Number.parseInt(stposy, 10) || 0;
  }
  return formatJSON(await sendJSON(runtime, deps, "POST", "/api/v1/directives/alog", payload, true));
}

async function executeRemove(parsed: ParsedArgs, runtime: RuntimeConfig, deps: ClientDeps): Promise<string> {
  const id = requireFlagString(parsed, "--id");
  return formatJSON(await sendJSON(runtime, deps, "DELETE", `/api/v1/directives/records/${encodeURIComponent(id)}`, undefined, true));
}

async function executeReplay(parsed: ParsedArgs, runtime: RuntimeConfig, deps: ClientDeps): Promise<string> {
  const id = requireFlagString(parsed, "--id");
  return formatJSON(await sendJSON(runtime, deps, "POST", `/api/v1/directives/aplay/${encodeURIComponent(id)}`, undefined, true));
}

async function executeStop(runtime: RuntimeConfig, deps: ClientDeps): Promise<string> {
  return formatJSON(await sendJSON(runtime, deps, "POST", "/api/v1/directives/astop", undefined, true));
}

async function executeVersion(runtime: RuntimeConfig, deps: ClientDeps): Promise<string> {
  const saved = await loadClientConfig(runtime.configPath);
  const cached = cachedVersionResponse(saved, runtime.serverAddr, deps.now());
  if (cached) {
    return renderVersionTable(cached);
  }

  const response = (await sendJSON(runtime, deps, "GET", "/api/v1/version", undefined, false)) as VersionResponse;
  await saveClientConfig(runtime.configPath, {
    ...saved,
    version_cache: {
      server_addr: normalizeServerAddr(runtime.serverAddr),
      cached_at: deps.now().toISOString(),
      response
    }
  });
  return renderVersionTable(response);
}

function parseGlobalFlags(argv: readonly string[]): { globals: GlobalFlags; commandIndex: number } {
  const aliases = { "-s": "--server", "-h": "--help" };
  const valueFlags = new Set(["--server", "--mode", "--token", "--username", "--password", "--config", "--timeout"]);
  const booleanFlags = new Set(["--help"]);
  const globals: string[] = [];
  let commandIndex = -1;

  for (let index = 0; index < argv.length; index += 1) {
    const token = normalizeArg(argv[index] ?? "", aliases);
    if (token.startsWith("-") && commandIndex < 0) {
      globals.push(token);
      if (valueFlags.has(token)) {
        const value = argv[index + 1];
        if (value === undefined) {
          throw new Error("missing value for " + token);
        }
        globals.push(value);
        index += 1;
      }
      continue;
    }
    commandIndex = index;
    break;
  }

  const parsed = parseArgs(globals, valueFlags, booleanFlags, aliases);
  return {
    globals: {
      server: getFlagString(parsed, "--server"),
      mode: getFlagString(parsed, "--mode"),
      token: getFlagString(parsed, "--token"),
      username: getFlagString(parsed, "--username"),
      password: getFlagString(parsed, "--password"),
      config: getFlagString(parsed, "--config"),
      timeoutMs: parsePositiveNumber(getFlagString(parsed, "--timeout"), "timeout")
    },
    commandIndex
  };
}

export async function runClientCli(argv: readonly string[] = process.argv.slice(2), customDeps: Partial<ClientDeps> = {}): Promise<number> {
  const deps = { ...defaultDeps(), ...customDeps };

  try {
    const { globals, commandIndex } = parseGlobalFlags(argv);
    if (commandIndex < 0) {
      deps.io.out(usage());
      return 0;
    }

    const command = argv[commandIndex] ?? "";
    if (command === "help" || command === "--help" || command === "-h") {
      deps.io.out(usage());
      return 0;
    }

    const runtime = await buildRuntimeConfig(globals, deps);
    const rest = argv.slice(commandIndex + 1);

    if (command === "auth") {
      const subcommand = rest[0] ?? "";
      const parsed = parseArgs(rest.slice(1), new Set(["--username", "--password"]), new Set(["--forget"]));
      let output = "";
      switch (subcommand) {
        case "login":
          output = await executeAuthLogin(parsed, runtime, deps);
          break;
        case "token":
          output = await executeAuthToken(runtime, deps);
          break;
        case "revoke":
          output = await executeAuthRevoke(parsed, runtime);
          break;
        default:
          throw new Error("unknown auth subcommand: " + subcommand);
      }
      if (output) {
        deps.io.out(output);
      }
      return 0;
    }

    let output = "";
    switch (command) {
      case "list":
      case "l":
        output = await executeList(parseArgs(rest, new Set(["--limits", "--name"]), new Set(), { "-l": "--limits", "-n": "--name" }), runtime, deps);
        break;
      case "recording":
      case "record":
      case "r":
        output = await executeRecording(parseArgs(rest, new Set(["--name", "--width", "--height", "--stposx", "--stposy"]), new Set(), { "-n": "--name" }), runtime, deps);
        break;
      case "remove":
        output = await executeRemove(parseArgs(rest, new Set(["--id"]), new Set(), { "-i": "--id" }), runtime, deps);
        break;
      case "replay":
        output = await executeReplay(parseArgs(rest, new Set(["--id"]), new Set(), { "-i": "--id" }), runtime, deps);
        break;
      case "stop":
      case "s":
        output = await executeStop(runtime, deps);
        break;
      case "version":
        output = await executeVersion(runtime, deps);
        break;
      default:
        throw new Error("unknown command: " + command);
    }

    if (output) {
      deps.io.out(output);
    }
    return 0;
  } catch (error) {
    deps.io.err(error instanceof Error ? error.message : String(error));
    return 1;
  }
}


