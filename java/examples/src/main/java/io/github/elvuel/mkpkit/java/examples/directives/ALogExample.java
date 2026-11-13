package io.github.elvuel.mkpkit.java.examples.directives;

import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.examples.ExampleSupport;

public final class ALogExample {
    private ALogExample() {
    }

    public static void main(String[] args) throws Exception {
        String logName = args.length > 0 ? args[0] : "subdir1/test";
        try (SFSerialPort sfport = ExampleSupport.newDevicePort()) {
            System.out.println(sfport.alog(logName, null, sfport.syncOutputTimeoutMs()));
        }
    }
}
