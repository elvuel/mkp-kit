import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "清理 MKP 设备上的目录。",
    summaryEn: "Clean an MKP directory.",
    usage: "node dist/examples/directives/clean_dir.js [--port COMx] [--fixture] [path]",
    allowedCounts: [0, 1]
  }, async ({ positionals, sfport }) => {
    const path = positionals[0] ?? "/eMMC/applog";
    log(await sfport.cleanDir(path));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
