using System.Text.Json;
using MkpKit.Diagnostics;
using MkpKit.Models;

namespace MkpKit.Parser;

public static class DirectiveEofFlags
{
    public const string Default = "<EOF>";
    public const string Cli = "cli>";
}

public enum DirectiveOutputKind
{
    Json,
    Text,
    EmptyOk,
    RawJsonText,
    LineJson
}

public sealed class DirectiveParser(string name, DirectiveOutputKind outputKind, Func<string, string, object?> parse, string eofFlag = DirectiveEofFlags.Cli)
{
    public string Name { get; } = name;
    public DirectiveOutputKind OutputKind { get; } = outputKind;
    public string EofFlag { get; } = eofFlag;

    public object? Parse(string cli, string raw) => parse(cli, raw);
}

public sealed class DirectiveParserRegistry
{
    private readonly Dictionary<string, DirectiveParser> _parsers = new(StringComparer.OrdinalIgnoreCase);

    public void Register(DirectiveParser parser) => _parsers[parser.Name] = parser;

    public DirectiveParser Resolve(string directive)
    {
        var name = directive.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        if (string.IsNullOrWhiteSpace(name) || !_parsers.TryGetValue(name, out var parser))
        {
            throw new DirectiveParseFailedException(directive, "parser-not-registered");
        }

        return parser;
    }

    public bool TryResolve(string directive, out DirectiveParser? parser)
    {
        var name = directive.Trim().Split(' ', 2, StringSplitOptions.RemoveEmptyEntries).FirstOrDefault();
        if (string.IsNullOrWhiteSpace(name))
        {
            parser = null;
            return false;
        }

        return _parsers.TryGetValue(name, out parser);
    }

    public static DirectiveParserRegistry CreateDefault()
    {
        var registry = new DirectiveParserRegistry();
        registry.Register(new DirectiveParser("astop", DirectiveOutputKind.Text, (cli, raw) => OutputParsing.ParseTextSuccess("astop", cli, raw, DirectiveEofFlags.Cli), DirectiveEofFlags.Cli));
        registry.Register(new DirectiveParser("acancel", DirectiveOutputKind.RawJsonText, (cli, raw) => OutputParsing.ParseRawJsonText("acancel", cli, raw, allowEmpty: false), DirectiveEofFlags.Default));
        registry.Register(new DirectiveParser("sn", DirectiveOutputKind.Json, (cli, raw) => ParseSn(OutputParsing.ParseJson("sn", cli, raw, DirectiveEofFlags.Default)), DirectiveEofFlags.Default));
        registry.Register(new DirectiveParser("list_dir", DirectiveOutputKind.Json, (cli, raw) => ParseFileSystem(OutputParsing.ParseJson("list_dir", cli, raw, DirectiveEofFlags.Default)), DirectiveEofFlags.Default));
        registry.Register(new DirectiveParser("clean_dir", DirectiveOutputKind.Text, (cli, raw) => OutputParsing.ParsePlainSuccess("clean_dir", cli, raw, DirectiveEofFlags.Cli), DirectiveEofFlags.Cli));
        registry.Register(new DirectiveParser("delete_file", DirectiveOutputKind.Text, (cli, raw) => OutputParsing.ParsePlainSuccess("delete_file", cli, raw, DirectiveEofFlags.Cli), DirectiveEofFlags.Cli));
        registry.Register(new DirectiveParser("alive", DirectiveOutputKind.Json, (cli, raw) => ParseHeartbeat(OutputParsing.ParseJson("alive", cli, raw, DirectiveEofFlags.Default)), DirectiveEofFlags.Default));
        registry.Register(new DirectiveParser("atime", DirectiveOutputKind.LineJson, (cli, raw) => ParseLogLength(OutputParsing.ParseLineJson("atime", cli, raw, ["\"seconds\":"])), DirectiveEofFlags.Default));
        registry.Register(new DirectiveParser("aversion", DirectiveOutputKind.Json, (cli, raw) => ParseVersion(OutputParsing.ParseJson("aversion", cli, raw, DirectiveEofFlags.Default)), DirectiveEofFlags.Default));
        registry.Register(new DirectiveParser("ainsp", DirectiveOutputKind.LineJson, (cli, raw) => ParseLogInfo(OutputParsing.ParseLineJson("ainsp", cli, raw, ["\"seconds\":", "\"width\":"])), DirectiveEofFlags.Default));
        registry.Register(new DirectiveParser("join", DirectiveOutputKind.Text, (cli, raw) => OutputParsing.ParseJoin("join", raw), DirectiveEofFlags.Cli));
        registry.Register(new DirectiveParser("wifi_auto", DirectiveOutputKind.Text, (cli, raw) => OutputParsing.ParseWifiAuto(cli, raw), DirectiveEofFlags.Cli));
        registry.Register(new DirectiveParser("adumj", DirectiveOutputKind.Json, (cli, raw) => ParseActionDump(OutputParsing.ParseOptionalJson("adumj", cli, raw, DirectiveEofFlags.Cli)), DirectiveEofFlags.Cli));
        registry.Register(new DirectiveParser("ahttpbase", DirectiveOutputKind.Json, (cli, raw) => ParseAHttpBase(OutputParsing.ParseAHttpBase(cli, raw)), DirectiveEofFlags.Cli));
        registry.Register(new DirectiveParser("aget", DirectiveOutputKind.Text, (cli, raw) => OutputParsing.ParseAGet("aget", cli, raw), DirectiveEofFlags.Cli));
        registry.Register(new DirectiveParser("aput", DirectiveOutputKind.Text, (cli, raw) => OutputParsing.ParseAPut("aput", cli, raw), DirectiveEofFlags.Cli));
        registry.Register(new DirectiveParser("ajson2log", DirectiveOutputKind.Text, (cli, raw) => OutputParsing.ParseAJson2Log("ajson2log", cli, raw), DirectiveEofFlags.Cli));
        registry.Register(new DirectiveParser("alog", DirectiveOutputKind.Text, (cli, raw) => OutputParsing.ParsePlainSuccess("alog", cli, raw, DirectiveEofFlags.Cli), DirectiveEofFlags.Cli));

        return registry;
    }

