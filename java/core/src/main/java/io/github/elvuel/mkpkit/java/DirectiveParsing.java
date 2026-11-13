package io.github.elvuel.mkpkit.java;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.BiFunction;

public final class DirectiveParsing {
    public static final String EOF_DEFAULT = "<EOF>";
    public static final String EOF_CLI = "cli>";

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private DirectiveParsing() {
    }

    public interface DirectiveParser {
        String name();

        String eofFlag();

        Object parse(String cli, String raw);
    }

    public static final class SimpleDirectiveParser implements DirectiveParser {
        private final String name;
        private final String eofFlag;
        private final BiFunction<String, String, Object> parse;

        public SimpleDirectiveParser(String name, String eofFlag, BiFunction<String, String, Object> parse) {
            this.name = Objects.requireNonNull(name, "name");
            this.eofFlag = Objects.requireNonNull(eofFlag, "eofFlag");
            this.parse = Objects.requireNonNull(parse, "parse");
        }

        @Override
        public String name() {
            return name;
        }

        @Override
        public String eofFlag() {
            return eofFlag;
        }

        @Override
        public Object parse(String cli, String raw) {
            return parse.apply(cli, raw);
        }
    }

    public static final class Registry {
        private final Map<String, DirectiveParser> parsers = new LinkedHashMap<>();

        public Registry register(DirectiveParser parser) {
            parsers.put(parser.name().toLowerCase(Locale.ROOT), parser);
            return this;
        }

        public DirectiveParser resolve(String directive) {
            DirectiveParser parser = parsers.get(directiveName(directive).toLowerCase(Locale.ROOT));
            if (parser == null) {
                throw new DirectiveParseFailedException(directive, "parser-not-registered");
            }
            return parser;
        }

        public Optional<DirectiveParser> tryResolve(String directive) {
            return Optional.ofNullable(parsers.get(directiveName(directive).toLowerCase(Locale.ROOT)));
        }
    }

    public static final class DirectiveParseFailedException extends RuntimeException {
        public DirectiveParseFailedException(String directive, String reason) {
            super("directive parse failed: " + directive + ": " + reason);
        }
    }

    public static final class DirectiveExecutionFailedException extends RuntimeException {
        public DirectiveExecutionFailedException(String directive) {
            super("directive execution failed: " + directive);
        }
    }

    public static final class RawDirectiveParseFailedException extends RuntimeException {
        public RawDirectiveParseFailedException(String kind) {
            super(kind);
        }
    }

    public static Registry createDefaultRegistry() {
        return new Registry()
            .register(new SimpleDirectiveParser("astop", EOF_CLI, (cli, raw) -> parseTextSuccess("astop", cli, raw, EOF_CLI)))
            .register(new SimpleDirectiveParser("acancel", EOF_DEFAULT, (cli, raw) -> parseRawJsonText(cli, raw, EOF_DEFAULT, true)))
            .register(new SimpleDirectiveParser("sn", EOF_DEFAULT, (cli, raw) -> parseSn(parseJsonNode(cli, raw, EOF_DEFAULT))))
            .register(new SimpleDirectiveParser("list_dir", EOF_DEFAULT, (cli, raw) -> parseFileSystem(parseJsonNode(cli, raw, EOF_DEFAULT))))
            .register(new SimpleDirectiveParser("clean_dir", EOF_CLI, (cli, raw) -> parsePlainSuccess("clean_dir", cli, raw, EOF_CLI)))
            .register(new SimpleDirectiveParser("delete_file", EOF_CLI, (cli, raw) -> parsePlainSuccess("delete_file", cli, raw, EOF_CLI)))
            .register(new SimpleDirectiveParser("alive", EOF_DEFAULT, (cli, raw) -> parseHeartbeat(parseJsonNode(cli, raw, EOF_DEFAULT))))
            .register(new SimpleDirectiveParser("atime", EOF_DEFAULT, (cli, raw) -> parseLogLength(parseLineJson(cli, raw, EOF_DEFAULT, List.of("\"seconds\":")))))
            .register(new SimpleDirectiveParser("aversion", EOF_DEFAULT, (cli, raw) -> parseVersion(parseJsonNode(cli, raw, EOF_DEFAULT))))
            .register(new SimpleDirectiveParser("ainsp", EOF_DEFAULT, (cli, raw) -> parseLogInfo(parseLineJson(cli, raw, EOF_DEFAULT, List.of("\"seconds\":", "\"width\":")))))
            .register(new SimpleDirectiveParser("join", EOF_CLI, (cli, raw) -> parseJoin("join", raw)))
            .register(new SimpleDirectiveParser("wifi_auto", EOF_CLI, DirectiveParsing::parseWifiAuto))
            .register(new SimpleDirectiveParser("adumj", EOF_CLI, (cli, raw) -> parseActionDump(parseOptionalJsonNode(cli, raw, EOF_CLI))))
            .register(new SimpleDirectiveParser("ahttpbase", EOF_CLI, DirectiveParsing::parseAHttpBase))
            .register(new SimpleDirectiveParser("aget", EOF_CLI, (cli, raw) -> parseAGet("aget", cli, raw)))
            .register(new SimpleDirectiveParser("aput", EOF_CLI, (cli, raw) -> parseAPut("aput", cli, raw)))
            .register(new SimpleDirectiveParser("ajson2log", EOF_CLI, (cli, raw) -> parseAJson2Log("ajson2log", cli, raw)))
            .register(new SimpleDirectiveParser("alog", EOF_CLI, (cli, raw) -> parsePlainSuccess("alog", cli, raw, EOF_CLI)));
    }

