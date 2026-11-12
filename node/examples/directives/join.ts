import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "连接 MKP 设备到 Wi‑Fi，或复用设备已保存的 Wi‑Fi 配置。",
    summaryEn: "Connect MKP to Wi‑Fi or reuse the device-saved Wi‑Fi configuration.",
    usage: "node dist/examples/directives/join.js [--port COMx] [--fixture] [ssid password]",
    allowedCounts: [0, 2]
  }, async ({ positionals, sfport }) => {
    const ssid = positionals[0];
    const password = positionals[1];
    log(await sfport.join(ssid ? { ssid, password: password ?? "" } : { ssid: "", password: "" }));
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
