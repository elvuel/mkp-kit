using MkpKit.Helpers;
using MkpKit.Models;
using MkpKit.Serial;
using Xunit;

namespace MkpKit.Tests;

public sealed class KpadOptionTests
{
    [Fact]
    public void KpadOptionFormatsCli()
    {
        var option = new KpadOption()
            .WithKeys(["MOD_LSHIFT", "H"])
            .WithAutoRelease();

        Assert.Equal("--s 0x02 --x1 0x0b --rel 1 --d 0", option.ToCliFragment());
    }

    [Fact]
    public void ExpandPrintableSymbolToShiftCombo()
    {
        Assert.Equal(["MOD_LSHIFT", "1"], KpadKeycodes.ExpandKpadInputKey("!"));
    }

    [Fact]
    public async Task TypeTextAsyncBuildsExpectedHelloMkpSequence()
    {
        KpadPressedState.Reset();
        var transport = new InMemoryTransport();
        var sfport = new SFSerialPort(new SerialPortOptions
        {
            Transport = transport,
            ParserRegistry = Parser.DirectiveParserRegistry.CreateDefault()
        });

        await DeviceHelpers.TypeTextAsync(sfport, "Hello MKP!");

        Assert.Equal(10, transport.SentDirectives.Count);
        Assert.Equal("kpad --port 2 --s 0x02 --x1 0x0b --rel 1 --d 0", transport.SentDirectives[0]);
        Assert.Equal("kpad --port 2 --x1 0x08 --rel 1 --d 0", transport.SentDirectives[1]);
        Assert.Equal("kpad --port 2 --x1 0x2c --rel 1 --d 0", transport.SentDirectives[5]);
        Assert.Equal("kpad --port 2 --s 0x02 --x1 0x1e --rel 1 --d 0", transport.SentDirectives[^1]);
    }

    [Fact]
    public async Task KeyDownAndKeyUpAdvancePressedState()
    {
        KpadPressedState.Reset();
        var transport = new InMemoryTransport();
        var sfport = new SFSerialPort(new SerialPortOptions
        {
            Transport = transport,
            ParserRegistry = Parser.DirectiveParserRegistry.CreateDefault()
        });

        await DeviceHelpers.KeyDownAsync(sfport, "a");
        await DeviceHelpers.KeyUpAsync(sfport, "a");

        Assert.Equal("kpad --port 2 --x1 0x04 --rel 0 --d 0", transport.SentDirectives[0]);
        Assert.Equal("kpad --port 2 --x1 0x04 --rel 1 --d 0", transport.SentDirectives[1]);
        Assert.Equal("kpad --port 2 --x1 0x00 --rel 0 --d 0", transport.SentDirectives[2]);

        var snapshot = KpadPressedState.Snapshot();
        Assert.Empty(snapshot.ModKeys);
        Assert.Empty(snapshot.Keys);
    }
}
