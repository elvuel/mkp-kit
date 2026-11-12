import { KpadOption, newSFSerialPort, typeText } from "../src/index.js";
import { resolveExamplePort } from "./common.js";

async function main(): Promise<void> {
  const portName = await resolveExamplePort();
  const sfport = newSFSerialPort({ name: portName });
  await sfport.open();
  try {
    console.log(`using serial port: ${portName}`);
    await typeText(sfport, "Hello MKP!", new KpadOption().withSyncIgnoreOutput(true));
    console.log("kpad device example completed");
  } finally {
    await sfport.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
