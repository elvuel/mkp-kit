package io.github.elvuel.mkpkit.java.examples;

import io.github.elvuel.mkpkit.java.JSerialCommTransport;
import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.SerialPortOptions;

public final class ExampleSupport {
    private ExampleSupport() {
    }

    public static String serialPortName() {
        String value = System.getenv("MKP_SERIAL_PORT");
        return value == null || value.isBlank() ? "COM3" : value.trim();
    }

    public static SFSerialPort newDevicePort() {
        String portName = serialPortName();
        return new SFSerialPort(
            new SerialPortOptions()
                .withName(portName)
                .withTransport(new JSerialCommTransport(portName, 115_200))
        );
    }
}
