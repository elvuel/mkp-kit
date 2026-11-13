package io.github.elvuel.mkpkit.java.server;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

final class RecordStore {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final Path path;
    private final List<MacroRecord> records;

    RecordStore(String path) throws IOException {
        this.path = Path.of(path).toAbsolutePath().normalize();
        Files.createDirectories(this.path.getParent() == null ? Path.of(".") : this.path.getParent());
        this.records = load(this.path);
    }

    synchronized List<MacroRecord> listRecords(int limit, String name) {
        String needle = name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
        return records.stream()
            .filter(item -> needle.isEmpty() || item.name().toLowerCase(Locale.ROOT).contains(needle))
            .sorted(Comparator.comparing(MacroRecord::created_at).reversed())
            .limit(limit)
            .toList();
    }

    synchronized MacroRecord getRecord(String uniqueId) {
        return records.stream().filter(item -> item.unique_id().equals(uniqueId)).findFirst().orElse(null);
    }

    synchronized MacroRecord insertRecord(String name, String uniqueId, String mkpPath, int startX, int startY, int width, int height, String os, int seconds, int milliseconds, String createdAt) throws IOException {
        MacroRecord record = new MacroRecord(
            UUID.randomUUID().toString(),
            name,
            uniqueId,
            mkpPath,
            startX,
            startY,
            width,
            height,
            os,
            seconds,
            milliseconds,
            createdAt
        );
        records.removeIf(item -> item.unique_id().equals(uniqueId));
        records.add(record);
        persist();
        return record;
    }

    synchronized boolean deleteRecord(String uniqueId) throws IOException {
        boolean removed = records.removeIf(item -> item.unique_id().equals(uniqueId));
        if (removed) {
            persist();
        }
        return removed;
    }

    private static List<MacroRecord> load(Path path) throws IOException {
        if (!Files.exists(path)) {
            return new ArrayList<>();
        }
        String raw = Files.readString(path);
        if (raw.isBlank()) {
            return new ArrayList<>();
        }
        return new ArrayList<>(MAPPER.readValue(raw, new TypeReference<List<MacroRecord>>() { }));
    }

    private void persist() throws IOException {
        Files.writeString(path, MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(records));
    }
}
