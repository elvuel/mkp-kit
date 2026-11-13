package io.github.elvuel.mkpkit.java.examples;

import io.github.elvuel.mkpkit.java.DeviceHelpers;
import io.github.elvuel.mkpkit.java.DryRunTransport;
import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.SerialPortOptions;

public final class KpadExample {
    private KpadExample() {
    }

    public static void main(String[] args) throws Exception {
        DryRunTransport transport = new DryRunTransport();
        SFSerialPort sfport = new SFSerialPort(new SerialPortOptions().withTransport(transport));
        DeviceHelpers.typeText(sfport, "Hello MKP!", null);
        for (String directive : transport.getSentDirectives()) {
            System.out.println(directive);
        }
        System.out.println("kpad dry-run example completed");
    }
}
