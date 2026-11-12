import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "把文件从 file server 拉取到 MKP 存储。",
    summaryEn: "Pull a file from the file server into MKP storage.",
    usage: "node dist/examples/directives/aget.js [--port COMx] [--fixture] [filepath]",
    allowedCounts: [0, 1]
  }, async ({ positionals, sfport }) => {
    const filepath = positionals[0] ?? "/tmp/demo.log";
    log(await sfport.aget({ filepath }));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
