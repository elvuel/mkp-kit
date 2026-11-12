import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { LogLength, MKPVersion, SerialPortStatus } from "../src/models.js";
import { APP_VERSION, createServerApp, type ServerPort } from "../src/server.js";

class FakeServerPort implements ServerPort {
  openCalls = 0;
  closeCalls = 0;
  startRecordingCalls: string[] = [];
  stopRecordingCalls = 0;
  cancelReplayCalls = 0;
  deleteFileCalls: string[] = [];
  moveCursorCalls: Array<{ x: number; y: number }> = [];
  startReplayingCalls: Array<{ logName: string; delay: number }> = [];
  version: MKPVersion = { app: "1.0.0", boot: "1.0.1", hw: "demo" };
  length: LogLength = { seconds: 1, milsec: 250 };
  status: SerialPortStatus = {
    name: "COM_TEST",
    portOpen: true,
    syncOutputTimeoutMs: 10000,
    transportConfigured: true
  };

  async open(): Promise<void> {
    this.openCalls += 1;
  }

  async close(): Promise<void> {
    this.closeCalls += 1;
  }

  snapshotStatus(): SerialPortStatus {
    return this.status;
  }

  async aversion(): Promise<MKPVersion> {
    return this.version;
  }

  async startRecording(args = ""): Promise<void> {
    this.startRecordingCalls.push(args);
  }

  async stopRecording(): Promise<string> {
    this.stopRecordingCalls += 1;
    return "stopped";
  }

  async cancelReplay(): Promise<unknown> {
    this.cancelReplayCalls += 1;
    return { ok: true };
  }

  async atime(): Promise<LogLength> {
    return this.length;
  }

  async deleteFile(path: string): Promise<string> {
    this.deleteFileCalls.push(path);
    return "deleted";
  }

  async moveCursor(x: number, y: number): Promise<void> {
    this.moveCursorCalls.push({ x, y });
  }

  async startReplaying(logName: string, delay = -1): Promise<void> {
    this.startReplayingCalls.push({ logName, delay });
  }
}

async function parseJson(response: Response): Promise<unknown> {
  return JSON.parse(await response.text()) as unknown;
}

async function issueToken(app: ReturnType<typeof createServerApp>): Promise<string> {
  const tokenResponse = await app.handle(
    new Request("http://localhost/api/v1/auth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" })
    })
  );
  const tokenBody = (await parseJson(tokenResponse)) as Record<string, unknown>;
  return String(tokenBody.token ?? "");
}

