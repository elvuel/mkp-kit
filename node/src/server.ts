import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server as NodeServer, type ServerResponse } from "node:http";
import { createRequire } from "node:module";

import type { LogLength, MKPVersion, SerialPortStatus } from "./models.js";
import { composeLogFullpath, newSFSerialPort } from "./sdk.js";

const require = createRequire(import.meta.url);

export const APP_VERSION = "0.1.0";
export const SERIAL_SYNC_TIMEOUT_GRACE_MS = 2000;

export interface ServerPort {
  open?(): Promise<void> | void;
  close?(): Promise<void> | void;
  snapshotStatus(): SerialPortStatus;
  aversion(timeoutMs?: number): Promise<MKPVersion> | MKPVersion;
  startRecording(args?: string): Promise<void> | void;
  stopRecording(): Promise<string> | string;
  cancelReplay(): Promise<unknown> | unknown;
  atime?(path: string, timeoutMs?: number): Promise<LogLength> | LogLength;
  deleteFile?(path: string, timeoutMs?: number): Promise<string> | string;
  moveCursor?(x: number, y: number): Promise<void> | void;
  startReplaying?(logName: string, delay?: number): Promise<void> | void;
}

export interface ServerSettings {
  mode: string;
  sfPort: string;
  port: number;
  user: string;
  password: string;
  jwtSecret: string;
  issuer: string;
  tokenTtlSeconds: number;
  muteAuthInDebug: boolean;
  syncDirectiveTimeoutMs: number;
  asyncDirectiveTimeoutMs: number;
  dbDriver: string;
  dbDsn: string;
  dbTimeoutMs: number;
  replayCompletionGraceMs: number;
  replayMinimumDurationMs: number;
  corsAllowOrigins: string[];
  corsAllowMethods: string[];
  corsAllowHeaders: string[];
  corsMaxAgeSeconds: number;
  httpRequestTimeoutMs: number;
  httpHeadersTimeoutMs: number;
  httpKeepAliveTimeoutMs: number;
}

export interface AuthTokenRequest {
  username: string;
  password: string;
}

export interface AlogRequest {
  log_name: string;
  width?: number | undefined;
  height?: number | undefined;
  stposx?: number | undefined;
  stposy?: number | undefined;
}

export interface ReplayState {
  running: boolean;
  current_id: string;
  started_at?: string | undefined;
  estimated_done_at?: string | undefined;
  release_after?: string | undefined;
  active: boolean;
  retry_after_seconds?: number | undefined;
}

export interface MacroRecord {
  id: number;
  name: string;
  unique_id: string;
  mkp_path: string;
  start_point_x: number;
  start_point_y: number;
  screen_width: number;
  screen_height: number;
  os: string;
  seconds: number;
  milliseconds: number;
  created_at: string;
  updated_at: string;
}

interface MacroRecordInput {
  name: string;
  unique_id: string;
  mkp_path: string;
  start_point_x: number;
  start_point_y: number;
  screen_width: number;
  screen_height: number;
  os: string;
  seconds: number;
  milliseconds: number;
}

interface AlogSession {
  name: string;
  unique_id: string;
  mkp_path: string;
  start_point_x: number;
  start_point_y: number;
  screen_width: number;
  screen_height: number;
  os: string;
}

export interface ServerApp {
  settings: ServerSettings;
  state: APIState;
  handle(request: Request): Promise<Response>;
  listen(port?: number, host?: string): Promise<NodeServer>;
  close(): Promise<void>;
}

export interface CreateServerAppOptions {
  settings?: Partial<ServerSettings> | undefined;
  sfport?: ServerPort | undefined;
  initializeSerial?: boolean | undefined;
  env?: NodeJS.ProcessEnv | undefined;
}

