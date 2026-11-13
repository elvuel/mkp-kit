package io.github.elvuel.mkpkit.java;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class Keycodes {
    public static final List<String> MOD_KEY_NAMES = List.of(
        "MOD_LCTRL",
        "MOD_LSHIFT",
        "MOD_LALT",
        "MOD_LMETA",
        "MOD_RCTRL",
        "MOD_RSHIFT",
        "MOD_RALT",
        "MOD_RMETA"
    );

    public static final Set<String> MOD_KEY_SHORT_NAMES = Set.of(
        "LCTRL",
        "LSHIFT",
        "LALT",
        "LMETA",
        "RCTRL",
        "RSHIFT",
        "RALT",
        "RMETA"
    );

    public static final Map<String, Integer> KEY_NAME_TO_NCODE;
    public static final Map<String, String> KEY_NAME_TO_HEXCODE;
    public static final Map<String, List<String>> SYMBOL_EXPANSIONS;

    static {
        Map<String, Integer> codes = new LinkedHashMap<>();
        codes.put("MOD_LCTRL", 0x01);
        codes.put("MOD_LSHIFT", 0x02);
        codes.put("MOD_LALT", 0x04);
        codes.put("MOD_LMETA", 0x08);
        codes.put("MOD_RCTRL", 0x10);
        codes.put("MOD_RSHIFT", 0x20);
        codes.put("MOD_RALT", 0x40);
        codes.put("MOD_RMETA", 0x80);
        codes.put("NONE", 0x00);
        codes.put("A", 0x04); codes.put("B", 0x05); codes.put("C", 0x06); codes.put("D", 0x07);
        codes.put("E", 0x08); codes.put("F", 0x09); codes.put("G", 0x0A); codes.put("H", 0x0B);
        codes.put("I", 0x0C); codes.put("J", 0x0D); codes.put("K", 0x0E); codes.put("L", 0x0F);
        codes.put("M", 0x10); codes.put("N", 0x11); codes.put("O", 0x12); codes.put("P", 0x13);
        codes.put("Q", 0x14); codes.put("R", 0x15); codes.put("S", 0x16); codes.put("T", 0x17);
        codes.put("U", 0x18); codes.put("V", 0x19); codes.put("W", 0x1A); codes.put("X", 0x1B);
        codes.put("Y", 0x1C); codes.put("Z", 0x1D);
        codes.put("1", 0x1E); codes.put("2", 0x1F); codes.put("3", 0x20); codes.put("4", 0x21); codes.put("5", 0x22);
        codes.put("6", 0x23); codes.put("7", 0x24); codes.put("8", 0x25); codes.put("9", 0x26); codes.put("0", 0x27);
        codes.put("ENTER", 0x28); codes.put("ESC", 0x29); codes.put("BACKSPACE", 0x2A); codes.put("TAB", 0x2B);
        codes.put("SPACE", 0x2C); codes.put("MINUS", 0x2D); codes.put("EQUAL", 0x2E); codes.put("LEFTBRACE", 0x2F);
        codes.put("RIGHTBRACE", 0x30); codes.put("BACKSLASH", 0x31); codes.put("SEMICOLON", 0x33); codes.put("APOSTROPHE", 0x34);
        codes.put("GRAVE", 0x35); codes.put("COMMA", 0x36); codes.put("DOT", 0x37); codes.put("SLASH", 0x38);
        codes.put("RIGHT", 0x4F); codes.put("LEFT", 0x50); codes.put("DOWN", 0x51); codes.put("UP", 0x52);
        KEY_NAME_TO_NCODE = Map.copyOf(codes);

        Map<String, String> hex = new LinkedHashMap<>();
        for (Map.Entry<String, Integer> entry : KEY_NAME_TO_NCODE.entrySet()) {
            hex.put(entry.getKey(), String.format("0x%02x", entry.getValue()));
        }
        KEY_NAME_TO_HEXCODE = Map.copyOf(hex);

        Map<String, List<String>> symbols = new LinkedHashMap<>();
        symbols.put("!", List.of("MOD_LSHIFT", "1"));
        symbols.put("@", List.of("MOD_LSHIFT", "2"));
        symbols.put("#", List.of("MOD_LSHIFT", "3"));
        symbols.put("$", List.of("MOD_LSHIFT", "4"));
        symbols.put("%", List.of("MOD_LSHIFT", "5"));
        symbols.put("^", List.of("MOD_LSHIFT", "6"));
        symbols.put("&", List.of("MOD_LSHIFT", "7"));
        symbols.put("*", List.of("MOD_LSHIFT", "8"));
        symbols.put("(", List.of("MOD_LSHIFT", "9"));
        symbols.put(")", List.of("MOD_LSHIFT", "0"));
        symbols.put(" ", List.of("SPACE"));
        symbols.put("-", List.of("MINUS"));
        symbols.put("_", List.of("MOD_LSHIFT", "MINUS"));
        symbols.put("=", List.of("EQUAL"));
        symbols.put("+", List.of("MOD_LSHIFT", "EQUAL"));
        symbols.put("[", List.of("LEFTBRACE"));
        symbols.put("{", List.of("MOD_LSHIFT", "LEFTBRACE"));
        symbols.put("]", List.of("RIGHTBRACE"));
        symbols.put("}", List.of("MOD_LSHIFT", "RIGHTBRACE"));
        symbols.put("\\", List.of("BACKSLASH"));
        symbols.put("|", List.of("MOD_LSHIFT", "BACKSLASH"));
        symbols.put(";", List.of("SEMICOLON"));
        symbols.put(":", List.of("MOD_LSHIFT", "SEMICOLON"));
        symbols.put("'", List.of("APOSTROPHE"));
        symbols.put("\"", List.of("MOD_LSHIFT", "APOSTROPHE"));
        symbols.put("`", List.of("GRAVE"));
        symbols.put("~", List.of("MOD_LSHIFT", "GRAVE"));
        symbols.put(",", List.of("COMMA"));
        symbols.put("<", List.of("MOD_LSHIFT", "COMMA"));
        symbols.put(".", List.of("DOT"));
        symbols.put(">", List.of("MOD_LSHIFT", "DOT"));
        symbols.put("/", List.of("SLASH"));
        symbols.put("?", List.of("MOD_LSHIFT", "SLASH"));
        SYMBOL_EXPANSIONS = Map.copyOf(symbols);
    }

    private Keycodes() {
    }

    public static boolean isModKey(String key) {
        return MOD_KEY_NAMES.contains(key);
    }

    public static String keyNameToHexcode(String key) {
        return KEY_NAME_TO_HEXCODE.get(key);
    }

    public static String normalizeKpadKey(String key) {
        String normalized = key == null ? "" : key.trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            return "";
        }
        return switch (normalized) {
            case "CTRL" -> "MOD_LCTRL";
            case "SHIFT" -> "MOD_LSHIFT";
            case "ALT" -> "MOD_LALT";
            case "META" -> "MOD_LMETA";
            case "LEFTBRACKET" -> "LEFTBRACE";
            case "RIGHTBRACKET" -> "RIGHTBRACE";
            default -> MOD_KEY_SHORT_NAMES.contains(normalized) ? "MOD_" + normalized : normalized;
        };
    }

    public static List<String> expandKpadInputKey(String key) {
        if (key == null || key.isEmpty()) {
            return List.of();
        }
        if (SYMBOL_EXPANSIONS.containsKey(key)) {
            return new ArrayList<>(SYMBOL_EXPANSIONS.get(key));
        }
        if (key.length() == 1) {
            char value = key.charAt(0);
            if (value >= 'a' && value <= 'z') {
                return List.of(String.valueOf(Character.toUpperCase(value)));
            }
            if (value >= 'A' && value <= 'Z') {
                return List.of("MOD_LSHIFT", String.valueOf(value));
            }
        }
        String normalized = normalizeKpadKey(key);
        return normalized.isEmpty() ? List.of() : List.of(normalized);
    }

    public static String modStatus(List<String> modKeys) {
        if (modKeys == null || modKeys.isEmpty()) {
            return "";
        }
        int code = 0;
        for (String key : modKeys) {
            code |= KEY_NAME_TO_NCODE.getOrDefault(key, 0);
        }
        return String.format("0x%02x", code);
    }

    public static SplitKeys splitKeys(List<String> keys) {
        List<String> modKeys = new ArrayList<>();
        List<String> normalKeys = new ArrayList<>();
        for (String key : keys) {
            if (isModKey(key)) {
                modKeys.add(key);
            } else {
                normalKeys.add(key);
            }
        }
        return new SplitKeys(modKeys, normalKeys);
    }

    public record SplitKeys(List<String> modKeys, List<String> normalKeys) {
    }
}
