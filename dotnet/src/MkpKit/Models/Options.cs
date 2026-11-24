namespace MkpKit.Models;

public sealed class LogOption
{
    public int Width { get; init; }
    public int Height { get; init; }
    public int StPosX { get; init; } = -1;
    public int StPosY { get; init; } = -1;

    public IReadOnlyList<string> CliArgs()
    {
        var args = new List<string>();
        if (Width > 0) args.AddRange(["--w", Width.ToString()]);
        if (Height > 0) args.AddRange(["--h", Height.ToString()]);
        if (StPosX >= 0) args.AddRange(["--stx", StPosX.ToString()]);
        if (StPosY >= 0) args.AddRange(["--sty", StPosY.ToString()]);
        return args;
    }
}

public sealed record JoinOption(string Ssid, string Password)
{
    public IReadOnlyList<string> CliArgs() => [Ssid, Password];
}

public sealed record WifiAutoOption(string? State = null)
{
    public IReadOnlyList<string> CliArgs() => string.IsNullOrWhiteSpace(State) ? [] : [State];
}

public sealed record AGetOption(string Filepath)
{
    public IReadOnlyList<string> CliArgs() => [Filepath];
}

public sealed record APutOption(string Filepath)
{
    public IReadOnlyList<string> CliArgs() => [Filepath];
}

public sealed record AJSON2LogOption(string JsonPath, string SavePath)
{
    public IReadOnlyList<string> CliArgs() => [JsonPath, SavePath];
}

public sealed record AHTTPBaseOption(string? Ahttpbase = null)
{
    public IReadOnlyList<string> CliArgs() => string.IsNullOrWhiteSpace(Ahttpbase) ? [] : [Ahttpbase];
}

public sealed record APlayOption(string LogPath, int Delay = -1)
{
    public IReadOnlyList<string> CliArgs() => [LogPath, "--delay", Delay.ToString()];
}

public sealed class M10Option
{
    public int? Button { get; private set; }
    public int? X { get; private set; }
    public int? Y { get; private set; }
    public int? Wheel { get; private set; }
    public bool AsyncMode { get; private set; } = true;
    public bool SyncIgnoreOutput { get; private set; }
    public int? SyncOutputTimeoutMs { get; private set; }

    public M10Option SetButton(int value) { Button = value; return this; }
    public M10Option WithoutButton() { Button = null; return this; }
    public M10Option SetX(int value) { X = value; return this; }
    public M10Option SetY(int value) { Y = value; return this; }
    public M10Option SetWheel(int value) { Wheel = value; return this; }
    public M10Option WithAsync(bool value) { AsyncMode = value; SyncIgnoreOutput = !value; return this; }
    public M10Option WithSyncIgnoreOutput(bool value) { SyncIgnoreOutput = value; AsyncMode = !value; return this; }
    public M10Option WithSyncOutputTimeout(int value) { SyncOutputTimeoutMs = value; return this; }
    public bool IsAsync() => AsyncMode && !SyncIgnoreOutput;

    public string ToCliFragment()
    {
        var args = new List<string>();
        if (Button.HasValue) args.AddRange(["--b", Button.Value.ToString()]);
        if (X.HasValue) args.AddRange(["--x", X.Value.ToString()]);
        if (Y.HasValue) args.AddRange(["--y", Y.Value.ToString()]);
        if (Wheel.HasValue) args.AddRange(["--w", Wheel.Value.ToString()]);
        return string.Join(' ', args);
    }
}

public sealed class KpadOption
{
    private sealed record PendingCommitState(IReadOnlyList<string> Keys, bool IsDown);

    private PendingCommitState? _commitState;

    public List<string> ModKeys { get; } = [];
    public List<string> Keys { get; } = [];
    public int Release { get; private set; }
    public int Delay { get; private set; }
    public bool Verbose { get; private set; }
    public bool AsyncMode { get; private set; } = true;
    public bool SyncIgnoreOutput { get; private set; }
    public int? SyncOutputTimeoutMs { get; private set; }

    public KpadOption WithKeys(IEnumerable<string> keys)
    {
        var normalized = keys
            .Select(KpadKeycodes.NormalizeKpadKey)
            .Where(static item => !string.IsNullOrWhiteSpace(item))
            .ToArray();
        var (modKeys, normalKeys) = KpadKeycodes.SplitKeys(normalized);

        ModKeys.Clear();
        ModKeys.AddRange(modKeys);
        Keys.Clear();
        Keys.AddRange(normalKeys.Take(6));
        return this;
    }

    public KpadOption WithKey(string key)
    {
        return WithKeys([key]);
    }

    public KpadOption WithModKeys(IEnumerable<string> modKeys)
    {
        ModKeys.Clear();
        ModKeys.AddRange(modKeys
            .Select(KpadKeycodes.NormalizeKpadKey)
            .Where(KpadKeycodes.IsModKey));
        return this;
    }

