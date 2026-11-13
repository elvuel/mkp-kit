using System.Diagnostics;
using System.IO.Ports;
using System.Text;
using MkpKit.Diagnostics;
using MkpKit.Models;
using MkpKit.Parser;

namespace MkpKit.Serial;

public sealed class SerialPortOptions
{
    public string Name { get; init; } = "COM3";
    public string MousePortFlag { get; init; } = "1";
    public string KeyboardPortFlag { get; init; } = "2";
    public int SyncOutputTimeoutMs { get; init; } = 10_000;
    public int BaudRate { get; init; } = 115_200;
    public ISerialTransport? Transport { get; init; }
    public DirectiveParserRegistry? ParserRegistry { get; init; }
}

public interface ISerialTransport : IAsyncDisposable
{
    bool IsOpen { get; }
    Task OpenAsync(CancellationToken cancellationToken = default);
    Task CloseAsync(CancellationToken cancellationToken = default);
    Task SendAsync(string directive, CancellationToken cancellationToken = default);
    Task<string> SendAndReceiveAsync(string directive, string eofFlag, int timeoutMs, CancellationToken cancellationToken = default);
}

public interface ISFSerialPort : IAsyncDisposable
{
    string Name { get; }
    string MousePortFlag { get; }
    string KeyboardPortFlag { get; }
    int SyncOutputTimeoutMs { get; }
    SerialPortStatus SnapshotStatus();
    Task OpenAsync(CancellationToken cancellationToken = default);
    Task CloseAsync(CancellationToken cancellationToken = default);
    Task<string> SendDirectiveAsync(string directive, CancellationToken cancellationToken = default);
    Task SendDirectiveNoWaitAsync(string directive, CancellationToken cancellationToken = default);
    Task<SN> SnAsync(CancellationToken cancellationToken = default);
    Task<Heartbeat> AliveAsync(CancellationToken cancellationToken = default);
    Task<MKPVersion> AVersionAsync(CancellationToken cancellationToken = default);
    Task<LogLength> ATimeAsync(string path, CancellationToken cancellationToken = default);
    Task<LogInfo> AInspAsync(string path, CancellationToken cancellationToken = default);
    Task<FileSystem> ListDirAsync(string path, CancellationToken cancellationToken = default);
    Task<string> CleanDirAsync(string path, CancellationToken cancellationToken = default);
    Task<string> DeleteFileAsync(string path, CancellationToken cancellationToken = default);
    Task<string> JoinAsync(JoinOption? option = null, CancellationToken cancellationToken = default);
    Task<string> WifiAutoAsync(WifiAutoOption? option = null, CancellationToken cancellationToken = default);
    Task<AHTTPBase> AHttpBaseAsync(AHTTPBaseOption? option = null, CancellationToken cancellationToken = default);
    Task<ActionDump> ADumjAsync(string path, CancellationToken cancellationToken = default);
    Task<string> AGetAsync(AGetOption option, CancellationToken cancellationToken = default);
    Task<string> APutAsync(APutOption option, CancellationToken cancellationToken = default);
    Task<string> AJson2LogAsync(AJSON2LogOption option, CancellationToken cancellationToken = default);
    Task<string> ALogAsync(string args = "", CancellationToken cancellationToken = default);
    Task<string> AStopAsync(CancellationToken cancellationToken = default);
    Task<string> ACancelAsync(CancellationToken cancellationToken = default);
    Task APlayAsync(APlayOption option, CancellationToken cancellationToken = default);
    Task Mouse10Async(M10Option option, CancellationToken cancellationToken = default);
    Task KeypadAsync(KpadOption option, CancellationToken cancellationToken = default);
}

public readonly record struct ExtractedSyncOutput(string? Output, string Remaining);

public static class SyncOutputExtraction
{
    public static ExtractedSyncOutput Extract(string buffer, string directive, string eofFlag)
    {
        var hitIndex = buffer.IndexOf(directive, StringComparison.Ordinal);
        if (hitIndex < 0)
        {
            return new(null, buffer);
        }

        var segment = buffer[hitIndex..];
        var outputCompletedIndex = -1;
        if (string.Equals(eofFlag, DirectiveEofFlags.Cli, StringComparison.Ordinal))
        {
            outputCompletedIndex = segment.IndexOf(DirectiveEofFlags.Cli, StringComparison.Ordinal);
        }
        else
        {
            var candidates = new[]
            {
                segment.IndexOf(DirectiveEofFlags.Default, StringComparison.Ordinal),
                segment.IndexOf(DirectiveEofFlags.Cli, StringComparison.Ordinal)
            }.Where(index => index >= 0).ToArray();
            outputCompletedIndex = candidates.Length > 0 ? candidates.Min() : -1;
        }

        if (outputCompletedIndex < 0)
        {
            return new(null, buffer);
        }

        return new(segment[..outputCompletedIndex], string.Empty);
    }
}

