package io.github.elvuel.mkpkit.java.examples;

import io.github.elvuel.mkpkit.java.DeviceHelpers;
import io.github.elvuel.mkpkit.java.SFSerialPort;

public final class KpadDeviceExample {
    private KpadDeviceExample() {
    }

    public static void main(String[] args) throws Exception {
        try (SFSerialPort sfport = ExampleSupport.newDevicePort()) {
            DeviceHelpers.typeText(sfport, "Hello MKP!", null);
        }
        System.out.println("kpad device example completed");
    }
}
