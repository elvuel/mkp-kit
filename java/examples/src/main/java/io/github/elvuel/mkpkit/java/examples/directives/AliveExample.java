package io.github.elvuel.mkpkit.java.examples.directives;

import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.examples.ExampleSupport;

public final class AliveExample {
    private AliveExample() {
    }

    public static void main(String[] args) throws Exception {
        try (SFSerialPort sfport = ExampleSupport.newDevicePort()) {
            ExampleSupport.printValue(sfport.alive());
        }
    }
}
