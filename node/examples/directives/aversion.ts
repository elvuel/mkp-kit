import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "查询 MKP 设备版本信息。",
    summaryEn: "Query MKP device version information.",
    usage: "node dist/examples/directives/aversion.js [--port COMx] [--fixture]",
    allowedCounts: [0]
  }, async ({ sfport }) => {
    log(await sfport.aversion());
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