public sealed class SystemIoPortsTransport : ISerialTransport
{
    private readonly System.IO.Ports.SerialPort _serialPort;
    private readonly SemaphoreSlim _ioGate = new(1, 1);

    public SystemIoPortsTransport(string portName, int baudRate)
    {
        PortName = portName;
        BaudRate = baudRate;
        _serialPort = new System.IO.Ports.SerialPort(portName, baudRate, Parity.None, 8, StopBits.One)
        {
            NewLine = "\r\n",
            Encoding = Encoding.UTF8,
            ReadTimeout = 50,
            WriteTimeout = 1_000,
            DtrEnable = false,
            RtsEnable = false
        };
    }

    public string PortName { get; }
    public int BaudRate { get; }
    public bool IsOpen => _serialPort.IsOpen;

    public async Task OpenAsync(CancellationToken cancellationToken = default)
    {
        if (_serialPort.IsOpen)
        {
            return;
        }

        await Task.Run(() => _serialPort.Open(), cancellationToken);
        DrainBuffers();
    }

    public async Task CloseAsync(CancellationToken cancellationToken = default)
    {
        await _ioGate.WaitAsync(cancellationToken);
        try
        {
            if (!_serialPort.IsOpen)
            {
                return;
            }

            await Task.Run(() => _serialPort.Close(), cancellationToken);
        }
        finally
        {
            _ioGate.Release();
        }
    }

    public async Task SendAsync(string directive, CancellationToken cancellationToken = default)
    {
        await OpenAsync(cancellationToken);
        await _ioGate.WaitAsync(cancellationToken);
        try
        {
            DrainBuffers();
            await WriteDirectiveAsync(directive, cancellationToken);
        }
        finally
        {
            _ioGate.Release();
        }
    }

    public async Task<string> SendAndReceiveAsync(string directive, string eofFlag, int timeoutMs, CancellationToken cancellationToken = default)
    {
        await OpenAsync(cancellationToken);
        await _ioGate.WaitAsync(cancellationToken);
        try
        {
            DrainBuffers();
            await WriteDirectiveAsync(directive, cancellationToken);

            var buffer = new StringBuilder();
            var stopwatch = Stopwatch.StartNew();
            while (stopwatch.ElapsedMilliseconds < timeoutMs)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var chunk = ReadAvailable();
                if (!string.IsNullOrEmpty(chunk))
                {
                    buffer.Append(chunk);
                    var extracted = SyncOutputExtraction.Extract(buffer.ToString(), directive, eofFlag);
                    if (extracted.Output is not null)
                    {
                        return extracted.Output;
                    }
                }

                await Task.Delay(15, cancellationToken);
            }

            var tail = ReadAvailable();
            if (!string.IsNullOrEmpty(tail))
            {
                buffer.Append(tail);
                var extracted = SyncOutputExtraction.Extract(buffer.ToString(), directive, eofFlag);
                if (extracted.Output is not null)
                {
                    return extracted.Output;
                }
            }

            throw new DirectiveTimeoutException(directive, timeoutMs);
        }
        finally
        {
            _ioGate.Release();
        }
    }

    public ValueTask DisposeAsync()
    {
        if (_serialPort.IsOpen)
        {
            _serialPort.Close();
        }

        _serialPort.Dispose();
        _ioGate.Dispose();
        return ValueTask.CompletedTask;
    }

    private async Task WriteDirectiveAsync(string directive, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        await Task.Run(() =>
        {
            _serialPort.Write(directive + "\r\n");
            _serialPort.BaseStream.Flush();
        }, cancellationToken);
    }

    private string ReadAvailable()
    {
        if (!_serialPort.IsOpen || _serialPort.BytesToRead <= 0)
        {
            return string.Empty;
        }

        return _serialPort.ReadExisting();
    }

    private void DrainBuffers()
    {
        if (!_serialPort.IsOpen)
        {
            return;
        }

        _serialPort.DiscardInBuffer();
        _serialPort.DiscardOutBuffer();
        while (_serialPort.BytesToRead > 0)
        {
            _ = _serialPort.ReadExisting();
            Thread.Sleep(5);
        }
    }
}

public sealed class InMemoryTransport : ISerialTransport
{
    private readonly Dictionary<string, string> _fixtures = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<string> _sent = [];

