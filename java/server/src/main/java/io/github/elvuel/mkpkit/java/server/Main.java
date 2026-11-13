package io.github.elvuel.mkpkit.java.server;

import io.github.elvuel.mkpkit.java.MkpJavaInfo;

public final class Main {
    private Main() {
    }

    public static void main(String[] args) throws Exception {
        ServerConfigLoader.ParsedServerCli cli;
        try {
            cli = ServerConfigLoader.parseCli(args);
        } catch (Exception error) {
            System.err.println(error.getMessage());
            System.err.println(ServerConfigLoader.usage());
            System.exit(1);
            return;
        }

        if (cli.helpRequested()) {
            System.out.println(ServerConfigLoader.usage());
            return;
        }
        if (cli.showVersion()) {
            System.out.println("mkpkit-java-server " + MkpJavaInfo.VERSION);
            return;
        }

        ServerConfigLoader.LoadedServerConfig loaded = ServerConfigLoader.load(cli.configPath());
        ServerApp app = new ServerApp(loaded.settings());
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                app.close();
            } catch (Exception ignored) {
            }
        }));
        app.start();
        System.out.println("mkpkit-java-server started");
        System.out.println("  Listen: " + loaded.settings().bind + ":" + app.port());
        System.out.println("  Serial: " + loaded.settings().sfPort);
        System.out.println("  RecordStore: " + loaded.settings().recordStorePath);
    }
}
