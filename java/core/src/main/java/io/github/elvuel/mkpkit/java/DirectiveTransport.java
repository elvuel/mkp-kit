package io.github.elvuel.mkpkit.java;

public interface DirectiveTransport extends AutoCloseable {
    boolean isOpen();

    void open() throws Exception;

    void close() throws Exception;

    void send(String directive) throws Exception;

    String sendAndReceive(String directive, String eofFlag, int timeoutMs) throws Exception;
}
