package io.github.elvuel.mkpkit.java.examples;

import io.github.elvuel.mkpkit.java.M10Option;
import io.github.elvuel.mkpkit.java.SFSerialPort;

public final class M10DeviceExample {
    private M10DeviceExample() {
    }

    public static void main(String[] args) throws Exception {
        try (SFSerialPort sfport = ExampleSupport.newDevicePort()) {
            sfport.mouse10(new M10Option().setX(-400).withSyncIgnoreOutput(true));
            sfport.mouse10(new M10Option().setY(-400).withSyncIgnoreOutput(true));
        }
        System.out.println("m10 device example completed");
    }
}
