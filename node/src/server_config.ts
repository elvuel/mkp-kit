import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import type { ServerSettings } from "./server.js";

export interface FileAuthConfig {
  secret?: string | undefined;
  user?: string | undefined;
  password?: string | undefined;
  issuer?: string | undefined;
  ttl_seconds?: number | undefined;
  muteInDebug?: boolean | undefined;
}

export interface FileDatabaseConfig {
  driver?: string | undefined;
  dsn?: string | undefined;
}

export interface FileRuntimeConfig {
  sync_directive_timeout_ms?: number | undefined;
  async_directive_timeout_ms?: number | undefined;
  db_timeout_ms?: number | undefined;
  replay_completion_grace_ms?: number | undefined;
  replay_minimum_duration_ms?: number | undefined;
}

export interface FileCorsConfig {
  allow_origins?: string[] | undefined;
  allow_methods?: string[] | undefined;
  allow_headers?: string[] | undefined;
  max_age_seconds?: number | undefined;
}

export interface FileHttpConfig {
  request_timeout_ms?: number | undefined;
  headers_timeout_ms?: number | undefined;
  keep_alive_timeout_ms?: number | undefined;
}

export interface FileServerConfig {
  mode?: string | undefined;
  port?: string | number | undefined;
  sf_port?: string | undefined;
  jwt?: FileAuthConfig | undefined;
  database?: FileDatabaseConfig | undefined;
  runtime?: FileRuntimeConfig | undefined;
  cors?: FileCorsConfig | undefined;
  http?: FileHttpConfig | undefined;
}

export interface ServerCLIArgs {
  configPath?: string | undefined;
  help: boolean;
}

function positiveNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

