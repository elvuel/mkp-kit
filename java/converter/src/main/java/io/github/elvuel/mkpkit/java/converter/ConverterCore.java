package io.github.elvuel.mkpkit.java.converter;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.elvuel.mkpkit.java.Keycodes;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class ConverterCore {
    public static final String MAGIC_V1 = "MKv1";
    public static final String MAGIC_V2 = "MKv2";
    public static final int MAGIC_LENGTH = 4;
    public static final int RECORD_HEADER_SIZE = 7;
    public static final int MAX_PAYLOAD_LENGTH = 64;
    public static final int KBD_MAX_KEYS = 6;
    public static final int MOUSE_BUTTON_LEFT = 0x01;
    public static final int MOUSE_BUTTON_RIGHT = 0x02;
    public static final int MOUSE_BUTTON_MIDDLE = 0x04;

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final String[] MOD_BIT_TO_NAME = new String[] {"lctrl", "lshift", "lalt", "lmeta", "rctrl", "rshift", "ralt", "rmeta"};

    private ConverterCore() {
    }

    public enum Direction {
        UNKNOWN(""),
        LOG_TO_JSON(".json"),
        JSON_TO_LOG(".log");

        private final String targetExtension;

        Direction(String targetExtension) {
            this.targetExtension = targetExtension;
        }

        public String targetExtension() {
            return targetExtension;
        }
    }

    public record Meta(int width, int height, int startX, int startY) {
        public Meta() {
            this(0, 0, 0, 0);
        }
    }

    public record LogHeader(String version, Meta meta) {
        public LogHeader {
            if (version == null || version.isBlank()) {
                version = MAGIC_V1;
            }
            if (meta == null) {
                meta = new Meta();
            }
        }
    }

    public record LogRecord(int port, int delta, int length, byte[] payload) {
        public LogRecord {
            payload = payload == null ? new byte[0] : payload.clone();
        }
    }

    public record MetaJson(int width, int height, int startX, int startY) {
        public MetaJson() {
            this(0, 0, 0, 0);
        }

        public Map<String, Object> toJsonObject() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("width", width);
            out.put("height", height);
            out.put("startX", startX);
            out.put("startY", startY);
            return out;
        }
    }

    public record MouseMoveEvent(int x, int y, int ts) {
        public Map<String, Object> toJsonObject() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("x", x);
            out.put("y", y);
            out.put("ts", ts);
            return out;
        }
    }

    public record ButtonEvent(String button, int ts) {
        public Map<String, Object> toJsonObject() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("button", button);
            out.put("ts", ts);
            return out;
        }
    }

    public record WheelEvent(int delta, int ts) {
        public Map<String, Object> toJsonObject() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("delta", delta);
            out.put("ts", ts);
            return out;
        }
    }

    public record KeyEvent(List<String> keys, int ts) {
        public KeyEvent {
            keys = keys == null ? List.of() : List.copyOf(keys);
        }

        public Map<String, Object> toJsonObject() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("keys", keys);
            out.put("ts", ts);
            return out;
        }
    }

    public static final class Event {
        private final String typeName;
        private final MouseMoveEvent mouseMove;
        private final ButtonEvent mouseDown;
        private final ButtonEvent mouseUp;
        private final WheelEvent wheel;
        private final KeyEvent keyDown;
        private final KeyEvent keyUp;

        private Event(String typeName, MouseMoveEvent mouseMove, ButtonEvent mouseDown, ButtonEvent mouseUp, WheelEvent wheel, KeyEvent keyDown, KeyEvent keyUp) {
            this.typeName = typeName == null ? "" : typeName;
            this.mouseMove = mouseMove;
            this.mouseDown = mouseDown;
            this.mouseUp = mouseUp;
            this.wheel = wheel;
            this.keyDown = keyDown;
            this.keyUp = keyUp;
        }

        public static Event mouseMove(MouseMoveEvent value) { return new Event("MouseMove", value, null, null, null, null, null); }
        public static Event mouseDown(ButtonEvent value) { return new Event("MouseDown", null, value, null, null, null, null); }
        public static Event mouseUp(ButtonEvent value) { return new Event("MouseUp", null, null, value, null, null, null); }
        public static Event wheel(WheelEvent value) { return new Event("Wheel", null, null, null, value, null, null); }
        public static Event keyDown(KeyEvent value) { return new Event("KeyDown", null, null, null, null, value, null); }
        public static Event keyUp(KeyEvent value) { return new Event("KeyUp", null, null, null, null, null, value); }

        public MouseMoveEvent mouseMove() { return mouseMove; }
        public ButtonEvent mouseDown() { return mouseDown; }
        public ButtonEvent mouseUp() { return mouseUp; }
        public WheelEvent wheel() { return wheel; }
        public KeyEvent keyDown() { return keyDown; }
        public KeyEvent keyUp() { return keyUp; }

        public int timestamp() {
            if (mouseMove != null) return mouseMove.ts();
            if (mouseDown != null) return mouseDown.ts();
            if (mouseUp != null) return mouseUp.ts();
            if (wheel != null) return wheel.ts();
            if (keyDown != null) return keyDown.ts();
            if (keyUp != null) return keyUp.ts();
            return 0;
        }

        public Object toJsonObject() {
            Map<String, Object> out = new LinkedHashMap<>();
            if (mouseMove != null) {
                out.put(typeName.isBlank() ? "MouseMove" : typeName, mouseMove.toJsonObject());
                return out;
            }
            if (mouseDown != null) {
                out.put(typeName.isBlank() ? "MouseDown" : typeName, mouseDown.toJsonObject());
                return out;
            }
            if (mouseUp != null) {
                out.put(typeName.isBlank() ? "MouseUp" : typeName, mouseUp.toJsonObject());
                return out;
            }
            if (wheel != null) {
                out.put(typeName.isBlank() ? "Wheel" : typeName, wheel.toJsonObject());
                return out;
            }
            if (keyDown != null) {
                out.put(typeName.isBlank() ? "KeyDown" : typeName, keyDown.toJsonObject());
                return out;
            }
            if (keyUp != null) {
                out.put(typeName.isBlank() ? "KeyUp" : typeName, keyUp.toJsonObject());
                return out;
            }
            throw new IllegalStateException("empty event");
        }

        public static Event fromJsonNode(JsonNode node) {
            if (node == null || !node.isObject() || node.size() != 1) {
                throw new IllegalArgumentException("event must have exactly one key");
            }
            Map.Entry<String, JsonNode> property = node.fields().next();
            String name = property.getKey();
            JsonNode value = property.getValue();
            return switch (name) {
                case "MouseMove" -> mouseMove(new MouseMoveEvent(value.path("x").asInt(), value.path("y").asInt(), value.path("ts").asInt()));
                case "MouseDown" -> mouseDown(new ButtonEvent(value.path("button").asText(""), value.path("ts").asInt()));
                case "MouseUp" -> mouseUp(new ButtonEvent(value.path("button").asText(""), value.path("ts").asInt()));
                case "Wheel" -> wheel(new WheelEvent(value.path("delta").asInt(), value.path("ts").asInt()));
                case "KeyDown" -> keyDown(new KeyEvent(readKeys(value.path("keys")), value.path("ts").asInt()));
                case "KeyUp" -> keyUp(new KeyEvent(readKeys(value.path("keys")), value.path("ts").asInt()));
                default -> throw new IllegalArgumentException("unknown event type " + name);
            };
        }
    }

    public static final class Envelope {
        private final String format;
        private final String version;
        private final MetaJson meta;
        private final List<Event> events;

        public Envelope(String format, String version, MetaJson meta, List<Event> events) {
            this.format = format == null || format.isBlank() ? "mkp-action-v1" : format;
            this.version = version == null || version.isBlank() ? MAGIC_V1 : version;
            this.meta = meta == null ? new MetaJson() : meta;
            this.events = events == null ? new ArrayList<>() : new ArrayList<>(events);
        }

        public String format() { return format; }
        public String version() { return version; }
        public MetaJson meta() { return meta; }
        public List<Event> events() { return events; }

        public Map<String, Object> toJsonObject() {
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("format", format);
            out.put("version", version);
            out.put("meta", meta.toJsonObject());
            out.put("events", events.stream().map(Event::toJsonObject).toList());
            return out;
        }
    }

    public record MouseReport(int button, int x, int y, int wheel) {
    }

    public record JsonToLogResult(LogHeader header, List<LogRecord> records, boolean hasMouse, boolean hasKeyboard) {
    }

    public record LogReadResult(LogHeader header, List<LogRecord> records) {
    }

    public static Direction directionFromPath(String filePath) {
        String normalized = filePath == null ? "" : filePath.toLowerCase(Locale.ROOT);
        if (normalized.endsWith(".log")) return Direction.LOG_TO_JSON;
        if (normalized.endsWith(".json")) return Direction.JSON_TO_LOG;
        return Direction.UNKNOWN;
    }

    public static String swapExt(String filePath, String newExtension) {
        int index = filePath.lastIndexOf('.');
        return index < 0 ? filePath + newExtension : filePath.substring(0, index) + newExtension;
    }

    public static byte[] mouseEncode(int button, int x, int y, int wheel) {
        int ux = x & 0x0FFF;
        int uy = y & 0x0FFF;
        return new byte[] {
            (byte) (button & 0xFF),
            (byte) (ux & 0xFF),
            (byte) (((ux >> 8) & 0x0F) | ((uy & 0x0F) << 4)),
            (byte) ((uy >> 4) & 0xFF),
            (byte) wheel
        };
    }

    public static MouseReport mouseDecode(byte[] payload) {
        if (payload.length != 5) {
            throw new IllegalArgumentException("mouse payload must be 5 bytes, got " + payload.length);
        }
        int ux = (payload[1] & 0xFF) | ((payload[2] & 0x0F) << 8);
        int uy = ((payload[2] & 0xF0) >> 4) | ((payload[3] & 0xFF) << 4);
        if ((ux & 0x0800) != 0) ux |= 0xF000;
        if ((uy & 0x0800) != 0) uy |= 0xF000;
        return new MouseReport(payload[0] & 0xFF, (short) ux, (short) uy, (byte) payload[4]);
    }

    public static Envelope readJsonFile(String path) throws IOException {
        JsonNode root = MAPPER.readTree(Path.of(path).toFile());
        JsonNode metaNode = root.path("meta");
        MetaJson meta = new MetaJson(metaNode.path("width").asInt(), metaNode.path("height").asInt(), metaNode.path("startX").asInt(), metaNode.path("startY").asInt());
        List<Event> events = new ArrayList<>();
        JsonNode eventsNode = root.path("events");
        if (eventsNode.isArray()) {
            for (JsonNode eventNode : eventsNode) {
                events.add(Event.fromJsonNode(eventNode));
            }
        }
        return new Envelope(root.path("format").asText("mkp-action-v1"), root.path("version").asText(MAGIC_V1), meta, events);
    }

    public static void writeJsonFile(String path, Envelope envelope) throws IOException {
        String json = MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(envelope.toJsonObject()) + System.lineSeparator();
        Files.writeString(Path.of(path), json, StandardCharsets.UTF_8);
    }

    public static LogReadResult readLogFile(String path) throws IOException {
        byte[] data = Files.readAllBytes(Path.of(path));
        if (data.length < MAGIC_LENGTH) {
            throw new IllegalArgumentException("empty log file");
        }
        String magic = new String(data, 0, MAGIC_LENGTH, StandardCharsets.US_ASCII);
        int offset = MAGIC_LENGTH;
        LogHeader header;
        if (MAGIC_V1.equals(magic)) {
            header = new LogHeader(MAGIC_V1, new Meta());
        } else if (MAGIC_V2.equals(magic)) {
            int width = readUInt16LE(data, offset);
            int height = readUInt16LE(data, offset + 2);
            int startX = readUInt16LE(data, offset + 4);
            int startY = readUInt16LE(data, offset + 6);
            header = new LogHeader(MAGIC_V2, new Meta(width, height, startX, startY));
            offset += 12;
        } else {
            throw new IllegalArgumentException("bad magic " + magic);
        }

        List<LogRecord> records = new ArrayList<>();
        while (offset < data.length) {
            if (offset + RECORD_HEADER_SIZE > data.length) {
                throw new IllegalArgumentException("truncated record header");
            }
            int port = data[offset] & 0xFF;
            int delta = readInt32LE(data, offset + 1);
            int length = readUInt16LE(data, offset + 5);
            offset += RECORD_HEADER_SIZE;
            if (length > MAX_PAYLOAD_LENGTH) {
                throw new IllegalArgumentException("record length " + length + " exceeds cap " + MAX_PAYLOAD_LENGTH);
            }
            if (offset + length > data.length) {
                throw new IllegalArgumentException("truncated record payload");
            }
            records.add(new LogRecord(port, delta, length, Arrays.copyOfRange(data, offset, offset + length)));
            offset += length;
        }
        return new LogReadResult(header, records);
    }

    public static void writeLogFile(String path, LogHeader header, List<LogRecord> records, boolean hasMouse, boolean hasKeyboard) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        output.write((MAGIC_V2.equals(header.version()) ? MAGIC_V2 : MAGIC_V1).getBytes(StandardCharsets.US_ASCII));
        if (MAGIC_V2.equals(header.version())) {
            writeUInt16LE(output, header.meta().width());
            writeUInt16LE(output, header.meta().height());
            writeUInt16LE(output, header.meta().startX());
            writeUInt16LE(output, header.meta().startY());
            writeInt32LE(output, 0);
        }
        for (LogRecord record : records) {
            output.write(record.port() & 0xFF);
            writeInt32LE(output, record.delta());
            writeUInt16LE(output, record.length());
            output.write(record.payload(), 0, record.payload().length);
        }
        if (hasMouse) {
            for (int index = 0; index < 3; index++) {
                output.write(1);
                writeInt32LE(output, 8);
                writeUInt16LE(output, 5);
                output.write(new byte[5], 0, 5);
            }
        }
        if (hasKeyboard) {
            output.write(2);
            writeInt32LE(output, 8);
            writeUInt16LE(output, 8);
            output.write(new byte[8], 0, 8);
        }
        Files.write(Path.of(path), output.toByteArray());
    }

    public static Envelope logToJson(LogHeader header, List<LogRecord> records) {
        Envelope envelope = new Envelope(
            "mkp-action-v1",
            header.version(),
            new MetaJson(header.meta().width(), header.meta().height(), header.meta().startX(), header.meta().startY()),
            new ArrayList<>()
        );

        int prevButton = 0;
        int prevModifier = 0;
        int[] prevKeys = new int[KBD_MAX_KEYS];
        int ts = 0;

        for (LogRecord record : records) {
            ts += record.delta();
            if (record.port() == 1 && record.length() == 5) {
                MouseReport report = mouseDecode(Arrays.copyOf(record.payload(), 5));
                prevButton = emitMouseEvents(envelope, report, prevButton, ts);
            } else if (record.port() == 2 && record.length() == 8 && record.payload().length >= 8) {
                prevModifier = emitKeyboardEvents(envelope, record.payload()[0] & 0xFF, extractKeyCodes(record.payload()), prevModifier, prevKeys, ts);
            }
        }

        return envelope;
    }

    public static JsonToLogResult jsonToLog(Envelope envelope) {
        String version = MAGIC_V1;
        if (MAGIC_V1.equals(envelope.version()) || MAGIC_V2.equals(envelope.version())) {
            version = envelope.version();
        }

        LogHeader header = new LogHeader(
            version,
            new Meta(envelope.meta().width(), envelope.meta().height(), envelope.meta().startX() & 0xFFFF, envelope.meta().startY() & 0xFFFF)
        );

        List<LogRecord> records = new ArrayList<>();
        int currentButton = 0;
        int prevModifier = 0;
        int[] prevKeys = new int[KBD_MAX_KEYS];
        int prevTs = 0;
        boolean first = true;
        boolean hasMouse = false;
        boolean hasKeyboard = false;

        for (int index = 0; index < envelope.events().size(); index++) {
            Event event = envelope.events().get(index);
            int ts = event.timestamp();
            int delta = first ? ts : ts - prevTs;
            if (delta < 0) {
                delta = 0;
            }
            first = false;
            prevTs = ts;

            if (event.mouseMove() != null) {
                MouseMoveEvent mouseMove = event.mouseMove();
                records.add(new LogRecord(1, delta, 5, mouseEncode(currentButton, mouseMove.x(), mouseMove.y(), 0)));
                hasMouse = true;
            } else if (event.mouseDown() != null) {
                ButtonEvent mouseDown = event.mouseDown();
                currentButton |= buttonBit(mouseDown.button());
                records.add(new LogRecord(1, delta, 5, mouseEncode(currentButton, 0, 0, 0)));
                hasMouse = true;
            } else if (event.mouseUp() != null) {
                ButtonEvent mouseUp = event.mouseUp();
                currentButton &= ~buttonBit(mouseUp.button()) & 0xFF;
                records.add(new LogRecord(1, delta, 5, mouseEncode(currentButton, 0, 0, 0)));
                hasMouse = true;
            } else if (event.wheel() != null) {
                WheelEvent wheel = event.wheel();
                records.add(new LogRecord(1, delta, 5, mouseEncode(currentButton, 0, 0, wheel.delta())));
                hasMouse = true;
            } else if (event.keyDown() != null) {
                prevModifier = applyKeyboardNames(prevModifier, prevKeys, event.keyDown().keys(), true, index, "KeyDown");
                records.add(new LogRecord(2, delta, 8, buildKeyboardReport(prevModifier, prevKeys)));
                hasKeyboard = true;
            } else if (event.keyUp() != null) {
                prevModifier = applyKeyboardNames(prevModifier, prevKeys, event.keyUp().keys(), false, index, "KeyUp");
                records.add(new LogRecord(2, delta, 8, buildKeyboardReport(prevModifier, prevKeys)));
                hasKeyboard = true;
            }
        }

        return new JsonToLogResult(header, records, hasMouse, hasKeyboard);
    }

    public static void convertLogFileToJsonFile(String inputPath, String outputPath) throws IOException {
        LogReadResult result = readLogFile(inputPath);
        writeJsonFile(outputPath, logToJson(result.header(), result.records()));
    }

    public static JsonToLogResult convertJsonFileToLogFile(String inputPath, String outputPath) throws IOException {
        Envelope envelope = readJsonFile(inputPath);
        JsonToLogResult result = jsonToLog(envelope);
        writeLogFile(outputPath, result.header(), result.records(), result.hasMouse(), result.hasKeyboard());
        return result;
    }

    private static int emitMouseEvents(Envelope envelope, MouseReport report, int prevButton, int ts) {
        if (report.x() != 0 || report.y() != 0) {
            envelope.events().add(Event.mouseMove(new MouseMoveEvent(report.x(), report.y(), ts)));
        }

        int down = report.button() & (~prevButton & 0xFF);
        int up = prevButton & (~report.button() & 0xFF);
        for (int bit : List.of(MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE)) {
            String name = buttonName(bit);
            if (name.isEmpty()) {
                continue;
            }
            if ((down & bit) != 0) {
                envelope.events().add(Event.mouseDown(new ButtonEvent(name, ts)));
            }
            if ((up & bit) != 0) {
                envelope.events().add(Event.mouseUp(new ButtonEvent(name, ts)));
            }
        }

        if (report.wheel() != 0) {
            envelope.events().add(Event.wheel(new WheelEvent(report.wheel(), ts)));
        }

        return report.button();
    }

    private static int emitKeyboardEvents(Envelope envelope, int modifier, int[] keys, int prevModifier, int[] prevKeys, int ts) {
        List<String> downNames = new ArrayList<>();
        List<String> upNames = new ArrayList<>();
        int modDown = (modifier ^ prevModifier) & modifier;
        int modUp = (modifier ^ prevModifier) & prevModifier;

        for (int bit = 0; bit < 8; bit++) {
            if ((modDown & (1 << bit)) != 0) {
                downNames.add(MOD_BIT_TO_NAME[bit]);
            }
            if ((modUp & (1 << bit)) != 0) {
                upNames.add(MOD_BIT_TO_NAME[bit]);
            }
        }

        for (int key : keys) {
            if (key != 0 && !contains(prevKeys, key)) {
                downNames.add(scanName(key));
            }
        }

        for (int key : prevKeys) {
            if (key != 0 && !contains(keys, key)) {
                upNames.add(scanName(key));
            }
        }

        if (!downNames.isEmpty()) {
            envelope.events().add(Event.keyDown(new KeyEvent(downNames, ts)));
        }
        if (!upNames.isEmpty()) {
            envelope.events().add(Event.keyUp(new KeyEvent(upNames, ts)));
        }

        System.arraycopy(keys, 0, prevKeys, 0, KBD_MAX_KEYS);
        return modifier;
    }

    private static int applyKeyboardNames(int modifier, int[] keys, List<String> names, boolean isDown, int index, String kind) {
        for (String name : names) {
            if (isModName(name)) {
                int bit = modBit(name);
                modifier = isDown ? (modifier | bit) : (modifier & (~bit & 0xFF));
                continue;
            }

            int code = scanCode(name);
            if (code == 0 && !"none".equalsIgnoreCase(name)) {
                throw new IllegalArgumentException("event " + index + " " + kind + ": unknown key name '" + name + "'");
            }

            if (isDown) {
                if (contains(keys, code)) {
                    continue;
                }
                boolean placed = false;
                for (int slot = 0; slot < keys.length; slot++) {
                    if (keys[slot] == 0) {
                        keys[slot] = code;
                        placed = true;
                        break;
                    }
                }
                if (!placed) {
                    throw new IllegalArgumentException("too many simultaneous keys: " + String.join(",", names));
                }
            } else {
                for (int slot = 0; slot < keys.length; slot++) {
                    if (keys[slot] == code) {
                        keys[slot] = 0;
                    }
                }
            }
        }

        return modifier;
    }

    private static byte[] buildKeyboardReport(int modifier, int[] keys) {
        return new byte[] {
            (byte) modifier,
            0,
            (byte) keys[0],
            (byte) keys[1],
            (byte) keys[2],
            (byte) keys[3],
            (byte) keys[4],
            (byte) keys[5]
        };
    }

    private static int scanCode(String name) {
        String normalized = Keycodes.normalizeKpadKey(name);
        if (Keycodes.isModKey(normalized)) {
            return 0;
        }
        return Keycodes.KEY_NAME_TO_NCODE.getOrDefault(normalized, 0);
    }

    private static String scanName(int code) {
        for (Map.Entry<String, Integer> pair : Keycodes.KEY_NAME_TO_NCODE.entrySet()) {
            if (pair.getValue() == code && !Keycodes.isModKey(pair.getKey()) && !"NONE".equals(pair.getKey())) {
                return pair.getKey().toLowerCase(Locale.ROOT);
            }
        }
        return "";
    }

    private static boolean isModName(String name) {
        return Keycodes.isModKey(name) || Keycodes.isModKey(Keycodes.normalizeKpadKey(name));
    }

    private static int modBit(String name) {
        return Keycodes.KEY_NAME_TO_NCODE.getOrDefault(Keycodes.normalizeKpadKey(name), 0);
    }

    private static int buttonBit(String name) {
        return switch (name.trim().toLowerCase(Locale.ROOT)) {
            case "left" -> MOUSE_BUTTON_LEFT;
            case "right" -> MOUSE_BUTTON_RIGHT;
            case "middle" -> MOUSE_BUTTON_MIDDLE;
            default -> throw new IllegalArgumentException("unknown button '" + name + "'");
        };
    }

    private static String buttonName(int bit) {
        return switch (bit) {
            case MOUSE_BUTTON_LEFT -> "left";
            case MOUSE_BUTTON_RIGHT -> "right";
            case MOUSE_BUTTON_MIDDLE -> "middle";
            default -> "";
        };
    }

    private static List<String> readKeys(JsonNode node) {
        List<String> out = new ArrayList<>();
        if (node != null && node.isArray()) {
            for (JsonNode item : node) {
                out.add(item.asText(""));
            }
        }
        return out;
    }

    private static int[] extractKeyCodes(byte[] payload) {
        return new int[] {
            payload[2] & 0xFF,
            payload[3] & 0xFF,
            payload[4] & 0xFF,
            payload[5] & 0xFF,
            payload[6] & 0xFF,
            payload[7] & 0xFF
        };
    }

    private static boolean contains(int[] values, int target) {
        for (int value : values) {
            if (value == target) {
                return true;
            }
        }
        return false;
    }

    private static int readUInt16LE(byte[] data, int offset) {
        return (data[offset] & 0xFF) | ((data[offset + 1] & 0xFF) << 8);
    }

    private static int readInt32LE(byte[] data, int offset) {
        return (data[offset] & 0xFF)
            | ((data[offset + 1] & 0xFF) << 8)
            | ((data[offset + 2] & 0xFF) << 16)
            | ((data[offset + 3] & 0xFF) << 24);
    }

    private static void writeUInt16LE(ByteArrayOutputStream output, int value) {
        output.write(value & 0xFF);
        output.write((value >> 8) & 0xFF);
    }

    private static void writeInt32LE(ByteArrayOutputStream output, int value) {
        output.write(value & 0xFF);
        output.write((value >> 8) & 0xFF);
        output.write((value >> 16) & 0xFF);
        output.write((value >> 24) & 0xFF);
    }
}
