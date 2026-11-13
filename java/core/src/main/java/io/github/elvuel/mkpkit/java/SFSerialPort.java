package io.github.elvuel.mkpkit.java;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class SFSerialPort implements AutoCloseable {
    private final String name;
    private final String mousePortFlag;
    private final String keyboardPortFlag;
    private final int syncOutputTimeoutMs;
    private final DirectiveTransport transport;
    private final DirectiveParsing.Registry parserRegistry;

    public SFSerialPort(SerialPortOptions options) {
        this.name = options.name();
        this.mousePortFlag = options.mousePortFlag();
        this.keyboardPortFlag = options.keyboardPortFlag();
        this.syncOutputTimeoutMs = options.syncOutputTimeoutMs();
        this.transport = options.transport();
        this.parserRegistry = options.parserRegistry();
    }

    public String name() {
        return name;
    }

    public String mousePortFlag() {
        return mousePortFlag;
    }

    public String keyboardPortFlag() {
        return keyboardPortFlag;
    }

    public int syncOutputTimeoutMs() {
        return syncOutputTimeoutMs;
    }

    public void open() throws Exception {
        requireTransport().open();
    }

    @Override
    public void close() throws Exception {
        if (transport != null) {
            transport.close();
        }
    }

    public String sendDirective(String directive) throws Exception {
        return sendDirective(directive, syncOutputTimeoutMs);
    }

    public String sendDirective(String directive, int timeoutMs) throws Exception {
        DirectiveTransport target = requireTransport();
        String eofFlag = parserRegistry.tryResolve(directive).map(DirectiveParsing.DirectiveParser::eofFlag).orElse(DirectiveParsing.EOF_CLI);
        return target.sendAndReceive(directive, eofFlag, timeoutMs);
    }

    public void sendDirectiveAsync(String directive) throws Exception {
        requireTransport().send(directive);
    }

    @SuppressWarnings("unchecked")
    public <T> T sendParsed(String directive, int timeoutMs) throws Exception {
        String raw = sendDirective(directive, timeoutMs);
        Object parsed = parserRegistry.resolve(directive).parse(directive, raw);
        return (T) parsed;
    }

    public void startRecording(String args) throws Exception {
        String directive = args == null || args.isBlank() ? "alog" : "alog " + args.trim();
        sendDirectiveAsync(directive);
    }

    public void startReplaying(String logName, int delay) throws Exception {
        String directive = "aplay " + logName + " --delay " + delay;
        sendDirectiveAsync(directive);
    }

    public String alog(String logName, Models.LogOption option, int timeoutMs) throws Exception {
        return sendParsed(buildAlogDirective(logName, option), timeoutMs);
    }

    public String stopRecording() throws Exception {
        return sendParsed("astop", syncOutputTimeoutMs);
    }

    public Object cancelReplay() throws Exception {
        return sendParsed("acancel", syncOutputTimeoutMs);
    }

    public void mouse10(M10Option option) throws Exception {
        String directive = "m10 --port " + mousePortFlag;
        String fragment = option.toCliFragment().trim();
        if (!fragment.isEmpty()) {
            directive += " " + fragment;
        }
        if (option.isAsync()) {
            sendDirectiveAsync(directive);
        } else {
            sendDirective(directive);
        }
    }

    public void keypad(KpadOption option) throws Exception {
        String directive = "kpad --port " + keyboardPortFlag;
        String fragment = option.toCliFragment().trim();
        if (!fragment.isEmpty()) {
            directive += " " + fragment;
        }
        if (option.isAsync()) {
            sendDirectiveAsync(directive);
        } else {
            sendDirective(directive);
        }
        option.commitState();
    }

    public Models.SN sn() throws Exception { return sendParsed("sn", syncOutputTimeoutMs); }
    public Models.Heartbeat alive() throws Exception { return sendParsed("alive", syncOutputTimeoutMs); }
    public Models.MkpVersion aversion() throws Exception { return sendParsed("aversion", syncOutputTimeoutMs); }
    public Models.LogLength atime(String path) throws Exception { return sendParsed("atime " + composeLogFullpath(path), syncOutputTimeoutMs); }
    public Models.LogInfo ainsp(String path) throws Exception { return sendParsed("ainsp " + composeLogFullpath(path), syncOutputTimeoutMs); }
    public Models.FileSystem listDir(String path) throws Exception { return sendParsed("list_dir " + path, syncOutputTimeoutMs); }
    public String cleanDir(String path) throws Exception { return sendParsed("clean_dir " + path, syncOutputTimeoutMs); }
    public String deleteFile(String path) throws Exception { return sendParsed("delete_file " + path, syncOutputTimeoutMs); }

    public String join(Models.JoinOption option) throws Exception {
        String directive = option == null ? "join" : List.of("join", option.ssid(), option.password()).stream().filter(item -> item != null && !item.isBlank()).reduce((a, b) -> a + " " + b).orElse("join");
        return sendParsed(directive, syncOutputTimeoutMs);
    }

    public String wifiAuto(Models.WifiAutoOption option) throws Exception {
        String directive = option == null || option.state() == null || option.state().isBlank() ? "wifi_auto" : "wifi_auto " + option.state();
        return sendParsed(directive, syncOutputTimeoutMs);
    }

    public Models.AHttpBase ahttpbase(Models.AHttpBaseOption option) throws Exception {
        String directive = option == null || option.ahttpbase() == null || option.ahttpbase().isBlank() ? "ahttpbase" : "ahttpbase " + option.ahttpbase();
        return sendParsed(directive, syncOutputTimeoutMs);
    }

    public Models.ActionDump adumj(String path) throws Exception { return sendParsed("adumj " + composeLogFullpath(path), syncOutputTimeoutMs); }
    public String aget(Models.AGetOption option) throws Exception { return sendParsed("aget " + option.filepath(), syncOutputTimeoutMs); }
    public String aput(Models.APutOption option) throws Exception { return sendParsed("aput " + option.filepath(), syncOutputTimeoutMs); }

    public String ajson2log(Models.AJson2LogOption option) throws Exception {
        List<String> args = new ArrayList<>();
        args.add(option.jsonpath());
        if (option.savepath() != null && !option.savepath().isBlank()) {
            args.add(option.savepath());
        }
        return sendParsed("ajson2log " + String.join(" ", args), syncOutputTimeoutMs);
    }

    public Models.SerialPortStatus snapshotStatus() {
        return new Models.SerialPortStatus(name, transport != null && transport.isOpen(), syncOutputTimeoutMs, transport != null);
    }

    public static String composeLogDirectory(String logDir) {
        return logDir.startsWith("/eMMC/applog") ? logDir : "/eMMC/applog/" + logDir;
    }

    public static String composeLogFullpath(String logPath) {
        String normalized = logPath.endsWith(".log") ? logPath : logPath + ".log";
        return normalized.startsWith("/eMMC/applog/") ? normalized : "/eMMC/applog/" + normalized;
    }

    private static String buildAlogDirective(String logName, Models.LogOption option) {
        List<String> args = new ArrayList<>();
        args.add("alog");
        args.add(composeLogFullpath(logName));
        if (option != null) {
            if (option.width() != null && option.width() > 0) {
                args.add("--width");
                args.add(String.valueOf(option.width()));
            }
            if (option.height() != null && option.height() > 0) {
                args.add("--height");
                args.add(String.valueOf(option.height()));
            }
            if (option.stposx() != null && option.stposx() > -1) {
                args.add("--stposx");
                args.add(String.valueOf(option.stposx()));
            }
            if (option.stposy() != null && option.stposy() > -1) {
                args.add("--stposy");
                args.add(String.valueOf(option.stposy()));
            }
        }
        return String.join(" ", args);
    }

    private DirectiveTransport requireTransport() {
        if (transport == null) {
            throw new TransportNotConfiguredException();
        }
        return transport;
    }

    public static final class TransportNotConfiguredException extends RuntimeException {
        public TransportNotConfiguredException() {
            super("transport not configured");
        }
    }

    public static final class DirectiveTimeoutException extends RuntimeException {
        public DirectiveTimeoutException(String directive, int timeoutMs) {
            super("directive timeout: " + directive + " after " + timeoutMs + "ms");
        }
    }
}
