import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "列出 MKP 设备上的目录内容。",
    summaryEn: "List an MKP directory.",
    usage: "node dist/examples/directives/list_dir.js [--port COMx] [--fixture] [path]",
    allowedCounts: [0, 1]
  }, async ({ positionals, sfport }) => {
    const path = positionals[0] ?? "/eMMC/applog";
    log(await sfport.listDir(path));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
