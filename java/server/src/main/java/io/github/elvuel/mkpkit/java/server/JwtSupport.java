package io.github.elvuel.mkpkit.java.server;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

final class JwtSupport {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private JwtSupport() {
    }

    static String issueToken(String username, ServerSettings settings) throws Exception {
        Map<String, Object> header = Map.of("alg", "HS256", "typ", "JWT");
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sub", username);
        payload.put("iss", settings.issuer);
        payload.put("iat", Instant.now().getEpochSecond());
        payload.put("exp", Instant.now().plusSeconds(settings.tokenTtlSeconds).getEpochSecond());
        String encodedHeader = encode(MAPPER.writeValueAsBytes(header));
        String encodedPayload = encode(MAPPER.writeValueAsBytes(payload));
        String signingInput = encodedHeader + "." + encodedPayload;
        String signature = sign(signingInput, settings.jwtSecret);
        return signingInput + "." + signature;
    }

    static String verify(String token, ServerSettings settings) throws Exception {
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new IllegalArgumentException("invalid bearer token");
        }
        String signingInput = parts[0] + "." + parts[1];
        String expected = sign(signingInput, settings.jwtSecret);
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), parts[2].getBytes(StandardCharsets.UTF_8))) {
            throw new IllegalArgumentException("invalid bearer token");
        }
        JsonNode payload = MAPPER.readTree(Base64.getUrlDecoder().decode(parts[1]));
        String issuer = payload.path("iss").asText("");
        long exp = payload.path("exp").asLong(0L);
        if (!settings.issuer.equals(issuer)) {
            throw new IllegalArgumentException("invalid bearer token issuer");
        }
        if (Instant.now().getEpochSecond() >= exp) {
            throw new IllegalArgumentException("bearer token expired");
        }
        String subject = payload.path("sub").asText("").trim();
        if (subject.isEmpty()) {
            throw new IllegalArgumentException("invalid bearer token subject");
        }
        return subject;
    }

    private static String sign(String input, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return encode(mac.doFinal(input.getBytes(StandardCharsets.UTF_8)));
    }

    private static String encode(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
