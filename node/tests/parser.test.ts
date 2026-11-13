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

test("aversion maps canonical version fields", () => {
  const parsed = parseDirectiveOutput<{ uver: string; aver: string }>("aversion", 'aversion\n{"uver":"u1","aver":"a1"}\n<EOF>');
  assert.deepEqual(parsed, { uver: "u1", aver: "a1" });
});

test("aversion falls back from legacy app boot fields", () => {
  const parsed = parseDirectiveOutput<{ uver: string; aver: string }>("aversion", 'aversion\n{"app":"u1","boot":"a1","hw":"demo"}\n<EOF>');
  assert.deepEqual(parsed, { uver: "u1", aver: "a1" });
});

test("ainsp maps canonical log info fields", () => {
  const parsed = parseDirectiveOutput<{
    seconds: number;
    milsec: number;
    width: number;
    heigh: number;
    stpos: { x: number; y: number };
  }>("ainsp /eMMC/applog/demo.log", 'ainsp /eMMC/applog/demo.log\nnoise\n{"seconds":6,"milsec":950,"width":1920,"heigh":1080,"stpos":{"x":10,"y":20}}\n<EOF>');
  assert.deepEqual(parsed, {
    seconds: 6,
    milsec: 950,
    width: 1920,
    heigh: 1080,
    stpos: { x: 10, y: 20 }
  });
});

test("ahttpbase wraps plain url output", () => {
  const parsed = parseDirectiveOutput<{ ahttpbase: string }>("ahttpbase", 'ahttpbase\nhttp://127.0.0.1:8080\ncli>');
  assert.deepEqual(parsed, { ahttpbase: "http://127.0.0.1:8080" });
});

test("acancel parses raw json text", () => {
  const parsed = parseDirectiveOutput<{ ok: boolean }>("acancel", 'acancel\n{"ok":true}\n<EOF>');
  assert.deepEqual(parsed, { ok: true });
});
