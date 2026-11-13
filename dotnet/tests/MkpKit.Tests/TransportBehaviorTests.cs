using MkpKit.Models;
using MkpKit.Parser;
using MkpKit.Serial;
using Xunit;

namespace MkpKit.Tests;

public sealed class TransportBehaviorTests
{
    [Fact]
    public void ExtractsSyncOutputUsingDefaultEofAndSkipsStalePrompt()
    {
        const string buffer = "cli>\r\nold noise\r\nsn\r\n{\"sn\":\"demo-sn\"}\r\n<EOF>\r\ncli>";

        var extracted = SyncOutputExtraction.Extract(buffer, "sn", DirectiveEofFlags.Default);

        Assert.NotNull(extracted.Output);
        Assert.Contains("demo-sn", extracted.Output);
        Assert.DoesNotContain("cli>", extracted.Output);
    }

    [Fact]
    public async Task SendDirectiveAsyncUsesParserSpecificEofFlag()
    {
        var transport = new CaptureTransport("sn\n{\"sn\":\"demo-sn\"}\n<EOF>\n");
        var sfport = new SFSerialPort(new SerialPortOptions
        {
            Transport = transport,
            ParserRegistry = DirectiveParserRegistry.CreateDefault()
        });

        _ = await sfport.SendDirectiveAsync("sn");

        Assert.Equal("sn", transport.LastDirective);
        Assert.Equal(DirectiveEofFlags.Default, transport.LastEofFlag);
    }

    [Fact]
    public async Task SendDirectiveAsyncFallsBackToCliPromptForUnknownDirective()
    {
        var transport = new CaptureTransport("m10 --port 1 --x 10\ncli>");
        var sfport = new SFSerialPort(new SerialPortOptions
        {
            Transport = transport,
            ParserRegistry = DirectiveParserRegistry.CreateDefault()
        });

        _ = await sfport.SendDirectiveAsync("m10 --port 1 --x 10");

        Assert.Equal(DirectiveEofFlags.Cli, transport.LastEofFlag);
    }

    [Fact]
    public async Task ParsedDirectiveUsesAHttpBaseOkFallback()
    {
        var transport = new InMemoryTransport()
            .AddFixture("ahttpbase http://127.0.0.1:8080", "ahttpbase http://127.0.0.1:8080\nOK\ncli>");
        var sfport = new SFSerialPort(new SerialPortOptions
        {
            Transport = transport,
            ParserRegistry = DirectiveParserRegistry.CreateDefault()
        });

        var parsed = await sfport.AHttpBaseAsync(new AHTTPBaseOption("http://127.0.0.1:8080"));

        Assert.Equal("http://127.0.0.1:8080", parsed.Ahttpbase);
    }

    private sealed class CaptureTransport(string response) : ISerialTransport
    {
        public bool IsOpen { get; private set; }
        public string? LastDirective { get; private set; }
        public string? LastEofFlag { get; private set; }
        public int LastTimeoutMs { get; private set; }

        public Task OpenAsync(CancellationToken cancellationToken = default)
        {
            IsOpen = true;
            return Task.CompletedTask;
        }

        public Task CloseAsync(CancellationToken cancellationToken = default)
        {
            IsOpen = false;
            return Task.CompletedTask;
        }

        public Task SendAsync(string directive, CancellationToken cancellationToken = default)
        {
            LastDirective = directive;
            return Task.CompletedTask;
        }

        public Task<string> SendAndReceiveAsync(string directive, string eofFlag, int timeoutMs, CancellationToken cancellationToken = default)
        {
            LastDirective = directive;
            LastEofFlag = eofFlag;
            LastTimeoutMs = timeoutMs;
            return Task.FromResult(response);
        }

        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
    }
}
