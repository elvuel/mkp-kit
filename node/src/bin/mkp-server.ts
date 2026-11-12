import { loadServerSettings, createServerApp } from "../server.js";
import { loadServerFileConfig, parseServerCLIArgs, serverCLIUsage, serverFileConfigToSettings } from "../server_config.js";

async function main(): Promise<void> {
  const cli = parseServerCLIArgs(process.argv.slice(2));
  if (cli.help) {
    console.log(serverCLIUsage());
    return;
  }

  const fileConfig = loadServerFileConfig(cli.configPath, process.env);
  const settings = loadServerSettings(process.env, serverFileConfigToSettings(fileConfig.config));
  const app = createServerApp({ initializeSerial: true, settings });
  const server = await app.listen(app.settings.port);
  console.log(`mkp-server listening on http://0.0.0.0:${app.settings.port}`);
  if (fileConfig.configPath) {
    console.log(`mkp-server loaded config: ${fileConfig.configPath}`);
  }

  const shutdown = async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await app.close();
  };

  process.once("SIGINT", () => {
    shutdown().finally(() => {
      process.exit(0);
    });
  });
  process.once("SIGTERM", () => {
    shutdown().finally(() => {
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
