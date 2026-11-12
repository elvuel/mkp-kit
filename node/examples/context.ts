import { newSFSerialPort, type DirectiveTransport } from "../src/index.js";

class SlowTransport implements DirectiveTransport {
  async send(): Promise<void> {
  }

  async sendAndReceive(directive: string): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return `${directive}\nok\ncli>`;
  }
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new Error("aborted"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => {
      reject(signal.reason ?? new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

async function runTimeoutCancel(): Promise<void> {
  const sfport = newSFSerialPort({ transport: new SlowTransport() });
  const signal = AbortSignal.timeout(1);
  try {
    const result = await abortable(sfport.alog("mkpdemo/demo"), signal);
    console.log("result=", result);
  } catch (error) {
    console.log("result=\"\" err=", error instanceof Error ? error.message : String(error));
    console.log("is timeout aborted:", signal.aborted);
  }
}

async function runManualCancel(): Promise<void> {
  const sfport = newSFSerialPort({ transport: new SlowTransport() });
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error("manual cancel")), 20);
  try {
    const result = await abortable(sfport.alog("mkpdemo/demo"), controller.signal);
    console.log("result=", result);
  } catch (error) {
    console.log("result=\"\" err=", error instanceof Error ? error.message : String(error));
    console.log("is canceled:", controller.signal.aborted);
  }
}

async function main(): Promise<void> {
  console.log("=== case 1: timeout cancel ===");
  await runTimeoutCancel();

  console.log("=== case 2: manual cancel ===");
  await runManualCancel();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