    public static String directiveName(String directive) {
        String trimmed = directive == null ? "" : directive.trim();
        if (trimmed.isEmpty()) {
            return "";
        }
        int space = trimmed.indexOf(' ');
        return space >= 0 ? trimmed.substring(0, space) : trimmed;
    }

    public static String preflight(String data, String eofFlag) {
        String current = sanitizeCarriageReturns(data).trim();
        if (EOF_CLI.equals(eofFlag)) {
            current = current.replaceFirst("cli>\\s*$", "").trim();
        } else {
            current = current.replaceFirst("<EOF>\\s*$", "").trim();
            current = current.replaceFirst("cli>\\s*$", "").trim();
        }
        return current;
    }

    public static String trimCliOutput(String data, String cli) {
        int hitIndex = data.indexOf(cli);
        String current = hitIndex >= 0 ? data.substring(hitIndex + cli.length()) : data;
        return current.replaceFirst("^\\n+", "").trim();
    }

    public static String extractJsonBlob(String raw) {
        String text = raw.trim();
        int startCurly = text.indexOf('{');
        int startSquare = text.indexOf('[');
        int start;
        if (startCurly < 0 && startSquare < 0) {
            throw new RawDirectiveParseFailedException("json");
        } else if (startCurly < 0) {
            start = startSquare;
        } else if (startSquare < 0) {
            start = startCurly;
        } else {
            start = Math.min(startCurly, startSquare);
        }

        int depth = 0;
        boolean quote = false;
        boolean escape = false;
        for (int index = start; index < text.length(); index++) {
            char ch = text.charAt(index);
            if (quote) {
                if (escape) {
                    escape = false;
                } else if (ch == '\\') {
                    escape = true;
                } else if (ch == '"') {
                    quote = false;
                }
                continue;
            }

            if (ch == '"') {
                quote = true;
                continue;
            }
            if (ch == '{' || ch == '[') {
                depth++;
                continue;
            }
            if (ch == '}' || ch == ']') {
                depth--;
                if (depth == 0) {
                    return text.substring(start, index + 1);
                }
            }
        }
        throw new RawDirectiveParseFailedException("json");
    }

    public static JsonNode parseJsonNode(String cli, String data, String eofFlag) {
        String normalized = trimCliOutput(preflight(data, eofFlag), cli);
        return readJson(extractJsonBlob(normalized));
    }

    public static JsonNode parseOptionalJsonNode(String cli, String data, String eofFlag) {
        String normalized = trimCliOutput(preflight(data, eofFlag), cli);
        if (normalized.isBlank()) {
            return MAPPER.nullNode();
        }
        return readJson(extractJsonBlob(normalized));
    }

