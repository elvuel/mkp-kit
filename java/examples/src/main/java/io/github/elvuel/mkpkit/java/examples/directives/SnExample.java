package io.github.elvuel.mkpkit.java.examples.directives;

import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.examples.ExampleSupport;

public final class SnExample {
    private SnExample() {
    }

    public static void main(String[] args) throws Exception {
        try (SFSerialPort sfport = ExampleSupport.newDevicePort()) {
            System.out.println(sfport.sn());
        }
    }
}
