using System.Text.Json;

namespace MkpKit.Models;

public sealed record SN(string Sn);

public sealed record Heartbeat(long Timetamp = 0, JsonElement? Raw = null);

public sealed record MKPVersion(string? App = null, string? Boot = null, string? Hw = null, JsonElement? Raw = null);

public sealed record LogLength(int Seconds = 0, int Milsec = 0, JsonElement? Raw = null);

public sealed record LogInfo(
    string? Name = null,
    string? Path = null,
    int Size = 0,
    int Seconds = 0,
    int Milsec = 0,
    int Width = 0,
    int Height = 0,
    JsonElement? Raw = null);

public sealed record AHTTPBase(string Ahttpbase, JsonElement? Raw = null);

public sealed record FileNode(
    string Name,
    string Path,
    string Type,
    long Size = 0,
    string? DisplayName = null,
    IReadOnlyList<FileNode>? Contents = null);

public sealed record FileSystem(string Error = "", FileNode? RootDir = null, JsonElement? Raw = null);

public sealed record ActionDump(JsonElement? Actions = null, JsonElement? Meta = null, JsonElement? Raw = null);

public sealed record SerialPortStatus(
    string Name,
    bool PortOpen,
    int SyncOutputTimeoutMs,
    bool TransportConfigured);
