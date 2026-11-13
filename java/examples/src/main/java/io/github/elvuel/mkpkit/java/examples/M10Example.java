package io.github.elvuel.mkpkit.java.examples;

import io.github.elvuel.mkpkit.java.DryRunTransport;
import io.github.elvuel.mkpkit.java.M10Option;
import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.SerialPortOptions;

public final class M10Example {
    private M10Example() {
    }

    public static void main(String[] args) throws Exception {
        DryRunTransport transport = new DryRunTransport();
        SFSerialPort sfport = new SFSerialPort(new SerialPortOptions().withTransport(transport));
        sfport.mouse10(new M10Option().setX(-400).withSyncIgnoreOutput(true));
        sfport.mouse10(new M10Option().setY(-400).withSyncIgnoreOutput(true));
        for (String directive : transport.getSentDirectives()) {
            System.out.println(directive);
        }
        System.out.println("m10 dry-run example completed");
    }
}