    private static SN ParseSn(JsonElement root) => new(GetString(root, "sn") ?? string.Empty);
    private static Heartbeat ParseHeartbeat(JsonElement root) => new(GetInt64(root, "timetamp"), root.Clone());
    private static MKPVersion ParseVersion(JsonElement root) => new(GetString(root, "app"), GetString(root, "boot"), GetString(root, "hw"), root.Clone());
    private static LogLength ParseLogLength(JsonElement root) => new(GetInt32(root, "seconds"), GetInt32(root, "milsec"), root.Clone());
    private static LogInfo ParseLogInfo(JsonElement root) => new(
        GetString(root, "name"),
        GetString(root, "path"),
        GetInt32(root, "size"),
        GetInt32(root, "seconds"),
        GetInt32(root, "milsec"),
        GetInt32(root, "width"),
        GetInt32(root, "heigh"),
        root.Clone());

    private static AHTTPBase ParseAHttpBase(JsonElement root) => new(GetString(root, "ahttpbase") ?? GetString(root, "url") ?? string.Empty, root.Clone());

    private static FileSystem ParseFileSystem(JsonElement root)
    {
        FileNode? node = null;
        if (TryGetProperty(root, "rootDir", out var rootDir))
        {
            node = ParseFileNode(rootDir);
        }

        return new(GetString(root, "error") ?? string.Empty, node, root.Clone());
    }

    private static FileNode ParseFileNode(JsonElement root)
    {
        var contents = new List<FileNode>();
        if (TryGetProperty(root, "contents", out var childArray) && childArray.ValueKind == JsonValueKind.Array)
        {
            foreach (var child in childArray.EnumerateArray())
            {
                contents.Add(ParseFileNode(child));
            }
        }

        return new(
            GetString(root, "name") ?? string.Empty,
            GetString(root, "path") ?? string.Empty,
            GetString(root, "type") ?? string.Empty,
            GetInt64(root, "size"),
            GetString(root, "displayName") ?? GetString(root, "display_name"),
            contents);
    }

    private static ActionDump ParseActionDump(JsonElement? root)
    {
        if (root is null)
        {
            return new();
        }

        var current = root.Value;
        JsonElement? actions = TryGetProperty(current, "actions", out var actionNode) ? actionNode.Clone() : null;
        JsonElement? meta = TryGetProperty(current, "meta", out var metaNode) ? metaNode.Clone() : null;
        return new(actions, meta, current.Clone());
    }

    private static bool TryGetProperty(JsonElement element, string name, out JsonElement value)
    {
        foreach (var property in element.EnumerateObject())
        {
            if (string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase))
            {
                value = property.Value;
                return true;
            }
        }

        value = default;
        return false;
    }

    private static string? GetString(JsonElement element, string name)
    {
        return TryGetProperty(element, name, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    private static int GetInt32(JsonElement element, string name)
    {
        if (TryGetProperty(element, name, out var value))
        {
            if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number)) return number;
            if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out number)) return number;
        }

        return 0;
    }

    private static long GetInt64(JsonElement element, string name)
    {
        if (TryGetProperty(element, name, out var value))
        {
            if (value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var number)) return number;
            if (value.ValueKind == JsonValueKind.String && long.TryParse(value.GetString(), out number)) return number;
        }

        return 0;
    }
}

