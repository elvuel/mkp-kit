package io.github.elvuel.mkpkit.java.cli;

import java.io.PrintWriter;

public final class Main {
    private Main() {
    }

    public static void main(String[] args) {
        int code = CliRunner.run(args, new PrintWriter(System.out, true), new PrintWriter(System.err, true));
        if (code != 0) {
            System.exit(code);
        }
    }
}
