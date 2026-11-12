import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "读取 MKP 日志的时长。",
    summaryEn: "Read the duration of an MKP log.",
    usage: "node dist/examples/directives/atime.js [--port COMx] [--fixture] [path]",
    allowedCounts: [0, 1]
  }, async ({ positionals, sfport }) => {
    const path = positionals[0] ?? "/eMMC/applog/spike.log";
    log(await sfport.atime(path));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
