import { log, runDirectiveExample } from "../common.js";

async function main(): Promise<void> {
  await runDirectiveExample({
    summaryZh: "查询 MKP 设备在线状态 / 心跳。",
    summaryEn: "Query MKP device liveness / heartbeat.",
    usage: "node dist/examples/directives/alive.js [--port COMx] [--fixture]",
    allowedCounts: [0]
  }, async ({ sfport }) => {
    log(await sfport.alive());
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