    public bool IsOpen { get; private set; }
    public IReadOnlyList<string> SentDirectives => _sent;

    public InMemoryTransport AddFixture(string directive, string rawOutput)
    {
        _fixtures[directive] = rawOutput;
        return this;
    }

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
        _sent.Add(directive);
        return Task.CompletedTask;
    }

    public Task<string> SendAndReceiveAsync(string directive, string eofFlag, int timeoutMs, CancellationToken cancellationToken = default)
    {
        _sent.Add(directive);
        if (_fixtures.TryGetValue(directive, out var raw))
        {
            return Task.FromResult(raw);
        }

        throw new DirectiveTimeoutException(directive, timeoutMs);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}

public sealed class SFSerialPort : ISFSerialPort
{
    private readonly ISerialTransport _transport;
    private readonly DirectiveParserRegistry _parsers;

    public SFSerialPort(SerialPortOptions options)
    {
        Name = options.Name;
        MousePortFlag = options.MousePortFlag;
        KeyboardPortFlag = options.KeyboardPortFlag;
        SyncOutputTimeoutMs = options.SyncOutputTimeoutMs;
        _transport = options.Transport ?? new SystemIoPortsTransport(options.Name, options.BaudRate);
        _parsers = options.ParserRegistry ?? DirectiveParserRegistry.CreateDefault();
    }

    public string Name { get; }
    public string MousePortFlag { get; }
    public string KeyboardPortFlag { get; }
    public int SyncOutputTimeoutMs { get; }

    public SerialPortStatus SnapshotStatus() => new(Name, _transport.IsOpen, SyncOutputTimeoutMs, true);

    public Task OpenAsync(CancellationToken cancellationToken = default) => _transport.OpenAsync(cancellationToken);

    public Task CloseAsync(CancellationToken cancellationToken = default) => _transport.CloseAsync(cancellationToken);

    public Task<string> SendDirectiveAsync(string directive, CancellationToken cancellationToken = default)
    {
        var eofFlag = _parsers.TryResolve(directive, out var parser) && parser is not null
            ? parser.EofFlag
            : DirectiveEofFlags.Cli;
        return _transport.SendAndReceiveAsync(directive, eofFlag, SyncOutputTimeoutMs, cancellationToken);
    }

    public Task SendDirectiveNoWaitAsync(string directive, CancellationToken cancellationToken = default)
    {
        return _transport.SendAsync(directive, cancellationToken);
    }

    public async Task<T> SendParsedAsync<T>(string directive, CancellationToken cancellationToken = default)
    {
        var raw = await SendDirectiveAsync(directive, cancellationToken);
        var parser = _parsers.Resolve(directive);
        var parsed = parser.Parse(directive, raw);
        if (parsed is T value)
        {
            return value;
        }

        throw new DirectiveParseFailedException(directive, $"type-mismatch:{typeof(T).Name}");
    }

    public Task<SN> SnAsync(CancellationToken cancellationToken = default) => SendParsedAsync<SN>("sn", cancellationToken);
    public Task<Heartbeat> AliveAsync(CancellationToken cancellationToken = default) => SendParsedAsync<Heartbeat>("alive", cancellationToken);
    public Task<MKPVersion> AVersionAsync(CancellationToken cancellationToken = default) => SendParsedAsync<MKPVersion>("aversion", cancellationToken);
    public Task<LogLength> ATimeAsync(string path, CancellationToken cancellationToken = default) => SendParsedAsync<LogLength>($"atime {ComposeLogFullpath(path)}", cancellationToken);
    public Task<LogInfo> AInspAsync(string path, CancellationToken cancellationToken = default) => SendParsedAsync<LogInfo>($"ainsp {ComposeLogFullpath(path)}", cancellationToken);
    public Task<FileSystem> ListDirAsync(string path, CancellationToken cancellationToken = default) => SendParsedAsync<FileSystem>($"list_dir {path}", cancellationToken);
    public Task<string> CleanDirAsync(string path, CancellationToken cancellationToken = default) => SendParsedAsync<string>($"clean_dir {path}", cancellationToken);
    public Task<string> DeleteFileAsync(string path, CancellationToken cancellationToken = default) => SendParsedAsync<string>($"delete_file {path}", cancellationToken);
    public Task<string> JoinAsync(JoinOption? option = null, CancellationToken cancellationToken = default)
    {
        if (option is null)
        {
            return SendParsedAsync<string>("join", cancellationToken);
        }

        var suffix = string.Join(' ', option.CliArgs());
        return SendParsedAsync<string>(string.IsNullOrWhiteSpace(suffix) ? "join" : $"join {suffix}", cancellationToken);
    }

