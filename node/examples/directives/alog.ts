import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "在 MKP 设备上开始录制。",
    summaryEn: "Start recording on the MKP device.",
    usage: "node dist/examples/directives/alog.js [--port COMx] [--fixture] [log_name]",
    allowedCounts: [0, 1]
  }, async ({ positionals, sfport }) => {
    const logName = positionals[0] ?? "mkpdemo/demo";
    log(await sfport.alog(logName));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
