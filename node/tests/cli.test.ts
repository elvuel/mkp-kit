import test from "node:test";
import assert from "node:assert/strict";

import { KpadOption, M10Option } from "../src/index.js";
import { runCli, type CliPortConfig, type CliSerialPort } from "../src/cli.js";

class FakePort implements CliSerialPort {
  opened = 0;
  closed = 0;
  mouseCalls: string[] = [];
  keypadCalls: string[] = [];
  rawCalls: string[] = [];

  async open(): Promise<void> {
    this.opened += 1;
  }

  async close(): Promise<void> {
    this.closed += 1;
  }

  async sendDirective(directive: string): Promise<string> {
    this.rawCalls.push(directive);
    return directive + "\ncli>";
  }

  async sendDirectiveAsync(directive: string): Promise<void> {
    this.rawCalls.push("async:" + directive);
  }

  async sn(): Promise<unknown> {
    return { sn: "SAMPLE-SN" };
  }

  async alive(): Promise<unknown> {
    return { timetamp: 1 };
  }

  async aversion(): Promise<unknown> {
    return { app: "1.0.0" };
  }

  async atime(path: string): Promise<unknown> {
    return { path };
  }

  async ainsp(path: string): Promise<unknown> {
    return { path };
  }

  async listDir(path: string): Promise<unknown> {
    return { path };
  }

  async cleanDir(path: string): Promise<string> {
    return "cleaned:" + path;
  }

  async deleteFile(path: string): Promise<string> {
    return "deleted:" + path;
  }

  async join(): Promise<string> {
    return "joined";
  }

  async wifiAuto(): Promise<string> {
    return "ok";
  }

  async ahttpbase(): Promise<unknown> {
    return { ahttpbase: "http://127.0.0.1:8080" };
  }

  async aget(): Promise<string> {
    return "downloaded";
  }

  async aput(): Promise<string> {
    return "uploaded";
  }

  async adumj(path: string): Promise<unknown> {
    return { path, actions: [] };
  }

  async ajson2log(): Promise<string> {
    return "saved";
  }

  async startRecording(args = ""): Promise<void> {
    this.rawCalls.push("alog:" + args);
  }

  async stopRecording(): Promise<string> {
    return "stopped";
  }

  async cancelReplay(): Promise<unknown> {
    return { ok: true };
  }

  async mouse10(opt: M10Option): Promise<void> {
    this.mouseCalls.push(opt.toCliFragment());
  }

  async keypad(opt: KpadOption): Promise<void> {
    this.keypadCalls.push(opt.toCliFragment());
  }
}

function createHarness() {
  const out: string[] = [];
  const err: string[] = [];
  const ports: FakePort[] = [];
  const configs: CliPortConfig[] = [];
  return {
    out,
    err,
    ports,
    configs,
    deps: {
      io: {
        out(message: string): void {
          out.push(message);
        },
        err(message: string): void {
          err.push(message);
        }
      },
      env: {},
      detectPort: async (): Promise<string> => "COM77",
      createPort(config: CliPortConfig): CliSerialPort {
        configs.push(config);
        const port = new FakePort();
        ports.push(port);
        return port;
      }
    }
  };
}

test("cli prints usage with no args", async () => {
  const harness = createHarness();
  assert.equal(await runCli([], harness.deps), 0);
  assert.match(harness.out[0] ?? "", /Usage:/);
  assert.equal(harness.ports.length, 0);
});

test("cli accepts --port before command", async () => {
  const harness = createHarness();
  assert.equal(await runCli(["--port", "COM9", "sn"], harness.deps), 0);
  assert.equal(harness.configs[0]?.name, "COM9");
  assert.match(harness.out[0] ?? "", /SAMPLE-SN/);
  assert.equal(harness.ports[0]?.opened, 1);
  assert.equal(harness.ports[0]?.closed, 1);
});

test("cli m10 dispatches composed movement", async () => {
  const harness = createHarness();
  assert.equal(await runCli(["m10", "--x", "-400", "--y", "25"], harness.deps), 0);
  assert.equal(harness.ports[0]?.mouseCalls[0], "--x -400 --y 25");
  assert.equal(harness.out[0], "ok");
});

test("cli kpad types text from positional args", async () => {
  const harness = createHarness();
  assert.equal(await runCli(["kpad", "Hello"], harness.deps), 0);
  assert.equal(harness.ports[0]?.keypadCalls.length, 5);
  assert.equal(harness.out[0], "ok");
});

test("cli raw dispatches direct directive", async () => {
  const harness = createHarness();
  assert.equal(await runCli(["raw", "sn"], harness.deps), 0);
  assert.equal(harness.ports[0]?.rawCalls[0], "sn");
  assert.match(harness.out[0] ?? "", /cli>/);
});

test("cli returns 1 on unknown command", async () => {
  const harness = createHarness();
  assert.equal(await runCli(["unknown-cmd"], harness.deps), 1);
  assert.match(harness.err[0] ?? "", /unknown command/i);
});
