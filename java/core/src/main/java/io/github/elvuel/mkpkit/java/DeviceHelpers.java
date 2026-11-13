package io.github.elvuel.mkpkit.java;

import java.util.ArrayList;
import java.util.List;

public final class DeviceHelpers {
    private DeviceHelpers() {
    }

    public static List<KpadOption> buildTextTapOptions(String text, KpadOption base) {
        List<KpadOption> options = new ArrayList<>();
        for (char ch : text.toCharArray()) {
            options.add(cloneKpadBase(base).withKeys(Keycodes.expandKpadInputKey(String.valueOf(ch))).withAutoRelease());
        }
        return options;
    }

    public static void keyTap(SFSerialPort sfport, String key, KpadOption base) throws Exception {
        sfport.keypad(cloneKpadBase(base).withKeys(Keycodes.expandKpadInputKey(key)).withAutoRelease());
    }

    public static void typeText(SFSerialPort sfport, String text, KpadOption base) throws Exception {
        for (KpadOption option : buildTextTapOptions(text, base)) {
            sfport.keypad(option);
        }
    }

    public static void keyPresses(SFSerialPort sfport, List<String> keys, int sleepMs, KpadOption base) throws Exception {
        for (int index = 0; index < keys.size(); index++) {
            keyTap(sfport, keys.get(index), base);
            if (sleepMs > 0 && index + 1 < keys.size()) {
                Thread.sleep(sleepMs);
            }
        }
    }

    public static void keyDown(SFSerialPort sfport, String key, KpadOption base) throws Exception {
        sfport.keypad(cloneKpadBase(base).keyDown(key));
    }

    public static void keyUp(SFSerialPort sfport, String key, KpadOption base) throws Exception {
        KpadOption.KeyUpPlan plan = cloneKpadBase(base).keyUp(key);
        if (plan.release() != null) {
            sfport.keypad(plan.release());
        }
        if (plan.remain() != null) {
            sfport.keypad(plan.remain());
        }
    }

    public static void keypadRelease(SFSerialPort sfport, KpadOption base) throws Exception {
        sfport.keypad(cloneKpadBase(base).withKey("NONE").withHold());
    }

    public static void keypadReleaseAll(SFSerialPort sfport, KpadOption base) throws Exception {
        int delay = base == null ? 0 : base.delay();
        sfport.keypad(cloneKpadBase(base).withRelease(0).withDelay(delay));
        KpadPressedState.reset();
    }

    public static void mouseReleaseAll(SFSerialPort sfport, M10Option base) throws Exception {
        M10Option option = cloneM10Base(base);
        option.setButton(0).setX(0).setY(0).withSyncIgnoreOutput(true);
        sfport.mouse10(option);
    }

    private static KpadOption cloneKpadBase(KpadOption base) {
        return base == null ? new KpadOption() : base.copy();
    }

    private static M10Option cloneM10Base(M10Option base) {
        return base == null ? new M10Option() : base.copy();
    }
}
