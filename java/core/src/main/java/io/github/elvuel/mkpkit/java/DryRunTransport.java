package io.github.elvuel.mkpkit.java;

import java.util.ArrayList;
import java.util.List;

public final class DryRunTransport implements DirectiveTransport {
    private final List<String> sentDirectives = new ArrayList<>();

    @Override
    public boolean isOpen() {
        return true;
    }

    @Override
    public void open() {
    }

    @Override
    public void close() {
    }

    @Override
    public void send(String directive) {
        sentDirectives.add(directive);
    }

    @Override
    public String sendAndReceive(String directive, String eofFlag, int timeoutMs) {
        sentDirectives.add(directive);
        return directive + "\n" + DirectiveParsing.EOF_CLI;
    }

    public List<String> getSentDirectives() {
        return List.copyOf(sentDirectives);
    }
}
