import test from "node:test";
import assert from "node:assert/strict";

import { directiveName, parseDirectiveOutput } from "../src/parser.js";

test("directiveName extracts verb", () => {
  assert.equal(directiveName("atime /eMMC/applog/demo.log"), "atime");
});

test("atime parses line json", () => {
  const parsed = parseDirectiveOutput<{ seconds: number; milsec: number }>("atime /eMMC/applog/demo.log", 'atime /eMMC/applog/demo.log\n{"seconds":6,"milsec":950}\n<EOF>');
  assert.deepEqual(parsed, { seconds: 6, milsec: 950 });
});

test("ahttpbase wraps plain url output", () => {
  const parsed = parseDirectiveOutput<{ ahttpbase: string }>("ahttpbase", 'ahttpbase\nhttp://127.0.0.1:8080\ncli>');
  assert.deepEqual(parsed, { ahttpbase: "http://127.0.0.1:8080" });
});

test("acancel parses raw json text", () => {
  const parsed = parseDirectiveOutput<{ ok: boolean }>("acancel", 'acancel\n{"ok":true}\n<EOF>');
  assert.deepEqual(parsed, { ok: true });
});
