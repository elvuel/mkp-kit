import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runClientCli } from "../src/client.js";

function createHarness() {
  const out: string[] = [];
  const err: string[] = [];
  const calls: Array<{ url: string; method: string }> = [];

  const fetchFn: typeof fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    calls.push({ url, method });

    if (url.endsWith("/api/v1/auth/token")) {
      return new Response(JSON.stringify({ ok: true, token: "jwt.header.signature", expires_in: 3600 }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (url.includes("/api/v1/directives/list")) {
      return new Response(
        JSON.stringify({
          ok: true,
          directive: "list",
          count: 1,
          records: [
            {
              name: "demo",
              unique_id: "rid-1",
              mkp_path: "/eMMC/applog/rid-1.log",
              start_point_x: 1,
              start_point_y: 2,
              screen_width: 1920,
              screen_height: 1080,
              os: "win32",
              seconds: 1,
              milliseconds: 250,
              created_at: "2026-11-12T00:00:00Z"
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }
    if (url.endsWith("/api/v1/version")) {
      return new Response(
        JSON.stringify({ ok: true, directive: "version", mkp_server: "0.1.0", mkp_device: { app: "1.0.0", boot: "1.0.1" } }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: false, error: `unhandled ${url}` }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;

  return {
    out,
    err,
    calls,
    deps: {
      env: {},
      fetchFn,
      io: {
        out(message: string): void {
          out.push(message);
        },
        err(message: string): void {
          err.push(message);
        }
      },
      now(): Date {
        return new Date("2026-11-12T00:00:00Z");
      }
    }
  };
}

test("mkp-client auth login stores token in config", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mkp-client-"));
  const configPath = join(dir, "client.json");
  const harness = createHarness();

  try {
    const code = await runClientCli(["--config", configPath, "auth", "login", "--username", "admin", "--password", "secret"], harness.deps);
    assert.equal(code, 0);
    assert.match(harness.out[0] ?? "", /token saved/);
    const saved = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    assert.equal(saved.token, "jwt.header.signature");
    assert.equal(saved.username, "admin");
    assert.equal(saved.password, "secret");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mkp-client list auto-fetches token and renders records table", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mkp-client-"));
  const configPath = join(dir, "client.json");
  const harness = createHarness();

  try {
    const code = await runClientCli(
      ["--config", configPath, "--server", "http://127.0.0.1:8080", "--username", "admin", "--password", "secret", "list", "-l", "10"],
      harness.deps
    );
    assert.equal(code, 0);
    assert.match(harness.out[0] ?? "", /\| Name \| RID \|/);
    assert.match(harness.out[0] ?? "", /rid-1/);
    assert.equal(harness.calls[0]?.url.endsWith("/api/v1/auth/token"), true);
    assert.equal(harness.calls[1]?.url.includes("/api/v1/directives/list?limits=10"), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mkp-client version uses cache when available", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mkp-client-"));
  const configPath = join(dir, "client.json");
  const harness = createHarness();

  try {
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          server_addr: "http://127.0.0.1:8080",
          version_cache: {
            server_addr: "http://127.0.0.1:8080",
            cached_at: "2026-11-11T23:00:00Z",
            response: {
              ok: true,
              directive: "version",
              mkp_server: "0.1.0",
              mkp_device: { app: "cached-app" }
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );
    const code = await runClientCli(["--config", configPath, "version"], harness.deps);
    assert.equal(code, 0);
    assert.match(harness.out[0] ?? "", /cached-app/);
    assert.equal(harness.calls.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
