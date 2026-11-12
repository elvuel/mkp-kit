import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  Direction,
  convertJSONFileToLogFile,
  convertLogFileToJSONFile,
  directionFromPath,
  envelopeToJSONObject,
  jsonToLog,
  readJSONFile,
  runConverter,
  writeJSONFile,
  writeLogFile,
  type Envelope
} from "../src/converter.js";

function tempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), "mkp-node-converter-"));
}

function sampleEnvelope(): Envelope {
  return {
    format: "mkp-action-v1",
    version: "MKv1",
    meta: { width: 0, height: 0, startX: 0, startY: 0 },
    events: [
      { typeName: "MouseMove", mouseMove: { x: 5, y: -3, ts: 0 } },
      { typeName: "MouseDown", mouseDown: { button: "left", ts: 8 } },
      { typeName: "MouseMove", mouseMove: { x: 10, y: 7, ts: 24 } },
      { typeName: "MouseUp", mouseUp: { button: "left", ts: 24 } },
      { typeName: "Wheel", wheel: { delta: 1, ts: 32 } },
      { typeName: "KeyDown", keyDown: { keys: ["a"], ts: 48 } },
      { typeName: "KeyUp", keyUp: { keys: ["a"], ts: 64 } },
      { typeName: "KeyDown", keyDown: { keys: ["lshift", "a"], ts: 72 } },
      { typeName: "KeyUp", keyUp: { keys: ["a"], ts: 80 } },
      { typeName: "KeyUp", keyUp: { keys: ["lshift"], ts: 88 } }
    ]
  };
}

test("converter direction is inferred from extension", () => {
  assert.equal(directionFromPath("demo.log"), Direction.LogToJson);
  assert.equal(directionFromPath("demo.json"), Direction.JsonToLog);
  assert.equal(directionFromPath("demo.txt"), Direction.Unknown);
});

test("converter roundtrip reaches stable JSON form", () => {
  const root = tempDir();
  const inputLog = path.join(root, "input.log");
  const roundtripJson = path.join(root, "roundtrip.json");
  const roundtripLog = path.join(root, "roundtrip.log");
  const roundtripJson2 = path.join(root, "roundtrip-2.json");

  const seed = sampleEnvelope();
  const initial = jsonToLog(seed);
  writeLogFile(inputLog, initial.header, initial.records, initial.hasMouse, initial.hasKeyboard);

  convertLogFileToJSONFile(inputLog, roundtripJson);
  convertJSONFileToLogFile(roundtripJson, roundtripLog);
  convertLogFileToJSONFile(roundtripLog, roundtripJson2);

  const env1 = readJSONFile(roundtripJson);
  const env2 = readJSONFile(roundtripJson2);
  assert.deepEqual(envelopeToJSONObject(env1), envelopeToJSONObject(env2));
});

test("converter JSON to log preserves first event time and clamps negative deltas", () => {
  const result = jsonToLog({
    format: "mkp-action-v1",
    version: "MKv1",
    meta: { width: 0, height: 0, startX: 0, startY: 0 },
    events: [
      { typeName: "KeyDown", keyDown: { keys: ["a"], ts: 50 } },
      { typeName: "KeyUp", keyUp: { keys: ["a"], ts: 10 } }
    ]
  });

  assert.equal(result.records[0]?.delta, 50);
  assert.equal(result.records[1]?.delta, 0);
  assert.equal(result.hasMouse, false);
  assert.equal(result.hasKeyboard, true);
});

test("converter CLI appends target extension when -o omits it", () => {
  const root = tempDir();
  const inputJson = path.join(root, "demo.json");
  const outputBase = path.join(root, "artifact");
  writeJSONFile(inputJson, {
    format: "mkp-action-v1",
    version: "MKv1",
    meta: { width: 0, height: 0, startX: 0, startY: 0 },
    events: [{ typeName: "KeyDown", keyDown: { keys: ["a"], ts: 1 } }]
  });

  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = runConverter(["-f", inputJson, "-o", outputBase], {
    out(message: string): void {
      stdout.push(message);
    },
    err(message: string): void {
      stderr.push(message);
    }
  });

  assert.equal(code, 0);
  assert.equal(stderr.length, 0);
  assert.match(stdout[0] ?? "", /json -> log:/i);
  assert.ok(readFileSync(outputBase + ".log").length > 0);
});
