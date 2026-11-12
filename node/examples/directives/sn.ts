import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "查询 MKP 设备序列号。",
    summaryEn: "Query the MKP device serial number.",
    usage: "node dist/examples/directives/sn.js [--port COMx] [--fixture]",
    allowedCounts: [0]
  }, async ({ sfport }) => {
    log(await sfport.sn());
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
