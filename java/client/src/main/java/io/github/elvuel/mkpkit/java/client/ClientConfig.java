package io.github.elvuel.mkpkit.java.client;

import java.util.Map;

public final class ClientConfig {
    public String server_addr = "";
    public String mode = "";
    public String username = "";
    public String password = "";
    public String token = "";
    public String token_expires_at = "";
    public Integer timeout_seconds;
    public VersionCache version_cache;

    public static final class VersionCache {
        public String server_addr = "";
        public String cached_at = "";
        public Map<String, Object> response;
    }
}
