import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "查询或设置 MKP 设备的 Wi‑Fi 自动连接。",
    summaryEn: "Query or set MKP Wi‑Fi auto-connect.",
    usage: "node dist/examples/directives/wifi_auto.js [--port COMx] [--fixture] [0|1|on|off]",
    allowedCounts: [0, 1]
  }, async ({ positionals, sfport }) => {
    const state = positionals[0];
    log(await sfport.wifiAuto(state ? { state } : undefined));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
