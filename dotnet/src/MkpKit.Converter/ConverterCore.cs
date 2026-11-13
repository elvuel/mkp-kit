using System.Buffers.Binary;
using System.Text.Json;
using MkpKit.Models;

namespace MkpKit.Converter;

public enum Direction
{
    Unknown,
    LogToJson,
    JsonToLog
}

public sealed record Meta(int Width = 0, int Height = 0, int StartX = 0, int StartY = 0);

public sealed record LogHeader(string Version = ConverterCore.MagicV1, Meta? Meta = null)
{
    public Meta Meta { get; init; } = Meta ?? new Meta();
}

public sealed record Record(byte Port, int Delta, ushort Length, byte[] Payload);
public sealed record MetaJson(int Width = 0, int Height = 0, int StartX = 0, int StartY = 0);
public sealed record MouseMoveEvent(int X, int Y, int Ts);
public sealed record ButtonEvent(string Button, int Ts);
public sealed record WheelEvent(int Delta, int Ts);
public sealed record KeyEvent(IReadOnlyList<string> Keys, int Ts);

public sealed class Event
{
    public string TypeName { get; init; } = string.Empty;
    public MouseMoveEvent? MouseMove { get; init; }
    public ButtonEvent? MouseDown { get; init; }
    public ButtonEvent? MouseUp { get; init; }
    public WheelEvent? Wheel { get; init; }
    public KeyEvent? KeyDown { get; init; }
    public KeyEvent? KeyUp { get; init; }

    public int Timestamp => MouseMove?.Ts ?? MouseDown?.Ts ?? MouseUp?.Ts ?? Wheel?.Ts ?? KeyDown?.Ts ?? KeyUp?.Ts ?? 0;

    public object ToJsonObject()
    {
        if (MouseMove is not null) return new Dictionary<string, object?> { [TypeName == string.Empty ? "MouseMove" : TypeName] = MouseMove };
        if (MouseDown is not null) return new Dictionary<string, object?> { [TypeName == string.Empty ? "MouseDown" : TypeName] = MouseDown };
        if (MouseUp is not null) return new Dictionary<string, object?> { [TypeName == string.Empty ? "MouseUp" : TypeName] = MouseUp };
        if (Wheel is not null) return new Dictionary<string, object?> { [TypeName == string.Empty ? "Wheel" : TypeName] = Wheel };
        if (KeyDown is not null) return new Dictionary<string, object?> { [TypeName == string.Empty ? "KeyDown" : TypeName] = KeyDown };
        if (KeyUp is not null) return new Dictionary<string, object?> { [TypeName == string.Empty ? "KeyUp" : TypeName] = KeyUp };
        throw new InvalidOperationException("empty event");
    }

    public static Event FromJsonElement(JsonElement element)
    {
        if (element.ValueKind != JsonValueKind.Object)
        {
            throw new InvalidOperationException("event must be object");
        }

        var properties = element.EnumerateObject().ToArray();
        if (properties.Length != 1)
        {
            throw new InvalidOperationException($"event must have exactly one key, got {properties.Length}");
        }

        var property = properties[0];
        return property.Name switch
        {
            "MouseMove" => new Event { TypeName = property.Name, MouseMove = JsonSerializer.Deserialize<MouseMoveEvent>(property.Value)! },
            "MouseDown" => new Event { TypeName = property.Name, MouseDown = JsonSerializer.Deserialize<ButtonEvent>(property.Value)! },
            "MouseUp" => new Event { TypeName = property.Name, MouseUp = JsonSerializer.Deserialize<ButtonEvent>(property.Value)! },
            "Wheel" => new Event { TypeName = property.Name, Wheel = JsonSerializer.Deserialize<WheelEvent>(property.Value)! },
            "KeyDown" => new Event { TypeName = property.Name, KeyDown = JsonSerializer.Deserialize<KeyEvent>(property.Value)! },
            "KeyUp" => new Event { TypeName = property.Name, KeyUp = JsonSerializer.Deserialize<KeyEvent>(property.Value)! },
            _ => throw new InvalidOperationException($"unknown event type {property.Name}")
        };
    }
}

