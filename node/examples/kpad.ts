import { DryRunTransport, KpadOption, newSFSerialPort, typeText } from "../src/index.js";

async function main(): Promise<void> {
  const transport = new DryRunTransport();
  const sfport = newSFSerialPort({ transport });
  await typeText(sfport, "Hello MKP!", new KpadOption().withSyncIgnoreOutput(true));
  for (const directive of transport.getSentDirectives()) {
    console.log(directive);
  }
  console.log("kpad dry-run example completed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
