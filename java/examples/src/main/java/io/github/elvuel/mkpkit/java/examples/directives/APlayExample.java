package io.github.elvuel.mkpkit.java.examples.directives;

import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.examples.ExampleSupport;

public final class APlayExample {
    private APlayExample() {
    }

    public static void main(String[] args) throws Exception {
        String logPath = args.length > 0 ? args[0] : "demo";
        int delay = args.length > 1 ? Integer.parseInt(args[1]) : -1;
        try (SFSerialPort sfport = ExampleSupport.newDevicePort()) {
            sfport.startReplaying(logPath, delay);
        }
        System.out.println("aplay sent");
    }
}