public static class OutputParsing
{
    public static string SanitizeCarriageReturns(string raw) => raw.Replace("\r", string.Empty);

    public static string Preflight(string name, string raw)
    {
        var current = SanitizeCarriageReturns(raw);
        if (IsExecutionFailed(current))
        {
            throw new DirectiveExecutionFailedException(name);
        }

        return current;
    }

    public static bool IsExecutionFailed(string raw)
    {
        var lowered = raw.ToLowerInvariant();
        return lowered.Contains("command returned non-zero error code", StringComparison.Ordinal)
            || lowered.Contains("server returned status 404", StringComparison.Ordinal);
    }

    public static string TrimCliOutput(string data, string cli, bool trimDefaultEof)
    {
        var value = data.Trim();
        if (!string.IsNullOrWhiteSpace(cli) && value.StartsWith(cli, StringComparison.Ordinal))
        {
            value = value[cli.Length..].Trim();
        }

        if (value.EndsWith(DirectiveEofFlags.Cli, StringComparison.OrdinalIgnoreCase))
        {
            value = value[..^DirectiveEofFlags.Cli.Length].Trim();
        }

        if (trimDefaultEof && value.EndsWith(DirectiveEofFlags.Default, StringComparison.OrdinalIgnoreCase))
        {
            value = value[..^DirectiveEofFlags.Default.Length].Trim();
        }

        return value;
    }

    public static JsonElement ParseJson(string name, string cli, string raw, string eofFlag)
    {
        var normalized = TrimCliOutput(Preflight(name, raw), cli, eofFlag != DirectiveEofFlags.Cli);
        var blob = ExtractJsonBlob(normalized);
        using var document = JsonDocument.Parse(blob);
        return document.RootElement.Clone();
    }

    public static JsonElement? ParseOptionalJson(string name, string cli, string raw, string eofFlag)
    {
        var normalized = TrimCliOutput(Preflight(name, raw), cli, eofFlag != DirectiveEofFlags.Cli);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        var blob = ExtractJsonBlob(normalized);
        using var document = JsonDocument.Parse(blob);
        return document.RootElement.Clone();
    }

    public static JsonElement ParseLineJson(string name, string cli, string raw, IReadOnlyList<string> requiredFragments)
    {
        var normalized = TrimCliOutput(Preflight(name, raw), cli, trimDefaultEof: true);
        foreach (var line in normalized.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var candidate = line.Trim();
            if (!candidate.StartsWith("{", StringComparison.Ordinal) && !candidate.StartsWith("[", StringComparison.Ordinal))
            {
                continue;
            }

            if (requiredFragments.All(candidate.Contains))
            {
                using var document = JsonDocument.Parse(candidate);
                return document.RootElement.Clone();
            }
        }

        return ParseJson(name, cli, raw, DirectiveEofFlags.Default);
    }

    public static object ParseRawJsonText(string name, string cli, string raw, bool allowEmpty)
    {
        var normalized = TrimCliOutput(Preflight(name, raw), cli, trimDefaultEof: true);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            if (allowEmpty)
            {
                return string.Empty;
            }

            throw new DirectiveParseFailedException(name, "empty-output");
        }

