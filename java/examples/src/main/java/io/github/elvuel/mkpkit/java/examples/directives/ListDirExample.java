package io.github.elvuel.mkpkit.java.examples.directives;

import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.examples.ExampleSupport;

public final class ListDirExample {
    private ListDirExample() {
    }

    public static void main(String[] args) throws Exception {
        String path = args.length > 0 ? args[0] : "/eMMC/applog";
        try (SFSerialPort sfport = ExampleSupport.newDevicePort()) {
            ExampleSupport.printValue(sfport.listDir(path));
        }
    }
}
