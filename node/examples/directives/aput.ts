import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "把文件从 MKP 存储上传到 file server。",
    summaryEn: "Upload a file from MKP storage to the file server.",
    usage: "node dist/examples/directives/aput.js [--port COMx] [--fixture] [filepath]",
    allowedCounts: [0, 1]
  }, async ({ positionals, sfport }) => {
    const filepath = positionals[0] ?? "/eMMC/applog/demo.log";
    log(await sfport.aput({ filepath }));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
