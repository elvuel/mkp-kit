package io.github.elvuel.mkpkit.java.examples.directives;

import io.github.elvuel.mkpkit.java.Models;
import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.examples.ExampleSupport;

public final class JoinExample {
    private JoinExample() {
    }

    public static void main(String[] args) throws Exception {
        Models.JoinOption option = null;
        if (args.length == 2) {
            option = new Models.JoinOption(args[0], args[1]);
        } else if (args.length != 0) {
            throw new IllegalArgumentException("usage: JoinExample [ssid password]");
        }
        try (SFSerialPort sfport = ExampleSupport.newDevicePort()) {
            ExampleSupport.printValue(sfport.join(option));
        }
    }
}
