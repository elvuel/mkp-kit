using MkpKit.Examples.Common;
using MkpKit.Models;
using MkpKit.Serial;

return await MainAsync(args);

static async Task<int> MainAsync(string[] args)
{
    const string generalUsage = """
usage: dotnet run --project .\examples\Directives -- <directive> [args...] [--port COMx]

directives:
  sn | aversion | alive
  list_dir [path]
  clean_dir [path]
  delete_file [path]
  join [ssid password]
  wifi_auto [0|1]
  ahttpbase [http-base-url]
  ainsp [log-path]
  atime [log-path]
  adumj <log-path>
  aget <file-server-path>
  aput <mkp-file-path>
  ajson2log <json-path> <mkp-log-path>
  alog [log-name]
  astop
  acancel
  aplay <log-path> [delay]
""";

    if (args.Length == 0)
    {
        Console.WriteLine(generalUsage);
        return 1;
    }

    var command = args[0].Trim().ToLowerInvariant();
    if (command is "--help" or "-h")
    {
        Console.WriteLine(generalUsage);
        return 0;
    }

    ExampleArguments parsed;
    try
    {
        parsed = ExampleSupport.Parse(args[1..]);
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine(ex.Message);
        Console.WriteLine(CommandUsage(command));
        return 1;
    }

    if (parsed.HelpRequested)
    {
        Console.WriteLine(CommandUsage(command));
        return 0;
    }

    try
    {
        await using var sfport = ExampleSupport.CreateSfPort(parsed.Port, 30_000);
        await sfport.OpenAsync();

        var output = await RunDirectiveAsync(sfport, command, parsed.Positionals);
        ExampleSupport.PrintValue(output);
        return 0;
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine(ex);
        return 1;
    }
}

static async Task<object?> RunDirectiveAsync(MkpKit.Serial.SFSerialPort sfport, string command, IReadOnlyList<string> args)
{
    switch (command)
    {
        case "sn":
            RequireArgCount(args, 0, CommandUsage(command));
            return await sfport.SnAsync();
        case "aversion":
            RequireArgCount(args, 0, CommandUsage(command));
            return await sfport.AVersionAsync();
        case "alive":
            RequireArgCount(args, 0, CommandUsage(command));
            return await sfport.AliveAsync();
        case "list_dir":
            RequireArgMax(args, 1, CommandUsage(command));
            return await sfport.ListDirAsync(args.Count == 0 ? "/eMMC" : args[0]);
        case "clean_dir":
            RequireArgMax(args, 1, CommandUsage(command));
            return await sfport.CleanDirAsync(args.Count == 0 ? "/eMMC/applog/subdir1" : args[0]);
        case "delete_file":
            RequireArgMax(args, 1, CommandUsage(command));
            return await sfport.DeleteFileAsync(args.Count == 0 ? "/eMMC/applog/uuu3.log" : args[0]);
        case "join":
            if (args.Count == 0)
            {
                return await sfport.JoinAsync();
            }

            if (args.Count == 2)
            {
                return await sfport.JoinAsync(new JoinOption(args[0], args[1]));
            }

            throw new ArgumentException(CommandUsage(command));
        case "wifi_auto":
            if (args.Count == 0)
            {
                return await sfport.WifiAutoAsync();
            }

            if (args.Count == 1 && args[0] is "0" or "1")
            {
                return await sfport.WifiAutoAsync(new WifiAutoOption(args[0]));
            }

            throw new ArgumentException(CommandUsage(command));
        case "ahttpbase":
            if (args.Count == 0)
            {
                return await sfport.AHttpBaseAsync();
            }

            if (args.Count == 1)
            {
                return await sfport.AHttpBaseAsync(new AHTTPBaseOption(args[0]));
            }

            throw new ArgumentException(CommandUsage(command));
        case "ainsp":
            RequireArgMax(args, 1, CommandUsage(command));
            return await sfport.AInspAsync(args.Count == 0 ? "/eMMC/applog/uuu2.log" : args[0]);
        case "atime":
            RequireArgMax(args, 1, CommandUsage(command));
            return await sfport.ATimeAsync(args.Count == 0 ? "/eMMC/applog/uuu2.log" : args[0]);
        case "adumj":
            RequireArgCount(args, 1, CommandUsage(command));
            return await sfport.ADumjAsync(args[0]);
        case "aget":
            RequireArgCount(args, 1, CommandUsage(command));
            return await sfport.AGetAsync(new AGetOption(args[0]));
        case "aput":
            RequireArgCount(args, 1, CommandUsage(command));
            return await sfport.APutAsync(new APutOption(args[0]));
        case "ajson2log":
            RequireArgCount(args, 2, CommandUsage(command));
            return await sfport.AJson2LogAsync(new AJSON2LogOption(args[0], args[1]));
        case "alog":
            RequireArgMax(args, 1, CommandUsage(command));
            return await sfport.ALogAsync(args.Count == 0 ? "subdir1/test" : args[0]);
        case "astop":
            RequireArgCount(args, 0, CommandUsage(command));
            return await sfport.AStopAsync();
        case "acancel":
            RequireArgCount(args, 0, CommandUsage(command));
            return await sfport.ACancelAsync();
        case "aplay":
            if (args.Count is 0 or > 2)
            {
                throw new ArgumentException(CommandUsage(command));
            }

            var delay = -1;
            if (args.Count == 2 && !int.TryParse(args[1], out delay))
            {
                throw new ArgumentException(CommandUsage(command));
            }

            await sfport.APlayAsync(new APlayOption(args[0], delay));
            return new { status = "started", path = SFSerialPort.ComposeLogFullpath(args[0]), delay };
        default:
            throw new ArgumentException(CommandUsage(command));
    }
}

