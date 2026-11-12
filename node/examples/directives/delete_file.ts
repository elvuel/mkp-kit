import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "删除 MKP 设备上的文件。",
    summaryEn: "Delete a file from the MKP device.",
    usage: "node dist/examples/directives/delete_file.js [--port COMx] [--fixture] [path]",
    allowedCounts: [0, 1]
  }, async ({ positionals, sfport }) => {
    const path = positionals[0] ?? "/eMMC/applog/demo.log";
    log(await sfport.deleteFile(path));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
