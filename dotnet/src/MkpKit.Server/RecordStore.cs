using System.Text.Json;

namespace MkpKit.Server;

public sealed record MacroRecord(
    int Id,
    string Name,
    string UniqueId,
    string MkpPath,
    int StartPointX,
    int StartPointY,
    int ScreenWidth,
    int ScreenHeight,
    string Os,
    int Seconds,
    int Milliseconds,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);

public sealed record MacroRecordInput(
    string Name,
    string UniqueId,
    string MkpPath,
    int StartPointX,
    int StartPointY,
    int ScreenWidth,
    int ScreenHeight,
    string Os,
    int Seconds,
    int Milliseconds);

public interface IMacroRecordStore
{
    MacroRecord InsertRecord(MacroRecordInput input);
    IReadOnlyList<MacroRecord> ListRecords(int limits, string? name = null);
    MacroRecord? GetRecord(string uniqueId);
    bool DeleteRecord(string uniqueId, out MacroRecord? deleted);
}

public sealed class JsonMacroRecordStore(string path) : IMacroRecordStore
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private readonly object _gate = new();
    private readonly string _path = ResolvePath(path);
    private List<MacroRecord> _records = LoadRecords(ResolvePath(path));

    public MacroRecord InsertRecord(MacroRecordInput input)
    {
        lock (_gate)
        {
            var now = DateTimeOffset.UtcNow;
            var nextId = _records.Count == 0 ? 1 : _records.Max(static item => item.Id) + 1;
            var record = new MacroRecord(
                nextId,
                input.Name,
                input.UniqueId,
                input.MkpPath,
                input.StartPointX,
                input.StartPointY,
                input.ScreenWidth,
                input.ScreenHeight,
                input.Os,
                input.Seconds,
                input.Milliseconds,
                now,
                now);
            _records.Add(record);
            PersistLocked();
            return record;
        }
    }

    public IReadOnlyList<MacroRecord> ListRecords(int limits, string? name = null)
    {
        lock (_gate)
        {
            var take = Math.Clamp(limits, 1, 10);
            IEnumerable<MacroRecord> query = _records;
            if (!string.IsNullOrWhiteSpace(name))
            {
                query = query.Where(item => item.Name.Contains(name.Trim(), StringComparison.OrdinalIgnoreCase));
            }

            return query
                .OrderByDescending(static item => item.CreatedAt)
                .Take(take)
                .ToArray();
        }
    }

    public MacroRecord? GetRecord(string uniqueId)
    {
        lock (_gate)
        {
            return _records.FirstOrDefault(item => string.Equals(item.UniqueId, uniqueId, StringComparison.Ordinal));
        }
    }

    public bool DeleteRecord(string uniqueId, out MacroRecord? deleted)
    {
        lock (_gate)
        {
            var index = _records.FindIndex(item => string.Equals(item.UniqueId, uniqueId, StringComparison.Ordinal));
            if (index < 0)
            {
                deleted = null;
                return false;
            }

            deleted = _records[index];
            _records.RemoveAt(index);
            PersistLocked();
            return true;
        }
    }

    private void PersistLocked()
    {
        var directory = Path.GetDirectoryName(_path);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        File.WriteAllText(_path, JsonSerializer.Serialize(_records, JsonOptions));
    }

    private static string ResolvePath(string path)
    {
        return Path.GetFullPath(string.IsNullOrWhiteSpace(path) ? ".mkp-server-records.json" : path);
    }

    private static List<MacroRecord> LoadRecords(string path)
    {
        if (!File.Exists(path))
        {
            return [];
        }

        var raw = File.ReadAllText(path);
        if (string.IsNullOrWhiteSpace(raw))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<MacroRecord>>(raw) ?? [];
        }
        catch
        {
            return [];
        }
    }
}
