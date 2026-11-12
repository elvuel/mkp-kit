import { runCli } from "../cli.js";

runCli().then((code) => {
  process.exitCode = code;
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
