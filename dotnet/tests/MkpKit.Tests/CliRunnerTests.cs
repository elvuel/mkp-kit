using MkpKit;
using MkpKit.Models;
using MkpKit.Serial;
using Xunit;

namespace MkpKit.Tests;

public sealed class CliRunnerTests
{
    [Fact]
    public async Task CliPrintsUsageWithNoArgs()
    {
        var harness = new CliHarness();
        var code = await CliRunner.RunAsync([], harness.Deps);
        Assert.Equal(0, code);
        Assert.Contains("Usage:", harness.Stdout);
        Assert.Empty(harness.CreatedPorts);
    }

    [Fact]
    public async Task CliAcceptsPortBeforeCommand()
    {
        var harness = new CliHarness();
        var code = await CliRunner.RunAsync(["--port", "COM9", "sn"], harness.Deps);
        Assert.Equal(0, code);
        Assert.Equal("COM9", harness.LastConfig?.Name);
        Assert.Contains("SAMPLE-SN", harness.Stdout);
        Assert.Equal(1, harness.CreatedPorts[0].Opened);
        Assert.Equal(1, harness.CreatedPorts[0].Closed);
    }

    [Fact]
    public async Task CliM10DispatchesMovement()
    {
        var harness = new CliHarness();
        var code = await CliRunner.RunAsync(["m10", "--x", "-400", "--y", "25"], harness.Deps);
        Assert.Equal(0, code);
        Assert.Equal("--x -400 --y 25", harness.CreatedPorts[0].MouseCalls[0]);
        Assert.Contains("ok", harness.Stdout);
    }

    [Fact]
    public async Task CliKpadTypesTextFromPositionals()
    {
        var harness = new CliHarness();
        var code = await CliRunner.RunAsync(["kpad", "Hello"], harness.Deps);
        Assert.Equal(0, code);
        Assert.Equal(5, harness.CreatedPorts[0].KeypadCalls.Count);
        Assert.Contains("ok", harness.Stdout);
    }

    [Fact]
    public async Task CliRawDispatchesDirective()
    {
        var harness = new CliHarness();
        var code = await CliRunner.RunAsync(["raw", "sn"], harness.Deps);
        Assert.Equal(0, code);
        Assert.Equal("sn", harness.CreatedPorts[0].RawCalls[0]);
        Assert.Contains("cli>", harness.Stdout);
    }

    [Fact]
    public async Task CliAplayDispatchesAsyncReplayDirective()
    {
        var harness = new CliHarness();
        var code = await CliRunner.RunAsync(["aplay", "demo", "--delay", "-1"], harness.Deps);
        Assert.Equal(0, code);
        Assert.Contains("async:aplay /eMMC/applog/demo.log --delay -1", harness.CreatedPorts[0].RawCalls);
        Assert.Contains("ok", harness.Stdout);
    }

    [Fact]
    public async Task CliUnknownCommandReturnsOne()
    {
        var harness = new CliHarness();
        var code = await CliRunner.RunAsync(["unknown-cmd"], harness.Deps);
        Assert.Equal(1, code);
        Assert.Contains("unknown command", harness.Stderr, StringComparison.OrdinalIgnoreCase);
    }

    private sealed class CliHarness
    {
        private readonly StringWriter _out = new();
        private readonly StringWriter _err = new();

        public List<FakePort> CreatedPorts { get; } = [];
        public CliPortConfig? LastConfig { get; private set; }
        public string Stdout => _out.ToString();
        public string Stderr => _err.ToString();

        public CliDeps Deps => new()
        {
            Out = _out,
            Err = _err,
            DetectPort = () => "COM77",
            CreatePort = config =>
            {
                LastConfig = config;
                var port = new FakePort();
                CreatedPorts.Add(port);
                return port;
            }
        };
    }

    private sealed class FakePort : ISFSerialPort
    {
        public int Opened { get; private set; }
        public int Closed { get; private set; }
        public List<string> MouseCalls { get; } = [];
        public List<string> KeypadCalls { get; } = [];
        public List<string> RawCalls { get; } = [];