    public static Object parseRawJsonText(String cli, String data, String eofFlag, boolean allowEmpty) {
        String normalized = trimCliOutput(preflight(data, eofFlag), cli);
        if (normalized.isBlank() && allowEmpty) {
            return "";
        }
        try {
            return readJson(extractJsonBlob(normalized));
        } catch (RuntimeException error) {
            if (normalized.isBlank() && allowEmpty) {
                return "";
            }
            return readJson(normalized);
        }
    }

    public static JsonNode parseLineJson(String cli, String data, String eofFlag, List<String> requiredFragments) {
        String normalized = trimCliOutput(preflight(data, eofFlag), cli);
        for (String line : normalized.split("\\n")) {
            String candidate = line.trim();
            if (!(candidate.startsWith("{") || candidate.startsWith("["))) {
                continue;
            }
            boolean matched = requiredFragments.isEmpty() || requiredFragments.stream().allMatch(candidate::contains);
            if (matched) {
                return readJson(candidate);
            }
        }
        return readJson(extractJsonBlob(normalized));
    }

    public static String parseTextSuccess(String name, String cli, String raw, String eofFlag) {
        String normalized = trimCliOutput(preflight(raw, eofFlag), cli);
        if (normalized.isBlank()) {
            throw new DirectiveParseFailedException(name, "empty-output");
        }
        return normalized;
    }

    public static String parsePlainSuccess(String name, String cli, String raw, String eofFlag) {
        return parseTextSuccess(name, cli, raw, eofFlag);
    }

    public static String parseJoin(String name, String raw) {
        String lowered = preflight(raw, EOF_CLI).toLowerCase(Locale.ROOT);
        if (lowered.contains("connected")) {
            return "connected";
        }
        if (lowered.contains("connecting to")) {
            return "connecting";
        }
        throw new DirectiveParseFailedException(name, "join-status-not-found");
    }

    public static String parseWifiAuto(String cli, String raw) {
        String normalized = preflight(raw, EOF_CLI);
        String value = normalized.startsWith(cli) ? normalized.substring(cli.length()).trim().toLowerCase(Locale.ROOT) : normalized.trim().toLowerCase(Locale.ROOT);
        if (value.contains("auto: on")) {
            return "on";
        }
        if (value.contains("auto: off")) {
            return "off";
        }
        return "";
    }

