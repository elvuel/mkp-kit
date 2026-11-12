import { Controller, DryRunTransport, newSFSerialPort } from "../src/index.js";

async function main(): Promise<void> {
  const transport = new DryRunTransport();
  const sfport = newSFSerialPort({ transport });
  const controller = new Controller(sfport);

  await controller.keyDown("w");
  await controller.keyDown("d");
  await controller.keyUp("d");
  await controller.keyUp("w");

  await controller.keyDown("alt");
  await controller.keyDown("n");
  await controller.keyUp("n");
  await controller.keyUp("alt");

  await controller.keyTap("esc");
  await controller.keyPresses(["H", "e", "l", "l", "o", " ", "M", "K", "P", "!"]);

  for (const directive of transport.getSentDirectives()) {
    console.log(directive);
  }
  console.log("keys dry-run example completed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
