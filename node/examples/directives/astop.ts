import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "停止当前 MKP 录制。",
    summaryEn: "Stop the current MKP recording.",
    usage: "node dist/examples/directives/astop.js [--port COMx] [--fixture]",
    allowedCounts: [0]
  }, async ({ sfport }) => {
    log(await sfport.stopRecording());
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
