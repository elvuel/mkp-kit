import { runFileServer } from "../file_server.js";

void runFileServer().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
