import test from "node:test";
import assert from "node:assert/strict";

import { buildTextTapOptions, keyPresses } from "../src/helper.js";

class FakePort {
  keypadCalls: string[] = [];

  async keypad(option: { toCliFragment(): string }): Promise<void> {
    this.keypadCalls.push(option.toCliFragment());
  }
}

test("buildTextTapOptions covers Hello MKP", () => {
  const options = buildTextTapOptions("Hello MKP!");
  assert.equal(options.length, 10);
  assert.ok(options[0]);
  assert.ok(options[9]);
  assert.match(options[0]!.toCliFragment(), /--s 0x02/);
  assert.match(options[0]!.toCliFragment(), /--x1 0x0b/);
  assert.match(options[9]!.toCliFragment(), /--x1 0x1e/);
});

test("keyPresses emits one tap per key", async () => {
  const port = new FakePort();
  await keyPresses(port as never, ["H", "i"]);
  assert.equal(port.keypadCalls.length, 2);
  assert.match(port.keypadCalls[0] ?? "", /--x1 0x0b/);
  assert.match(port.keypadCalls[1] ?? "", /--x1 0x0c/);
});