public sealed class Envelope
{
    public string Format { get; init; } = "mkp-action-v1";
    public string Version { get; init; } = ConverterCore.MagicV1;
    public MetaJson Meta { get; init; } = new();
    public List<Event> Events { get; init; } = [];

    public object ToJsonObject() => new Dictionary<string, object?>
    {
        ["format"] = Format,
        ["version"] = Version,
        ["meta"] = Meta,
        ["events"] = Events.Select(static item => item.ToJsonObject()).ToArray()
    };
}

public sealed record MouseReport(int Button, int X, int Y, int Wheel);
public sealed record JsonToLogResult(LogHeader Header, List<Record> Records, bool HasMouse, bool HasKeyboard);

public static class ConverterCore
{
    public const string MagicV1 = "MKv1";
    public const string MagicV2 = "MKv2";
    public const int MagicLength = 4;
    public const int RecordHeaderSize = 7;
    public const int MaxPayloadLength = 64;
    public const int KbdMaxKeys = 6;
    public const int MouseButtonLeft = 0x01;
    public const int MouseButtonRight = 0x02;
    public const int MouseButtonMiddle = 0x04;

    private static readonly string[] ModBitToName = ["lctrl", "lshift", "lalt", "lmeta", "rctrl", "rshift", "ralt", "rmeta"];

    public static Direction DirectionFromPath(string filePath)
    {
        return Path.GetExtension(filePath).ToLowerInvariant() switch
        {
            ".log" => Direction.LogToJson,
            ".json" => Direction.JsonToLog,
            _ => Direction.Unknown
        };
    }

    public static string SwapExt(string filePath, string newExtension)
    {
        return Path.ChangeExtension(filePath, newExtension) ?? filePath + newExtension;
    }

    public static byte[] MouseEncode(int button, int x, int y, int wheel)
    {
        var ux = x & 0x0FFF;
        var uy = y & 0x0FFF;
        return
        [
            (byte)(button & 0xFF),
            (byte)(ux & 0xFF),
            (byte)(((ux >> 8) & 0x0F) | ((uy & 0x0F) << 4)),
            (byte)((uy >> 4) & 0xFF),
            unchecked((byte)wheel)
        ];
    }

    public static MouseReport MouseDecode(byte[] payload)
    {
        if (payload.Length != 5)
        {
            throw new InvalidOperationException($"mouse payload must be 5 bytes, got {payload.Length}");
        }

        var ux = payload[1] | ((payload[2] & 0x0F) << 8);
        var uy = (payload[2] >> 4) | (payload[3] << 4);
        if ((ux & 0x0800) != 0) ux |= unchecked((short)0xF000);
        if ((uy & 0x0800) != 0) uy |= unchecked((short)0xF000);
        var x = unchecked((short)ux);
        var y = unchecked((short)uy);
        var wheel = unchecked((sbyte)payload[4]);
        return new MouseReport(payload[0], x, y, wheel);
    }

    public static Envelope ReadJsonFile(string path)
    {
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var root = document.RootElement;
        var env = new Envelope
        {
            Format = root.TryGetProperty("format", out var format) && format.ValueKind == JsonValueKind.String ? format.GetString() ?? "mkp-action-v1" : "mkp-action-v1",
            Version = root.TryGetProperty("version", out var version) && version.ValueKind == JsonValueKind.String ? version.GetString() ?? MagicV1 : MagicV1,
            Meta = root.TryGetProperty("meta", out var meta) ? JsonSerializer.Deserialize<MetaJson>(meta)! : new MetaJson(),
            Events = root.TryGetProperty("events", out var events) && events.ValueKind == JsonValueKind.Array
                ? events.EnumerateArray().Select(Event.FromJsonElement).ToList()
                : []
        };
        return env;
    }

