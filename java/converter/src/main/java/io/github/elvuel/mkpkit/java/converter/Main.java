package io.github.elvuel.mkpkit.java.converter;

import java.io.PrintWriter;

public final class Main {
    private Main() {
    }

    public static void main(String[] args) {
        int exitCode = ConverterCli.run(args, new PrintWriter(System.out, true), new PrintWriter(System.err, true));
        if (exitCode != 0) {
            System.exit(exitCode);
        }
    }
}