interface JWTClaims {
  iss: string;
  sub: string;
  iat: number;
  exp: number;
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) {
    return fallback;
  }
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseBool(raw: string | undefined, fallback: boolean): boolean {
  if (!raw?.trim()) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

function parseCSV(raw: string | undefined, fallback: readonly string[]): string[] {
  if (!raw?.trim()) {
    return [...fallback];
  }
  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return parsed.length > 0 ? parsed : [...fallback];
}

function resolveRunMode(raw: string | undefined): string {
  const mode = firstNonEmpty(raw, "release").toLowerCase();
  if (["dev", "development", "debug"].includes(mode)) {
    return "debug";
  }
  if (["test", "testing"].includes(mode)) {
    return "test";
  }
  return "release";
}

export function loadServerSettings(env: NodeJS.ProcessEnv = process.env, seed: Partial<ServerSettings> = {}): ServerSettings {
  const dbDriver = firstNonEmpty(env.MKP_DB_DRIVER, env.MKP_DATABASE_DRIVER, seed.dbDriver, "sqlite").toLowerCase();
  const defaultDbDsn = dbDriver === "memory" ? ":memory:" : "mkp.db";
  return {
    mode: resolveRunMode(firstNonEmpty(env.APP_MODE, env.RUN_MODE, env.GIN_MODE, env.MKP_MODE, seed.mode, "release")),
    sfPort: firstNonEmpty(env.MKP_SF_PORT, env.MKP_SERIAL_PORT, seed.sfPort, "COM3"),
    port: parsePositiveInt(firstNonEmpty(env.PORT, env.MKP_PORT, seed.port === undefined ? undefined : String(seed.port)), 8080),
    user: firstNonEmpty(env.MKP_USER, seed.user, "admin"),
    password: firstNonEmpty(env.MKP_PASSWORD, seed.password, "admin123"),
    jwtSecret: firstNonEmpty(env.JWT_SECRET, env.MKP_JWT_SECRET, seed.jwtSecret, "mkp-go-dev-secret"),
    issuer: firstNonEmpty(env.MKP_ISSUER, seed.issuer, "mkp-go-server"),
    tokenTtlSeconds: parsePositiveInt(firstNonEmpty(env.JWT_TTL_SECONDS, env.MKP_TOKEN_TTL_SECONDS, seed.tokenTtlSeconds === undefined ? undefined : String(seed.tokenTtlSeconds)), 86400),
    muteAuthInDebug: parseBool(firstNonEmpty(env.MKP_MUTE_AUTH_IN_DEBUG, seed.muteAuthInDebug === undefined ? undefined : String(seed.muteAuthInDebug)), false),
    syncDirectiveTimeoutMs: parsePositiveInt(firstNonEmpty(env.MKP_SYNC_DIRECTIVE_TIMEOUT_MS, seed.syncDirectiveTimeoutMs === undefined ? undefined : String(seed.syncDirectiveTimeoutMs)), 10000),
    asyncDirectiveTimeoutMs: parsePositiveInt(firstNonEmpty(env.MKP_ASYNC_DIRECTIVE_TIMEOUT_MS, seed.asyncDirectiveTimeoutMs === undefined ? undefined : String(seed.asyncDirectiveTimeoutMs)), 3000),
    dbDriver,
    dbDsn: firstNonEmpty(env.MKP_DB_DSN, env.MKP_DATABASE_DSN, seed.dbDsn, defaultDbDsn),
    dbTimeoutMs: parsePositiveInt(firstNonEmpty(env.MKP_DB_TIMEOUT_MS, seed.dbTimeoutMs === undefined ? undefined : String(seed.dbTimeoutMs)), 5000),
    replayCompletionGraceMs: parsePositiveInt(firstNonEmpty(env.MKP_REPLAY_COMPLETION_GRACE_MS, seed.replayCompletionGraceMs === undefined ? undefined : String(seed.replayCompletionGraceMs)), 1500),
    replayMinimumDurationMs: parsePositiveInt(firstNonEmpty(env.MKP_REPLAY_MIN_DURATION_MS, seed.replayMinimumDurationMs === undefined ? undefined : String(seed.replayMinimumDurationMs)), 1000),
    corsAllowOrigins: parseCSV(env.MKP_CORS_ALLOW_ORIGINS, seed.corsAllowOrigins ?? ["*"]),
    corsAllowMethods: parseCSV(env.MKP_CORS_ALLOW_METHODS, seed.corsAllowMethods ?? ["GET", "POST", "DELETE", "OPTIONS"]),
    corsAllowHeaders: parseCSV(env.MKP_CORS_ALLOW_HEADERS, seed.corsAllowHeaders ?? ["Origin", "Content-Type", "Accept", "Authorization"]),
    corsMaxAgeSeconds: parsePositiveInt(firstNonEmpty(env.MKP_CORS_MAX_AGE_SECONDS, seed.corsMaxAgeSeconds === undefined ? undefined : String(seed.corsMaxAgeSeconds)), 43200),
    httpRequestTimeoutMs: parsePositiveInt(firstNonEmpty(env.MKP_HTTP_REQUEST_TIMEOUT_MS, seed.httpRequestTimeoutMs === undefined ? undefined : String(seed.httpRequestTimeoutMs)), 30000),
    httpHeadersTimeoutMs: parsePositiveInt(firstNonEmpty(env.MKP_HTTP_HEADERS_TIMEOUT_MS, seed.httpHeadersTimeoutMs === undefined ? undefined : String(seed.httpHeadersTimeoutMs)), 10000),
    httpKeepAliveTimeoutMs: parsePositiveInt(firstNonEmpty(env.MKP_HTTP_KEEP_ALIVE_TIMEOUT_MS, seed.httpKeepAliveTimeoutMs === undefined ? undefined : String(seed.httpKeepAliveTimeoutMs)), 60000)
  };
}

function toIsoString(value: Date | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function notFound(): Response {
  return jsonResponse({ ok: false, error: "not found" }, 404);
}

function secureTextEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function base64urlEncode(data: string | Buffer): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function signJWT(claims: JWTClaims, secret: string): string {
  const header = base64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64urlEncode(JSON.stringify(claims));
  const content = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(content).digest("base64url");
  return `${content}.${signature}`;
}

function verifyJWT(token: string, secret: string, issuer: string): JWTClaims {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new AuthError(401, "invalid or expired token");
  }

  const content = `${parts[0]}.${parts[1]}`;
  const expected = createHmac("sha256", secret).update(content).digest("base64url");
  if (!secureTextEqual(expected, parts[2])) {
    throw new AuthError(401, "invalid or expired token");
  }

  let claims: JWTClaims;
  try {
    claims = JSON.parse(base64urlDecode(parts[1])) as JWTClaims;
  } catch {
    throw new AuthError(401, "invalid or expired token");
  }

  if (claims.iss !== issuer || typeof claims.sub !== "string" || !claims.sub.trim()) {
    throw new AuthError(401, "invalid or expired token");
  }
  if (!Number.isFinite(claims.exp) || claims.exp * 1000 <= Date.now()) {
    throw new AuthError(401, "invalid or expired token");
  }
  return claims;
}

function allowedOrigin(origin: string | null, settings: ServerSettings): string | undefined {
  if (settings.corsAllowOrigins.includes("*")) {
    return "*";
  }
  if (!origin) {
    return undefined;
  }
  return settings.corsAllowOrigins.includes(origin) ? origin : undefined;
}

function withCorsHeaders(request: Request, response: Response, settings: ServerSettings): Response {
  const headers = new Headers(response.headers);
  const origin = allowedOrigin(request.headers.get("origin"), settings);
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }
  headers.set("access-control-allow-methods", settings.corsAllowMethods.join(", "));
  headers.set("access-control-allow-headers", settings.corsAllowHeaders.join(", "));
  headers.set("access-control-max-age", String(settings.corsMaxAgeSeconds));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function serializeRecord(record: MacroRecord): MacroRecord {
  return { ...record };
}

async function parseJsonBody<T>(request: Request): Promise<T> {
  const raw = await request.text();
  if (!raw.trim()) {
    return {} as T;
  }
  return JSON.parse(raw) as T;
}

async function requestToNodeResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  res.end(bytes);
}

