using System.Text.Json;
using System.Text.Json.Serialization;
using MkpKit.Models;
using MkpKit.Serial;

namespace MkpKit.Examples.Common;

public sealed record ExampleArguments(bool HelpRequested, string? Port, IReadOnlyList<string> Positionals);

public static class ExampleSupport
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public static ExampleArguments Parse(string[] args)
    {
        var positionals = new List<string>();
        string? port = null;
        var helpRequested = false;

        for (var index = 0; index < args.Length; index++)
        {
            var arg = args[index];
            switch (arg)
            {
                case "--help":
                case "-h":
                    helpRequested = true;
                    break;
                case "--port":
                case "-p":
                    if (index + 1 >= args.Length)
                    {
                        throw new ArgumentException("missing value for --port");
                    }

                    port = args[++index];
                    break;
                default:
                    positionals.Add(arg);
                    break;
            }
        }

        return new ExampleArguments(helpRequested, port, positionals);
    }

    public static string ResolvePort(string? port)
    {
        return string.IsNullOrWhiteSpace(port)
            ? SFSerialPort.CheckSfSerialPort()
            : port;
    }

    public static SFSerialPort CreateSfPort(string? port, int timeoutMs = 10_000)
    {
        return new SFSerialPort(new SerialPortOptions
        {
            Name = ResolvePort(port),
            SyncOutputTimeoutMs = timeoutMs
        });
    }

    public static void PrintValue(object? value)
    {
        switch (value)
        {
            case null:
                return;
            case string text:
                Console.WriteLine(text);
                return;
            case JsonElement json:
                Console.WriteLine(JsonSerializer.Serialize(json, JsonOptions));
                return;
            case SN sn:
                Console.WriteLine(JsonSerializer.Serialize(new { sn = sn.Sn }, JsonOptions));
                return;
            case Heartbeat heartbeat:
                Console.WriteLine(JsonSerializer.Serialize(new { timetamp = heartbeat.Timetamp }, JsonOptions));
                return;
            case MKPVersion version:
                Console.WriteLine(JsonSerializer.Serialize(new
                {
                    uver = FirstNonEmpty(version.Uver, version.App),
                    aver = FirstNonEmpty(version.Aver, version.Boot)
                }, JsonOptions));
                return;
            case LogLength length:
                Console.WriteLine(JsonSerializer.Serialize(new { seconds = length.Seconds, milsec = length.Milsec }, JsonOptions));
                return;
            case LogInfo info:
                Console.WriteLine(JsonSerializer.Serialize(new
                {
                    seconds = info.Seconds,
                    milsec = info.Milsec,
                    width = info.Width,
                    heigh = info.Height,
                    stpos = info.Stpos is null ? null : new { x = info.Stpos.X, y = info.Stpos.Y }
                }, JsonOptions));
                return;
            case AHTTPBase httpBase:
                Console.WriteLine(JsonSerializer.Serialize(new { ahttpbase = httpBase.Ahttpbase }, JsonOptions));
                return;
            case FileSystem fs:
                Console.WriteLine(JsonSerializer.Serialize(new
                {
                    rootDir = NormalizeFileNode(fs.RootDir),
                    error = fs.Error
                }, JsonOptions));
                return;
            case ActionDump dump:
                Console.WriteLine(JsonSerializer.Serialize(new { actions = dump.Actions, meta = dump.Meta }, JsonOptions));
                return;
            default:
                Console.WriteLine(JsonSerializer.Serialize(value, JsonOptions));
                return;
        }
    }

    private static object? NormalizeFileNode(FileNode? node)
    {
        if (node is null)
        {
            return null;
        }

        return new
        {
            name = node.Name,
            path = node.Path,
            type = node.Type,
            size = node.Size,
            displayName = node.DisplayName,
            contents = node.Contents?.Select(NormalizeFileNode).ToArray()
        };
    }

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value;
            }
        }

        return string.Empty;
    }
}
