package io.github.elvuel.mkpkit.java.client;

import java.io.PrintWriter;

public final class Main {
    private Main() {
    }

    public static void main(String[] args) {
        int code = ClientRunner.run(args, new PrintWriter(System.out, true), new PrintWriter(System.err, true));
        if (code != 0) {
            System.exit(code);
        }
    }
}