function requestHeadersFromNode(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(key, item);
      }
      continue;
    }
    if (value !== undefined) {
      headers.set(key, value);
    }
  }
  return headers;
}

async function incomingMessageToRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  const protocol = (req.socket as { encrypted?: boolean }).encrypted ? "https" : "http";
  const host = req.headers.host ?? "127.0.0.1";
  return new Request(`${protocol}://${host}${req.url ?? "/"}`, {
    method: req.method ?? "GET",
    headers: requestHeadersFromNode(req),
    ...(req.method === "GET" || req.method === "HEAD" || body === undefined ? {} : { body, duplex: "half" as const })
  });
}

class AuthError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

interface SQLiteRunResultLike {
  lastInsertRowid?: bigint | number | undefined;
  changes?: bigint | number | undefined;
}

interface SQLiteStatementLike {
  all(...params: unknown[]): Array<Record<string, unknown>>;
  get(...params: unknown[]): Record<string, unknown> | undefined;
  run(...params: unknown[]): SQLiteRunResultLike;
}

interface SQLiteDatabaseLike {
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): SQLiteStatementLike;
}

interface RecordStore {
  readonly available: boolean;
  close(): void;
  deleteRecord(uniqueId: string): boolean;
  getRecord(uniqueId: string): MacroRecord | undefined;
  insertRecord(input: MacroRecordInput): MacroRecord;
  listRecords(limits: number, name?: string): MacroRecord[];
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function openSqliteDatabase(location: string): SQLiteDatabaseLike {
  const sqlite = require("node:sqlite") as {
    DatabaseSync: new (location: string) => SQLiteDatabaseLike;
  };
  return new sqlite.DatabaseSync(location);
}

function mapRecordRow(row: Record<string, unknown>): MacroRecord {
  return {
    id: asNumber(row.id),
    name: asString(row.name),
    unique_id: asString(row.unique_id),
    mkp_path: asString(row.mkp_path),
    start_point_x: asNumber(row.start_point_x),
    start_point_y: asNumber(row.start_point_y),
    screen_width: asNumber(row.screen_width),
    screen_height: asNumber(row.screen_height),
    os: asString(row.os),
    seconds: asNumber(row.seconds),
    milliseconds: asNumber(row.milliseconds),
    created_at: asString(row.created_at),
    updated_at: asString(row.updated_at)
  };
}

class UnavailableRecordStore implements RecordStore {
  readonly available = false;

  close(): void {
  }

  deleteRecord(): boolean {
    throw new Error("database is not initialized");
  }

