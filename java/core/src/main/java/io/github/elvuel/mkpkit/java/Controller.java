package io.github.elvuel.mkpkit.java;

import java.util.List;

public final class Controller {
    private final SFSerialPort serialPort;

    public Controller(SFSerialPort serialPort) {
        this.serialPort = serialPort;
    }

    public SFSerialPort serialPort() {
        return serialPort;
    }

    public String composeLogFullpath(String path) {
        return SFSerialPort.composeLogFullpath(path);
    }

    public void mouse10(M10Option option) throws Exception {
        serialPort.mouse10(option);
    }

    public void keypad(KpadOption option) throws Exception {
        serialPort.keypad(option);
    }

    public void typeText(String text, KpadOption option) throws Exception {
        DeviceHelpers.typeText(serialPort, text, option);
    }

    public void keyTap(String key, KpadOption option) throws Exception {
        DeviceHelpers.keyTap(serialPort, key, option);
    }

    public void keyPresses(List<String> keys, int sleepMs, KpadOption option) throws Exception {
        DeviceHelpers.keyPresses(serialPort, keys, sleepMs, option);
    }

    public void keyDown(String key, KpadOption option) throws Exception {
        DeviceHelpers.keyDown(serialPort, key, option);
    }

    public void keyUp(String key, KpadOption option) throws Exception {
        DeviceHelpers.keyUp(serialPort, key, option);
    }

    public void keypadRelease(KpadOption option) throws Exception {
        DeviceHelpers.keypadRelease(serialPort, option);
    }

    public void keypadReleaseAll(KpadOption option) throws Exception {
        DeviceHelpers.keypadReleaseAll(serialPort, option);
    }

    public void mouseReleaseAll(M10Option option) throws Exception {
        DeviceHelpers.mouseReleaseAll(serialPort, option);
    }
}