function authHeader(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

function createTestApp(options: Parameters<typeof createServerApp>[0] = {}) {
  return createServerApp({
    ...options,
    settings: {
      dbDriver: "sqlite",
      dbDsn: ":memory:",
      ...(options.settings ?? {})
    }
  });
}

test("server health returns go-like shape", async () => {
  const fake = new FakeServerPort();
  const app = createTestApp({ sfport: fake });
  app.state.alogRunning = true;
  app.state.currentAlogId = "alog-1";
  app.state.replayRunning = true;
  app.state.currentReplayId = "rid-1";
  app.state.replayReleaseAt = new Date(Date.now() + 1500);

  const response = await app.handle(new Request("http://localhost/health"));
  assert.equal(response.status, 200);
  const body = (await parseJson(response)) as Record<string, unknown>;
  assert.equal(body.ok, true);
  assert.equal(body.ready, true);
  assert.equal((body.alog as Record<string, unknown>).current_id, "alog-1");
  assert.equal((body.replay as Record<string, unknown>).current_id, "rid-1");
  assert.equal((body.replay as Record<string, unknown>).active, true);
});

test("server auth token + replay status works", async () => {
  const fake = new FakeServerPort();
  const app = createTestApp({ sfport: fake });
  const token = await issueToken(app);

  const replayResponse = await app.handle(
    new Request("http://localhost/api/v1/directives/replay/status", {
      headers: authHeader(token)
    })
  );
  assert.equal(replayResponse.status, 200);
  const replayBody = (await parseJson(replayResponse)) as Record<string, unknown>;
  assert.equal(replayBody.directive, "replay_status");
  assert.equal(typeof replayBody.replay, "object");
});

test("server missing auth uses error key", async () => {
  const app = createTestApp({ sfport: new FakeServerPort() });
  const response = await app.handle(new Request("http://localhost/api/v1/directives/replay/status"));
  assert.equal(response.status, 401);
  assert.deepEqual(await parseJson(response), { ok: false, error: "missing Authorization header" });
});

test("server debug mode can mute auth", async () => {
  const app = createTestApp({
    sfport: new FakeServerPort(),
    settings: { mode: "debug", muteAuthInDebug: true }
  });
  const response = await app.handle(new Request("http://localhost/api/v1/directives/replay/status"));
  assert.equal(response.status, 200);
  const body = (await parseJson(response)) as Record<string, unknown>;
  assert.equal(body.ok, true);
});

test("server version payload matches contract", async () => {
  const fake = new FakeServerPort();
  const app = createTestApp({ sfport: fake });
  const response = await app.handle(new Request("http://localhost/api/v1/version"));
  assert.equal(response.status, 200);
  assert.deepEqual(await parseJson(response), {
    ok: true,
    directive: "version",
    mkp_server: APP_VERSION,
    mkp_device: fake.version
  });
});

test("server alog and astop persist a record", async () => {
  const fake = new FakeServerPort();
  const app = createTestApp({ sfport: fake });
  const token = await issueToken(app);
  const auth = authHeader(token);

  const start = await app.handle(
    new Request("http://localhost/api/v1/directives/alog", {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({ log_name: "demo" })
    })
  );
  assert.equal(start.status, 200);
  assert.equal(fake.startRecordingCalls[0], "demo");
  assert.equal(app.state.alogRunning, true);

  const stop = await app.handle(
    new Request("http://localhost/api/v1/directives/astop", {
      method: "POST",
      headers: auth
    })
  );
  assert.equal(stop.status, 200);
  assert.equal(fake.stopRecordingCalls, 1);
  assert.equal(app.state.alogRunning, false);
  const stopBody = (await parseJson(stop)) as Record<string, unknown>;
  assert.equal(stopBody.persisted, true);
  assert.equal(typeof stopBody.macro_record_id, "number");
});

test("server list/get/delete records roundtrip", async () => {
  const fake = new FakeServerPort();
  const app = createTestApp({ sfport: fake });
  const token = await issueToken(app);
  const auth = authHeader(token);

  const inserted = app.state.insertRecord({
    name: "demo",
    unique_id: "rid-1",
    mkp_path: "/eMMC/applog/rid-1.log",
    start_point_x: 11,
    start_point_y: 22,
    screen_width: 1920,
    screen_height: 1080,
    os: "win32",
    seconds: 1,
    milliseconds: 250
  });

  const listed = await app.handle(new Request("http://localhost/api/v1/directives/list?limits=10", { headers: auth }));
  assert.equal(listed.status, 200);
  const listBody = (await parseJson(listed)) as Record<string, unknown>;
  assert.equal(listBody.directive, "list");
  assert.equal(listBody.count, 1);

  const got = await app.handle(new Request(`http://localhost/api/v1/directives/records/${inserted.unique_id}`, { headers: auth }));
  assert.equal(got.status, 200);
  const getBody = (await parseJson(got)) as Record<string, unknown>;
  assert.equal((getBody.record as Record<string, unknown>).unique_id, "rid-1");

  const removed = await app.handle(
    new Request(`http://localhost/api/v1/directives/records/${inserted.unique_id}`, {
      method: "DELETE",
      headers: auth
    })
  );
  assert.equal(removed.status, 200);
  assert.equal(fake.deleteFileCalls[0], "/eMMC/applog/rid-1.log");
  assert.equal(app.state.getRecord("rid-1"), undefined);
});

test("server records persist across app instances with sqlite file", async () => {
  const dbRoot = mkdtempSync(join(tmpdir(), "mkp-node-server-"));
  const dbPath = join(dbRoot, "records.sqlite");
  const first = createTestApp({ sfport: new FakeServerPort(), settings: { dbDsn: dbPath } });

  try {
    first.state.insertRecord({
      name: "persisted",
      unique_id: "rid-persist",
      mkp_path: "/eMMC/applog/rid-persist.log",
      start_point_x: 7,
      start_point_y: 9,
      screen_width: 1280,
      screen_height: 720,
      os: "win32",
      seconds: 2,
      milliseconds: 125
    });
    await first.close();

    const second = createTestApp({ sfport: new FakeServerPort(), settings: { dbDsn: dbPath } });
    try {
      const token = await issueToken(second);
      const listed = await second.handle(
        new Request("http://localhost/api/v1/directives/list?limits=10", {
          headers: authHeader(token)
        })
      );
      assert.equal(listed.status, 200);
      const body = (await parseJson(listed)) as Record<string, unknown>;
      assert.equal(body.count, 1);
      const records = body.records as Array<Record<string, unknown>>;
      assert.equal(records[0]?.unique_id, "rid-persist");
      assert.equal(records[0]?.name, "persisted");
    } finally {
      await second.close();
    }
  } finally {
    rmSync(dbRoot, { recursive: true, force: true });
  }
});

test("server record routes return database init error when driver is unavailable", async () => {
  const app = createTestApp({
    sfport: new FakeServerPort(),
    settings: { dbDriver: "unsupported" }
  });
  const token = await issueToken(app);
  const response = await app.handle(
    new Request("http://localhost/api/v1/directives/list?limits=10", {
      headers: authHeader(token)
    })
  );
  assert.equal(response.status, 500);
  assert.deepEqual(await parseJson(response), { ok: false, error: "database is not initialized" });
});

test("server delete record blocks while same record replaying", async () => {
  const fake = new FakeServerPort();
  const app = createTestApp({ sfport: fake });
  const token = await issueToken(app);
  const auth = authHeader(token);

  app.state.insertRecord({
    name: "demo",
    unique_id: "rid-del",
    mkp_path: "/eMMC/applog/rid-del.log",
    start_point_x: 0,
    start_point_y: 0,
    screen_width: 0,
    screen_height: 0,
    os: "win32",
    seconds: 1,
    milliseconds: 250
  });
  app.state.replayRunning = true;
  app.state.currentReplayId = "rid-del";
  app.state.replayReleaseAt = new Date(Date.now() + 2000);

  const response = await app.handle(
    new Request("http://localhost/api/v1/directives/records/rid-del", {
      method: "DELETE",
      headers: auth
    })
  );
  assert.equal(response.status, 409);
  const body = (await parseJson(response)) as Record<string, unknown>;
  assert.equal(body.ok, false);
  assert.equal(body.error, "record is currently being replayed");
  assert.equal(typeof body.retry_after_seconds, "number");
});

test("server aplay conflict includes retry window", async () => {
  const fake = new FakeServerPort();
  const app = createTestApp({ sfport: fake });
  const token = await issueToken(app);
  const auth = authHeader(token);

  app.state.insertRecord({
    name: "one",
    unique_id: "rid-one",
    mkp_path: "/eMMC/applog/rid-one.log",
    start_point_x: 0,
    start_point_y: 0,
    screen_width: 0,
    screen_height: 0,
    os: "win32",
    seconds: 1,
    milliseconds: 250
  });
  app.state.insertRecord({
    name: "two",
    unique_id: "rid-two",
    mkp_path: "/eMMC/applog/rid-two.log",
    start_point_x: 0,
    start_point_y: 0,
    screen_width: 0,
    screen_height: 0,
    os: "win32",
    seconds: 1,
    milliseconds: 250
  });
  app.state.replayRunning = true;
  app.state.currentReplayId = "rid-one";
  app.state.replayDoneAt = new Date(Date.now() + 900);
  app.state.replayReleaseAt = new Date(Date.now() + 2000);

  const response = await app.handle(
    new Request("http://localhost/api/v1/directives/aplay/rid-two", {
      method: "POST",
      headers: auth
    })
  );
  assert.equal(response.status, 409);
  const body = (await parseJson(response)) as Record<string, unknown>;
  assert.equal(body.ok, false);
  assert.equal(body.error, "replay is already running");
  assert.equal(typeof body.retry_after_seconds, "number");
  assert.equal(typeof body.estimated_done_at, "string");
  assert.equal(typeof body.release_after, "string");
});

test("server aplay starts replay and updates state", async () => {
  const fake = new FakeServerPort();
  const app = createTestApp({ sfport: fake });
  const token = await issueToken(app);
  const auth = authHeader(token);

  app.state.insertRecord({
    name: "demo",
    unique_id: "rid-play",
    mkp_path: "/eMMC/applog/rid-play.log",
    start_point_x: 0,
    start_point_y: 0,
    screen_width: 0,
    screen_height: 0,
    os: "win32",
    seconds: 1,
    milliseconds: 250
  });

  const response = await app.handle(
    new Request("http://localhost/api/v1/directives/aplay/rid-play", {
      method: "POST",
      headers: auth
    })
  );
  assert.equal(response.status, 200);
  const body = (await parseJson(response)) as Record<string, unknown>;
  assert.equal(body.directive, "aplay");
  assert.deepEqual(fake.moveCursorCalls[0], { x: 0, y: 0 });
  assert.equal(fake.startReplayingCalls[0]?.logName, "/eMMC/applog/rid-play.log");
  assert.equal(fake.startReplayingCalls[0]?.delay, -1);
  assert.equal(app.state.replayRunning, true);
  assert.equal(app.state.currentReplayId, "rid-play");
});

test("server auth token is JWT and works across app instances with same secret", async () => {
  const first = createTestApp({ sfport: new FakeServerPort(), settings: { jwtSecret: "shared-secret" } });
  const token = await issueToken(first);
  assert.equal(token.split(".").length, 3);

  const second = createTestApp({ sfport: new FakeServerPort(), settings: { jwtSecret: "shared-secret" } });
  const response = await second.handle(
    new Request("http://localhost/api/v1/directives/replay/status", {
      headers: authHeader(token)
    })
  );
  assert.equal(response.status, 200);
});

test("server adds cors headers and handles preflight", async () => {
  const app = createTestApp({
    sfport: new FakeServerPort(),
    settings: {
      corsAllowOrigins: ["http://localhost:3000"],
      corsAllowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      corsAllowHeaders: ["Authorization", "Content-Type"],
      corsMaxAgeSeconds: 60
    }
  });

  const preflight = await app.handle(
    new Request("http://localhost/api/v1/directives/list", {
      method: "OPTIONS",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "GET"
      }
    })
  );
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "http://localhost:3000");
  assert.equal(preflight.headers.get("access-control-max-age"), "60");

  const health = await app.handle(
    new Request("http://localhost/health", {
      headers: { origin: "http://localhost:3000" }
    })
  );
  assert.equal(health.headers.get("access-control-allow-origin"), "http://localhost:3000");
});
