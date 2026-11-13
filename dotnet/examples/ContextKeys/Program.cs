using MkpKit.Controller;
using MkpKit.Examples.Common;
using MkpKit.Models;
using MkpKit.Serial;

return await MainAsync(args);

static async Task<int> MainAsync(string[] args)
{
    const string usage = """
usage: dotnet run --project .\examples\ContextKeys -- <keys|context> [--port COMx]

modes:
  keys     connect to a real device and demonstrate keyDown/keyUp/keyTap
  context  use a fake slow transport to demonstrate CancellationToken-based cancellation
""";

    if (args.Length == 0)
    {
        Console.WriteLine(usage);
        return 1;
    }

    var mode = args[0].Trim().ToLowerInvariant();
    if (mode is "--help" or "-h")
    {
        Console.WriteLine(usage);
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
        Console.WriteLine(usage);
        return 1;
    }

    if (parsed.HelpRequested || parsed.Positionals.Count != 0)
    {
        Console.WriteLine(usage);
        return parsed.HelpRequested ? 0 : 1;
    }

    try
    {
        switch (mode)
        {
            case "keys":
                return await RunKeysAsync(parsed.Port);
            case "context":
                return await RunContextAsync();
            default:
                Console.WriteLine(usage);
                return 1;
        }
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine(ex);
        return 1;
    }
}

static async Task<int> RunKeysAsync(string? port)
{
    await using var sfport = ExampleSupport.CreateSfPort(port);
    await sfport.OpenAsync();

    var controller = new Controller(sfport);

    Console.WriteLine("sleep 5s");
    await Task.Delay(TimeSpan.FromSeconds(5));
    Console.WriteLine("--start--");

    var option = new KpadOption().WithSyncIgnoreOutput(true);

    await controller.KeyDownAsync("w", option);
    await controller.KeyDownAsync("d", option);
    await Task.Delay(TimeSpan.FromSeconds(3));
    await controller.KeyUpAsync("d", option);
    await controller.KeyUpAsync("w", option);

    await controller.KeyDownAsync("alt", option);
    await controller.KeyDownAsync("n", option);
    await Task.Delay(200);
    await controller.KeyUpAsync("n", option);
    await controller.KeyUpAsync("alt", option);

    await Task.Delay(TimeSpan.FromSeconds(3));
    await controller.KeyTapAsync("esc", option);

    await Task.Delay(TimeSpan.FromSeconds(3));
    await controller.KeyDownAsync("MOD_LALT", option);
    await controller.KeyDownAsync("q", option);
    await Task.Delay(600);
    await controller.KeyUpAsync("q", option);
    await controller.KeyUpAsync("MOD_LALT", option);

    await Task.Delay(TimeSpan.FromSeconds(3));
    await controller.KeyDownAsync("space", option);
    await Task.Delay(TimeSpan.FromSeconds(3));
    await controller.KeyUpAsync("space", option);
    await controller.KeypadReleaseAllAsync(option);

    Console.WriteLine("keys 示例完成");
    return 0;
}

static async Task<int> RunContextAsync()
{
    Console.WriteLine("=== case 1: timeout cancel ===");
    var timeoutPort = new SFSerialPort(new SerialPortOptions
    {
        Transport = new SlowTransport(),
        SyncOutputTimeoutMs = 10_000
    });

    using (var timeoutCts = new CancellationTokenSource(TimeSpan.FromMilliseconds(1)))
    {
        try
        {
            var result = await timeoutPort.ALogAsync("mkpdemo/demo", timeoutCts.Token);
            Console.WriteLine($"result={result}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"result=\"\" err={ex.Message}");
            Console.WriteLine($"is canceled: {timeoutCts.IsCancellationRequested}");
        }
    }

    Console.WriteLine("=== case 2: manual cancel ===");
    var manualPort = new SFSerialPort(new SerialPortOptions
    {
        Transport = new SlowTransport(),
        SyncOutputTimeoutMs = 10_000
    });

    using var manualCts = new CancellationTokenSource();
    _ = Task.Run(async () =>
    {
        await Task.Delay(20);
        manualCts.Cancel();
    });

    try
    {
        var result = await manualPort.ALogAsync("mkpdemo/demo", manualCts.Token);
        Console.WriteLine($"result={result}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"result=\"\" err={ex.Message}");
        Console.WriteLine($"is canceled: {manualCts.IsCancellationRequested}");
    }

    return 0;
}

file sealed class SlowTransport : ISerialTransport
{
    public bool IsOpen => true;

    public Task OpenAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task CloseAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;

    public Task SendAsync(string directive, CancellationToken cancellationToken = default) => Task.CompletedTask;

    public async Task<string> SendAndReceiveAsync(string directive, string eofFlag, int timeoutMs, CancellationToken cancellationToken = default)
    {
        await Task.Delay(100, cancellationToken);
        return $"{directive}\nok\ncli>";
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
