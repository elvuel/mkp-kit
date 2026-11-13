package io.github.elvuel.mkpkit.java;

public final class SerialPortOptions {
    private String name = "COM3";
    private String mousePortFlag = "1";
    private String keyboardPortFlag = "2";
    private int syncOutputTimeoutMs = 10_000;
    private int baudRate = 115_200;
    private DirectiveTransport transport;
    private DirectiveParsing.Registry parserRegistry = DirectiveParsing.createDefaultRegistry();

    public String name() { return name; }
    public String mousePortFlag() { return mousePortFlag; }
    public String keyboardPortFlag() { return keyboardPortFlag; }
    public int syncOutputTimeoutMs() { return syncOutputTimeoutMs; }
    public int baudRate() { return baudRate; }
    public DirectiveTransport transport() { return transport; }
    public DirectiveParsing.Registry parserRegistry() { return parserRegistry; }

    public SerialPortOptions withName(String value) { this.name = value; return this; }
    public SerialPortOptions withMousePortFlag(String value) { this.mousePortFlag = value; return this; }
    public SerialPortOptions withKeyboardPortFlag(String value) { this.keyboardPortFlag = value; return this; }
    public SerialPortOptions withSyncOutputTimeoutMs(int value) { this.syncOutputTimeoutMs = value; return this; }
    public SerialPortOptions withBaudRate(int value) { this.baudRate = value; return this; }
    public SerialPortOptions withTransport(DirectiveTransport value) { this.transport = value; return this; }
    public SerialPortOptions withParserRegistry(DirectiveParsing.Registry value) { this.parserRegistry = value; return this; }
}
