package io.github.elvuel.mkpkit.java.server;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;

public final class ServerConfigLoader {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ServerConfigLoader() {
    }

    public static ParsedServerCli parseCli(String[] args) {
        String configPath = null;
        boolean help = false;
        boolean version = false;
        for (int index = 0; index < args.length; index++) {
            String token = args[index];
            switch (token) {
                case "-h", "--help" -> help = true;
                case "--version" -> version = true;
                case "--config" -> {
                    if (index + 1 >= args.length) {
                        throw new IllegalArgumentException("missing value for --config");
                    }
                    configPath = args[++index];
                }
                default -> throw new IllegalArgumentException("unknown argument: " + token);
            }
        }
        return new ParsedServerCli(configPath, help, version);
    }

    public static String usage() {
        return String.join("\n",
            "Usage:",
            "  mkpkit-java-server [--config path] [--version]",
            "",
            "Options:",
            "  --config <path>  Load server settings from server.json-like file",
            "  --version        Show version",
            "  -h, --help       Show this help message"
        );
    }

    public static LoadedServerConfig load(String cliPath) throws IOException {
        String resolved = resolveConfigPath(cliPath);
        ServerSettings settings = new ServerSettings();
        if (resolved == null) {
            return new LoadedServerConfig(null, settings);
        }

        JsonNode root = MAPPER.readTree(Files.readString(Path.of(resolved)));
        if (root == null || root.isNull()) {
            return new LoadedServerConfig(resolved, settings);
        }

        if (root.hasNonNull("mode")) settings.mode = root.get("mode").asText(settings.mode);
        if (root.hasNonNull("port")) settings.port = positiveInt(root.get("port"), settings.port);
        if (root.hasNonNull("sf_port")) settings.sfPort = root.get("sf_port").asText(settings.sfPort);
        if (root.hasNonNull("record_store_path")) settings.recordStorePath = root.get("record_store_path").asText(settings.recordStorePath);

        JsonNode jwt = root.get("jwt");
        if (jwt != null && jwt.isObject()) {
            if (jwt.hasNonNull("user")) settings.user = jwt.get("user").asText(settings.user);
            if (jwt.hasNonNull("password")) settings.password = jwt.get("password").asText(settings.password);
            if (jwt.hasNonNull("secret")) settings.jwtSecret = jwt.get("secret").asText(settings.jwtSecret);
            if (jwt.hasNonNull("issuer")) settings.issuer = jwt.get("issuer").asText(settings.issuer);
            if (jwt.hasNonNull("ttl_seconds")) settings.tokenTtlSeconds = positiveInt(jwt.get("ttl_seconds"), settings.tokenTtlSeconds);
            if (jwt.hasNonNull("muteInDebug")) settings.muteAuthInDebug = jwt.get("muteInDebug").asBoolean(settings.muteAuthInDebug);
        }

        JsonNode runtime = root.get("runtime");
        if (runtime != null && runtime.isObject()) {
            if (runtime.hasNonNull("sync_directive_timeout_ms")) settings.syncDirectiveTimeoutMs = positiveInt(runtime.get("sync_directive_timeout_ms"), settings.syncDirectiveTimeoutMs);
            if (runtime.hasNonNull("db_timeout_ms")) settings.dbTimeoutMs = positiveInt(runtime.get("db_timeout_ms"), settings.dbTimeoutMs);
        }

        JsonNode cors = root.get("cors");
        if (cors != null && cors.isObject()) {
            List<String> origins = stringList(cors.get("allow_origins"));
            List<String> methods = stringList(cors.get("allow_methods"));
            List<String> headers = stringList(cors.get("allow_headers"));
            if (!origins.isEmpty()) settings.corsAllowOrigins = origins;
            if (!methods.isEmpty()) settings.corsAllowMethods = methods;
            if (!headers.isEmpty()) settings.corsAllowHeaders = headers;
            if (cors.hasNonNull("max_age_seconds")) settings.corsMaxAgeSeconds = positiveInt(cors.get("max_age_seconds"), settings.corsMaxAgeSeconds);
        }

        return new LoadedServerConfig(resolved, settings);
    }

    public static String resolveConfigPath(String cliPath) {
        if (cliPath != null && !cliPath.isBlank()) {
            return Paths.get(cliPath).toAbsolutePath().normalize().toString();
        }
        String envPath = System.getenv("MKP_CONFIG_PATH");
        if (envPath != null && !envPath.isBlank()) {
            return Paths.get(envPath).toAbsolutePath().normalize().toString();
        }
        Path cwd = Path.of(System.getProperty("user.dir"), "server.json");
        if (Files.exists(cwd)) {
            return cwd.toAbsolutePath().normalize().toString();
        }
        Path home = Path.of(System.getProperty("user.home"), ".mkp", "server.json");
        if (Files.exists(home)) {
            return home.toAbsolutePath().normalize().toString();
        }
        return null;
    }

    private static int positiveInt(JsonNode node, int defaultValue) {
        int value = node.isNumber() ? node.asInt() : Integer.parseInt(node.asText(String.valueOf(defaultValue)).trim());
        return value > 0 ? value : defaultValue;
    }

    private static List<String> stringList(JsonNode node) {
        List<String> values = new ArrayList<>();
        if (node == null || !node.isArray()) {
            return values;
        }
        for (JsonNode item : node) {
            String text = item.asText("").trim();
            if (!text.isEmpty()) {
                values.add(text);
            }
        }
        return values;
    }

    public record ParsedServerCli(String configPath, boolean helpRequested, boolean showVersion) {
    }

    public record LoadedServerConfig(String configPath, ServerSettings settings) {
    }
}
