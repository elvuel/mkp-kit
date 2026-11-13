package io.github.elvuel.mkpkit.java.examples.directives;

import io.github.elvuel.mkpkit.java.Models;
import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.examples.ExampleSupport;

public final class WifiAutoExample {
    private WifiAutoExample() {
    }

    public static void main(String[] args) throws Exception {
        Models.WifiAutoOption option = null;
        if (args.length == 1) {
            if (!"0".equals(args[0]) && !"1".equals(args[0])) {
                throw new IllegalArgumentException("usage: WifiAutoExample [0|1]");
            }
            option = new Models.WifiAutoOption(args[0]);
        } else if (args.length != 0) {
            throw new IllegalArgumentException("usage: WifiAutoExample [0|1]");
        }
        try (SFSerialPort sfport = ExampleSupport.newDevicePort()) {
            ExampleSupport.printValue(sfport.wifiAuto(option));
        }
    }
}