static void RequireArgCount(IReadOnlyList<string> args, int expected, string usage)
{
    if (args.Count != expected)
    {
        throw new ArgumentException(usage);
    }
}

static void RequireArgMax(IReadOnlyList<string> args, int max, string usage)
{
    if (args.Count > max)
    {
        throw new ArgumentException(usage);
    }
}

static string CommandUsage(string command)
{
    return command switch
    {
        "sn" => "usage: dotnet run --project .\\examples\\Directives -- sn [--port COMx]",
        "aversion" => "usage: dotnet run --project .\\examples\\Directives -- aversion [--port COMx]",
        "alive" => "usage: dotnet run --project .\\examples\\Directives -- alive [--port COMx]",
        "list_dir" => "usage: dotnet run --project .\\examples\\Directives -- list_dir [/path] [--port COMx]",
        "clean_dir" => "usage: dotnet run --project .\\examples\\Directives -- clean_dir [/path] [--port COMx]",
        "delete_file" => "usage: dotnet run --project .\\examples\\Directives -- delete_file [/path] [--port COMx]",
        "join" => "usage: dotnet run --project .\\examples\\Directives -- join [ssid password] [--port COMx]",
        "wifi_auto" => "usage: dotnet run --project .\\examples\\Directives -- wifi_auto [0|1] [--port COMx]",
        "ahttpbase" => "usage: dotnet run --project .\\examples\\Directives -- ahttpbase [http-base-url] [--port COMx]",
        "ainsp" => "usage: dotnet run --project .\\examples\\Directives -- ainsp [/eMMC/applog/demo.log] [--port COMx]",
        "atime" => "usage: dotnet run --project .\\examples\\Directives -- atime [/eMMC/applog/demo.log] [--port COMx]",
        "adumj" => "usage: dotnet run --project .\\examples\\Directives -- adumj <log-path> [--port COMx]",
        "aget" => "usage: dotnet run --project .\\examples\\Directives -- aget <file-server-path> [--port COMx]",
        "aput" => "usage: dotnet run --project .\\examples\\Directives -- aput <mkp-file-path> [--port COMx]",
        "ajson2log" => "usage: dotnet run --project .\\examples\\Directives -- ajson2log <json-path> <mkp-log-path> [--port COMx]",
        "alog" => "usage: dotnet run --project .\\examples\\Directives -- alog [log-name] [--port COMx]",
        "astop" => "usage: dotnet run --project .\\examples\\Directives -- astop [--port COMx]",
        "acancel" => "usage: dotnet run --project .\\examples\\Directives -- acancel [--port COMx]",
        "aplay" => "usage: dotnet run --project .\\examples\\Directives -- aplay <log-path> [delay] [--port COMx]",
        _ => "usage: dotnet run --project .\\examples\\Directives -- <directive> [args...] [--port COMx]"
    };
}
