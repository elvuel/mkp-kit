package io.github.elvuel.mkpkit.java.examples.directives;

import io.github.elvuel.mkpkit.java.Models;
import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.examples.ExampleSupport;

public final class APutExample {
    private APutExample() {
    }

    public static void main(String[] args) throws Exception {
        String filepath = args.length > 0 ? args[0] : "/eMMC/applog/demo.log";
        try (SFSerialPort sfport = ExampleSupport.newDevicePort()) {
            System.out.println(sfport.aput(new Models.APutOption(filepath)));
        }
    }
}
