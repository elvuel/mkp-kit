import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "把 MKP 设备日志转换为动作 JSON。",
    summaryEn: "Convert an MKP device log into action JSON.",
    usage: "node dist/examples/directives/adumj.js [--port COMx] [--fixture] [path]",
    allowedCounts: [0, 1]
  }, async ({ positionals, sfport }) => {
    const path = positionals[0] ?? "/eMMC/applog/demo.log";
    log(await sfport.adumj(path));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