    public Task<string> WifiAutoAsync(WifiAutoOption? option = null, CancellationToken cancellationToken = default)
    {
        var suffix = string.Join(' ', (option ?? new WifiAutoOption()).CliArgs());
        return SendParsedAsync<string>(string.IsNullOrWhiteSpace(suffix) ? "wifi_auto" : $"wifi_auto {suffix}", cancellationToken);
    }

    public Task<AHTTPBase> AHttpBaseAsync(AHTTPBaseOption? option = null, CancellationToken cancellationToken = default)
    {
        var suffix = string.Join(' ', (option ?? new AHTTPBaseOption()).CliArgs());
        return SendParsedAsync<AHTTPBase>(string.IsNullOrWhiteSpace(suffix) ? "ahttpbase" : $"ahttpbase {suffix}", cancellationToken);
    }

    public Task<ActionDump> ADumjAsync(string path, CancellationToken cancellationToken = default) => SendParsedAsync<ActionDump>($"adumj {ComposeLogFullpath(path)}", cancellationToken);
    public Task<string> AGetAsync(AGetOption option, CancellationToken cancellationToken = default) => SendParsedAsync<string>($"aget {string.Join(' ', option.CliArgs())}", cancellationToken);
    public Task<string> APutAsync(APutOption option, CancellationToken cancellationToken = default) => SendParsedAsync<string>($"aput {string.Join(' ', option.CliArgs())}", cancellationToken);
    public Task<string> AJson2LogAsync(AJSON2LogOption option, CancellationToken cancellationToken = default) => SendParsedAsync<string>($"ajson2log {string.Join(' ', option.CliArgs())}", cancellationToken);
    public Task<string> ALogAsync(string args = "", CancellationToken cancellationToken = default) => SendParsedAsync<string>(string.IsNullOrWhiteSpace(args) ? "alog" : $"alog {args}", cancellationToken);
    public Task<string> AStopAsync(CancellationToken cancellationToken = default) => SendParsedAsync<string>("astop", cancellationToken);
    public Task<string> ACancelAsync(CancellationToken cancellationToken = default) => SendParsedAsync<string>("acancel", cancellationToken);
    public Task APlayAsync(APlayOption option, CancellationToken cancellationToken = default) => SendDirectiveNoWaitAsync($"aplay {string.Join(' ', new APlayOption(ComposeLogFullpath(option.LogPath), option.Delay).CliArgs())}", cancellationToken);

    public async Task Mouse10Async(M10Option option, CancellationToken cancellationToken = default)
    {
        var directive = "m10 --port " + MousePortFlag;
        var fragment = option.ToCliFragment();
        if (!string.IsNullOrWhiteSpace(fragment))
        {
            directive += " " + fragment;
        }

        if (option.IsAsync())
        {
            await _transport.SendAsync(directive, cancellationToken);
            return;
        }

        _ = await SendDirectiveAsync(directive, cancellationToken);
    }

    public async Task KeypadAsync(KpadOption option, CancellationToken cancellationToken = default)
    {
        var directive = "kpad --port " + KeyboardPortFlag;
        var fragment = option.ToCliFragment();
        if (!string.IsNullOrWhiteSpace(fragment))
        {
            directive += " " + fragment;
        }

        if (option.IsAsync())
        {
            await _transport.SendAsync(directive, cancellationToken);
            option.CommitState();
            return;
        }

        _ = await SendDirectiveAsync(directive, cancellationToken);
        option.CommitState();
    }

    public static string CheckSfSerialPort()
    {
        var value = Environment.GetEnvironmentVariable("MKP_SFPORT");
        if (!string.IsNullOrWhiteSpace(value)) return value;
        value = Environment.GetEnvironmentVariable("MKP_SF_PORT");
        if (!string.IsNullOrWhiteSpace(value)) return value;
        throw new MkpException("failed to auto-detect SF serial port in .NET; pass --port COMx or set MKP_SFPORT/MKP_SF_PORT explicitly");
    }

    public static string ComposeLogFullpath(string path)
    {
        var normalized = path.EndsWith(".log", StringComparison.OrdinalIgnoreCase) ? path : path + ".log";
        return normalized.StartsWith("/eMMC/applog/", StringComparison.OrdinalIgnoreCase)
            ? normalized
            : "/eMMC/applog/" + normalized.TrimStart('/');
    }

    public ValueTask DisposeAsync() => _transport.DisposeAsync();
}
