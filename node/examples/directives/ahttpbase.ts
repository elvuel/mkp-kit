import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "查询或设置 MKP 文件服务的 HTTP 基地址。",
    summaryEn: "Query or set the MKP file-service HTTP base URL.",
    usage: "node dist/examples/directives/ahttpbase.js [--port COMx] [--fixture] [url]",
    allowedCounts: [0, 1]
  }, async ({ positionals, sfport }) => {
    const ahttpbase = positionals[0];
    log(await sfport.ahttpbase(ahttpbase ? { ahttpbase } : undefined));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