  getRecord(): MacroRecord | undefined {
    throw new Error("database is not initialized");
  }

  insertRecord(): MacroRecord {
    throw new Error("database is not initialized");
  }

  listRecords(): MacroRecord[] {
    throw new Error("database is not initialized");
  }
}

class MemoryRecordStore implements RecordStore {
  readonly available = true;

  private nextRecordId = 1;
  private readonly records: MacroRecord[] = [];

  close(): void {
  }

  deleteRecord(uniqueId: string): boolean {
    const index = this.records.findIndex((item) => item.unique_id === uniqueId);
    if (index < 0) {
      return false;
    }
    this.records.splice(index, 1);
    return true;
  }

  getRecord(uniqueId: string): MacroRecord | undefined {
    const record = this.records.find((item) => item.unique_id === uniqueId);
    return record ? serializeRecord(record) : undefined;
  }

  insertRecord(input: MacroRecordInput): MacroRecord {
    const now = new Date().toISOString();
    const record: MacroRecord = {
      id: this.nextRecordId,
      name: input.name,
      unique_id: input.unique_id,
      mkp_path: input.mkp_path,
      start_point_x: input.start_point_x,
      start_point_y: input.start_point_y,
      screen_width: input.screen_width,
      screen_height: input.screen_height,
      os: input.os,
      seconds: input.seconds,
      milliseconds: input.milliseconds,
      created_at: now,
      updated_at: now
    };
    this.nextRecordId += 1;
    this.records.push(record);
    return serializeRecord(record);
  }

  listRecords(limits: number, name = ""): MacroRecord[] {
    const lowered = name.trim().toLowerCase();
    const filtered = lowered
      ? this.records.filter((record) => record.name.toLowerCase().includes(lowered))
      : this.records;
    return [...filtered]
      .sort((left, right) => right.id - left.id)
      .slice(0, limits)
      .map((record) => serializeRecord(record));
  }
}

class SqliteRecordStore implements RecordStore {
  readonly available = true;

  private readonly db: SQLiteDatabaseLike;
  private readonly deleteStmt: SQLiteStatementLike;
  private readonly getStmt: SQLiteStatementLike;
  private readonly insertStmt: SQLiteStatementLike;
  private readonly listStmt: SQLiteStatementLike;
  private readonly listWithNameStmt: SQLiteStatementLike;

