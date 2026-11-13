package io.github.elvuel.mkpkit.java;

import java.util.ArrayList;
import java.util.List;

public final class KpadPressedState {
    private static final List<String> PRESSED_MOD_KEYS = new ArrayList<>();
    private static final List<String> PRESSED_KEYS = new ArrayList<>();

    private KpadPressedState() {
    }

    public static synchronized void reset() {
        PRESSED_MOD_KEYS.clear();
        PRESSED_KEYS.clear();
    }

    public static synchronized Snapshot snapshot() {
        return new Snapshot(List.copyOf(PRESSED_MOD_KEYS), List.copyOf(PRESSED_KEYS));
    }

    static synchronized void appendDown(List<String> keys) {
        for (String key : keys) {
            if (Keycodes.isModKey(key)) {
                appendOnce(PRESSED_MOD_KEYS, key);
            } else {
                appendOnce(PRESSED_KEYS, key);
            }
        }
    }

    static synchronized void applyUp(List<String> keys) {
        for (String key : keys) {
            if (Keycodes.isModKey(key)) {
                removeOnce(PRESSED_MOD_KEYS, key);
            } else {
                removeOnce(PRESSED_KEYS, key);
            }
        }
    }

    static void appendOnce(List<String> items, String value) {
        if (!items.contains(value)) {
            items.add(value);
        }
    }

    static void removeOnce(List<String> items, String value) {
        items.remove(value);
    }

    public record Snapshot(List<String> modKeys, List<String> keys) {
    }
}
