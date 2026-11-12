import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "读取 MKP 日志的基础信息。",
    summaryEn: "Inspect basic metadata for an MKP log.",
    usage: "node dist/examples/directives/ainsp.js [--port COMx] [--fixture] [path]",
    allowedCounts: [0, 1]
  }, async ({ positionals, sfport }) => {
    const path = positionals[0] ?? "/eMMC/applog/demo.log";
    log(await sfport.ainsp(path));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
