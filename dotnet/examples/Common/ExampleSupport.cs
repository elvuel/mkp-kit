using System.Text.Json;
using MkpKit.Serial;

namespace MkpKit.Examples.Common;

public sealed record ExampleArguments(bool HelpRequested, string? Port, IReadOnlyList<string> Positionals);

public static class ExampleSupport
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true
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
            default:
                Console.WriteLine(JsonSerializer.Serialize(value, JsonOptions));
                return;
        }
    }
}