    public static void WriteJsonFile(string path, Envelope envelope)
    {
        var json = JsonSerializer.Serialize(envelope.ToJsonObject(), new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(path, json + Environment.NewLine);
    }

    public static (LogHeader Header, List<Record> Records) ReadLogFile(string path)
    {
        var data = File.ReadAllBytes(path);
        if (data.Length < MagicLength)
        {
            throw new InvalidOperationException("empty log file");
        }

        var magic = System.Text.Encoding.ASCII.GetString(data, 0, MagicLength);
        var offset = MagicLength;
        LogHeader header;
        if (magic == MagicV1)
        {
            header = new LogHeader(MagicV1, new Meta());
        }
        else if (magic == MagicV2)
        {
            var width = BinaryPrimitives.ReadUInt16LittleEndian(data.AsSpan(offset, 2));
            var height = BinaryPrimitives.ReadUInt16LittleEndian(data.AsSpan(offset + 2, 2));
            var startX = BinaryPrimitives.ReadUInt16LittleEndian(data.AsSpan(offset + 4, 2));
            var startY = BinaryPrimitives.ReadUInt16LittleEndian(data.AsSpan(offset + 6, 2));
            header = new LogHeader(MagicV2, new Meta(width, height, startX, startY));
            offset += 12;
        }
        else
        {
            throw new InvalidOperationException($"bad magic {magic}");
        }

        var records = new List<Record>();
        while (offset < data.Length)
        {
            if (offset + RecordHeaderSize > data.Length) throw new InvalidOperationException("truncated record header");
            var port = data[offset];
            var delta = BinaryPrimitives.ReadInt32LittleEndian(data.AsSpan(offset + 1, 4));
            var length = BinaryPrimitives.ReadUInt16LittleEndian(data.AsSpan(offset + 5, 2));
            offset += RecordHeaderSize;
            if (length > MaxPayloadLength) throw new InvalidOperationException($"record length {length} exceeds cap {MaxPayloadLength}");
            if (offset + length > data.Length) throw new InvalidOperationException("truncated record payload");
            var payload = data.AsSpan(offset, length).ToArray();
            offset += length;
            records.Add(new Record(port, delta, length, payload));
        }

        return (header, records);
    }

    public static void WriteLogFile(string path, LogHeader header, IReadOnlyList<Record> records, bool hasMouse, bool hasKeyboard)
    {
        using var ms = new MemoryStream();
        using var bw = new BinaryWriter(ms);
        bw.Write(System.Text.Encoding.ASCII.GetBytes(header.Version == MagicV2 ? MagicV2 : MagicV1));
        if (header.Version == MagicV2)
        {
            bw.Write((ushort)header.Meta.Width);
            bw.Write((ushort)header.Meta.Height);
            bw.Write((ushort)header.Meta.StartX);
            bw.Write((ushort)header.Meta.StartY);
            bw.Write(0);
        }

        foreach (var record in records)
        {
            bw.Write(record.Port);
            bw.Write(record.Delta);
            bw.Write(record.Length);
            bw.Write(record.Payload);
        }

        if (hasMouse)
        {
            for (var index = 0; index < 3; index++)
            {
                bw.Write((byte)1);
                bw.Write(8);
                bw.Write((ushort)5);
                bw.Write(new byte[5]);
            }
        }

        if (hasKeyboard)
        {
            bw.Write((byte)2);
            bw.Write(8);
            bw.Write((ushort)8);
            bw.Write(new byte[8]);
        }

        File.WriteAllBytes(path, ms.ToArray());
    }

    public static Envelope LogToJson(LogHeader header, IReadOnlyList<Record> records)
    {
        var env = new Envelope
        {
            Format = "mkp-action-v1",
            Version = header.Version,
            Meta = new MetaJson(header.Meta.Width, header.Meta.Height, header.Meta.StartX, header.Meta.StartY)
        };

        var prevButton = 0;
        var prevModifier = 0;
        var prevKeys = new int[KbdMaxKeys];
        var ts = 0;

        foreach (var record in records)
        {
            ts += record.Delta;
            if (record.Port == 1 && record.Length == 5)
            {
                EmitMouseEvents(env, MouseDecode(record.Payload.Take(5).ToArray()), ref prevButton, ts);
            }
            else if (record.Port == 2 && record.Length == 8 && record.Payload.Length >= 8)
            {
                EmitKeyboardEvents(env, record.Payload[0], record.Payload.Skip(2).Take(6).Select(static item => (int)item).ToArray(), ref prevModifier, prevKeys, ts);
            }
        }

        return env;
    }

    public static JsonToLogResult JsonToLog(Envelope env)
    {
        var version = env.Version is MagicV1 or MagicV2 ? env.Version : MagicV1;
        var header = new LogHeader(version, new Meta(env.Meta.Width, env.Meta.Height, env.Meta.StartX & 0xFFFF, env.Meta.StartY & 0xFFFF));
        var records = new List<Record>();
        var currentButton = 0;
        var prevModifier = 0;
        var prevKeys = new int[KbdMaxKeys];
        var prevTs = 0;
        var first = true;
        var hasMouse = false;
        var hasKeyboard = false;

        for (var index = 0; index < env.Events.Count; index++)
        {
            var ev = env.Events[index];
            var ts = ev.Timestamp;
            var delta = first ? ts : ts - prevTs;
            if (delta < 0) delta = 0;
            first = false;
            prevTs = ts;

            if (ev.MouseMove is not null)
            {
                records.Add(new Record(1, delta, 5, MouseEncode(currentButton, ev.MouseMove.X, ev.MouseMove.Y, 0)));
                hasMouse = true;
            }
            else if (ev.MouseDown is not null)
            {
                currentButton |= ButtonBit(ev.MouseDown.Button);
                records.Add(new Record(1, delta, 5, MouseEncode(currentButton, 0, 0, 0)));
                hasMouse = true;
            }
            else if (ev.MouseUp is not null)
            {
                currentButton &= ~ButtonBit(ev.MouseUp.Button) & 0xFF;
                records.Add(new Record(1, delta, 5, MouseEncode(currentButton, 0, 0, 0)));
                hasMouse = true;
            }
            else if (ev.Wheel is not null)
            {
                records.Add(new Record(1, delta, 5, MouseEncode(currentButton, 0, 0, ev.Wheel.Delta)));
                hasMouse = true;
            }
            else if (ev.KeyDown is not null)
            {
                ApplyKeyboardNames(ref prevModifier, prevKeys, ev.KeyDown.Keys, true, index, "KeyDown");
                records.Add(new Record(2, delta, 8, BuildKeyboardReport(prevModifier, prevKeys)));
                hasKeyboard = true;
            }
            else if (ev.KeyUp is not null)
            {
                ApplyKeyboardNames(ref prevModifier, prevKeys, ev.KeyUp.Keys, false, index, "KeyUp");
                records.Add(new Record(2, delta, 8, BuildKeyboardReport(prevModifier, prevKeys)));
                hasKeyboard = true;
            }
        }

        return new JsonToLogResult(header, records, hasMouse, hasKeyboard);
    }

    public static void ConvertLogFileToJsonFile(string inputPath, string outputPath)
    {
        var (header, records) = ReadLogFile(inputPath);
        WriteJsonFile(outputPath, LogToJson(header, records));
    }

    public static JsonToLogResult ConvertJsonFileToLogFile(string inputPath, string outputPath)
    {
        var envelope = ReadJsonFile(inputPath);
        var result = JsonToLog(envelope);
        WriteLogFile(outputPath, result.Header, result.Records, result.HasMouse, result.HasKeyboard);
        return result;
    }

    private static void EmitMouseEvents(Envelope env, MouseReport report, ref int prevButton, int ts)
    {
        if (report.X != 0 || report.Y != 0)
        {
            env.Events.Add(new Event { TypeName = "MouseMove", MouseMove = new MouseMoveEvent(report.X, report.Y, ts) });
        }

        var down = report.Button & (~prevButton & 0xFF);
        var up = prevButton & (~report.Button & 0xFF);
        foreach (var bit in new[] { MouseButtonLeft, MouseButtonRight, MouseButtonMiddle })
        {
            var name = ButtonName(bit);
            if (string.IsNullOrEmpty(name)) continue;
            if ((down & bit) != 0) env.Events.Add(new Event { TypeName = "MouseDown", MouseDown = new ButtonEvent(name, ts) });
            if ((up & bit) != 0) env.Events.Add(new Event { TypeName = "MouseUp", MouseUp = new ButtonEvent(name, ts) });
        }

        if (report.Wheel != 0)
        {
            env.Events.Add(new Event { TypeName = "Wheel", Wheel = new WheelEvent(report.Wheel, ts) });
        }

        prevButton = report.Button;
    }

    private static void EmitKeyboardEvents(Envelope env, int modifier, int[] keys, ref int prevModifier, int[] prevKeys, int ts)
    {
        var downNames = new List<string>();
        var upNames = new List<string>();
        var modDown = (modifier ^ prevModifier) & modifier;
        var modUp = (modifier ^ prevModifier) & prevModifier;

        for (var bit = 0; bit < 8; bit++)
        {
            if ((modDown & (1 << bit)) != 0) downNames.Add(ModBitToName[bit]);
            if ((modUp & (1 << bit)) != 0) upNames.Add(ModBitToName[bit]);
        }

        foreach (var key in keys.Where(static item => item != 0))
        {
            if (!prevKeys.Contains(key)) downNames.Add(ScanName(key));
        }

        foreach (var key in prevKeys.Where(static item => item != 0))
        {
            if (!keys.Contains(key)) upNames.Add(ScanName(key));
        }

        if (downNames.Count > 0) env.Events.Add(new Event { TypeName = "KeyDown", KeyDown = new KeyEvent(downNames, ts) });
        if (upNames.Count > 0) env.Events.Add(new Event { TypeName = "KeyUp", KeyUp = new KeyEvent(upNames, ts) });

        prevModifier = modifier;
        Array.Copy(keys, prevKeys, KbdMaxKeys);
    }

    private static void ApplyKeyboardNames(ref int modifier, int[] keys, IReadOnlyList<string> names, bool isDown, int index, string kind)
    {
        foreach (var name in names)
        {
            if (IsModName(name))
            {
                var bit = ModBit(name);
                modifier = isDown ? modifier | bit : modifier & (~bit & 0xFF);
                continue;
            }

            var code = ScanCode(name);
            if (code == 0 && !string.Equals(name, "none", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException($"event {index} {kind}: unknown key name '{name}'");
            }

            if (isDown)
            {
                if (keys.Contains(code)) continue;
                var placed = false;
                for (var slot = 0; slot < keys.Length; slot++)
                {
                    if (keys[slot] == 0)
                    {
                        keys[slot] = code;
                        placed = true;
                        break;
                    }
                }
                if (!placed) throw new InvalidOperationException($"too many simultaneous keys: {string.Join(',', names)}");
            }
            else
            {
                for (var slot = 0; slot < keys.Length; slot++)
                {
                    if (keys[slot] == code) keys[slot] = 0;
                }
            }
        }
    }

    private static byte[] BuildKeyboardReport(int modifier, int[] keys)
    {
        return
        [
            (byte)modifier,
            0,
            (byte)keys[0],
            (byte)keys[1],
            (byte)keys[2],
            (byte)keys[3],
            (byte)keys[4],
            (byte)keys[5]
        ];
    }

    private static int ScanCode(string name)
    {
        var normalized = KpadKeycodes.NormalizeKpadKey(name);
        return KpadKeycodes.IsModKey(normalized) ? 0 : (KpadKeycodes.KeyNameToNCode.TryGetValue(normalized, out var code) ? code : 0);
    }

    private static string ScanName(int code)
    {
        foreach (var pair in KpadKeycodes.KeyNameToNCode)
        {
            if (pair.Value == code && !KpadKeycodes.IsModKey(pair.Key) && pair.Key != "NONE") return pair.Key.ToLowerInvariant();
        }
        return string.Empty;
    }

    private static bool IsModName(string name)
    {
        return KpadKeycodes.IsModKey(name) || KpadKeycodes.IsModKey(KpadKeycodes.NormalizeKpadKey(name));
    }

    private static int ModBit(string name)
    {
        var normalized = KpadKeycodes.NormalizeKpadKey(name);
        return KpadKeycodes.KeyNameToNCode.TryGetValue(normalized, out var bit) ? bit : 0;
    }

    private static int ButtonBit(string name)
    {
        return name.Trim().ToLowerInvariant() switch
        {
            "left" => MouseButtonLeft,
            "right" => MouseButtonRight,
            "middle" => MouseButtonMiddle,
            _ => throw new InvalidOperationException($"unknown button '{name}'")
        };
    }

    private static string ButtonName(int bit) => bit switch
    {
        MouseButtonLeft => "left",
        MouseButtonRight => "right",
        MouseButtonMiddle => "middle",
        _ => string.Empty
    };
}

public static class ConverterCli
{
    public static int Run(string[] args, TextWriter stdout, TextWriter stderr)
    {
        string inputPath = string.Empty;
        string outputPath = string.Empty;

        for (var index = 0; index < args.Length; index++)
        {
            var token = args[index];
            switch (token)
            {
                case "-h":
                case "--help":
                    stdout.WriteLine(Usage());
                    return 0;
                case "-f":
                    if (index + 1 >= args.Length) { stderr.WriteLine("converter: missing -f value"); return 1; }
                    inputPath = args[++index];
                    break;
                case "-o":
                    if (index + 1 >= args.Length) { stderr.WriteLine("converter: missing -o value"); return 1; }
                    outputPath = args[++index];
                    break;
                default:
                    stderr.WriteLine($"converter: unknown argument {token}");
                    stderr.WriteLine(Usage());
                    return 1;
            }
        }

        if (string.IsNullOrWhiteSpace(inputPath))
        {
            stderr.WriteLine(Usage());
            stderr.WriteLine("converter: missing -f");
            return 1;
        }

        var direction = ConverterCore.DirectionFromPath(inputPath);
        if (direction == Direction.Unknown)
        {
            stderr.WriteLine($"converter: unrecognized input extension on '{inputPath}' (expected .log or .json)");
            return 1;
        }

        var resolvedOutput = string.IsNullOrWhiteSpace(outputPath)
            ? ConverterCore.SwapExt(inputPath, direction == Direction.LogToJson ? ".json" : ".log")
            : outputPath;
        var targetExtension = direction == Direction.LogToJson ? ".json" : ".log";
        if (!resolvedOutput.EndsWith(targetExtension, StringComparison.OrdinalIgnoreCase)) resolvedOutput += targetExtension;

        try
        {
            var outputDir = Path.GetDirectoryName(resolvedOutput);
            if (!string.IsNullOrWhiteSpace(outputDir)) Directory.CreateDirectory(outputDir);
            if (direction == Direction.LogToJson)
            {
                ConverterCore.ConvertLogFileToJsonFile(inputPath, resolvedOutput);
                var env = ConverterCore.ReadJsonFile(resolvedOutput);
                stdout.WriteLine($"log -> json: {resolvedOutput} ({env.Events.Count} events)");
                return 0;
            }

            var result = ConverterCore.ConvertJsonFileToLogFile(inputPath, resolvedOutput);
            stdout.WriteLine($"json -> log: {resolvedOutput} (version={result.Header.Version}, mouse={(result.HasMouse ? 1 : 0)}, kbd={(result.HasKeyboard ? 1 : 0)})");
            return 0;
        }
        catch (Exception ex)
        {
            stderr.WriteLine($"converter: {ex.Message}");
            return 1;
        }
    }

    public static string Usage() => string.Join('\n',
    [
        "usage: mkp-dotnet-converter -f <input> [-o <output>]",
        string.Empty,
        "Convert between binary applog (.log) and JSON action envelope (.json).",
        "The direction is decided by the input file extension.",
        string.Empty,
        "Flags:",
        "  -f <input>   input file (.log or .json)",
        "  -o <output>  output file (default: same name with opposite extension)",
        "  -h, --help   show this message"
    ]);
}