        try
        {
            var blob = ExtractJsonBlob(normalized);
            using var document = JsonDocument.Parse(blob);
            return document.RootElement.Clone();
        }
        catch (DirectiveParseFailedException)
        {
            return normalized;
        }
    }

    public static JsonElement ParseAHttpBase(string cli, string raw)
    {
        var data = Preflight("ahttpbase", raw);
        try
        {
            var blob = ExtractJsonBlob(data);
            using var document = JsonDocument.Parse(blob);
            return document.RootElement.Clone();
        }
        catch (DirectiveParseFailedException)
        {
            var normalized = TrimCliOutput(SanitizeCarriageReturns(data), cli, trimDefaultEof: true);
            if (string.Equals(normalized, "OK", StringComparison.OrdinalIgnoreCase))
            {
                var url = cli.StartsWith("ahttpbase", StringComparison.OrdinalIgnoreCase)
                    ? cli["ahttpbase".Length..].Trim()
                    : string.Empty;
                var json = JsonSerializer.Serialize(new Dictionary<string, string> { ["ahttpbase"] = url });
                using var document = JsonDocument.Parse(json);
                return document.RootElement.Clone();
            }

            throw new DirectiveParseFailedException("ahttpbase", "json-or-ok-not-found");
        }
    }

    public static string ParseAGet(string name, string cli, string raw)
    {
        var normalized = TrimCliOutput(Preflight(name, raw), cli, trimDefaultEof: false);
        var lowered = normalized.ToLowerInvariant();
        if (lowered.Contains("error code", StringComparison.Ordinal) || lowered.Contains("server returned status", StringComparison.Ordinal))
        {
            throw new DirectiveExecutionFailedException(name);
        }

        if (normalized.Contains("GET status=200", StringComparison.Ordinal))
        {
            return normalized;
        }

        if (normalized.Contains("GET status=", StringComparison.Ordinal))
        {
            throw new DirectiveExecutionFailedException(name);
        }

        if (string.IsNullOrWhiteSpace(normalized))
        {
            throw new DirectiveParseFailedException(name, "empty-output");
        }

        throw new DirectiveParseFailedException(name, "unexpected-aget-output");
    }

    public static string ParseAPut(string name, string cli, string raw)
    {
        var normalized = TrimCliOutput(Preflight(name, raw), cli, trimDefaultEof: false);
        var lowered = normalized.ToLowerInvariant();
        if (lowered.Contains("upload failed", StringComparison.Ordinal) || lowered.Contains("failed to open file", StringComparison.Ordinal) || lowered.Contains("error code", StringComparison.Ordinal))
        {
            throw new DirectiveExecutionFailedException(name);
        }

        if (normalized.Contains("Upload OK", StringComparison.Ordinal))
        {
            return normalized;
        }

        if (string.IsNullOrWhiteSpace(normalized))
        {
            throw new DirectiveParseFailedException(name, "empty-output");
        }

        throw new DirectiveParseFailedException(name, "unexpected-aput-output");
    }

    public static string ParseAJson2Log(string name, string cli, string raw)
    {
        var normalized = TrimCliOutput(Preflight(name, raw), cli, trimDefaultEof: false);
        if (normalized.ToLowerInvariant().Contains("error code", StringComparison.Ordinal))
        {
            throw new DirectiveExecutionFailedException(name);
        }

        if (string.IsNullOrWhiteSpace(normalized))
        {
            throw new DirectiveParseFailedException(name, "empty-output");
        }

        return normalized;
    }

    public static string ParseTextSuccess(string name, string cli, string raw, string eofFlag)
    {
        var normalized = TrimCliOutput(Preflight(name, raw), cli, eofFlag != DirectiveEofFlags.Cli);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            throw new DirectiveParseFailedException(name, "empty-output");
        }

        return normalized;
    }

    public static string ParsePlainSuccess(string name, string cli, string raw, string eofFlag)
    {
        var normalized = TrimCliOutput(Preflight(name, raw), cli, eofFlag != DirectiveEofFlags.Cli);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            throw new DirectiveParseFailedException(name, "empty-output");
        }

        return normalized;
    }

    public static string ParseJoin(string name, string raw)
    {
        var lowered = Preflight(name, raw).ToLowerInvariant();
        if (lowered.Contains("connected", StringComparison.Ordinal))
        {
            return "connected";
        }

        if (lowered.Contains("connecting to", StringComparison.Ordinal))
        {
            return "connecting";
        }

        throw new DirectiveParseFailedException(name, "join-status-not-found");
    }

    public static string ParseWifiAuto(string cli, string raw)
    {
        var normalized = Preflight("wifi_auto", raw);
        var value = normalized.StartsWith(cli, StringComparison.Ordinal)
            ? normalized[cli.Length..].Trim().ToLowerInvariant()
            : normalized.Trim().ToLowerInvariant();

        if (value.Contains("auto: on", StringComparison.Ordinal))
        {
            return "on";
        }

        if (value.Contains("auto: off", StringComparison.Ordinal))
        {
            return "off";
        }

        return string.Empty;
    }

    public static string ExtractJsonBlob(string raw)
    {
        var text = raw.Trim();
        var start = -1;
        var quote = false;
        var escape = false;
        var depth = 0;
        var openChar = '\0';
        var closeChar = '\0';

        for (var index = 0; index < text.Length; index++)
        {
            var current = text[index];
            if (start < 0)
            {
                if (current == '{' || current == '[')
                {
                    start = index;
                    openChar = current;
                    closeChar = current == '{' ? '}' : ']';
                    depth = 1;
                }

                continue;
            }

            if (escape)
            {
                escape = false;
                continue;
            }

            if (current == '\\')
            {
                escape = true;
                continue;
            }

            if (current == '"')
            {
                quote = !quote;
                continue;
            }

            if (quote)
            {
                continue;
            }

            if (current == openChar)
            {
                depth++;
                continue;
            }

            if (current == closeChar)
            {
                depth--;
                if (depth == 0)
                {
                    return text[start..(index + 1)];
                }
            }
        }

        throw new DirectiveParseFailedException("json", "json-blob-not-found");
    }
}
