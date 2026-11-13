using System.Text.Json;
using MkpKit.Controller;
using MkpKit.Models;
using MkpKit.Serial;

namespace MkpKit;

public sealed record CliPortConfig(
    string Name,
    string? MousePortFlag = null,
    string? KeyboardPortFlag = null,
    int? SyncOutputTimeoutMs = null);

public sealed class CliDeps
{
    public required TextWriter Out { get; init; }
    public required TextWriter Err { get; init; }
    public required Func<CliPortConfig, ISFSerialPort> CreatePort { get; init; }
    public required Func<string> DetectPort { get; init; }
}

internal sealed record ParsedCliArgs(Dictionary<string, string?> Flags, List<string> Positionals);

public static class CliRunner
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    public static Task<int> RunAsync(string[] args, CliDeps? deps = null, CancellationToken cancellationToken = default)
    {
        deps ??= DefaultDeps();
        return RunCoreAsync(args, deps, cancellationToken);
    }

    public static string Usage() => string.Join('\n',
    [
        "Usage:",
        "  mkp-dotnet [--port COM3] [--timeout 10000] <command> [args...]",
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
        "  wifi_auto [0|1]",
        "  ahttpbase [url]",
        "  aget <filepath>",
        "  aput <filepath>",
        "  adumj <log_path>",
        "  ajson2log <jsonpath> <savepath>",
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
    ]);

    private static async Task<int> RunCoreAsync(string[] args, CliDeps deps, CancellationToken cancellationToken)
    {
        if (args.Length == 0 || args.Contains("-h") || args.Contains("--help"))
        {
            await deps.Out.WriteLineAsync(Usage());
            return 0;
        }

        ParsedCliArgs parsed;
        try
        {
            parsed = ParseArgs(args);
        }
        catch (Exception ex)
        {
            await deps.Err.WriteLineAsync(ex.Message);
            await deps.Err.WriteLineAsync(Usage());
            return 1;
        }

        if (parsed.Positionals.Count == 0)
        {
            await deps.Out.WriteLineAsync(Usage());
            return 0;
        }

        var command = parsed.Positionals[0].Trim().ToLowerInvariant();
        var commandArgs = parsed.Positionals.Skip(1).ToArray();
        if (command == "status")
        {
            await deps.Out.WriteLineAsync($"{MkpKitInfo.Language} {MkpKitInfo.Stage} {MkpKitInfo.Version}");
            return 0;
        }

        var portName = parsed.Flags.TryGetValue("--port", out var portValue) && !string.IsNullOrWhiteSpace(portValue)
            ? portValue!
            : deps.DetectPort();
        var timeoutMs = ParseIntFlag(parsed.Flags, "--timeout", 10_000);
        var mousePortFlag = parsed.Flags.TryGetValue("--mouse-port", out var mousePort) ? mousePort : null;
        var keyboardPortFlag = parsed.Flags.TryGetValue("--keyboard-port", out var keyboardPort) ? keyboardPort : null;
        var jsonOutput = parsed.Flags.ContainsKey("--json");

        await using var port = deps.CreatePort(new CliPortConfig(portName, mousePortFlag, keyboardPortFlag, timeoutMs));

        try
        {
            await port.OpenAsync(cancellationToken);
            var exitCode = await DispatchAsync(port, command, commandArgs, deps, jsonOutput, cancellationToken);
            await port.CloseAsync(cancellationToken);
            return exitCode;
        }
        catch (Exception ex)
        {
            await deps.Err.WriteLineAsync(ex.Message);
            return 1;
        }
    }

    private static async Task<int> DispatchAsync(ISFSerialPort port, string command, string[] args, CliDeps deps, bool jsonOutput, CancellationToken cancellationToken)
    {
        switch (command)
        {
            case "sn":
                return await PrintAsync(deps.Out, await port.SnAsync(cancellationToken), jsonOutput);
            case "alive":
                return await PrintAsync(deps.Out, await port.AliveAsync(cancellationToken), jsonOutput);
            case "aversion":
                return await PrintAsync(deps.Out, await port.AVersionAsync(cancellationToken), jsonOutput);
            case "atime":
                RequireArgs(command, args, 1);
                return await PrintAsync(deps.Out, await port.ATimeAsync(args[0], cancellationToken), jsonOutput);
            case "ainsp":
                RequireArgs(command, args, 1);
                return await PrintAsync(deps.Out, await port.AInspAsync(args[0], cancellationToken), jsonOutput);
            case "list_dir":
                RequireArgs(command, args, 1);
                return await PrintAsync(deps.Out, await port.ListDirAsync(args[0], cancellationToken), jsonOutput);
            case "clean_dir":
                RequireArgs(command, args, 1);
                return await PrintAsync(deps.Out, await port.CleanDirAsync(args[0], cancellationToken), jsonOutput);
            case "delete_file":
                RequireArgs(command, args, 1);
                return await PrintAsync(deps.Out, await port.DeleteFileAsync(args[0], cancellationToken), jsonOutput);
            case "join":
                if (args.Length == 0) return await PrintAsync(deps.Out, await port.JoinAsync(cancellationToken: cancellationToken), jsonOutput);
                if (args.Length == 2) return await PrintAsync(deps.Out, await port.JoinAsync(new JoinOption(args[0], args[1]), cancellationToken), jsonOutput);
                throw new InvalidOperationException("join expects zero args or <ssid> <password>");
            case "wifi_auto":
                if (args.Length == 0) return await PrintAsync(deps.Out, await port.WifiAutoAsync(cancellationToken: cancellationToken), jsonOutput);
                if (args.Length == 1 && args[0] is "0" or "1") return await PrintAsync(deps.Out, await port.WifiAutoAsync(new WifiAutoOption(args[0]), cancellationToken), jsonOutput);
                throw new InvalidOperationException("wifi_auto expects [0|1]");
            case "ahttpbase":
                if (args.Length == 0) return await PrintAsync(deps.Out, await port.AHttpBaseAsync(cancellationToken: cancellationToken), jsonOutput);
                if (args.Length == 1) return await PrintAsync(deps.Out, await port.AHttpBaseAsync(new AHTTPBaseOption(args[0]), cancellationToken), jsonOutput);
                throw new InvalidOperationException("ahttpbase expects [url]");
            case "aget":
                RequireArgs(command, args, 1);
                return await PrintAsync(deps.Out, await port.AGetAsync(new AGetOption(args[0]), cancellationToken), jsonOutput);
            case "aput":
                RequireArgs(command, args, 1);
                return await PrintAsync(deps.Out, await port.APutAsync(new APutOption(args[0]), cancellationToken), jsonOutput);
            case "adumj":
                RequireArgs(command, args, 1);
                return await PrintAsync(deps.Out, await port.ADumjAsync(args[0], cancellationToken), jsonOutput);
            case "ajson2log":
                RequireArgs(command, args, 2);
                return await PrintAsync(deps.Out, await port.AJson2LogAsync(new AJSON2LogOption(args[0], args[1]), cancellationToken), jsonOutput);
            case "alog":
                return await PrintAsync(deps.Out, await port.ALogAsync(string.Join(' ', args), cancellationToken), jsonOutput);
            case "astop":
                return await PrintAsync(deps.Out, await port.AStopAsync(cancellationToken), jsonOutput);
            case "acancel":
                return await PrintAsync(deps.Out, await port.ACancelAsync(cancellationToken), jsonOutput);
            case "aplay":
                await RunAplayAsync(port, args, cancellationToken);
                await deps.Out.WriteLineAsync("ok");
                return 0;
            case "m10":
                await RunM10Async(port, args, cancellationToken);
                await deps.Out.WriteLineAsync("ok");
                return 0;
            case "kpad":
                await RunKpadAsync(port, args, cancellationToken);
                await deps.Out.WriteLineAsync("ok");
                return 0;
            case "raw":
                if (args.Length == 0) throw new InvalidOperationException("raw expects <directive...>");
                return await PrintAsync(deps.Out, await port.SendDirectiveAsync(string.Join(' ', args), cancellationToken), false);
            case "raw-async":
                if (args.Length == 0) throw new InvalidOperationException("raw-async expects <directive...>");
                await port.SendDirectiveNoWaitAsync(string.Join(' ', args), cancellationToken);
                await deps.Out.WriteLineAsync("ok");
                return 0;
            default:
                await deps.Err.WriteLineAsync($"unknown command: {command}");
                return 1;
        }
    }

    private static async Task RunM10Async(ISFSerialPort port, string[] args, CancellationToken cancellationToken)
    {
        var option = new M10Option();
        for (var index = 0; index < args.Length; index++)
        {
            var token = args[index];
            switch (token)
            {
                case "--x": option.SetX(ParseIntValue(args, ref index, token)); break;
                case "--y": option.SetY(ParseIntValue(args, ref index, token)); break;
                case "--w": option.SetWheel(ParseIntValue(args, ref index, token)); break;
                case "--b": option.SetButton(ParseIntValue(args, ref index, token)); break;
                case "--async": option.WithAsync(true); break;
                case "--sync": option.WithAsync(false); break;
                default: throw new InvalidOperationException($"unknown m10 flag: {token}");
            }
        }

        await port.Mouse10Async(option, cancellationToken);
    }

    private static async Task RunAplayAsync(ISFSerialPort port, string[] args, CancellationToken cancellationToken)
    {
        if (args.Length == 0)
        {
            throw new InvalidOperationException("aplay expects <log_path> [--delay <n>]");
        }

        string? path = null;
        var delay = -1;
        for (var index = 0; index < args.Length; index++)
        {
            var token = args[index];
            switch (token)
            {
                case "--delay":
                    delay = ParseIntValue(args, ref index, token);
                    break;
                default:
                    if (token.StartsWith("--", StringComparison.Ordinal)) throw new InvalidOperationException($"unknown aplay flag: {token}");
                    path ??= token;
                    break;
            }
        }

        if (string.IsNullOrWhiteSpace(path)) throw new InvalidOperationException("aplay expects <log_path>");
        await port.APlayAsync(new APlayOption(path, delay), cancellationToken);
    }

    private static async Task RunKpadAsync(ISFSerialPort port, string[] args, CancellationToken cancellationToken)
    {
        var delay = 0;
        var release = 1;
        var asyncMode = false;
        var text = string.Empty;
        var explicitKey = string.Empty;

        for (var index = 0; index < args.Length; index++)
        {
            var token = args[index];
            switch (token)
            {
                case "--text": text = ReadStringValue(args, ref index, token); break;
                case "--key": explicitKey = ReadStringValue(args, ref index, token); break;
                case "--delay": delay = ParseIntValue(args, ref index, token); break;
                case "--rel": release = ParseIntValue(args, ref index, token); break;
                case "--async": asyncMode = true; break;
                default:
                    if (token.StartsWith("--", StringComparison.Ordinal)) throw new InvalidOperationException($"unknown kpad flag: {token}");
                    text += token;
                    break;
            }
        }

        if (!string.IsNullOrWhiteSpace(explicitKey))
        {
            var option = new KpadOption().WithDelay(delay).WithRelease(release).WithKeys(KpadKeycodes.ExpandKpadInputKey(explicitKey)).WithAsync(asyncMode);
            await port.KeypadAsync(option, cancellationToken);
            return;
        }

        if (string.IsNullOrEmpty(text)) throw new InvalidOperationException("kpad expects text or --key");

        foreach (var key in text.Select(ch => ch.ToString()))
        {
            var option = new KpadOption().WithDelay(delay).WithRelease(release).WithKeys(KpadKeycodes.ExpandKpadInputKey(key)).WithAsync(asyncMode);
            await port.KeypadAsync(option, cancellationToken);
        }
    }

    private static CliDeps DefaultDeps()
    {
        return new CliDeps
        {
            Out = Console.Out,
            Err = Console.Error,
            DetectPort = SFSerialPort.CheckSfSerialPort,
            CreatePort = config => new SFSerialPort(new SerialPortOptions
            {
                Name = config.Name,
                MousePortFlag = config.MousePortFlag ?? "1",
                KeyboardPortFlag = config.KeyboardPortFlag ?? "2",
                SyncOutputTimeoutMs = config.SyncOutputTimeoutMs ?? 10_000
            })
        };
    }

    private static ParsedCliArgs ParseArgs(string[] args)
    {
        var flags = new Dictionary<string, string?>(StringComparer.Ordinal);
        var positionals = new List<string>();
        for (var index = 0; index < args.Length; index++)
        {
            var token = args[index];
            switch (token)
            {
                case "--json":
                    flags[token] = null;
                    break;
                case "--port":
                case "--timeout":
                case "--mouse-port":
                case "--keyboard-port":
                    if (index + 1 >= args.Length) throw new InvalidOperationException($"missing value for {token}");
                    flags[token] = args[++index];
                    break;
                default:
                    positionals.Add(token);
                    break;
            }
        }

        return new ParsedCliArgs(flags, positionals);
    }

    private static int ParseIntFlag(Dictionary<string, string?> flags, string name, int defaultValue)
    {
        return flags.TryGetValue(name, out var value) && int.TryParse(value, out var parsed) ? parsed : defaultValue;
    }

    private static int ParseIntValue(IReadOnlyList<string> args, ref int index, string token)
    {
        index += 1;
        if (index >= args.Count || !int.TryParse(args[index], out var value)) throw new InvalidOperationException($"invalid value for {token}");
        return value;
    }

    private static string ReadStringValue(IReadOnlyList<string> args, ref int index, string token)
    {
        index += 1;
        if (index >= args.Count) throw new InvalidOperationException($"missing value for {token}");
        return args[index];
    }

    private static void RequireArgs(string command, string[] args, int count)
    {
        if (args.Length != count) throw new InvalidOperationException($"{command} expects {count} argument(s)");
    }

    private static async Task<int> PrintAsync(TextWriter output, object? value, bool forceJson)
    {
        string text;
        if (value is null)
        {
            text = string.Empty;
        }
        else if (!forceJson && value is string plain)
        {
            text = plain;
        }
        else
        {
            text = JsonSerializer.Serialize(value, JsonOptions);
        }

        await output.WriteLineAsync(text);
        return 0;
    }
}
