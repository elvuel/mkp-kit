package io.github.elvuel.mkpkit.java.fileserver;

import io.github.elvuel.mkpkit.java.MkpJavaInfo;

public final class Main {
    private Main() {
    }

    public static void main(String[] args) throws Exception {
        FileServerCli.ParsedArgs parsed;
        try {
            parsed = FileServerCli.parse(args, System.getProperty("user.dir", "."));
        } catch (IllegalArgumentException error) {
            System.err.println("mkpkit-java-file-server: " + error.getMessage());
            System.err.println(FileServerCli.usage());
            System.exit(1);
            return;
        }

        if (parsed.helpRequested()) {
            System.out.println(FileServerCli.usage());
            return;
        }
        if (parsed.versionRequested()) {
            System.out.println(MkpJavaInfo.VERSION);
            return;
        }

        try (FileServerApp app = new FileServerApp(parsed.settings())) {
            app.start();
            System.out.println("http4dev server started");
            System.out.println("  FileRoot: " + app.settings().fileRoot());
            System.out.println("  Listen: " + app.settings().bind() + ":" + app.settings().port());
            System.out.println("  Endpoints:");
            System.out.println("    GET  /<path>        Download file");
            System.out.println("    PUT  /<path>        Raw upload");
            System.out.println("    POST /upload        Multipart form upload");
            System.out.println("    GET  /list?path=    List directory");
            System.out.println();
            Thread.currentThread().join();
        }
    }
}