  constructor(location: string) {
    this.db = openSqliteDatabase(location);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS macro_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        unique_id TEXT NOT NULL UNIQUE,
        mkp_path TEXT NOT NULL,
        start_point_x INTEGER NOT NULL DEFAULT 0,
        start_point_y INTEGER NOT NULL DEFAULT 0,
        screen_width INTEGER NOT NULL DEFAULT 0,
        screen_height INTEGER NOT NULL DEFAULT 0,
        os TEXT NOT NULL,
        seconds INTEGER NOT NULL DEFAULT 0,
        milliseconds INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    this.insertStmt = this.db.prepare(`
      INSERT INTO macro_records (
        name,
        unique_id,
        mkp_path,
        start_point_x,
        start_point_y,
        screen_width,
        screen_height,
        os,
        seconds,
        milliseconds,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.listStmt = this.db.prepare(`
      SELECT *
      FROM macro_records
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `);
    this.listWithNameStmt = this.db.prepare(`
      SELECT *
      FROM macro_records
      WHERE name LIKE ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `);
    this.getStmt = this.db.prepare("SELECT * FROM macro_records WHERE unique_id = ? LIMIT 1");
    this.deleteStmt = this.db.prepare("DELETE FROM macro_records WHERE unique_id = ?");
  }

  close(): void {
    this.db.close();
  }

  deleteRecord(uniqueId: string): boolean {
    const result = this.deleteStmt.run(uniqueId);
    return asNumber(result.changes) > 0;
  }

  getRecord(uniqueId: string): MacroRecord | undefined {
    const row = this.getStmt.get(uniqueId);
    return row ? mapRecordRow(row) : undefined;
  }

  insertRecord(input: MacroRecordInput): MacroRecord {
    const now = new Date().toISOString();
    const result = this.insertStmt.run(
      input.name,
      input.unique_id,
      input.mkp_path,
      input.start_point_x,
      input.start_point_y,
      input.screen_width,
      input.screen_height,
      input.os,
      input.seconds,
      input.milliseconds,
      now,
      now
    );
    return {
      id: asNumber(result.lastInsertRowid),
      name: input.name,
      unique_id: input.unique_id,
      mkp_path: input.mkp_path,
      start_point_x: input.start_point_x,
      start_point_y: input.start_point_y,
      screen_width: input.screen_width,
      screen_height: input.screen_height,
      os: input.os,
      seconds: input.seconds,
      milliseconds: input.milliseconds,
      created_at: now,
      updated_at: now
    };
  }

  listRecords(limits: number, name = ""): MacroRecord[] {
    const rows = name.trim()
      ? this.listWithNameStmt.all(`%${name.trim()}%`, limits)
      : this.listStmt.all(limits);
    return rows.map((row) => mapRecordRow(row));
  }
}

function createRecordStore(settings: ServerSettings): RecordStore {
  const driver = settings.dbDriver.trim().toLowerCase();
  if (driver === "memory") {
    return new MemoryRecordStore();
  }
  if (driver === "sqlite" || driver === "sqlite3") {
    try {
      return new SqliteRecordStore(settings.dbDsn);
    } catch {
      return new UnavailableRecordStore();
    }
  }
  return new UnavailableRecordStore();
}

export class APIState {
  readonly settings: ServerSettings;
  readonly sfport: ServerPort;

  private initialized = false;
  private readonly recordStore: RecordStore;
  private replayTimer: NodeJS.Timeout | undefined;
  private currentAlogSession: AlogSession | undefined;

  alogRunning = false;
  alogStarted = false;
  currentAlogId = "";
  replayRunning = false;
  currentReplayId = "";
  replayStartedAt: Date | undefined;
  replayDoneAt: Date | undefined;
  replayReleaseAt: Date | undefined;

  constructor(settings: ServerSettings, sfport: ServerPort, initializeSerial = false) {
    this.settings = settings;
    this.sfport = sfport;
    this.recordStore = createRecordStore(settings);
    this.initialized = !initializeSerial;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.sfport.open?.();
    try {
      await this.sfport.stopRecording();
    } catch {
    }
    this.initialized = true;
  }

  async close(): Promise<void> {
    this.resetReplayState();
    this.recordStore.close();
    await this.sfport.close?.();
  }

  isDBReady(): boolean {
    return this.recordStore.available;
  }

  snapshotAlogState(): Record<string, unknown> {
    return {
      running: this.alogRunning,
      started: this.alogStarted,
      current_id: this.currentAlogId
    };
  }

  snapshotReplayState(): ReplayState {
    const payload: ReplayState = {
      running: this.replayRunning,
      current_id: this.currentReplayId,
      started_at: toIsoString(this.replayStartedAt),
      estimated_done_at: toIsoString(this.replayDoneAt),
      release_after: toIsoString(this.replayReleaseAt),
      active: false
    };

    const { blocking, retryAfterSeconds } = this.isReplayBlocking();
    if (blocking) {
      payload.active = true;
      if (retryAfterSeconds > 0) {
        payload.retry_after_seconds = retryAfterSeconds;
      }
    }

    return payload;
  }

  issueToken(username: string): { token: string; expires_in: number } {
    const expires_in = this.settings.tokenTtlSeconds;
    const now = Math.floor(Date.now() / 1000);
    const token = signJWT(
      {
        iss: this.settings.issuer,
        sub: username,
        iat: now,
        exp: now + expires_in
      },
      this.settings.jwtSecret
    );
    return { token, expires_in };
  }

  requireAuth(header: string | null): string {
    if (this.settings.muteAuthInDebug && this.settings.mode === "debug") {
      return this.settings.user;
    }
    if (!header) {
      throw new AuthError(401, "missing Authorization header");
    }
    const parts = header.trim().split(/\s+/, 2);
    if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer" || !parts[1]) {
      throw new AuthError(401, "invalid Authorization header format");
    }
    return verifyJWT(parts[1], this.settings.jwtSecret, this.settings.issuer).sub;
  }

  beginAlogSession(input: AlogRequest): AlogSession {
    const uniqueId = randomUUID().replace(/-/g, "").slice(0, 20);
    const session: AlogSession = {
      name: input.log_name.trim(),
      unique_id: uniqueId,
      mkp_path: composeLogFullpath(uniqueId),
      start_point_x: Math.max(input.stposx ?? 0, 0),
      start_point_y: Math.max(input.stposy ?? 0, 0),
      screen_width: Math.max(input.width ?? 0, 0),
      screen_height: Math.max(input.height ?? 0, 0),
      os: process.platform
    };
    this.currentAlogSession = session;
    this.currentAlogId = uniqueId;
    this.alogRunning = true;
    this.alogStarted = true;
    return session;
  }

  finishAlogSession(): AlogSession | undefined {
    const session = this.currentAlogSession;
    this.currentAlogSession = undefined;
    this.currentAlogId = "";
    this.alogRunning = false;
    this.alogStarted = false;
    return session;
  }

  insertRecord(input: MacroRecordInput): MacroRecord {
    return this.recordStore.insertRecord(input);
  }

  listRecords(limits: number, name = ""): MacroRecord[] {
    return this.recordStore.listRecords(limits, name);
  }

  getRecord(uniqueId: string): MacroRecord | undefined {
    return this.recordStore.getRecord(uniqueId);
  }

  deleteRecord(uniqueId: string): boolean {
    return this.recordStore.deleteRecord(uniqueId);
  }

  replayWindowForRecord(record: MacroRecord, startedAt: Date): { doneAt: Date; releaseAfter: Date } {
    const durationMs = Math.max(this.settings.replayMinimumDurationMs, record.seconds * 1000 + record.milliseconds);
    const doneAt = new Date(startedAt.getTime() + durationMs);
    const releaseAfter = new Date(doneAt.getTime() + this.settings.replayCompletionGraceMs);
    return { doneAt, releaseAfter };
  }

  isReplayBlocking(recordId = ""): { blocking: boolean; retryAfterSeconds: number } {
    if (!this.replayRunning) {
      return { blocking: false, retryAfterSeconds: 0 };
    }
    if (recordId && this.currentReplayId && this.currentReplayId !== recordId) {
      return { blocking: false, retryAfterSeconds: 0 };
    }
    if (!this.replayReleaseAt) {
      return { blocking: false, retryAfterSeconds: 0 };
    }
    const remainingMs = this.replayReleaseAt.getTime() - Date.now();
    if (remainingMs <= 0) {
      return { blocking: false, retryAfterSeconds: 0 };
    }
    return { blocking: true, retryAfterSeconds: Math.floor(remainingMs / 1000) + 1 };
  }

  markReplay(record: MacroRecord): { doneAt: Date; releaseAfter: Date } {
    const startedAt = new Date();
    const { doneAt, releaseAfter } = this.replayWindowForRecord(record, startedAt);
    this.replayRunning = true;
    this.currentReplayId = record.unique_id;
    this.replayStartedAt = startedAt;
    this.replayDoneAt = doneAt;
    this.replayReleaseAt = releaseAfter;
    if (this.replayTimer) {
      clearTimeout(this.replayTimer);
    }
    const replayId = record.unique_id;
    const delayMs = Math.max(releaseAfter.getTime() - Date.now(), 0);
    this.replayTimer = setTimeout(() => {
      if (this.currentReplayId === replayId) {
        this.resetReplayState();
      }
    }, delayMs);
    return { doneAt, releaseAfter };
  }

  resetReplayState(): void {
    if (this.replayTimer) {
      clearTimeout(this.replayTimer);
      this.replayTimer = undefined;
    }
    this.replayRunning = false;
    this.currentReplayId = "";
    this.replayStartedAt = undefined;
    this.replayDoneAt = undefined;
    this.replayReleaseAt = undefined;
  }
}

function createDefaultPort(settings: ServerSettings): ServerPort {
  return newSFSerialPort({
    name: settings.sfPort,
    syncOutputTimeoutMs: settings.syncDirectiveTimeoutMs
  });
}

async function handleHealth(state: APIState): Promise<Response> {
  const serial = state.sfport.snapshotStatus();
  const ready = serial.portOpen && serial.transportConfigured;
  return jsonResponse({
    ok: true,
    status: ready ? "up" : "degraded",
    ready,
    db_ready: state.isDBReady(),
    serial,
    alog: state.snapshotAlogState(),
    replay: state.snapshotReplayState()
  });
}

async function handleAuthToken(request: Request, state: APIState): Promise<Response> {
  const body = await parseJsonBody<AuthTokenRequest>(request);
  if (!secureTextEqual(body.username ?? "", state.settings.user) || !secureTextEqual(body.password ?? "", state.settings.password)) {
    return jsonResponse({ ok: false, error: "invalid username or password" }, 401);
  }
  const issued = state.issueToken(body.username);
  return jsonResponse({ ok: true, token: issued.token, token_type: "Bearer", expires_in: issued.expires_in });
}

async function handleVersion(state: APIState): Promise<Response> {
  const mkpDevice = await state.sfport.aversion(state.settings.syncDirectiveTimeoutMs + SERIAL_SYNC_TIMEOUT_GRACE_MS);
  return jsonResponse({ ok: true, directive: "version", mkp_server: APP_VERSION, mkp_device: mkpDevice });
}

async function handleDirectiveList(request: Request, state: APIState): Promise<Response> {
  state.requireAuth(request.headers.get("authorization"));
  const url = new URL(request.url);
  const limits = Math.max(1, Math.min(10, parsePositiveInt(url.searchParams.get("limits") ?? undefined, 10)));
  const name = (url.searchParams.get("name") ?? "").trim();
  const records = state.listRecords(limits, name);
  const payload: Record<string, unknown> = {
    ok: true,
    directive: "list",
    limits,
    count: records.length,
    records
  };
  if (name) {
    payload.name = name;
  }
  return jsonResponse(payload);
}

async function handleGetRecord(request: Request, state: APIState, recordId: string): Promise<Response> {
  state.requireAuth(request.headers.get("authorization"));
  const current = recordId.trim();
  if (!current) {
    return jsonResponse({ ok: false, error: "missing record id" }, 400);
  }
  const record = state.getRecord(current);
  if (!record) {
    return jsonResponse({ ok: false, error: "record not found" }, 404);
  }
  return jsonResponse({ ok: true, directive: "record", record });
}

async function handleDeleteRecord(request: Request, state: APIState, recordId: string): Promise<Response> {
  state.requireAuth(request.headers.get("authorization"));
  const current = recordId.trim();
  if (!current) {
    return jsonResponse({ ok: false, error: "missing record id" }, 400);
  }
  const record = state.getRecord(current);
  if (!record) {
    return jsonResponse({ ok: false, error: "record not found" }, 404);
  }
  const { blocking, retryAfterSeconds } = state.isReplayBlocking(record.unique_id);
  if (blocking) {
    const payload: Record<string, unknown> = { ok: false, error: "record is currently being replayed" };
    if (retryAfterSeconds > 0) {
      payload.retry_after_seconds = retryAfterSeconds;
    }
    return jsonResponse(payload, 409);
  }

  let fileDeleted = false;
  if (record.mkp_path && state.sfport.deleteFile) {
    await state.sfport.deleteFile(record.mkp_path, state.settings.syncDirectiveTimeoutMs + SERIAL_SYNC_TIMEOUT_GRACE_MS);
    fileDeleted = true;
  }
  state.deleteRecord(record.unique_id);
  return jsonResponse({ ok: true, directive: "record_delete", id: record.unique_id, file_deleted: fileDeleted });
}

async function handleReplayStatus(request: Request, state: APIState): Promise<Response> {
  state.requireAuth(request.headers.get("authorization"));
  return jsonResponse({ ok: true, directive: "replay_status", replay: state.snapshotReplayState() });
}

async function handleAlog(request: Request, state: APIState): Promise<Response> {
  state.requireAuth(request.headers.get("authorization"));
  if (state.alogRunning) {
    return jsonResponse({ ok: false, error: "alog is already running" }, 409);
  }
  const body = await parseJsonBody<AlogRequest>(request);
  const logName = (body.log_name ?? "").trim();
  if (!logName) {
    return jsonResponse({ ok: false, error: "log_name is required" }, 400);
  }
  const session = state.beginAlogSession({ ...body, log_name: logName });
  await state.sfport.startRecording(logName);
  return jsonResponse({ ok: true, directive: "alog", id: session.unique_id, log_name: logName, status: "started" });
}

async function handleAstop(request: Request, state: APIState): Promise<Response> {
  state.requireAuth(request.headers.get("authorization"));
  if (!state.alogRunning) {
    return jsonResponse({ ok: true, directive: "astop", status: "The stop command has been sent." });
  }
  const stoppedId = state.currentAlogId;
  const stoppedStarted = state.alogStarted;
  await state.sfport.stopRecording();
  const stoppedSession = state.finishAlogSession();
  const payload: Record<string, unknown> = {
    ok: true,
    directive: "astop",
    id: stoppedId,
    status: "stopped"
  };

  if (stoppedSession && stoppedStarted) {
    let length: LogLength = { seconds: 0, milsec: 0 };
    try {
      if (state.sfport.atime) {
        length = await state.sfport.atime(stoppedSession.mkp_path, state.settings.dbTimeoutMs);
      }
    } catch {
    }
    try {
      const record = state.insertRecord({
        name: stoppedSession.name,
        unique_id: stoppedSession.unique_id,
        mkp_path: stoppedSession.mkp_path,
        start_point_x: stoppedSession.start_point_x,
        start_point_y: stoppedSession.start_point_y,
        screen_width: stoppedSession.screen_width,
        screen_height: stoppedSession.screen_height,
        os: stoppedSession.os,
        seconds: length.seconds,
        milliseconds: length.milsec
      });
      payload.persisted = true;
      payload.macro_record_id = record.id;
    } catch (error) {
      payload.persisted = false;
      payload.persist_error = error instanceof Error ? error.message : String(error);
    }
  } else if (stoppedSession) {
    payload.persisted = false;
    payload.persist_error = "alog session was not fully started";
  } else {
    payload.persisted = false;
    payload.persist_error = "missing alog session state";
  }

  return jsonResponse(payload);
}

async function handleAplay(request: Request, state: APIState, recordId: string): Promise<Response> {
  state.requireAuth(request.headers.get("authorization"));
  const current = recordId.trim();
  if (!current) {
    return jsonResponse({ ok: false, error: "missing record id" }, 400);
  }
  if (state.replayRunning) {
    const { blocking, retryAfterSeconds } = state.isReplayBlocking();
    if (blocking) {
      return jsonResponse(
        {
          ok: false,
          error: "replay is already running",
          retry_after_seconds: retryAfterSeconds,
          estimated_done_at: toIsoString(state.replayDoneAt),
          release_after: toIsoString(state.replayReleaseAt)
        },
        409
      );
    }
    state.resetReplayState();
  }
  const record = state.getRecord(current);
  if (!record) {
    return jsonResponse({ ok: false, error: "record not found" }, 404);
  }
  if (!state.sfport.startReplaying) {
    return jsonResponse({ ok: false, error: "start_replaying is not supported by the configured serial port" }, 500);
  }
  if (state.sfport.moveCursor) {
    await state.sfport.moveCursor(Math.max(record.start_point_x, 0), Math.max(record.start_point_y, 0));
  }
  await state.sfport.startReplaying(record.mkp_path, -1);
  const { doneAt, releaseAfter } = state.markReplay(record);
  return jsonResponse({
    ok: true,
    directive: "aplay",
    id: record.unique_id,
    mkp_path: record.mkp_path,
    status: "started",
    estimated_done_at: doneAt.toISOString(),
    release_after: releaseAfter.toISOString()
  });
}

async function handleAcancel(request: Request, state: APIState): Promise<Response> {
  state.requireAuth(request.headers.get("authorization"));
  const replayId = state.currentReplayId;
  const wasRunning = state.replayRunning;
  await state.sfport.cancelReplay();
  state.resetReplayState();
  return jsonResponse({ ok: true, directive: "acancel", id: replayId, was_running: wasRunning, status: "cancel_sent" });
}

function recordIdFromPath(path: string, prefix: string): string | undefined {
  if (!path.startsWith(prefix)) {
    return undefined;
  }
  const value = path.slice(prefix.length).trim();
  return value ? decodeURIComponent(value) : "";
}

async function routeRequest(request: Request, state: APIState): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (request.method === "GET" && path === "/health") {
    return handleHealth(state);
  }
  if (request.method === "POST" && path === "/api/v1/auth/token") {
    return handleAuthToken(request, state);
  }
  if (request.method === "GET" && path === "/api/v1/version") {
    return handleVersion(state);
  }
  if (request.method === "GET" && path === "/api/v1/directives/list") {
    return handleDirectiveList(request, state);
  }
  if (request.method === "GET" && path === "/api/v1/directives/replay/status") {
    return handleReplayStatus(request, state);
  }
  if (request.method === "POST" && path === "/api/v1/directives/alog") {
    return handleAlog(request, state);
  }
  if (request.method === "POST" && path === "/api/v1/directives/astop") {
    return handleAstop(request, state);
  }
  if (request.method === "POST" && path === "/api/v1/directives/acancel") {
    return handleAcancel(request, state);
  }

  const recordId = recordIdFromPath(path, "/api/v1/directives/records/");
  if (recordId !== undefined && request.method === "GET") {
    return handleGetRecord(request, state, recordId);
  }
  if (recordId !== undefined && request.method === "DELETE") {
    return handleDeleteRecord(request, state, recordId);
  }

  const replayId = recordIdFromPath(path, "/api/v1/directives/aplay/");
  if (replayId !== undefined && request.method === "POST") {
    return handleAplay(request, state, replayId);
  }

  return notFound();
}

export function createServerApp(options: CreateServerAppOptions = {}): ServerApp {
  const env = options.env ?? process.env;
  const settings: ServerSettings = {
    ...loadServerSettings(env),
    ...(options.settings ?? {})
  };
  const state = new APIState(settings, options.sfport ?? createDefaultPort(settings), options.initializeSerial ?? false);

  return {
    settings,
    state,
    async handle(request: Request): Promise<Response> {
      try {
        return withCorsHeaders(request, await routeRequest(request, state), settings);
      } catch (error) {
        if (error instanceof AuthError) {
          return withCorsHeaders(request, jsonResponse({ ok: false, error: error.message }, error.statusCode), settings);
        }
        if (error instanceof SyntaxError) {
          return withCorsHeaders(request, jsonResponse({ ok: false, error: error.message }, 400), settings);
        }
        return withCorsHeaders(
          request,
          jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500),
          settings
        );
      }
    },
    async listen(port = settings.port, host = "0.0.0.0"): Promise<NodeServer> {
      await state.initialize();
      const server = createServer(async (req, res) => {
        try {
          const request = await incomingMessageToRequest(req);
          const response = await this.handle(request);
          await requestToNodeResponse(response, res);
        } catch (error) {
          const response = jsonResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }, 500);
          await requestToNodeResponse(response, res);
        }
      });
      server.requestTimeout = settings.httpRequestTimeoutMs;
      server.headersTimeout = settings.httpHeadersTimeoutMs;
      server.keepAliveTimeout = settings.httpKeepAliveTimeoutMs;
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolve();
        });
      });
      return server;
    },
    async close(): Promise<void> {
      await state.close();
    }
  };
}

export async function runServer(options: CreateServerAppOptions = {}): Promise<NodeServer> {
  const app = createServerApp({ ...options, initializeSerial: options.initializeSerial ?? true });
  return app.listen(app.settings.port);
}

