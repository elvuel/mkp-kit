using MkpKit.Converter;
using Xunit;

namespace MkpKit.Converter.Tests;

public sealed class ConverterTests
{
    [Fact]
    public void ConverterDirectionIsInferredFromExtension()
    {
        Assert.Equal(Direction.LogToJson, ConverterCore.DirectionFromPath("demo.log"));
        Assert.Equal(Direction.JsonToLog, ConverterCore.DirectionFromPath("demo.json"));
        Assert.Equal(Direction.Unknown, ConverterCore.DirectionFromPath("demo.txt"));
    }

    [Fact]
    public void MouseEncodeDecodeRoundtrip()
    {
        var cases = new[]
        {
            (button: 0, x: 0, y: 0, wheel: 0),
            (button: 1, x: 5, y: -3, wheel: 0),
            (button: 2, x: -2048, y: 2047, wheel: -1),
            (button: 4, x: 1024, y: -1024, wheel: 12)
        };

        foreach (var item in cases)
        {
            var decoded = ConverterCore.MouseDecode(ConverterCore.MouseEncode(item.button, item.x, item.y, item.wheel));
            Assert.Equal(item.button, decoded.Button);
            Assert.Equal(item.x, decoded.X);
            Assert.Equal(item.y, decoded.Y);
            Assert.Equal(item.wheel, decoded.Wheel);
        }
    }

    [Fact]
    public void JsonReadWriteRoundtrip()
    {
        var path = Path.Combine(Path.GetTempPath(), Guid.NewGuid() + ".json");
        try
        {
            var env = new Envelope
            {
                Version = ConverterCore.MagicV2,
                Meta = new MetaJson(1920, 1080, 200, 300),
                Events =
                [
                    new Event { TypeName = "MouseMove", MouseMove = new MouseMoveEvent(10, -5, 15) },
                    new Event { TypeName = "MouseDown", MouseDown = new ButtonEvent("left", 16) },
                    new Event { TypeName = "Wheel", Wheel = new WheelEvent(1, 17) },
                    new Event { TypeName = "KeyDown", KeyDown = new KeyEvent(["lshift", "a"], 18) }
                ]
            };

            ConverterCore.WriteJsonFile(path, env);
            var loaded = ConverterCore.ReadJsonFile(path);
            Assert.Equal(System.Text.Json.JsonSerializer.Serialize(env.ToJsonObject()), System.Text.Json.JsonSerializer.Serialize(loaded.ToJsonObject()));
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }

    [Fact]
    public void LogJsonRoundtripIsStable()
    {
        var root = Path.Combine(Path.GetTempPath(), "mkp-dotnet-converter-" + Guid.NewGuid());
        Directory.CreateDirectory(root);
        var logPath = Path.Combine(root, "rt.log");
        var jsonPath = Path.Combine(root, "rt.json");
        var log2Path = Path.Combine(root, "rt2.log");
        var json2Path = Path.Combine(root, "rt2.json");

        try
        {
            var header = new LogHeader(ConverterCore.MagicV1, new Meta());
            var records = new List<Record>
            {
                new(1, 0, 5, ConverterCore.MouseEncode(0, 5, -3, 0)),
                new(1, 8, 5, ConverterCore.MouseEncode(1, 0, 0, 0)),
                new(1, 16, 5, ConverterCore.MouseEncode(0, 10, 7, 0)),
                new(1, 8, 5, ConverterCore.MouseEncode(0, 0, 0, 1)),
                new(2, 8, 8, [0, 0, 0x04, 0, 0, 0, 0, 0]),
                new(2, 16, 8, [0, 0, 0, 0, 0, 0, 0, 0]),
                new(2, 8, 8, [0x02, 0, 0x04, 0, 0, 0, 0, 0]),
                new(2, 8, 8, [0x02, 0, 0, 0, 0, 0, 0, 0]),
                new(2, 8, 8, [0, 0, 0, 0, 0, 0, 0, 0])
            };

            ConverterCore.WriteLogFile(logPath, header, records, hasMouse: true, hasKeyboard: true);
            ConverterCore.ConvertLogFileToJsonFile(logPath, jsonPath);
            ConverterCore.ConvertJsonFileToLogFile(jsonPath, log2Path);
            ConverterCore.ConvertLogFileToJsonFile(log2Path, json2Path);

            Assert.Equal(File.ReadAllText(jsonPath), File.ReadAllText(json2Path));
        }
        finally
        {
            Directory.Delete(root, true);
        }
    }

    [Fact]
    public void JsonToLogPreservesFirstEventTimestamp()
    {
        var env = new Envelope
        {
            Events =
            [
                new Event { TypeName = "MouseMove", MouseMove = new MouseMoveEvent(4, 9, 123) },
                new Event { TypeName = "MouseDown", MouseDown = new ButtonEvent("left", 140) },
                new Event { TypeName = "KeyDown", KeyDown = new KeyEvent(["a"], 160) }
            ]
        };

        var result = ConverterCore.JsonToLog(env);
        Assert.Equal(ConverterCore.MagicV1, result.Header.Version);
        Assert.True(result.HasMouse);
        Assert.True(result.HasKeyboard);
        Assert.Equal(123, result.Records[0].Delta);
        Assert.Equal(17, result.Records[1].Delta);
        Assert.Equal(20, result.Records[2].Delta);
    }

    [Fact]
    public void ConverterCliAppendsTargetExtension()
    {
        var root = Path.Combine(Path.GetTempPath(), "mkp-dotnet-converter-cli-" + Guid.NewGuid());
        Directory.CreateDirectory(root);
        var inputJson = Path.Combine(root, "demo.json");
        var outputBase = Path.Combine(root, "artifact");
        try
        {
            ConverterCore.WriteJsonFile(inputJson, new Envelope
            {
                Events = [new Event { TypeName = "KeyDown", KeyDown = new KeyEvent(["a"], 1) }]
            });

            var stdout = new StringWriter();
            var stderr = new StringWriter();
            var code = ConverterCli.Run(["-f", inputJson, "-o", outputBase], stdout, stderr);
            Assert.Equal(0, code);
            Assert.Equal(string.Empty, stderr.ToString());
            Assert.Contains("json -> log:", stdout.ToString(), StringComparison.OrdinalIgnoreCase);
            Assert.True(File.Exists(outputBase + ".log"));
        }
        finally
        {
            Directory.Delete(root, true);
        }
    }
}
