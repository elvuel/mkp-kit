package io.github.elvuel.mkpkit.java.fileserver;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import io.github.elvuel.mkpkit.java.MkpJavaInfo;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

public final class FileServerApp implements AutoCloseable {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final FileServerSettings settings;
    private final HttpServer server;

    public FileServerApp(FileServerSettings settings) throws IOException {
        this.settings = settings;
        this.server = HttpServer.create(new InetSocketAddress(settings.bind(), settings.port()), 0);
        this.server.createContext("/", this::handle);
    }

    public FileServerSettings settings() {
        return settings;
    }

    public void start() throws IOException {
        Files.createDirectories(Path.of(settings.fileRoot()));
        server.start();
    }

    @Override
    public void close() {
        server.stop(0);
    }

    private void handle(HttpExchange exchange) throws IOException {
        Files.createDirectories(Path.of(settings.fileRoot()));
        try {
            write(exchange, route(exchange));
        } catch (IllegalArgumentException error) {
            write(exchange, json(400, Map.of("error", error.getMessage())));
        } catch (Exception error) {
            write(exchange, json(500, Map.of("error", error.getMessage())));
        }
    }

    private HttpResponse route(HttpExchange exchange) throws Exception {
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        URI uri = exchange.getRequestURI();
        String path = uri.getPath();
        if ("GET".equals(method) && "/healthz".equals(path)) {
            return json(200, Map.of("status", "ok", "service", "mkpkit-java-file-server", "version", MkpJavaInfo.VERSION, "file_root", settings.fileRoot()));
        }
        if ("GET".equals(method) && "/list".equals(path)) {
            return handleList(uri);
        }
        if ("POST".equals(method) && "/upload".equals(path)) {
            return handleUpload(exchange);
        }
        if ("PUT".equals(method)) {
            return handlePut(uri, exchange.getRequestBody());
        }
        if ("GET".equals(method)) {
            return handleGet(uri);
        }
        return json(404, Map.of("error", "Not found"));
    }

    private HttpResponse handleList(URI uri) throws IOException {
        String requestPath = parseQuery(uri.getRawQuery()).getOrDefault("path", "");
        Path fsPath = safeJoin(Path.of(settings.fileRoot()), requestPath);
        if (fsPath == null || !Files.isDirectory(fsPath)) {
            return json(404, Map.of("error", "Directory not found: " + requestPath));
        }
        return json(200, listDirectory(fsPath, Path.of(settings.fileRoot())));
    }

    private HttpResponse handleUpload(HttpExchange exchange) throws IOException {
        String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("multipart/form-data")) {
            return json(400, Map.of("error", "Expected multipart form data"));
        }
        String boundary = extractBoundary(contentType);
        if (boundary == null || boundary.isBlank()) {
            return json(400, Map.of("error", "Missing multipart boundary"));
        }

        MultipartForm form = parseMultipart(readAll(exchange.getRequestBody()), boundary);
        if (form.fileContent == null) {
            return json(400, Map.of("error", "Missing 'file' field in form data"));
        }
        if (form.fileName == null || form.fileName.isBlank()) {
            return json(400, Map.of("error", "Empty filename"));
        }

        String safeName = sanitizeFilename(form.fileName);
        Path target = safeJoin(Path.of(settings.fileRoot()), form.path == null ? "" : form.path, safeName);
        if (target == null) {
            return json(400, Map.of("error", "Path traversal rejected"));
        }

