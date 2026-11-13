package io.github.elvuel.mkpkit.java.server;

import java.util.List;

public final class ServerSettings {
    public String mode = "release";
    public String bind = "127.0.0.1";
    public int port = 8080;
    public String sfPort = defaultSfPort();
    public int syncDirectiveTimeoutMs = 10_000;
    public int dbTimeoutMs = 10_000;
    public String user = "admin";
    public String password = "admin";
    public String jwtSecret = "mkpkit-java-dev-secret";
    public String issuer = "mkpkit-java-server";
    public int tokenTtlSeconds = 3600;
    public boolean muteAuthInDebug = true;
    public List<String> corsAllowOrigins = List.of("*");
    public List<String> corsAllowMethods = List.of("GET", "POST", "DELETE", "OPTIONS");
    public List<String> corsAllowHeaders = List.of("Content-Type", "Authorization");
    public int corsMaxAgeSeconds = 600;
    public String recordStorePath = ".mkp-server-records.json";

    private static String defaultSfPort() {
        String env = System.getenv("MKP_SERIAL_PORT");
        return env == null || env.isBlank() ? "COM3" : env.trim();
    }
}
