import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "把动作 JSON 转回 MKP log 格式。",
    summaryEn: "Convert action JSON back into MKP log format.",
    usage: "node dist/examples/directives/ajson2log.js [--port COMx] [--fixture] [jsonpath] [savepath]",
    allowedCounts: [0, 1, 2]
  }, async ({ positionals, sfport }) => {
    const jsonpath = positionals[0] ?? "demo.json";
    const savepath = positionals[1] ?? "/eMMC/applog/demo.log";
    log(await sfport.ajson2log({ jsonpath, savepath }));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
