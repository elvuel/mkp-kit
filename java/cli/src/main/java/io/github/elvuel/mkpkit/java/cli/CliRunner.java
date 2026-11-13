package io.github.elvuel.mkpkit.java.cli;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.elvuel.mkpkit.java.JSerialCommTransport;
import io.github.elvuel.mkpkit.java.KpadOption;
import io.github.elvuel.mkpkit.java.Keycodes;
import io.github.elvuel.mkpkit.java.M10Option;
import io.github.elvuel.mkpkit.java.MkpJavaInfo;
import io.github.elvuel.mkpkit.java.Models;
import io.github.elvuel.mkpkit.java.SFSerialPort;
import io.github.elvuel.mkpkit.java.SerialPortOptions;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public final class CliRunner {
    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final Set<String> COMMON_BOOLEAN_FLAGS = Set.of("--json");
    private static final Set<String> COMMON_VALUE_FLAGS = Set.of("--port", "--timeout", "--mouse-port", "--keyboard-port");

    private CliRunner() {
    }

    public static int run(String[] args, PrintWriter out, PrintWriter err) {
        try {
            if (args.length == 0 || contains(args, "-h") || contains(args, "--help")) {
                out.println(usage());
                return 0;
            }

            int commandIndex = findCommandIndex(args);
            if (commandIndex < 0 || commandIndex >= args.length) {
                out.println(usage());
                return 0;
            }

            ParsedArgs globalParsed = parseArgs(Arrays.copyOfRange(args, 0, commandIndex), Set.of());
            String command = args[commandIndex].trim().toLowerCase(Locale.ROOT);
            ParsedArgs commandParsed = parseArgs(Arrays.copyOfRange(args, commandIndex + 1, args.length), Set.of("--async"));
            if (command.equals("status")) {
                out.println(MkpJavaInfo.LANGUAGE + " " + MkpJavaInfo.STAGE + " " + MkpJavaInfo.VERSION);
                return 0;
            }

            String portName = stringFlag(globalParsed, "--port");
            if (portName == null || portName.isBlank()) {
                portName = getenv("MKP_SERIAL_PORT");
            }
            if (portName == null || portName.isBlank()) {
                portName = "COM3";
            }
            int timeoutMs = parseIntFlag(globalParsed, "--timeout", 10_000);
            String mousePortFlag = stringFlag(globalParsed, "--mouse-port");
            String keyboardPortFlag = stringFlag(globalParsed, "--keyboard-port");
            boolean jsonOutput = hasSwitch(globalParsed, "--json");

            SerialPortOptions options = new SerialPortOptions()
                .withName(portName)
                .withSyncOutputTimeoutMs(timeoutMs)
                .withTransport(new JSerialCommTransport(portName, 115_200));
            if (mousePortFlag != null && !mousePortFlag.isBlank()) {
                options.withMousePortFlag(mousePortFlag);
            }
            if (keyboardPortFlag != null && !keyboardPortFlag.isBlank()) {
                options.withKeyboardPortFlag(keyboardPortFlag);
            }

            try (SFSerialPort port = new SFSerialPort(options)) {
                port.open();
                Object value = dispatch(port, command, commandParsed);
                String rendered = renderValue(value, jsonOutput);
                if (!rendered.isBlank()) {
                    out.println(rendered);
                }
            }
            return 0;
        } catch (Exception error) {
            err.println(error.getMessage());
            return 1;
        }
    }

    public static String usage() {
        return String.join("\n",
            "Usage:",
            "  mkpkit-java [--port COM3] [--timeout 10000] <command> [args...]",
            "",
            "Commands:",
            "  status",
            "  sn | alive | aversion",
            "  atime <path>",
            "  ainsp <path>",
            "  list_dir <path>",
            "  clean_dir <path>",
            "  delete_file <path>",
            "  join [ssid password]",
            "  wifi_auto [state]",
            "  ahttpbase [url]",
            "  aget <filepath>",
            "  aput <filepath>",
            "  adumj <log_path>",
            "  ajson2log <jsonpath> [savepath]",
            "  alog [raw args...]",
            "  astop",
            "  acancel",
            "  aplay <log_path> [--delay <n>]",
            "  m10 --x <n> [--y <n>] [--w <n>] [--b <n>] [--async]",
            "  kpad [text] [--text <text>] [--key <key>] [--delay <ms>] [--rel <n>] [--async]",
            "  raw <directive...>",
            "  raw-async <directive...>",
            "",
            "Global flags:",
            "  --port COM3",
            "  --timeout 10000",
            "  --mouse-port 1",
            "  --keyboard-port 2",
            "  --json"
        );
    }

    private static Object dispatch(SFSerialPort port, String command, ParsedArgs parsed) throws Exception {
        List<String> args = parsed.positionals();
        return switch (command) {
            case "sn" -> port.sn();
            case "alive" -> port.alive();
            case "aversion" -> port.aversion();
            case "atime" -> port.atime(requirePositional(args, "path", 0));
            case "ainsp" -> port.ainsp(requirePositional(args, "path", 0));
            case "list_dir" -> port.listDir(requirePositional(args, "path", 0));
            case "clean_dir" -> port.cleanDir(requirePositional(args, "path", 0));
            case "delete_file" -> port.deleteFile(requirePositional(args, "path", 0));
            case "join" -> args.isEmpty()
                ? port.join(null)
                : port.join(new Models.JoinOption(requirePositional(args, "ssid", 0), args.size() > 1 ? args.get(1) : ""));
            case "wifi_auto" -> args.isEmpty() ? port.wifiAuto(null) : port.wifiAuto(new Models.WifiAutoOption(args.getFirst()));
            case "ahttpbase" -> args.isEmpty() ? port.ahttpbase(null) : port.ahttpbase(new Models.AHttpBaseOption(args.getFirst()));
            case "aget" -> port.aget(new Models.AGetOption(requirePositional(args, "filepath", 0)));
            case "aput" -> port.aput(new Models.APutOption(requirePositional(args, "filepath", 0)));
            case "adumj" -> port.adumj(requirePositional(args, "log_path", 0));
            case "ajson2log" -> port.ajson2log(new Models.AJson2LogOption(requirePositional(args, "jsonpath", 0), args.size() > 1 ? args.get(1) : null));
            case "alog" -> {
                port.startRecording(String.join(" ", args));
                yield "alog sent";
            }
            case "astop" -> port.stopRecording();
            case "acancel" -> port.cancelReplay();
            case "aplay" -> {
                String logPath = requirePositional(args, "log_path", 0);
                int delay = parseOptionInt(parsed, "--delay", 0);
                port.startReplaying(logPath, delay);
                yield "aplay sent";
            }
            case "m10" -> {
                M10Option option = new M10Option();
                Integer x = parseOptionIntNullable(parsed, "--x");
                Integer y = parseOptionIntNullable(parsed, "--y");
                Integer wheel = parseOptionIntNullable(parsed, "--w");
                Integer button = parseOptionIntNullable(parsed, "--b");
                if (x == null && y == null && wheel == null && button == null) {
                    throw new IllegalArgumentException("m10 requires at least one of --b, --x, --y, or --w");
                }
                if (x != null) {
                    option.setX(x);
                }
                if (y != null) {
                    option.setY(y);
                }
                if (wheel != null) {
                    option.setWheel(wheel);
                }
                if (button != null) {
                    option.setButton(button);
                }
                option.withAsync(hasSwitch(parsed, "--async"));
                if (!hasSwitch(parsed, "--async")) {
                    option.withSyncIgnoreOutput(true);
                }
                port.mouse10(option);
                yield "m10 sent";
            }
            case "kpad" -> {
                String text = optionString(parsed, "--text");
                String key = optionString(parsed, "--key");
                int delay = parseOptionInt(parsed, "--delay", 0);
                int rel = parseOptionInt(parsed, "--rel", 1);
                boolean async = hasSwitch(parsed, "--async");
                List<KpadOption> options = new ArrayList<>();
                if (text == null && key == null && !args.isEmpty()) {
                    text = String.join(" ", args);
                }
                if (text != null && !text.isBlank()) {
                    for (char ch : text.toCharArray()) {
                        options.add(new KpadOption().withDelay(delay).withRelease(rel).withAsync(async).withKeys(Keycodes.expandKpadInputKey(String.valueOf(ch))));
                    }
                } else if (key != null && !key.isBlank()) {
                    options.add(new KpadOption().withDelay(delay).withRelease(rel).withAsync(async).withKeys(Keycodes.expandKpadInputKey(key)));
                } else {
                    throw new IllegalArgumentException("kpad requires text or --key");
                }
                for (KpadOption option : options) {
                    if (!async) {
                        option.withSyncIgnoreOutput(true);
                    }
                    port.keypad(option);
                }
                yield "kpad sent";
            }
            case "raw" -> port.sendDirective(String.join(" ", args));
            case "raw-async" -> {
                port.sendDirectiveAsync(String.join(" ", args));
                yield "raw-async sent";
            }
            default -> throw new IllegalArgumentException("unknown command: " + command);
        };
    }

    private static int findCommandIndex(String[] args) {
        for (int index = 0; index < args.length; index++) {
            String token = args[index];
            if (COMMON_BOOLEAN_FLAGS.contains(token)) {
                continue;
            }
            if (COMMON_VALUE_FLAGS.contains(token)) {
                index += 1;
                continue;
            }
            return index;
        }
        return -1;
    }

    private static ParsedArgs parseArgs(String[] argv, Set<String> booleanFlags) {
        Map<String, String> flags = new HashMap<>();
        Set<String> switches = new HashSet<>();
        List<String> positionals = new ArrayList<>();
        for (int index = 0; index < argv.length; index++) {
            String token = argv[index];
            if (COMMON_BOOLEAN_FLAGS.contains(token) || booleanFlags.contains(token)) {
                switches.add(token);
                continue;
            }
            if (COMMON_VALUE_FLAGS.contains(token)) {
                if (index + 1 >= argv.length) {
                    throw new IllegalArgumentException("missing value for " + token);
                }
                flags.put(token, argv[++index]);
                continue;
            }
            if (token.startsWith("--")) {
                if (index + 1 < argv.length && !argv[index + 1].startsWith("--")) {
                    flags.put(token, argv[++index]);
                } else {
                    switches.add(token);
                }
                continue;
            }
            positionals.add(token);
        }
        return new ParsedArgs(flags, switches, positionals);
    }

    private static String renderValue(Object value, boolean jsonOutput) throws Exception {
        if (value == null) {
            return "";
        }
        if (value instanceof String text && !jsonOutput) {
            return text;
        }
        return MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(value);
    }

    private static String requirePositional(List<String> args, String name, int index) {
        if (index >= args.size()) {
            throw new IllegalArgumentException("missing required argument: " + name);
        }
        return args.get(index);
    }

    private static Integer parseOptionIntNullable(ParsedArgs parsed, String name) {
        String value = optionString(parsed, name);
        return value == null ? null : Integer.parseInt(value);
    }

    private static int parseOptionInt(ParsedArgs parsed, String name, int defaultValue) {
        String value = optionString(parsed, name);
        return value == null ? defaultValue : Integer.parseInt(value);
    }

    private static String optionString(ParsedArgs parsed, String name) {
        return parsed.flags().get(name);
    }

    private static boolean hasSwitch(ParsedArgs parsed, String name) {
        return parsed.switches().contains(name);
    }

    private static String stringFlag(ParsedArgs parsed, String name) {
        return parsed.flags().get(name);
    }

    private static int parseIntFlag(ParsedArgs parsed, String name, int defaultValue) {
        String raw = parsed.flags().get(name);
        return raw == null ? defaultValue : Integer.parseInt(raw);
    }

    private static String getenv(String name) {
        try {
            return System.getenv(name);
        } catch (SecurityException ignored) {
            return null;
        }
    }

    private static boolean contains(String[] args, String target) {
        for (String arg : args) {
            if (target.equals(arg)) {
                return true;
            }
        }
        return false;
    }

    private record ParsedArgs(Map<String, String> flags, Set<String> switches, List<String> positionals) {
    }
}
