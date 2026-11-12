import { runClientCli } from "../client.js";

runClientCli().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