function cleanStrings(values: readonly string[] | undefined): string[] | undefined {
  if (!values) {
    return undefined;
  }
  const cleaned = values.map((value) => value.trim()).filter((value) => value.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

export function parseServerCLIArgs(argv: readonly string[] = process.argv.slice(2)): ServerCLIArgs {
  let configPath: string | undefined;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--help" || token === "-h") {
      help = true;
      continue;
    }
    if (token === "--config") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("missing value for --config");
      }
      configPath = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${token}`);
  }

  return { help, ...(configPath ? { configPath } : {}) };
}

export function serverCLIUsage(): string {
  return [
    "Usage:",
    "  mkp-server [--config path]",
    "",
    "Options:",
    "  --config <path>  Load server settings from server.json-like file",
    "  -h, --help       Show this help message"
  ].join("\n");
}

export function resolveServerConfigPath(cliPath = "", env: NodeJS.ProcessEnv = process.env): string | undefined {
  const explicit = cliPath.trim() || (env.MKP_CONFIG_PATH ?? "").trim();
  if (explicit) {
    return resolve(explicit);
  }

  const cwdPath = join(process.cwd(), "server.json");
  if (existsSync(cwdPath)) {
    return cwdPath;
  }

  const homePath = join(homedir(), ".mkp", "server.json");
  if (existsSync(homePath)) {
    return homePath;
  }

  return undefined;
}

export function loadServerFileConfig(cliPath = "", env: NodeJS.ProcessEnv = process.env): {
  configPath?: string | undefined;
  config?: FileServerConfig | undefined;
} {
  const configPath = resolveServerConfigPath(cliPath, env);
  if (!configPath) {
    return {};
  }

  const raw = readFileSync(configPath, "utf8");
  const config = raw.trim() ? (JSON.parse(raw) as FileServerConfig) : {};
  return { configPath, config };
}

export function serverFileConfigToSettings(config: FileServerConfig | undefined): Partial<ServerSettings> {
  if (!config) {
    return {};
  }

  const settings: Partial<ServerSettings> = {};

  if (typeof config.mode === "string" && config.mode.trim()) {
    settings.mode = config.mode.trim();
  }
  if (typeof config.sf_port === "string" && config.sf_port.trim()) {
    settings.sfPort = config.sf_port.trim();
  }
  const port = positiveNumber(config.port);
  if (port !== undefined) {
    settings.port = port;
  }

  if (config.jwt) {
    if (typeof config.jwt.user === "string" && config.jwt.user.trim()) {
      settings.user = config.jwt.user.trim();
    }
    if (typeof config.jwt.password === "string" && config.jwt.password.trim()) {
      settings.password = config.jwt.password.trim();
    }
    if (typeof config.jwt.secret === "string" && config.jwt.secret.trim()) {
      settings.jwtSecret = config.jwt.secret.trim();
    }
    if (typeof config.jwt.issuer === "string" && config.jwt.issuer.trim()) {
      settings.issuer = config.jwt.issuer.trim();
    }
    const tokenTtlSeconds = positiveNumber(config.jwt.ttl_seconds);
    if (tokenTtlSeconds !== undefined) {
      settings.tokenTtlSeconds = tokenTtlSeconds;
    }
    if (typeof config.jwt.muteInDebug === "boolean") {
      settings.muteAuthInDebug = config.jwt.muteInDebug;
    }
  }

  if (config.database) {
    if (typeof config.database.driver === "string" && config.database.driver.trim()) {
      settings.dbDriver = config.database.driver.trim();
    }
    if (typeof config.database.dsn === "string" && config.database.dsn.trim()) {
      settings.dbDsn = config.database.dsn.trim();
    }
  }

  if (config.runtime) {
    const syncDirectiveTimeoutMs = positiveNumber(config.runtime.sync_directive_timeout_ms);
    if (syncDirectiveTimeoutMs !== undefined) {
      settings.syncDirectiveTimeoutMs = syncDirectiveTimeoutMs;
    }
    const asyncDirectiveTimeoutMs = positiveNumber(config.runtime.async_directive_timeout_ms);
    if (asyncDirectiveTimeoutMs !== undefined) {
      settings.asyncDirectiveTimeoutMs = asyncDirectiveTimeoutMs;
    }
    const dbTimeoutMs = positiveNumber(config.runtime.db_timeout_ms);
    if (dbTimeoutMs !== undefined) {
      settings.dbTimeoutMs = dbTimeoutMs;
    }
    const replayCompletionGraceMs = positiveNumber(config.runtime.replay_completion_grace_ms);
    if (replayCompletionGraceMs !== undefined) {
      settings.replayCompletionGraceMs = replayCompletionGraceMs;
    }
    const replayMinimumDurationMs = positiveNumber(config.runtime.replay_minimum_duration_ms);
    if (replayMinimumDurationMs !== undefined) {
      settings.replayMinimumDurationMs = replayMinimumDurationMs;
    }
  }

  if (config.cors) {
    const corsAllowOrigins = cleanStrings(config.cors.allow_origins);
    if (corsAllowOrigins) {
      settings.corsAllowOrigins = corsAllowOrigins;
    }
    const corsAllowMethods = cleanStrings(config.cors.allow_methods);
    if (corsAllowMethods) {
      settings.corsAllowMethods = corsAllowMethods;
    }
    const corsAllowHeaders = cleanStrings(config.cors.allow_headers);
    if (corsAllowHeaders) {
      settings.corsAllowHeaders = corsAllowHeaders;
    }
    const corsMaxAgeSeconds = positiveNumber(config.cors.max_age_seconds);
    if (corsMaxAgeSeconds !== undefined) {
      settings.corsMaxAgeSeconds = corsMaxAgeSeconds;
    }
  }

  if (config.http) {
    const httpRequestTimeoutMs = positiveNumber(config.http.request_timeout_ms);
    if (httpRequestTimeoutMs !== undefined) {
      settings.httpRequestTimeoutMs = httpRequestTimeoutMs;
    }
    const httpHeadersTimeoutMs = positiveNumber(config.http.headers_timeout_ms);
    if (httpHeadersTimeoutMs !== undefined) {
      settings.httpHeadersTimeoutMs = httpHeadersTimeoutMs;
    }
    const httpKeepAliveTimeoutMs = positiveNumber(config.http.keep_alive_timeout_ms);
    if (httpKeepAliveTimeoutMs !== undefined) {
      settings.httpKeepAliveTimeoutMs = httpKeepAliveTimeoutMs;
    }
  }

  return settings;
}