        if (target.getParent() != null) {
            Files.createDirectories(target.getParent());
        }
        Files.write(target, form.fileContent);
        return json(200, Map.of(
            "status", "ok",
            "path", relativePosixPath(Path.of(settings.fileRoot()), target),
            "size", form.fileContent.length
        ));
    }

    private HttpResponse handlePut(URI uri, InputStream stream) throws IOException {
        String urlPath = decodePath(uri.getPath());
        Path target = safeJoin(Path.of(settings.fileRoot()), urlPath);
        if (target == null) {
            return json(400, Map.of("error", "Path traversal rejected"));
        }
        byte[] data = readAll(stream);
        if (data.length == 0) {
            return json(400, Map.of("error", "Empty request body"));
        }
        if (target.getParent() != null) {
            Files.createDirectories(target.getParent());
        }
        Files.write(target, data);
        return json(200, Map.of("status", "ok", "path", urlPath, "size", data.length));
    }

    private HttpResponse handleGet(URI uri) throws IOException {
        String urlPath = decodePath(uri.getPath());
        Path target = safeJoin(Path.of(settings.fileRoot()), urlPath);
        if (target == null) {
            return json(400, Map.of("error", "Path traversal rejected"));
        }
        if (!Files.isRegularFile(target)) {
            return json(404, Map.of("error", "File not found: " + urlPath));
        }
        Headers headers = new Headers();
        headers.set("Content-Type", "application/octet-stream");
        headers.set("Content-Disposition", attachmentDisposition(target.getFileName().toString()));
        return new HttpResponse(200, Files.readAllBytes(target), headers);
    }

    private static List<Map<String, Object>> listDirectory(Path dirPath, Path fileRoot) throws IOException {
        List<Map<String, Object>> entries = new ArrayList<>();
        try (var stream = Files.list(dirPath)) {
            for (Path item : stream.sorted((left, right) -> left.getFileName().toString().compareTo(right.getFileName().toString())).toList()) {
                boolean isDir = Files.isDirectory(item);
                Map<String, Object> entry = new LinkedHashMap<>();
                entry.put("name", item.getFileName().toString());
                entry.put("type", isDir ? "dir" : "file");
                entry.put("size", isDir ? 0L : Files.size(item));
                entry.put("path", relativePosixPath(fileRoot, item));
                entries.add(entry);
            }
        }
        return entries;
    }

    static Path safeJoin(Path fileRoot, String... paths) {
        Path root = fileRoot.toAbsolutePath().normalize();
        Path current = root;
        for (String raw : paths) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String normalized = raw.replace('\\', '/').replaceFirst("^/+", "");
            if (normalized.isBlank()) {
                continue;
            }
            if (normalized.matches("^[A-Za-z]:.*")) {
                return null;
            }
            Path candidate = current;
            for (String part : normalized.split("/")) {
                if (part.isBlank()) {
                    continue;
                }
                candidate = candidate.resolve(part);
            }
            current = candidate.normalize();
            if (!current.startsWith(root)) {
                return null;
            }
        }
        return current;
    }

    static String sanitizeFilename(String filename) {
        String base = filename.replace('\\', '/');
        int slash = base.lastIndexOf('/');
        if (slash >= 0) {
            base = base.substring(slash + 1);
        }
        if (base.isBlank()) {
            return "unnamed_file";
        }
        StringBuilder cleaned = new StringBuilder(base.length());
        for (char ch : base.toCharArray()) {
            if ("<>:\"|?*".indexOf(ch) >= 0) {
                cleaned.append('_');
            } else {
                cleaned.append(ch);
            }
        }
        String output = cleaned.toString();
        return output.isBlank() || ".".equals(output) ? "unnamed_file" : output;
    }

    private static String relativePosixPath(Path root, Path target) {
        return root.toAbsolutePath().normalize().relativize(target.toAbsolutePath().normalize()).toString().replace('\\', '/');
    }

    private static String decodePath(String path) {
        String stripped = path == null ? "" : path.replaceFirst("^/+", "");
        return URLDecoder.decode(stripped, StandardCharsets.UTF_8);
    }

    private static Map<String, String> parseQuery(String rawQuery) {
        Map<String, String> result = new LinkedHashMap<>();
        if (rawQuery == null || rawQuery.isBlank()) {
            return result;
        }
        for (String part : rawQuery.split("&")) {
            int index = part.indexOf('=');
            if (index < 0) {
                result.put(URLDecoder.decode(part, StandardCharsets.UTF_8), "");
            } else {
                result.put(
                    URLDecoder.decode(part.substring(0, index), StandardCharsets.UTF_8),
                    URLDecoder.decode(part.substring(index + 1), StandardCharsets.UTF_8)
                );
            }
        }
        return result;
    }

    private static String extractBoundary(String contentType) {
        for (String part : contentType.split(";")) {
            String token = part.trim();
            if (token.startsWith("boundary=")) {
                String value = token.substring("boundary=".length()).trim();
                if (value.startsWith("\"") && value.endsWith("\"") && value.length() >= 2) {
                    return value.substring(1, value.length() - 1);
                }
                return value;
            }
        }
        return null;
    }

    private static MultipartForm parseMultipart(byte[] body, String boundary) {
        String raw = new String(body, StandardCharsets.ISO_8859_1);
        String delimiter = "--" + boundary;
        MultipartForm form = new MultipartForm();
        for (String part : raw.split(Pattern.quote(delimiter))) {
            String item = stripPart(part);
            if (item.isBlank() || "--".equals(item)) {
                continue;
            }
            int separator = item.indexOf("\r\n\r\n");
            int contentOffset = 4;
            if (separator < 0) {
                separator = item.indexOf("\n\n");
                contentOffset = 2;
            }
            if (separator < 0) {
                continue;
            }
            String headerBlock = item.substring(0, separator);
            String contentBlock = trimMultipartContent(item.substring(separator + contentOffset));
            ContentDisposition disposition = parseContentDisposition(headerBlock);
            if ("path".equals(disposition.name)) {
                form.path = contentBlock;
            } else if ("file".equals(disposition.name)) {
                form.fileName = disposition.filename;
                form.fileContent = contentBlock.getBytes(StandardCharsets.ISO_8859_1);
            }
        }
        return form;
    }

    private static ContentDisposition parseContentDisposition(String headerBlock) {
        String name = null;
        String filename = null;
        for (String line : headerBlock.split("\\r?\\n")) {
            String trimmed = line.trim();
            if (!trimmed.toLowerCase(Locale.ROOT).startsWith("content-disposition:")) {
                continue;
            }
            String[] segments = trimmed.substring("content-disposition:".length()).split(";");
            for (String segment : segments) {
                String token = segment.trim();
                if (token.startsWith("name=")) {
                    name = stripQuotes(token.substring("name=".length()).trim());
                } else if (token.startsWith("filename*=")) {
                    filename = decodeRfc5987(stripQuotes(token.substring("filename*=".length()).trim()));
                } else if (token.startsWith("filename=")) {
                    filename = stripQuotes(token.substring("filename=".length()).trim());
                }
            }
        }
        return new ContentDisposition(name, filename);
    }

    private static String stripQuotes(String value) {
        if (value == null) {
            return null;
        }
        if (value.startsWith("\"") && value.endsWith("\"") && value.length() >= 2) {
            return value.substring(1, value.length() - 1);
        }
        return value;
    }

    private static String decodeRfc5987(String value) {
        int marker = value.indexOf("''");
        if (marker >= 0 && marker + 2 <= value.length()) {
            String encoded = value.substring(marker + 2);
            return URLDecoder.decode(encoded, StandardCharsets.UTF_8);
        }
        return value;
    }

    private static String stripPart(String part) {
        String output = part;
        while (output.startsWith("\r\n")) {
            output = output.substring(2);
        }
        while (output.startsWith("\n")) {
            output = output.substring(1);
        }
        while (output.endsWith("\r\n")) {
            output = output.substring(0, output.length() - 2);
        }
        while (output.endsWith("\n")) {
            output = output.substring(0, output.length() - 1);
        }
        return output;
    }

    private static String trimMultipartContent(String content) {
        String output = content;
        if (output.endsWith("\r\n")) {
            output = output.substring(0, output.length() - 2);
        }
        if (output.endsWith("\n")) {
            output = output.substring(0, output.length() - 1);
        }
        return output;
    }

    private static String attachmentDisposition(String filename) {
        return "attachment; filename=\"" + filename.replace("\"", "\\\"") + "\"";
    }

    private static HttpResponse json(int statusCode, Object payload) throws IOException {
        Headers headers = new Headers();
        headers.set("Content-Type", "application/json; charset=utf-8");
        return new HttpResponse(statusCode, MAPPER.writerWithDefaultPrettyPrinter().writeValueAsBytes(payload), headers);
    }

    private static void write(HttpExchange exchange, HttpResponse response) throws IOException {
        Headers headers = exchange.getResponseHeaders();
        response.headers.forEach((key, values) -> values.forEach(value -> headers.add(key, value)));
        exchange.sendResponseHeaders(response.statusCode, response.body.length);
        try (OutputStream stream = exchange.getResponseBody()) {
            stream.write(response.body);
        }
    }

    private static byte[] readAll(InputStream stream) throws IOException {
        return stream.readAllBytes();
    }

    private static final class MultipartForm {
        private String path;
        private String fileName;
        private byte[] fileContent;
    }

    private record ContentDisposition(String name, String filename) {
    }

    private record HttpResponse(int statusCode, byte[] body, Headers headers) {
    }
}

