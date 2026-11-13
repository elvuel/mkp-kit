package io.github.elvuel.mkpkit.java.fileserver;

import java.nio.file.Path;

public final class FileServerCli {
    private FileServerCli() {
    }

    public static String usage() {
        return String.join("\n",
            "Usage: mkpkit-java-file-server [-p PORT] [-r ROOT] [-b BIND]",
            "",
            "Endpoints:",
            "  GET  /<path>        Download file",
            "  PUT  /<path>        Raw upload",
            "  POST /upload        Multipart form upload",
            "  GET  /list?path=    List directory"
        );
    }

    public static ParsedArgs parse(String[] args, String cwd) {
        String bind = "0.0.0.0";
        int port = 8080;
        String fileRoot = "./file_root";
        boolean help = false;
        boolean version = false;

        for (int index = 0; index < args.length; index++) {
            String token = args[index];
            switch (token) {
                case "-h", "--help" -> help = true;
                case "--version" -> version = true;
                case "-p", "--port" -> {
                    if (index + 1 >= args.length) {
                        throw new IllegalArgumentException("missing value for " + token);
                    }
                    port = parsePositiveInt(args[++index], token);
                }
                case "-r", "--root" -> {
                    if (index + 1 >= args.length) {
                        throw new IllegalArgumentException("missing value for " + token);
                    }
                    fileRoot = args[++index];
                }
                case "-b", "--bind" -> {
                    if (index + 1 >= args.length) {
                        throw new IllegalArgumentException("missing value for " + token);
                    }
                    bind = args[++index];
                }
                default -> throw new IllegalArgumentException("unknown argument: " + token);
            }
        }

        Path resolvedRoot = Path.of(cwd).resolve(fileRoot).normalize().toAbsolutePath();
        return new ParsedArgs(help, version, new FileServerSettings(bind, port, resolvedRoot.toString()));
    }

    private static int parsePositiveInt(String raw, String flag) {
        try {
            int value = Integer.parseInt(raw);
            if (value <= 0) {
                throw new IllegalArgumentException("invalid value for " + flag + ": " + raw);
            }
            return value;
        } catch (NumberFormatException error) {
            throw new IllegalArgumentException("invalid value for " + flag + ": " + raw, error);
        }
    }

    public record ParsedArgs(boolean helpRequested, boolean versionRequested, FileServerSettings settings) {
    }
}
