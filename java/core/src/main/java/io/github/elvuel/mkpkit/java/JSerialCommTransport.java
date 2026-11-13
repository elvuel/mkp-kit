package io.github.elvuel.mkpkit.java;

import com.fazecast.jSerialComm.SerialPort;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.locks.ReentrantLock;

public final class JSerialCommTransport implements DirectiveTransport {
    private final SerialPort serialPort;
    private final ReentrantLock ioGate = new ReentrantLock();

    public JSerialCommTransport(String portName, int baudRate) {
        this.serialPort = SerialPort.getCommPort(portName);
        this.serialPort.setBaudRate(baudRate);
        this.serialPort.setNumDataBits(8);
        this.serialPort.setNumStopBits(SerialPort.ONE_STOP_BIT);
        this.serialPort.setParity(SerialPort.NO_PARITY);
        this.serialPort.setFlowControl(SerialPort.FLOW_CONTROL_DISABLED);
        this.serialPort.setComPortTimeouts(SerialPort.TIMEOUT_NONBLOCKING, 0, 0);
        this.serialPort.clearDTR();
        this.serialPort.clearRTS();
    }

    @Override
    public boolean isOpen() {
        return serialPort.isOpen();
    }

    @Override
    public void open() {
        if (serialPort.isOpen()) {
            return;
        }
        if (!serialPort.openPort(1_000)) {
            throw new IllegalStateException("failed to open serial port: " + serialPort.getSystemPortName());
        }
        drainBuffers();
    }

    @Override
    public void close() {
        ioGate.lock();
        try {
            if (serialPort.isOpen()) {
                serialPort.closePort();
            }
        } finally {
            ioGate.unlock();
        }
    }

    @Override
    public void send(String directive) throws Exception {
        open();
        ioGate.lock();
        try {
            drainBuffers();
            writeDirective(directive);
        } finally {
            ioGate.unlock();
        }
    }

    @Override
    public String sendAndReceive(String directive, String eofFlag, int timeoutMs) throws Exception {
        open();
        ioGate.lock();
        try {
            drainBuffers();
            writeDirective(directive);

            StringBuilder buffer = new StringBuilder();
            long deadline = System.currentTimeMillis() + timeoutMs;
            while (System.currentTimeMillis() < deadline) {
                String chunk = readAvailable();
                if (!chunk.isEmpty()) {
                    buffer.append(chunk);
                    SyncOutputExtraction.ExtractedSyncOutput extracted = SyncOutputExtraction.extract(buffer.toString(), directive, eofFlag);
                    if (extracted.output() != null) {
                        return extracted.output();
                    }
                }
                Thread.sleep(15L);
            }

            String tail = readAvailable();
            if (!tail.isEmpty()) {
                buffer.append(tail);
                SyncOutputExtraction.ExtractedSyncOutput extracted = SyncOutputExtraction.extract(buffer.toString(), directive, eofFlag);
                if (extracted.output() != null) {
                    return extracted.output();
                }
            }

            throw new SFSerialPort.DirectiveTimeoutException(directive, timeoutMs);
        } finally {
            ioGate.unlock();
        }
    }

    private void writeDirective(String directive) {
        byte[] bytes = (directive + "\r\n").getBytes(StandardCharsets.UTF_8);
        serialPort.writeBytes(bytes, bytes.length);
    }

    private String readAvailable() {
        int available = serialPort.bytesAvailable();
        if (!serialPort.isOpen() || available <= 0) {
            return "";
        }
        byte[] bytes = new byte[available];
        int read = serialPort.readBytes(bytes, bytes.length);
        if (read <= 0) {
            return "";
        }
        return new String(bytes, 0, read, StandardCharsets.UTF_8);
    }

    private void drainBuffers() {
        if (!serialPort.isOpen()) {
            return;
        }
        serialPort.flushIOBuffers();
        while (serialPort.bytesAvailable() > 0) {
            readAvailable();
        }
    }
}
