package io.github.elvuel.mkpkit.java.client;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.elvuel.mkpkit.java.MkpJavaInfo;
import java.io.IOException;
import java.io.PrintWriter;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public final class ClientRunner {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Duration VERSION_CACHE_TTL = Duration.ofMinutes(5);
    private static final String DEFAULT_SERVER = "http://127.0.0.1:8080";

    private ClientRunner() {
    }

    public static int run(String[] argv, PrintWriter out, PrintWriter err) {
        try {
            GlobalFlags globals = parseGlobalFlags(argv);
            if (globals.commandIndex < 0) {
                out.println(usage());
                return 0;
            }
            String command = argv[globals.commandIndex];
            if ("help".equals(command) || "--help".equals(command) || "-h".equals(command)) {
                out.println(usage());
                return 0;
            }

            RuntimeConfig runtime = buildRuntime(globals);
            String[] rest = slice(argv, globals.commandIndex + 1);
            String output;
            if ("auth".equals(command)) {
                String sub = rest.length > 0 ? rest[0] : "";
                ParsedArgs parsed = parseArgs(slice(rest, 1));
                output = switch (sub) {
                    case "login" -> executeAuthLogin(parsed, runtime);
                    case "token" -> executeAuthToken(runtime);
                    case "revoke" -> executeAuthRevoke(parsed, runtime);
                    default -> throw new IllegalArgumentException("unknown auth subcommand: " + sub);
                };
            } else {
                ParsedArgs parsed = parseArgs(rest);
                output = switch (command) {
                    case "list", "l" -> executeList(parsed, runtime);
                    case "recording", "record", "r" -> executeRecording(parsed, runtime);
                    case "remove" -> executeRemove(parsed, runtime);
                    case "replay" -> executeReplay(parsed, runtime);
                    case "stop", "s" -> executeStop(runtime);
                    case "version" -> executeVersion(runtime);
                    default -> throw new IllegalArgumentException("unknown command: " + command);
                };
            }

            if (!output.isBlank()) {
                out.println(output);
            }
            return 0;
        } catch (Exception error) {
            err.println(error.getMessage());
            return 1;
        }
    }

    public static String usage() {
        return String.join("\n",
            "Usage:",
            "  mkpkit-java-client [global flags] <command> [subcommand] [flags]",
            "",
            "Commands:",
            "  auth login [--username <user>] [--password <pass>]",
            "  auth token",
            "  auth revoke [--forget]",
            "  list [-l 10] [-n name]",
            "  recording [-n name] [--width 0] [--height 0] [--stposx 0] [--stposy 0]",
            "  remove -i <record-id>",
            "  replay -i <record-id>",
            "  stop",
            "  version",
            "",
            "Global flags:",
            "  -s, --server <url>",
            "  --mode <debug|release>",
            "  --token <jwt>",
            "  --username <name>",
            "  --password <password>",
            "  --config <path>",
            "  --timeout <ms>",
            "  -h, --help"
        );
    }

    private static String executeAuthLogin(ParsedArgs parsed, RuntimeConfig runtime) throws Exception {
        String username = value(parsed, "--username", runtime.username);
        String password = value(parsed, "--password", runtime.password);
        if (username.isBlank() || password.isBlank()) {
            throw new IllegalArgumentException("username/password are required");
        }
        Map<String, Object> response = request(runtime, "POST", "/api/v1/auth/token", Map.of("username", username, "password", password), false);
        String token = String.valueOf(response.getOrDefault("token", ""));
        int expiresIn = ((Number) response.getOrDefault("expires_in", 0)).intValue();
        ClientConfig saved = loadClientConfig(runtime.configPath);
        saved.server_addr = runtime.serverAddr;
        saved.mode = runtime.mode;
        saved.username = username;
        saved.password = password;
        saved.token = token;
        saved.token_expires_at = Instant.now().plusSeconds(expiresIn).toString();
        saved.timeout_seconds = (int) Math.ceil(runtime.timeoutMs / 1000.0);
        saveClientConfig(runtime.configPath, saved);
        runtime.token = token;
        return "token saved (expires at " + saved.token_expires_at + ")";
    }

    private static String executeAuthToken(RuntimeConfig runtime) throws Exception {
        return runtime.token.isBlank() ? ensureManagedToken(runtime, false) : runtime.token;
    }

    private static String executeAuthRevoke(ParsedArgs parsed, RuntimeConfig runtime) throws Exception {
        boolean forget = parsed.switches.contains("--forget");
        ClientConfig saved = loadClientConfig(runtime.configPath);
        saved.token = "";
        saved.token_expires_at = "";
        if (forget) {
            saved.username = "";
            saved.password = "";
        }
        saveClientConfig(runtime.configPath, saved);
        return forget ? "local token and credentials cleared" : "local token cleared";
    }

    private static String executeList(ParsedArgs parsed, RuntimeConfig runtime) throws Exception {
        int limits = parsePositiveInt(value(parsed, "--limits", "10"), "limits");
        String name = value(parsed, "--name", "");
        String path = "/api/v1/directives/list?limits=" + limits + (name.isBlank() ? "" : "&name=" + name);
        Map<String, Object> response = request(runtime, "GET", path, null, true);
        Object rawRecords = response.get("records");
        if (!(rawRecords instanceof List<?> records) || records.isEmpty()) {
            return "No records found";
        }
        List<String> lines = new ArrayList<>();
        lines.add("| Name | RID | Location | Length | Created At |");
        lines.add("| --- | --- | --- | --- | --- |");
        for (Object item : records) {
            if (!(item instanceof Map<?, ?> record)) {
                continue;
            }
            lines.add("| "
                + esc(record.get("name")) + " | "
                + esc(record.get("unique_id")) + " | "
                + esc(record.get("mkp_path")) + " | "
                + esc(String.valueOf(record.containsKey("seconds") ? record.get("seconds") : 0) + "s " + String.valueOf(record.containsKey("milliseconds") ? record.get("milliseconds") : 0) + "ms") + " | "
                + esc(record.get("created_at")) + " |");
        }
        return String.join("\n", lines);
    }

    private static String executeRecording(ParsedArgs parsed, RuntimeConfig runtime) throws Exception {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("log_name", value(parsed, "--name", "mkp-" + Instant.now().toString().replace(':', '-')));
        payload.put("width", parseOptionalInt(valueOrNull(parsed, "--width"), 0));
        payload.put("height", parseOptionalInt(valueOrNull(parsed, "--height"), 0));
        if (valueOrNull(parsed, "--stposx") != null) payload.put("stposx", parseOptionalInt(valueOrNull(parsed, "--stposx"), 0));
        if (valueOrNull(parsed, "--stposy") != null) payload.put("stposy", parseOptionalInt(valueOrNull(parsed, "--stposy"), 0));
        return pretty(request(runtime, "POST", "/api/v1/directives/alog", payload, true));
    }

    private static String executeRemove(ParsedArgs parsed, RuntimeConfig runtime) throws Exception {
        return pretty(request(runtime, "DELETE", "/api/v1/directives/records/" + required(parsed, "--id"), null, true));
    }

    private static String executeReplay(ParsedArgs parsed, RuntimeConfig runtime) throws Exception {
        return pretty(request(runtime, "POST", "/api/v1/directives/aplay/" + required(parsed, "--id"), null, true));
    }

    private static String executeStop(RuntimeConfig runtime) throws Exception {
        return pretty(request(runtime, "POST", "/api/v1/directives/astop", null, true));
    }

    private static String executeVersion(RuntimeConfig runtime) throws Exception {
        ClientConfig saved = loadClientConfig(runtime.configPath);
        if (saved.version_cache != null && normalizeServer(saved.version_cache.server_addr).equals(normalizeServer(runtime.serverAddr))) {
            Instant cachedAt = parseInstant(saved.version_cache.cached_at);
            if (cachedAt != null && cachedAt.plus(VERSION_CACHE_TTL).isAfter(Instant.now()) && saved.version_cache.response != null) {
                return renderVersionTable(saved.version_cache.response);
            }
        }
        Map<String, Object> response = request(runtime, "GET", "/api/v1/version", null, false);
        ClientConfig.VersionCache cache = new ClientConfig.VersionCache();
        cache.server_addr = normalizeServer(runtime.serverAddr);
        cache.cached_at = Instant.now().toString();
        cache.response = response;
        saved.version_cache = cache;
        saveClientConfig(runtime.configPath, saved);
        return renderVersionTable(response);
    }

    private static Map<String, Object> request(RuntimeConfig runtime, String method, String path, Object payload, boolean requireAuth) throws Exception {
        boolean needsAuth = requireAuth && !"debug".equalsIgnoreCase(runtime.mode);
        String token = runtime.token;
        if (needsAuth && token.isBlank()) {
            token = ensureManagedToken(runtime, false);
        }
        Result result = doRequest(runtime, method, path, payload, needsAuth ? token : "");
        if (result.status == 401 && needsAuth && !runtime.explicitToken) {
            token = ensureManagedToken(runtime, true);
            result = doRequest(runtime, method, path, payload, token);
        }
        if (result.status >= 400) {
            throw new IllegalStateException(result.body.containsKey("error") ? String.valueOf(result.body.get("error")) : ("http " + result.status));
        }
        return result.body;
    }

    private static Result doRequest(RuntimeConfig runtime, String method, String path, Object payload, String token) throws Exception {
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofMillis(runtime.timeoutMs)).build();
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(normalizeServer(runtime.serverAddr) + path)).timeout(Duration.ofMillis(runtime.timeoutMs));
        builder.header("Accept", "application/json");
        if (!token.isBlank()) {
            builder.header("Authorization", "Bearer " + token);
        }
        if (payload == null) {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        } else {
            builder.header("Content-Type", "application/json");
            builder.method(method, HttpRequest.BodyPublishers.ofString(MAPPER.writeValueAsString(payload), StandardCharsets.UTF_8));
        }
        HttpResponse<String> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        Map<String, Object> body = response.body().isBlank()
            ? Map.of()
            : MAPPER.readValue(response.body(), new TypeReference<Map<String, Object>>() { });
        return new Result(response.statusCode(), body);
    }

    private static String ensureManagedToken(RuntimeConfig runtime, boolean forceRefresh) throws Exception {
        if (!forceRefresh && !runtime.token.isBlank() && runtime.tokenExpiresAt != null && runtime.tokenExpiresAt.isAfter(Instant.now().plusSeconds(30))) {
            return runtime.token;
        }
        if (runtime.username.isBlank() || runtime.password.isBlank()) {
            throw new IllegalStateException("missing auth credentials: run `mkpkit-java-client auth login` or pass --username/--password");
        }
        Map<String, Object> response = doRequest(runtime, "POST", "/api/v1/auth/token", Map.of("username", runtime.username, "password", runtime.password), "").body;
        String token = String.valueOf(response.getOrDefault("token", ""));
        int expiresIn = ((Number) response.getOrDefault("expires_in", 0)).intValue();
        runtime.token = token;
        runtime.tokenExpiresAt = Instant.now().plusSeconds(expiresIn);
        ClientConfig saved = loadClientConfig(runtime.configPath);
        saved.token = token;
        saved.token_expires_at = runtime.tokenExpiresAt.toString();
        saveClientConfig(runtime.configPath, saved);
        return token;
    }

    private static RuntimeConfig buildRuntime(GlobalFlags flags) throws Exception {
        String configPath = resolveConfigPath(flags.config);
        ClientConfig config = loadClientConfig(configPath);
        RuntimeConfig runtime = new RuntimeConfig();
        runtime.configPath = configPath;
        runtime.serverAddr = firstNonBlank(flags.server, System.getenv("MKP_SERVER"), config.server_addr, DEFAULT_SERVER);
        runtime.mode = firstNonBlank(flags.mode, config.mode, "release");
        runtime.username = firstNonBlank(flags.username, config.username, "");
        runtime.password = firstNonBlank(flags.password, config.password, "");
        runtime.token = firstNonBlank(flags.token, config.token, "");
        runtime.explicitToken = flags.token != null && !flags.token.isBlank();
        runtime.timeoutMs = flags.timeoutMs != null ? flags.timeoutMs : ((config.timeout_seconds == null || config.timeout_seconds <= 0) ? 10_000 : config.timeout_seconds * 1000L);
        runtime.tokenExpiresAt = parseInstant(config.token_expires_at);
        return runtime;
    }

    private static String resolveConfigPath(String explicit) {
        if (explicit != null && !explicit.isBlank()) {
            return explicit;
        }
        String env = System.getenv("MKP_CONFIG_PATH");
        if (env != null && !env.isBlank()) {
            return env;
        }
        Path local = Path.of(System.getProperty("user.dir"), "client.json");
        if (Files.exists(local)) {
            return local.toString();
        }
        return Path.of(System.getProperty("user.home"), ".mkp", "client.json").toString();
    }

    private static ClientConfig loadClientConfig(String path) throws IOException {
        Path target = Path.of(path);
        if (!Files.exists(target)) {
            return new ClientConfig();
        }
        String raw = Files.readString(target);
        return raw.isBlank() ? new ClientConfig() : MAPPER.readValue(raw, ClientConfig.class);
    }

    private static void saveClientConfig(String path, ClientConfig config) throws IOException {
        Path target = Path.of(path).toAbsolutePath().normalize();
        if (target.getParent() != null) {
            Files.createDirectories(target.getParent());
        }
        Files.writeString(target, MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(config));
    }

    private static String renderVersionTable(Map<String, Object> info) {
        List<String[]> rows = new ArrayList<>();
        rows.add(new String[] {"mkp agent server", String.valueOf(info.getOrDefault("mkp_server", "unknown"))});
        rows.add(new String[] {"mkp agent client", MkpJavaInfo.VERSION});
        Object deviceObject = info.get("mkp_device");
        if (deviceObject instanceof Map<?, ?> device) {
            for (String key : List.of("app", "boot", "hw", "uver", "aver")) {
                Object value = device.get(key);
                if (value instanceof String text && !text.isBlank()) {
                    rows.add(new String[] {"mkp device " + key, text});
                }
            }
        }
        List<String> lines = new ArrayList<>();
        lines.add("| Component | Version |");
        lines.add("| --- | --- |");
        for (String[] row : rows) {
            lines.add("| " + esc(row[0]) + " | " + esc(row[1]) + " |");
        }
        return String.join("\n", lines);
    }

    private static ParsedArgs parseArgs(String[] argv) {
        Map<String, String> flags = new LinkedHashMap<>();
        List<String> positionals = new ArrayList<>();
        List<String> switches = new ArrayList<>();
        for (int index = 0; index < argv.length; index++) {
            String token = normalizeArg(argv[index]);
            if (token.startsWith("--") || token.startsWith("-")) {
                if (index + 1 < argv.length && !argv[index + 1].startsWith("-")) {
                    flags.put(token, argv[++index]);
                } else {
                    switches.add(token);
                }
                continue;
            }
            positionals.add(argv[index]);
        }
        return new ParsedArgs(flags, positionals, switches);
    }

    private static GlobalFlags parseGlobalFlags(String[] argv) {
        GlobalFlags flags = new GlobalFlags();
        for (int index = 0; index < argv.length; index++) {
            String token = normalizeArg(argv[index]);
            if (!token.startsWith("-") || isCommandToken(token)) {
                flags.commandIndex = index;
                break;
            }
            switch (token) {
                case "--help" -> {
                    flags.commandIndex = index;
                    return flags;
                }
                case "--server", "--mode", "--token", "--username", "--password", "--config", "--timeout" -> {
                    if (index + 1 >= argv.length) {
                        throw new IllegalArgumentException("missing value for " + token);
                    }
                    String value = argv[++index];
                    switch (token) {
                        case "--server" -> flags.server = value;
                        case "--mode" -> flags.mode = value;
                        case "--token" -> flags.token = value;
                        case "--username" -> flags.username = value;
                        case "--password" -> flags.password = value;
                        case "--config" -> flags.config = value;
                        case "--timeout" -> flags.timeoutMs = Long.parseLong(value);
                        default -> {
                        }
                    }
                }
                default -> throw new IllegalArgumentException("unknown flag: " + token);
            }
        }
        return flags;
    }

    private static boolean isCommandToken(String token) {
        return switch (token) {
            case "auth", "list", "l", "recording", "record", "r", "remove", "replay", "stop", "s", "version", "help" -> true;
            default -> false;
        };
    }

    private static String normalizeArg(String raw) {
        return switch (raw) {
            case "-s" -> "--server";
            case "-h" -> "--help";
            case "-l" -> "--limits";
            case "-n" -> "--name";
            case "-i" -> "--id";
            default -> raw;
        };
    }

    private static String value(ParsedArgs parsed, String name, String defaultValue) {
        return parsed.flags.getOrDefault(name, defaultValue == null ? "" : defaultValue);
    }

    private static String valueOrNull(ParsedArgs parsed, String name) {
        return parsed.flags.get(name);
    }

    private static String required(ParsedArgs parsed, String name) {
        String value = parsed.flags.get(name);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " is required");
        }
        return value;
    }

    private static String pretty(Object value) throws IOException {
        return MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(value);
    }

    private static int parsePositiveInt(String raw, String name) {
        int value = Integer.parseInt(raw);
        if (value <= 0) {
            throw new IllegalArgumentException("invalid number for " + name + ": " + raw);
        }
        return value;
    }

    private static int parseOptionalInt(String raw, int defaultValue) {
        if (raw == null || raw.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException ignored) {
            return defaultValue;
        }
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return "";
    }

    private static String normalizeServer(String value) {
        String current = value == null ? "" : value.trim();
        while (current.endsWith("/")) {
            current = current.substring(0, current.length() - 1);
        }
        return current;
    }

    private static Instant parseInstant(String raw) {
        try {
            return raw == null || raw.isBlank() ? null : Instant.parse(raw);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static String esc(Object value) {
        return String.valueOf(value == null ? "" : value).replace("|", "\\|").replace("\n", " ").replace("\r", " ");
    }

    private static String[] slice(String[] items, int start) {
        if (start >= items.length) {
            return new String[0];
        }
        String[] result = new String[items.length - start];
        System.arraycopy(items, start, result, 0, result.length);
        return result;
    }

    private record ParsedArgs(Map<String, String> flags, List<String> positionals, List<String> switches) {
    }

    private static final class GlobalFlags {
        String server;
        String mode;
        String token;
        String username;
        String password;
        String config;
        Long timeoutMs;
        int commandIndex = -1;
    }

    private static final class RuntimeConfig {
        String serverAddr;
        String mode;
        String token;
        boolean explicitToken;
        String username;
        String password;
        String configPath;
        long timeoutMs;
        Instant tokenExpiresAt;
    }

    private record Result(int status, Map<String, Object> body) {
    }
}

