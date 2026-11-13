package io.github.elvuel.mkpkit.java;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;

public final class Models {
    private Models() {
    }

    public record SN(String sn) {
    }

    public record Heartbeat(long timetamp) {
    }

    public record MkpVersion(String app, String boot, String hw, JsonNode raw) {
    }

    public record LogLength(int seconds, int milsec) {
    }

    public record LogInfo(String name, String path, Long size, JsonNode raw) {
    }

    public record AHttpBase(String ahttpbase) {
    }

    public record FileNode(String name, String path, String type, Long size, String displayName, List<FileNode> contents) {
    }

    public record FileSystem(FileNode rootDir, String error, JsonNode raw) {
    }

    public record ActionDump(List<Object> actions, Map<String, Object> meta, JsonNode raw) {
    }

    public record SerialPortStatus(String name, boolean portOpen, int syncOutputTimeoutMs, boolean transportConfigured) {
    }

    public record LogOption(Integer width, Integer height, Integer stposx, Integer stposy) {
    }

    public record JoinOption(String ssid, String password) {
    }

    public record WifiAutoOption(String state) {
    }

    public record AGetOption(String filepath) {
    }

    public record APutOption(String filepath) {
    }

    public record AJson2LogOption(String jsonpath, String savepath) {
    }

    public record AHttpBaseOption(String ahttpbase) {
    }
}
