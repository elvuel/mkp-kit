package io.github.elvuel.mkpkit.java.server;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.github.elvuel.mkpkit.java.JSerialCommTransport;
import io.github.elvuel.mkpkit.java.MkpJavaInfo;
import io.github.elvuel.mkpkit.java.Models;
import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.SerialPortOptions;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ServerApp implements AutoCloseable {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final ServerSettings settings;
    private final SFSerialPort sfport;
    private final RecordStore recordStore;
    private final HttpServer server;

    private boolean alogRunning;
    private String currentAlogId = "";
    private String currentAlogName = "";
    private String currentAlogPath = "";
    private int currentStartX;
    private int currentStartY;
    private int currentWidth;
    private int currentHeight;
    private String currentOs = "unknown";
    private Instant alogStartedAt;

    private boolean replayRunning;
    private String currentReplayId = "";
    private Instant replayDoneAt;
    private Instant replayReleaseAt;

    public ServerApp(ServerSettings settings) throws Exception {
        this.settings = settings;
        this.sfport = new SFSerialPort(
            new SerialPortOptions()
                .withName(settings.sfPort)
                .withSyncOutputTimeoutMs(settings.syncDirectiveTimeoutMs)
                .withTransport(new JSerialCommTransport(settings.sfPort, 115_200))
        );
        this.recordStore = new RecordStore(settings.recordStorePath);
        this.server = HttpServer.create(new InetSocketAddress(settings.bind, settings.port), 0);
        this.server.createContext("/", this::handle);
    }

    public void start() throws Exception {
        sfport.open();
        server.start();
    }

    public int port() {
        return server.getAddress().getPort();
    }

    @Override
    public void close() throws Exception {
        server.stop(0);
        sfport.close();
    }

    private void handle(HttpExchange exchange) throws IOException {
        try {
            writeResponse(exchange, route(exchange));
        } catch (IllegalArgumentException error) {
            writeResponse(exchange, json(400, Map.of("ok", false, "error", error.getMessage())));
        } catch (SecurityException error) {
            writeResponse(exchange, json(401, Map.of("ok", false, "error", error.getMessage())));
        } catch (Exception error) {
            writeResponse(exchange, json(500, Map.of("ok", false, "error", error.getMessage())));
        }
    }

    private HttpResponse route(HttpExchange exchange) throws Exception {
        String method = exchange.getRequestMethod();
        URI uri = exchange.getRequestURI();
        String path = uri.getPath();
        if ("OPTIONS".equalsIgnoreCase(method)) {
            return empty(204);
        }
        if ("GET".equals(method) && ("/health".equals(path) || "/healthz".equals(path))) {
            return handleHealth();
        }
        if ("POST".equals(method) && "/api/v1/auth/token".equals(path)) {
            return handleAuthToken(exchange);
        }
        if ("GET".equals(method) && "/api/v1/version".equals(path)) {
            return handleVersion();
        }
        if ("GET".equals(method) && "/api/v1/directives/list".equals(path)) {
            requireAuth(exchange);
            return handleDirectiveList(uri);
        }
        if ("GET".equals(method) && "/api/v1/directives/replay/status".equals(path)) {
            requireAuth(exchange);
            return json(200, Map.of("ok", true, "directive", "replay_status", "replay", snapshotReplayState()));
        }
        if ("POST".equals(method) && "/api/v1/directives/alog".equals(path)) {
            requireAuth(exchange);
            return handleAlog(exchange);
        }
        if ("POST".equals(method) && "/api/v1/directives/astop".equals(path)) {
            requireAuth(exchange);
            return handleAstop();
        }
        if ("POST".equals(method) && "/api/v1/directives/acancel".equals(path)) {
            requireAuth(exchange);
            return handleAcancel();
        }
        if (path.startsWith("/api/v1/directives/records/")) {
            requireAuth(exchange);
            String id = path.substring("/api/v1/directives/records/".length()).trim();
            if ("GET".equals(method)) {
                MacroRecord record = recordStore.getRecord(id);
                return record == null
                    ? json(404, Map.of("ok", false, "error", "record not found"))
                    : json(200, Map.of("ok", true, "directive", "record", "record", record));
            }
            if ("DELETE".equals(method)) {
                MacroRecord record = recordStore.getRecord(id);
                if (record == null) {
                    return json(404, Map.of("ok", false, "error", "record not found"));
                }
                boolean fileDeleted = false;
                if (record.mkp_path() != null && !record.mkp_path().isBlank()) {
                    try {
                        sfport.deleteFile(record.mkp_path());
                        fileDeleted = true;
                    } catch (Exception ignored) {
                    }
                }
                recordStore.deleteRecord(id);
                return json(200, Map.of("ok", true, "directive", "record_delete", "id", id, "file_deleted", fileDeleted));
            }
        }
        if (path.startsWith("/api/v1/directives/aplay/")) {
            requireAuth(exchange);
            if (!"POST".equals(method)) {
                return json(404, Map.of("ok", false, "error", "not found"));
            }
            return handleAplay(path.substring("/api/v1/directives/aplay/".length()).trim());
        }
        return json(404, Map.of("ok", false, "error", "not found"));
    }

    private HttpResponse handleHealth() throws IOException {
        Models.SerialPortStatus serial = sfport.snapshotStatus();
        boolean ready = serial.portOpen() && serial.transportConfigured();
        return json(200, Map.of(
            "ok", true,
            "status", ready ? "up" : "degraded",
            "ready", ready,
            "serial", serial,
            "alog", snapshotAlogState(),
            "replay", snapshotReplayState()
        ));
    }

    private HttpResponse handleAuthToken(HttpExchange exchange) throws Exception {
        JsonNode body = readJson(exchange.getRequestBody());
        String username = body.path("username").asText("");
        String password = body.path("password").asText("");
        if (!settings.user.equals(username) || !settings.password.equals(password)) {
            return json(401, Map.of("ok", false, "error", "invalid username or password"));
        }
        String token = JwtSupport.issueToken(username, settings);
        return json(200, Map.of("ok", true, "token", token, "token_type", "Bearer", "expires_in", settings.tokenTtlSeconds));
    }

    private HttpResponse handleVersion() throws Exception {
        return json(200, Map.of(
            "ok", true,
            "directive", "version",
            "mkp_server", MkpJavaInfo.VERSION,
            "mkp_device", sfport.aversion()
        ));
    }

    private HttpResponse handleDirectiveList(URI uri) throws IOException {
        Map<String, String> query = parseQuery(uri.getRawQuery());
        int limits = Math.max(1, Math.min(10, parseInt(query.get("limits"), 10)));
        String name = query.getOrDefault("name", "").trim();
        List<MacroRecord> records = recordStore.listRecords(limits, name);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("ok", true);
        payload.put("directive", "list");
        payload.put("limits", limits);
        payload.put("count", records.size());
        payload.put("records", records);
        if (!name.isEmpty()) {
            payload.put("name", name);
        }
        return json(200, payload);
    }

    private HttpResponse handleAlog(HttpExchange exchange) throws Exception {
        if (alogRunning) {
            return json(409, Map.of("ok", false, "error", "alog is already running"));
        }
        JsonNode body = readJson(exchange.getRequestBody());
        String logName = body.path("log_name").asText("").trim();
        if (logName.isEmpty()) {
            return json(400, Map.of("ok", false, "error", "log_name is required"));
        }
        currentAlogId = UUID.randomUUID().toString();
        currentAlogName = logName;
        currentAlogPath = SFSerialPort.composeLogFullpath(logName);
        currentWidth = body.path("width").asInt(0);
        currentHeight = body.path("height").asInt(0);
        currentStartX = body.path("stposx").asInt(0);
        currentStartY = body.path("stposy").asInt(0);
        currentOs = body.path("os").asText("unknown");
        alogStartedAt = Instant.now();
        alogRunning = true;
        sfport.startRecording(buildAlogArgs(currentAlogPath, currentWidth, currentHeight, currentStartX, currentStartY));
        return json(200, Map.of("ok", true, "directive", "alog", "id", currentAlogId, "log_name", logName, "status", "started"));
    }

    private HttpResponse handleAstop() throws Exception {
        if (!alogRunning) {
            return json(200, Map.of("ok", true, "directive", "astop", "status", "The stop command has been sent."));
        }
        String stoppedId = currentAlogId;
        String stoppedName = currentAlogName;
        String stoppedPath = currentAlogPath;
        int startX = currentStartX;
        int startY = currentStartY;
        int width = currentWidth;
        int height = currentHeight;
        String os = currentOs;
        alogRunning = false;
        currentAlogId = "";
        currentAlogName = "";
        currentAlogPath = "";
        sfport.stopRecording();

        Models.LogLength length;
        try {
            length = sfport.atime(stoppedPath);
        } catch (Exception ignored) {
            length = new Models.LogLength(0, 0);
        }
        MacroRecord record = recordStore.insertRecord(stoppedName, stoppedId, stoppedPath, startX, startY, width, height, os, length.seconds(), length.milsec(), Instant.now().toString());
        return json(200, Map.of(
            "ok", true,
            "directive", "astop",
            "id", stoppedId,
            "status", "stopped",
            "persisted", true,
            "macro_record_id", record.id()
        ));
    }

    private HttpResponse handleAplay(String id) throws Exception {
        if (id.isBlank()) {
            return json(400, Map.of("ok", false, "error", "missing record id"));
        }
        if (replayRunning && replayReleaseAt != null && Instant.now().isBefore(replayReleaseAt)) {
            return json(409, Map.of(
                "ok", false,
                "error", "replay is already running",
                "retry_after_seconds", Math.max(1L, replayReleaseAt.getEpochSecond() - Instant.now().getEpochSecond()),
                "estimated_done_at", replayDoneAt == null ? "" : replayDoneAt.toString(),
                "release_after", replayReleaseAt.toString()
            ));
        }
        MacroRecord record = recordStore.getRecord(id);
        if (record == null) {
            return json(404, Map.of("ok", false, "error", "record not found"));
        }
        sfport.startReplaying(record.mkp_path(), -1);
        replayRunning = true;
        currentReplayId = record.unique_id();
        long durationMs = Math.max(1_000L, record.seconds() * 1000L + record.milliseconds());
        replayDoneAt = Instant.now().plusMillis(durationMs);
        replayReleaseAt = replayDoneAt.plusMillis(500L);
        return json(200, Map.of(
            "ok", true,
            "directive", "aplay",
            "id", record.unique_id(),
            "mkp_path", record.mkp_path(),
            "status", "started",
            "estimated_done_at", replayDoneAt.toString(),
            "release_after", replayReleaseAt.toString()
        ));
    }

    private HttpResponse handleAcancel() throws Exception {
        String replayId = currentReplayId;
        boolean wasRunning = replayRunning;
        sfport.cancelReplay();
        replayRunning = false;
        currentReplayId = "";
        replayDoneAt = null;
        replayReleaseAt = null;
        return json(200, Map.of("ok", true, "directive", "acancel", "id", replayId, "was_running", wasRunning, "status", "cancel_sent"));
    }

    private void requireAuth(HttpExchange exchange) throws Exception {
        if ("debug".equalsIgnoreCase(settings.mode) && settings.muteAuthInDebug) {
            return;
        }
        String authorization = exchange.getRequestHeaders().getFirst("Authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new SecurityException("missing bearer token");
        }
        JwtSupport.verify(authorization.substring("Bearer ".length()).trim(), settings);
    }

    private String buildAlogArgs(String logPath, int width, int height, int stposx, int stposy) {
        List<String> args = new ArrayList<>();
        args.add(logPath);
        if (width > 0) {
            args.add("--width");
            args.add(String.valueOf(width));
        }
        if (height > 0) {
            args.add("--height");
            args.add(String.valueOf(height));
        }
        if (stposx >= 0) {
            args.add("--stposx");
            args.add(String.valueOf(stposx));
        }
        if (stposy >= 0) {
            args.add("--stposy");
            args.add(String.valueOf(stposy));
        }
        return String.join(" ", args);
    }

    private Map<String, Object> snapshotAlogState() {
        return Map.of(
            "running", alogRunning,
            "id", currentAlogId,
            "name", currentAlogName,
            "mkp_path", currentAlogPath,
            "started_at", alogStartedAt == null ? "" : alogStartedAt.toString()
        );
    }

    private Map<String, Object> snapshotReplayState() {
        return Map.of(
            "running", replayRunning,
            "id", currentReplayId,
            "estimated_done_at", replayDoneAt == null ? "" : replayDoneAt.toString(),
            "release_after", replayReleaseAt == null ? "" : replayReleaseAt.toString()
        );
    }

    private static JsonNode readJson(InputStream stream) throws IOException {
        return MAPPER.readTree(stream);
    }

    private static Map<String, String> parseQuery(String rawQuery) {
        Map<String, String> result = new LinkedHashMap<>();
        if (rawQuery == null || rawQuery.isBlank()) {
            return result;
        }
        for (String part : rawQuery.split("&")) {
            int separator = part.indexOf('=');
            if (separator < 0) {
                result.put(part, "");
            } else {
                result.put(part.substring(0, separator), part.substring(separator + 1));
            }
        }
        return result;
    }

    private static int parseInt(String raw, int defaultValue) {
        if (raw == null || raw.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException ignored) {
            return defaultValue;
        }
    }

    private static HttpResponse empty(int statusCode) {
        return new HttpResponse(statusCode, new byte[0]);
    }

    private static HttpResponse json(int statusCode, Object payload) throws IOException {
        return new HttpResponse(statusCode, MAPPER.writerWithDefaultPrettyPrinter().writeValueAsBytes(payload));
    }

    private void writeResponse(HttpExchange exchange, HttpResponse response) throws IOException {
        Headers headers = exchange.getResponseHeaders();
        headers.set("Content-Type", "application/json; charset=utf-8");
        headers.set("Access-Control-Allow-Origin", String.join(",", settings.corsAllowOrigins));
        headers.set("Access-Control-Allow-Methods", String.join(",", settings.corsAllowMethods));
        headers.set("Access-Control-Allow-Headers", String.join(",", settings.corsAllowHeaders));
        headers.set("Access-Control-Max-Age", String.valueOf(settings.corsMaxAgeSeconds));
        exchange.sendResponseHeaders(response.statusCode, response.body.length);
        try (OutputStream stream = exchange.getResponseBody()) {
            stream.write(response.body);
        }
    }

    private record HttpResponse(int statusCode, byte[] body) {
    }
}

