package io.github.elvuel.mkpkit.java.converter;

import java.io.PrintWriter;
import java.nio.file.Files;
import java.nio.file.Path;

public final class ConverterCli {
    private ConverterCli() {
    }

    public static int run(String[] args, PrintWriter out, PrintWriter err) {
        String inputPath = "";
        String outputPath = "";

        for (int index = 0; index < args.length; index++) {
            String token = args[index];
            switch (token) {
                case "-h", "--help" -> {
                    out.println(usage());
                    return 0;
                }
                case "-f" -> {
                    if (index + 1 >= args.length) {
                        err.println("converter: missing -f value");
                        return 1;
                    }
                    inputPath = args[++index];
                }
                case "-o" -> {
                    if (index + 1 >= args.length) {
                        err.println("converter: missing -o value");
                        return 1;
                    }
                    outputPath = args[++index];
                }
                default -> {
                    err.println("converter: unknown argument " + token);
                    err.println(usage());
                    return 1;
                }
            }
        }

        if (inputPath.isBlank()) {
            err.println(usage());
            err.println("converter: missing -f");
            return 1;
        }

        ConverterCore.Direction direction = ConverterCore.directionFromPath(inputPath);
        if (direction == ConverterCore.Direction.UNKNOWN) {
            err.println("converter: unrecognized input extension on '" + inputPath + "' (expected .log or .json)");
            return 1;
        }

        String resolvedOutput = outputPath.isBlank() ? ConverterCore.swapExt(inputPath, direction.targetExtension()) : outputPath;
        if (!resolvedOutput.toLowerCase().endsWith(direction.targetExtension())) {
            resolvedOutput += direction.targetExtension();
        }

        try {
            Path outputDir = Path.of(resolvedOutput).toAbsolutePath().normalize().getParent();
            if (outputDir != null) {
                Files.createDirectories(outputDir);
            }
            if (direction == ConverterCore.Direction.LOG_TO_JSON) {
                ConverterCore.convertLogFileToJsonFile(inputPath, resolvedOutput);
                ConverterCore.Envelope envelope = ConverterCore.readJsonFile(resolvedOutput);
                out.println("log -> json: " + resolvedOutput + " (" + envelope.events().size() + " events)");
                return 0;
            }
            ConverterCore.JsonToLogResult result = ConverterCore.convertJsonFileToLogFile(inputPath, resolvedOutput);
            out.println(
                "json -> log: " + resolvedOutput
                    + " (version=" + result.header().version()
                    + ", mouse=" + (result.hasMouse() ? 1 : 0)
                    + ", kbd=" + (result.hasKeyboard() ? 1 : 0)
                    + ")"
            );
            return 0;
        } catch (Exception error) {
            err.println("converter: " + error.getMessage());
            return 1;
        }
    }

    public static String usage() {
        return String.join("\n",
            "usage: mkpkit-java-converter -f <input> [-o <output>]",
            "",
            "Convert between binary applog (.log) and JSON action envelope (.json).",
            "The direction is decided by the input file extension.",
            "",
            "Flags:",
            "  -f <input>   input file (.log or .json)",
            "  -o <output>  output file (default: same name with opposite extension)",
            "  -h, --help   show this message"
        );
    }
}
