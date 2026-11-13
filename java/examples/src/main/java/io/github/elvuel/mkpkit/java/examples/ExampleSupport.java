package io.github.elvuel.mkpkit.java.examples;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.elvuel.mkpkit.java.JSerialCommTransport;
import io.github.elvuel.mkpkit.java.Models;
import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.SerialPortOptions;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class ExampleSupport {
    private static final ObjectMapper MAPPER = new ObjectMapper().setSerializationInclusion(JsonInclude.Include.NON_NULL);
    private ExampleSupport() {
    }

    public static String serialPortName() {
        String value = System.getenv("MKP_SERIAL_PORT");
        return value == null || value.isBlank() ? "COM3" : value.trim();
    }

    public static SFSerialPort newDevicePort() {
        String portName = serialPortName();
        return new SFSerialPort(
            new SerialPortOptions()
                .withName(portName)
                .withTransport(new JSerialCommTransport(portName, 115_200))
        );
    }

    public static void printValue(Object value) throws Exception {
        if (value == null) {
            return;
        }
        if (value instanceof String text) {
            System.out.println(text);
            return;
        }
        if (value instanceof Models.SN sn) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("sn", sn.sn());
            System.out.println(MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(payload));
            return;
        }
        if (value instanceof Models.Heartbeat heartbeat) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("timetamp", heartbeat.timetamp());
            System.out.println(MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(payload));
            return;
        }
        if (value instanceof Models.MkpVersion version) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("uver", version.uver());
            payload.put("aver", version.aver());
            System.out.println(MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(payload));
            return;
        }
        if (value instanceof Models.LogLength length) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("seconds", length.seconds());
            payload.put("milsec", length.milsec());
            System.out.println(MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(payload));
            return;
        }
        if (value instanceof Models.LogInfo info) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("seconds", info.seconds());
            payload.put("milsec", info.milsec());
            payload.put("width", info.width());
            payload.put("heigh", info.heigh());
            if (info.stpos() != null) {
                payload.put("stpos", Map.of("x", info.stpos().x(), "y", info.stpos().y()));
            }
            System.out.println(MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(payload));
            return;
        }
        if (value instanceof Models.AHttpBase base) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("ahttpbase", base.ahttpbase());
            System.out.println(MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(payload));
            return;
        }
        if (value instanceof Models.ActionDump dump) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("actions", dump.actions());
            payload.put("meta", dump.meta());
            System.out.println(MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(payload));
            return;
        }
        if (value instanceof Models.FileSystem fs) {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("rootDir", normalizeFileNode(fs.rootDir()));
            payload.put("error", fs.error());
            System.out.println(MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(payload));
            return;
        }
        System.out.println(MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(value));
    }

    private static Object normalizeFileNode(Models.FileNode node) {
        if (node == null) {
            return null;
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("name", node.name());
        payload.put("path", node.path());
        payload.put("type", node.type());
        payload.put("size", node.size());
        payload.put("displayName", node.displayName());
        payload.put("contents", node.contents() == null ? List.of() : node.contents().stream().map(ExampleSupport::normalizeFileNode).toList());
        return payload;
    }
}
