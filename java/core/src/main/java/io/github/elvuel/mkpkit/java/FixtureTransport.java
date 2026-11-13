package io.github.elvuel.mkpkit.java;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class FixtureTransport implements DirectiveTransport {
    private final Map<String, String> fixtures = new LinkedHashMap<>();
    private final List<String> sentDirectives = new ArrayList<>();
    private boolean open;
    private String lastDirective;
    private String lastEofFlag;
    private int lastTimeoutMs;

    public FixtureTransport addFixture(String directive, String response) {
        fixtures.put(directive, response);
        return this;
    }

    public List<String> getSentDirectives() {
        return List.copyOf(sentDirectives);
    }

    public String lastDirective() {
        return lastDirective;
    }

    public String lastEofFlag() {
        return lastEofFlag;
    }

    public int lastTimeoutMs() {
        return lastTimeoutMs;
    }

    @Override
    public boolean isOpen() {
        return open;
    }

    @Override
    public void open() {
        open = true;
    }

    @Override
    public void close() {
        open = false;
    }

    @Override
    public void send(String directive) {
        open = true;
        sentDirectives.add(directive);
        lastDirective = directive;
    }

    @Override
    public String sendAndReceive(String directive, String eofFlag, int timeoutMs) {
        open = true;
        sentDirectives.add(directive);
        lastDirective = directive;
        lastEofFlag = eofFlag;
        lastTimeoutMs = timeoutMs;
        return fixtures.getOrDefault(directive, directive + "\n" + DirectiveParsing.EOF_CLI);
    }
}
