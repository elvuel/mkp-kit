import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { loadServerFileConfig, resolveServerConfigPath, serverFileConfigToSettings } from "../src/server_config.js";

test("server config loader prefers explicit path and maps settings", () => {
  const dir = mkdtempSync(join(tmpdir(), "mkp-server-config-"));
  const configPath = join(dir, "server.json");

  try {
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          mode: "debug",
          port: 9090,
          sf_port: "COM9",
          jwt: { secret: "jwt-secret", user: "demo", password: "pass", issuer: "issuer", ttl_seconds: 1234, muteInDebug: true },
          database: { driver: "sqlite", dsn: "demo.db" },
          runtime: { sync_directive_timeout_ms: 111, async_directive_timeout_ms: 222, db_timeout_ms: 333 },
          cors: { allow_origins: ["http://localhost:3000"], allow_methods: ["GET", "POST"], allow_headers: ["Authorization"], max_age_seconds: 60 },
          http: { request_timeout_ms: 4000, headers_timeout_ms: 5000, keep_alive_timeout_ms: 6000 }
        },
        null,
        2
      ),
      "utf8"
    );

    assert.equal(resolveServerConfigPath(configPath, {}), configPath);
    const loaded = loadServerFileConfig(configPath, {});
    assert.equal(loaded.configPath, configPath);
    const settings = serverFileConfigToSettings(loaded.config);
    assert.equal(settings.mode, "debug");
    assert.equal(settings.port, 9090);
    assert.equal(settings.sfPort, "COM9");
    assert.equal(settings.jwtSecret, "jwt-secret");
    assert.equal(settings.user, "demo");
    assert.equal(settings.password, "pass");
    assert.equal(settings.dbDsn, "demo.db");
    assert.deepEqual(settings.corsAllowOrigins, ["http://localhost:3000"]);
    assert.equal(settings.httpKeepAliveTimeoutMs, 6000);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
