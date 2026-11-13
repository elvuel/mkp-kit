package io.github.elvuel.mkpkit.java.examples.directives;

import io.github.elvuel.mkpkit.java.Models;
import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.examples.ExampleSupport;

public final class AHttpBaseExample {
    private AHttpBaseExample() {
    }

    public static void main(String[] args) throws Exception {
        String url = args.length > 0 ? args[0] : "http://127.0.0.1:8080";
        try (SFSerialPort sfport = ExampleSupport.newDevicePort()) {
            System.out.println(sfport.ahttpbase(new Models.AHttpBaseOption(url)));
        }
    }
}
