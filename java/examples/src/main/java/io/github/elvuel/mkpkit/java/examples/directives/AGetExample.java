package io.github.elvuel.mkpkit.java.examples.directives;

import io.github.elvuel.mkpkit.java.Models;
import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.examples.ExampleSupport;

public final class AGetExample {
    private AGetExample() {
    }

    public static void main(String[] args) throws Exception {
        String filepath = args.length > 0 ? args[0] : "/tmp/demo.txt";
        try (SFSerialPort sfport = ExampleSupport.newDevicePort()) {
            System.out.println(sfport.aget(new Models.AGetOption(filepath)));
        }
    }
}
