import test from "node:test";
import assert from "node:assert/strict";

import { EOF_CLI, EOF_DEFAULT } from "../src/parser.js";
import { M10Option, alog, newSFSerialPort, startRecord } from "../src/index.js";
import { extractSyncOutput, resolveSFSerialPortPath, type DirectiveTransport } from "../src/sdk.js";

class StaticTransport implements DirectiveTransport {
  sent: string[] = [];

  async send(directive: string): Promise<void> {
    this.sent.push(directive);
  }

  async sendAndReceive(directive: string): Promise<string> {
    this.sent.push(directive);
    if (directive === "sn") {
      return 'sn\n{"sn":"SAMPLE-SN"}\n<EOF>';
    }
    if (directive.startsWith("alog ")) {
      return directive + "\nok\ncli>";
    }
    return directive + "\ncli>";
  }

  isOpen(): boolean {
    return true;
  }
}

test("sendParsed returns typed sn payload", async () => {
  const transport = new StaticTransport();
  const sfport = newSFSerialPort({ transport });
  assert.deepEqual(await sfport.sn(), { sn: "SAMPLE-SN" });
});

test("mouse10 composes m10 directive", async () => {
  const transport = new StaticTransport();
  const sfport = newSFSerialPort({ transport });
  await sfport.mouse10(new M10Option().setX(-400).withSyncIgnoreOutput(true));
  assert.equal(transport.sent[0], "m10 --port 1 --x -400");
});

test("extractSyncOutput ignores stale prefix before directive echo", () => {
  const raw = "noise\ncli>\natime /eMMC/applog/demo.log\n{\"seconds\":1,\"milsec\":2}\n<EOF>";
  assert.deepEqual(extractSyncOutput(raw, "atime /eMMC/applog/demo.log", EOF_DEFAULT), {
    output: 'atime /eMMC/applog/demo.log\n{"seconds":1,"milsec":2}\n',
    remaining: ""
  });
});

test("extractSyncOutput waits for cli eof when parser falls back to cli mode", () => {
  const partial = "m10 --port 1 --x -400\n";
  assert.deepEqual(extractSyncOutput(partial, "m10 --port 1 --x -400", EOF_CLI), { remaining: partial });
  assert.deepEqual(extractSyncOutput(partial + "cli>", "m10 --port 1 --x -400", EOF_CLI), {
    output: "m10 --port 1 --x -400\n",
    remaining: ""
  });
});

test("resolveSFSerialPortPath matches SF usb vid pid", () => {
  assert.equal(
    resolveSFSerialPortPath([
      { path: "COM3", vendorId: "0x1a86", productId: "55d3" },
      { path: "COM9", vendorId: "0xFFFF", productId: "0001" }
    ]),
    "COM3"
  );
});

test("snapshotStatus reflects transport open state", () => {
  const transport = new StaticTransport();
  const sfport = newSFSerialPort({ transport, syncOutputTimeoutMs: 4321 });
  assert.deepEqual(sfport.snapshotStatus(), {
    name: "COM3",
    portOpen: true,
    syncOutputTimeoutMs: 4321,
    transportConfigured: true
  });
});

test("function-style startRecord composes alog args", async () => {
  const transport = new StaticTransport();
  const sfport = newSFSerialPort({ transport });
  await startRecord(sfport, "demo", { width: 1920, stposx: 100, stposy: 200 });
  assert.equal(transport.sent[0], "alog /eMMC/applog/demo.log --width 1920 --stposx 100 --stposy 200");
});

test("function-style alog uses sync parser path", async () => {
  const transport = new StaticTransport();
  const sfport = newSFSerialPort({ transport });
  assert.equal(await alog(sfport, "demo"), "ok");
});
