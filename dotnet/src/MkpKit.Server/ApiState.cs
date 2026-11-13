namespace MkpKit.Server;

public sealed record AlogSession(
    string Name,
    string UniqueId,
    string MkpPath,
    int StartPointX,
    int StartPointY,
    int ScreenWidth,
    int ScreenHeight,
    string Os);

public sealed record AlogSnapshot(bool Running, bool Started, string CurrentId);

public sealed record ReplaySnapshot(
    bool Running,
    string CurrentId,
    DateTimeOffset? StartedAt,
    DateTimeOffset? EstimatedDoneAt,
    DateTimeOffset? ReleaseAfter,
    bool Active,
    int? RetryAfterSeconds);

public sealed class ServerApiState(ServerSettings settings) : IDisposable
{
    private readonly object _alogGate = new();
    private readonly object _replayGate = new();
    private Timer? _replayTimer;

    private bool _alogRunning;
    private bool _alogStarted;
    private string _currentAlogId = string.Empty;
    private AlogSession? _currentAlog;

    private bool _replayRunning;
    private string _currentReplayId = string.Empty;
    private DateTimeOffset? _replayStartedAt;
    private DateTimeOffset? _replayDoneAt;
    private DateTimeOffset? _replayReleaseAt;

    public bool TryStartAlog(AlogSession session, out string? currentId)
    {
        lock (_alogGate)
        {
            if (_alogRunning)
            {
                currentId = _currentAlogId;
                return false;
            }

            _alogRunning = true;
            _alogStarted = false;
            _currentAlogId = session.UniqueId;
            _currentAlog = session;
            currentId = null;
            return true;
        }
    }

    public void ResetAlog(string uniqueId)
    {
        lock (_alogGate)
        {
            if (!string.Equals(_currentAlogId, uniqueId, StringComparison.Ordinal))
            {
                return;
            }

            _alogRunning = false;
            _alogStarted = false;
            _currentAlogId = string.Empty;
            _currentAlog = null;
        }
    }

    public void MarkAlogStarted(string uniqueId)
    {
        lock (_alogGate)
        {
            if (string.Equals(_currentAlogId, uniqueId, StringComparison.Ordinal))
            {
                _alogStarted = true;
            }
        }
    }

    public (string CurrentId, bool Started, AlogSession? Session, bool WasRunning) StopAlog()
    {
        lock (_alogGate)
        {
            var currentId = _currentAlogId;
            var started = _alogStarted;
            var session = _currentAlog;
            var wasRunning = _alogRunning;
            _alogRunning = false;
            _alogStarted = false;
            _currentAlogId = string.Empty;
            _currentAlog = null;
            return (currentId, started, session, wasRunning);
        }
    }

    public AlogSnapshot SnapshotAlogState()
    {
        lock (_alogGate)
        {
            return new AlogSnapshot(_alogRunning, _alogStarted, _currentAlogId);
        }
    }

    public ReplaySnapshot SnapshotReplayState()
    {
        lock (_replayGate)
        {
            var (blocking, remaining) = IsReplayBlockingLocked(DateTimeOffset.UtcNow, string.Empty);
            return new ReplaySnapshot(
                _replayRunning,
                _currentReplayId,
                _replayStartedAt,
                _replayDoneAt,
                _replayReleaseAt,
                blocking,
                remaining > TimeSpan.Zero ? (int)remaining.TotalSeconds + 1 : null);
        }
    }

    public (bool Blocking, ReplaySnapshot Snapshot) CurrentReplayConflict(string? recordId)
    {
        lock (_replayGate)
        {
            var (blocking, remaining) = IsReplayBlockingLocked(DateTimeOffset.UtcNow, recordId ?? string.Empty);
            return (blocking, new ReplaySnapshot(
                _replayRunning,
                _currentReplayId,
                _replayStartedAt,
                _replayDoneAt,
                _replayReleaseAt,
                blocking,
                remaining > TimeSpan.Zero ? (int)remaining.TotalSeconds + 1 : null));
        }
    }

    public void NormalizeReplayState()
    {
        lock (_replayGate)
        {
            if (_replayRunning)
            {
                var (blocking, _) = IsReplayBlockingLocked(DateTimeOffset.UtcNow, string.Empty);
                if (!blocking)
                {
                    ResetReplayStateLocked();
                }
            }
        }
    }

    public void BeginReplay(MacroRecord record, DateTimeOffset startedAt)
    {
        var (doneAt, releaseAfter) = ReplayWindowForRecord(record, startedAt);
        lock (_replayGate)
        {
            _replayRunning = true;
            _currentReplayId = record.UniqueId;
            _replayStartedAt = startedAt;
            _replayDoneAt = doneAt;
            _replayReleaseAt = releaseAfter;
            _replayTimer?.Dispose();
            var dueTime = releaseAfter - DateTimeOffset.UtcNow;
            if (dueTime < TimeSpan.Zero)
            {
                dueTime = TimeSpan.Zero;
            }
            _replayTimer = new Timer(static state => ((ServerApiState)state!).ReleaseReplay(), this, dueTime, Timeout.InfiniteTimeSpan);
        }
    }

    public (bool WasRunning, string ReplayId) CancelReplay()
    {
        lock (_replayGate)
        {
            var replayId = _currentReplayId;
            var wasRunning = _replayRunning;
            ResetReplayStateLocked();
            return (wasRunning, replayId);
        }
    }

    public (DateTimeOffset DoneAt, DateTimeOffset ReleaseAfter) ReplayWindowForRecord(MacroRecord record, DateTimeOffset startedAt)
    {
        var duration = TimeSpan.FromSeconds(record.Seconds) + TimeSpan.FromMilliseconds(record.Milliseconds);
        var minimum = TimeSpan.FromMilliseconds(Math.Max(settings.ReplayMinimumDurationMs, 1));
        if (duration < minimum)
        {
            duration = minimum;
        }

        var doneAt = startedAt.Add(duration);
        return (doneAt, doneAt.Add(TimeSpan.FromMilliseconds(Math.Max(settings.ReplayCompletionGraceMs, 0))));
    }

    private void ReleaseReplay()
    {
        lock (_replayGate)
        {
            ResetReplayStateLocked();
        }
    }

    private (bool Blocking, TimeSpan Remaining) IsReplayBlockingLocked(DateTimeOffset now, string recordId)
    {
        if (!_replayRunning)
        {
            return (false, TimeSpan.Zero);
        }

        if (!string.IsNullOrWhiteSpace(recordId) && !string.IsNullOrWhiteSpace(_currentReplayId) && !string.Equals(_currentReplayId, recordId, StringComparison.Ordinal))
        {
            return (false, TimeSpan.Zero);
        }

        if (_replayReleaseAt is { } releaseAt && now < releaseAt)
        {
            return (true, releaseAt - now);
        }

        return (false, TimeSpan.Zero);
    }

    private void ResetReplayStateLocked()
    {
        _replayRunning = false;
        _currentReplayId = string.Empty;
        _replayStartedAt = null;
        _replayDoneAt = null;
        _replayReleaseAt = null;
        _replayTimer?.Dispose();
        _replayTimer = null;
    }

    public void Dispose()
    {
        lock (_replayGate)
        {
            _replayTimer?.Dispose();
            _replayTimer = null;
        }
    }
}
