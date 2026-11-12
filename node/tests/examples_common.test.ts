import assert from "node:assert/strict";
import test from "node:test";

import { FixtureTransport, parseDirectiveExampleArgs, parseExampleArgs } from "../examples/common.js";
import { newSFSerialPort } from "../src/index.js";

test("parseExampleArgs keeps positionals and recognizes fixture/port", () => {
  const parsed = parseExampleArgs(["--fixture", "--port", "COM9", "/eMMC/applog"]);
  assert.equal(parsed.fixture, true);
  assert.equal(parsed.port, "COM9");
  assert.equal(parsed.help, false);
  assert.deepEqual(parsed.positionals, ["/eMMC/applog"]);
});

test("parseExampleArgs recognizes help flags", () => {
  const parsed = parseExampleArgs(["--help"]);
  assert.equal(parsed.help, true);
  assert.equal(parsed.fixture, false);
  assert.deepEqual(parsed.positionals, []);
});

test("parseDirectiveExampleArgs prints bilingual help and returns null", () => {
  let output = "";
  const parsed = parseDirectiveExampleArgs({
    summaryZh: "列出 MKP 设备上的目录内容。",
    summaryEn: "List an MKP directory.",
    usage: "node dist/examples/directives/list_dir.js [--port COMx] [--fixture] [path]",
    allowedCounts: [0, 1]
  }, ["--help"], (message) => {
    output = message;
  });
  assert.equal(parsed, null);
  assert.match(output, /列出 MKP 设备上的目录内容/);
  assert.match(output, /List an MKP directory/);
  assert.match(output, /Usage:/);
  assert.match(output, /使用桩响应/);
  assert.match(output, /Show this help message/);
});

test("parseDirectiveExampleArgs rejects invalid positional count", () => {
  assert.throws(() => parseDirectiveExampleArgs({
    summaryZh: "连接 Wi‑Fi。",
    summaryEn: "Join Wi‑Fi.",
    usage: "node dist/examples/directives/join.js [--port COMx] [--fixture] [ssid password]",
    allowedCounts: [0, 2]
  }, ["only-ssid"]), /usage:/);
});

test("FixtureTransport list_dir follows requested path", async () => {
  const sfport = newSFSerialPort({ transport: new FixtureTransport() });
  const result = await sfport.listDir("/eMMC/applog/subdir");
  assert.equal(result.rootDir?.path, "/eMMC/applog/subdir");
  assert.equal(result.rootDir?.name, "subdir");
  assert.equal(result.rootDir?.contents?.[0]?.path, "/eMMC/applog/subdir/demo.log");
});