        public string Name => "COM77";
        public string MousePortFlag => "1";
        public string KeyboardPortFlag => "2";
        public int SyncOutputTimeoutMs => 10_000;

        public Task OpenAsync(CancellationToken cancellationToken = default) { Opened += 1; return Task.CompletedTask; }
        public Task CloseAsync(CancellationToken cancellationToken = default) { Closed += 1; return Task.CompletedTask; }
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        public SerialPortStatus SnapshotStatus() => new(Name, true, SyncOutputTimeoutMs, true);
        public Task<string> SendDirectiveAsync(string directive, CancellationToken cancellationToken = default) { RawCalls.Add(directive); return Task.FromResult(directive + "\ncli>"); }
        public Task SendDirectiveNoWaitAsync(string directive, CancellationToken cancellationToken = default) { RawCalls.Add("async:" + directive); return Task.CompletedTask; }
        public Task<SN> SnAsync(CancellationToken cancellationToken = default) => Task.FromResult(new SN("SAMPLE-SN"));
        public Task<Heartbeat> AliveAsync(CancellationToken cancellationToken = default) => Task.FromResult(new Heartbeat(1));
        public Task<MKPVersion> AVersionAsync(CancellationToken cancellationToken = default) => Task.FromResult(new MKPVersion(App: "1.0.0"));
        public Task<LogLength> ATimeAsync(string path, CancellationToken cancellationToken = default) => Task.FromResult(new LogLength(Raw: null));
        public Task<LogInfo> AInspAsync(string path, CancellationToken cancellationToken = default) => Task.FromResult(new LogInfo(Path: path));
        public Task<FileSystem> ListDirAsync(string path, CancellationToken cancellationToken = default) => Task.FromResult(new FileSystem(RootDir: new FileNode("root", path, "dir")));
        public Task<string> CleanDirAsync(string path, CancellationToken cancellationToken = default) => Task.FromResult("cleaned:" + path);
        public Task<string> DeleteFileAsync(string path, CancellationToken cancellationToken = default) => Task.FromResult("deleted:" + path);
        public Task<string> JoinAsync(JoinOption? option = null, CancellationToken cancellationToken = default) => Task.FromResult("joined");
        public Task<string> WifiAutoAsync(WifiAutoOption? option = null, CancellationToken cancellationToken = default) => Task.FromResult("ok");
        public Task<AHTTPBase> AHttpBaseAsync(AHTTPBaseOption? option = null, CancellationToken cancellationToken = default) => Task.FromResult(new AHTTPBase("http://127.0.0.1:8080"));
        public Task<ActionDump> ADumjAsync(string path, CancellationToken cancellationToken = default) => Task.FromResult(new ActionDump());
        public Task<string> AGetAsync(AGetOption option, CancellationToken cancellationToken = default) => Task.FromResult("downloaded");
        public Task<string> APutAsync(APutOption option, CancellationToken cancellationToken = default) => Task.FromResult("uploaded");
        public Task<string> AJson2LogAsync(AJSON2LogOption option, CancellationToken cancellationToken = default) => Task.FromResult("saved");
        public Task<string> ALogAsync(string args = "", CancellationToken cancellationToken = default) => Task.FromResult("recording");
        public Task<string> AStopAsync(CancellationToken cancellationToken = default) => Task.FromResult("stopped");
        public Task<string> ACancelAsync(CancellationToken cancellationToken = default) => Task.FromResult("canceled");
        public Task APlayAsync(APlayOption option, CancellationToken cancellationToken = default) { RawCalls.Add($"async:aplay {SFSerialPort.ComposeLogFullpath(option.LogPath)} --delay {option.Delay}"); return Task.CompletedTask; }
        public Task Mouse10Async(M10Option option, CancellationToken cancellationToken = default) { MouseCalls.Add(option.ToCliFragment()); return Task.CompletedTask; }
        public Task KeypadAsync(KpadOption option, CancellationToken cancellationToken = default) { KeypadCalls.Add(option.ToCliFragment()); return Task.CompletedTask; }
    }
}
