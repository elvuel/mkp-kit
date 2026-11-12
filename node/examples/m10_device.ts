import { M10Option, newSFSerialPort } from "../src/index.js";
import { resolveExamplePort } from "./common.js";

async function main(): Promise<void> {
  const portName = await resolveExamplePort();
  const sfport = newSFSerialPort({ name: portName });
  await sfport.open();
  try {
    console.log(`using serial port: ${portName}`);
    await sfport.mouse10(new M10Option().setX(-400).withSyncIgnoreOutput(true));
    await sfport.mouse10(new M10Option().setY(-400).withSyncIgnoreOutput(true));
    console.log("m10 device example completed");
  } finally {
    await sfport.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