    public KpadOption WithDelay(int value) { Delay = value; return this; }
    public KpadOption WithRelease(int value) { Release = value; return this; }
    public KpadOption WithHold() { Release = 0; return this; }
    public KpadOption WithAutoRelease() { Release = 1; return this; }
    public KpadOption WithDuration(int value) { if (value > 1) Release = value; return this; }
    public KpadOption WithVerbose(bool value) { Verbose = value; return this; }
    public KpadOption WithAsync(bool value) { AsyncMode = value; SyncIgnoreOutput = !value; return this; }
    public KpadOption WithSyncIgnoreOutput(bool value) { SyncIgnoreOutput = value; AsyncMode = !value; return this; }
    public KpadOption WithSyncOutputTimeout(int value) { SyncOutputTimeoutMs = value; return this; }
    public bool IsAsync() => AsyncMode && !SyncIgnoreOutput;

    public string ToCliFragment()
    {
        var args = new List<string>();
        var status = KpadKeycodes.ModStatus(ModKeys);
        if (!string.IsNullOrWhiteSpace(status))
        {
            args.AddRange(["--s", status]);
        }

        for (var index = 0; index < Keys.Count; index++)
        {
            var key = Keys[index];
            if (string.IsNullOrWhiteSpace(key))
            {
                continue;
            }

            var code = KpadKeycodes.KeyNameToHexcode(key);
            if (string.IsNullOrWhiteSpace(code))
            {
                throw new NotSupportedException("unknown key name: " + key);
            }

            args.AddRange([$"--x{index + 1}", code]);
        }

        args.AddRange(["--rel", Release.ToString(), "--d", Delay.ToString()]);
        if (Verbose)
        {
            args.AddRange(["--v", "1"]);
        }

        return string.Join(' ', args);
    }

    public KpadOption KeyDown(string key)
    {
        var commitKeys = KpadKeycodes.ExpandKpadInputKey(key);
        if (commitKeys.Count == 0)
        {
            return this;
        }

        var (nextMod, nextKeys) = KpadPressedState.Snapshot();
        foreach (var item in commitKeys)
        {
            if (KpadKeycodes.IsModKey(item))
            {
                KpadPressedState.AppendOnce(nextMod, item);
            }
            else
            {
                KpadPressedState.AppendOnce(nextKeys, item);
            }
        }

        WithKeys(nextMod.Concat(nextKeys));
        WithModKeys(nextMod);
        WithHold();
        _commitState = new PendingCommitState([.. commitKeys], true);
        return this;
    }

    public (KpadOption? Release, KpadOption? Remain) KeyUp(string key)
    {
        var releaseKeys = KpadKeycodes.ExpandKpadInputKey(key);
        if (releaseKeys.Count == 0)
        {
            return (null, null);
        }

        var (releaseMod, releaseNormal) = KpadPressedState.Snapshot();
        var nextMod = new List<string>(releaseMod);
        var nextKeys = new List<string>(releaseNormal);
        foreach (var item in releaseKeys)
        {
            if (KpadKeycodes.IsModKey(item))
            {
                KpadPressedState.RemoveOnce(nextMod, item);
            }
            else
            {
                KpadPressedState.RemoveOnce(nextKeys, item);
            }
        }

        var releaseOpt = new KpadOption()
            .WithDelay(Delay)
            .WithVerbose(Verbose)
            .WithAsync(AsyncMode)
            .WithKeys(releaseKeys)
            .WithAutoRelease();
        releaseOpt.SyncIgnoreOutput = SyncIgnoreOutput;
        releaseOpt.SyncOutputTimeoutMs = SyncOutputTimeoutMs;
        if (releaseKeys.Any(KpadKeycodes.IsModKey))
        {
            releaseOpt.WithModKeys(releaseMod);
        }

        var remainOpt = new KpadOption()
            .WithDelay(Delay)
            .WithVerbose(Verbose)
            .WithAsync(AsyncMode);
        remainOpt.SyncIgnoreOutput = SyncIgnoreOutput;
        remainOpt.SyncOutputTimeoutMs = SyncOutputTimeoutMs;

        var remain = nextMod.Concat(nextKeys).ToArray();
        if (remain.Length == 0)
        {
            remainOpt.WithKey("NONE").WithHold();
        }
        else
        {
            remainOpt.WithKeys(remain).WithHold();
            if (releaseKeys.Any(KpadKeycodes.IsModKey))
            {
                remainOpt.WithModKeys(nextMod);
            }
        }

        remainOpt._commitState = new PendingCommitState([.. releaseKeys], false);
        return (releaseOpt, remainOpt);
    }

    public void CommitState()
    {
        if (_commitState is null)
        {
            return;
        }

        KpadPressedState.Commit(_commitState.Keys, _commitState.IsDown);
        _commitState = null;
    }
}
