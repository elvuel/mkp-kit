package io.github.elvuel.mkpkit.java.examples.directives;

import io.github.elvuel.mkpkit.java.Models;
import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.examples.ExampleSupport;

public final class AJson2LogExample {
    private AJson2LogExample() {
    }

    public static void main(String[] args) throws Exception {
        String jsonpath = args.length > 0 ? args[0] : "demo.json";
        String savepath = args.length > 1 ? args[1] : "/eMMC/applog/demo.log";
        try (SFSerialPort sfport = ExampleSupport.newDevicePort()) {
            ExampleSupport.printValue(sfport.ajson2log(new Models.AJson2LogOption(jsonpath, savepath)));
        }
    }
}
