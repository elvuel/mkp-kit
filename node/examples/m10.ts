import { DryRunTransport, M10Option, newSFSerialPort } from "../src/index.js";

async function main(): Promise<void> {
  const transport = new DryRunTransport();
  const sfport = newSFSerialPort({ transport });
  await sfport.mouse10(new M10Option().setX(-400).withSyncIgnoreOutput(true));
  await sfport.mouse10(new M10Option().setY(-400).withSyncIgnoreOutput(true));
  for (const directive of transport.getSentDirectives()) {
    console.log(directive);
  }
  console.log("m10 dry-run example completed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