    public static Models.AHttpBase parseAHttpBase(String cli, String raw) {
        String data = preflight(raw, EOF_CLI);
        try {
            return parseAHttpBaseNode(readJson(extractJsonBlob(data)));
        } catch (RuntimeException error) {
            String normalized = trimCliOutput(sanitizeCarriageReturns(data), cli);
            if ("OK".equalsIgnoreCase(normalized)) {
                String url = cli.toLowerCase(Locale.ROOT).startsWith("ahttpbase") ? cli.substring("ahttpbase".length()).trim() : "";
                return new Models.AHttpBase(url);
            }
            for (String line : normalized.split("\\n")) {
                String candidate = line.trim();
                if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
                    return new Models.AHttpBase(candidate);
                }
            }
            throw new DirectiveParseFailedException("ahttpbase", "json-or-ok-not-found");
        }
    }

    public static String parseAGet(String name, String cli, String raw) {
        String normalized = trimCliOutput(preflight(raw, EOF_CLI), cli);
        String lowered = normalized.toLowerCase(Locale.ROOT);
        if (lowered.contains("error code") || lowered.contains("server returned status")) {
            throw new DirectiveExecutionFailedException(name);
        }
        if (normalized.contains("GET status=200")) {
            return normalized;
        }
        if (normalized.contains("GET status=")) {
            throw new DirectiveExecutionFailedException(name);
        }
        if (normalized.isBlank()) {
            throw new DirectiveParseFailedException(name, "empty-output");
        }
        throw new DirectiveParseFailedException(name, "unexpected-aget-output");
    }

    public static String parseAPut(String name, String cli, String raw) {
        String normalized = trimCliOutput(preflight(raw, EOF_CLI), cli);
        String lowered = normalized.toLowerCase(Locale.ROOT);
        if (lowered.contains("upload failed") || lowered.contains("failed to open file") || lowered.contains("error code")) {
            throw new DirectiveExecutionFailedException(name);
        }
        if (normalized.contains("Upload OK")) {
            return normalized;
        }
        if (normalized.isBlank()) {
            throw new DirectiveParseFailedException(name, "empty-output");
        }
        throw new DirectiveParseFailedException(name, "unexpected-aput-output");
    }

    public static String parseAJson2Log(String name, String cli, String raw) {
        String normalized = trimCliOutput(preflight(raw, EOF_CLI), cli);
        if (normalized.toLowerCase(Locale.ROOT).contains("error code")) {
            throw new DirectiveExecutionFailedException(name);
        }
        if (normalized.isBlank()) {
            throw new DirectiveParseFailedException(name, "empty-output");
        }
        return normalized;
    }

    private static Models.SN parseSn(JsonNode root) {
        return new Models.SN(text(root, "sn"));
    }

    private static Models.Heartbeat parseHeartbeat(JsonNode root) {
        return new Models.Heartbeat(root.path("timetamp").asLong());
    }

    private static Models.MkpVersion parseVersion(JsonNode root) {
        return new Models.MkpVersion(optText(root, "app"), optText(root, "boot"), optText(root, "hw"), root.deepCopy());
    }

    private static Models.LogLength parseLogLength(JsonNode root) {
        return new Models.LogLength(root.path("seconds").asInt(), root.path("milsec").asInt());
    }

    private static Models.LogInfo parseLogInfo(JsonNode root) {
        return new Models.LogInfo(optText(root, "name"), optText(root, "path"), optLong(root, "size"), root.deepCopy());
    }

    private static Models.AHttpBase parseAHttpBaseNode(JsonNode root) {
        String value = optText(root, "ahttpbase");
        if (value == null || value.isBlank()) {
            value = optText(root, "url");
        }
        return new Models.AHttpBase(value == null ? "" : value);
    }

    private static Models.FileSystem parseFileSystem(JsonNode root) {
        Models.FileNode node = root.hasNonNull("rootDir") ? parseFileNode(root.get("rootDir")) : null;
        return new Models.FileSystem(node, optText(root, "error"), root.deepCopy());
    }

    private static Models.ActionDump parseActionDump(JsonNode root) {
        if (root == null || root.isNull() || root.isMissingNode()) {
            return new Models.ActionDump(List.of(), Map.of(), MAPPER.nullNode());
        }
        List<Object> actions = root.has("actions") && !root.get("actions").isNull()
            ? MAPPER.convertValue(root.get("actions"), new TypeReference<List<Object>>() { })
            : List.of();
        Map<String, Object> meta = root.has("meta") && !root.get("meta").isNull()
            ? MAPPER.convertValue(root.get("meta"), new TypeReference<Map<String, Object>>() { })
            : Map.of();
        return new Models.ActionDump(actions, meta, root.deepCopy());
    }

    private static Models.FileNode parseFileNode(JsonNode root) {
        List<Models.FileNode> contents = new ArrayList<>();
        JsonNode childNodes = root.get("contents");
        if (childNodes != null && childNodes.isArray()) {
            for (JsonNode item : childNodes) {
                contents.add(parseFileNode(item));
            }
        }
        return new Models.FileNode(
            text(root, "name"),
            optText(root, "path"),
            optText(root, "type"),
            optLong(root, "size"),
            optText(root, "displayName"),
            List.copyOf(contents)
        );
    }

    private static JsonNode readJson(String text) {
        try {
            return MAPPER.readTree(text);
        } catch (IOException error) {
            throw new RawDirectiveParseFailedException("json");
        }
    }

    private static String sanitizeCarriageReturns(String value) {
        return value == null ? "" : value.replace("\r", "");
    }

    private static String text(JsonNode root, String field) {
        String value = optText(root, field);
        if (value == null) {
            throw new DirectiveParseFailedException(field, "missing-field");
        }
        return value;
    }

    private static String optText(JsonNode root, String field) {
        JsonNode node = root.get(field);
        if (node == null || node.isNull() || node.isMissingNode()) {
            return null;
        }
        return node.asText();
    }

    private static Long optLong(JsonNode root, String field) {
        JsonNode node = root.get(field);
        if (node == null || node.isNull() || node.isMissingNode()) {
            return null;
        }
        return node.asLong();
    }
}
