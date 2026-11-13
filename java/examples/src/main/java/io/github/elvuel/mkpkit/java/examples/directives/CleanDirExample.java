package io.github.elvuel.mkpkit.java.examples.directives;

import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.examples.ExampleSupport;

public final class CleanDirExample {
    private CleanDirExample() {
    }

    public static void main(String[] args) throws Exception {
        String path = args.length > 0 ? args[0] : "/eMMC/applog/subdir1";
        try (SFSerialPort sfport = ExampleSupport.newDevicePort()) {
            ExampleSupport.printValue(sfport.cleanDir(path));
        }
    }
}
