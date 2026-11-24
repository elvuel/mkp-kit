using MkpKit.Helpers;
using MkpKit.Models;
using MkpKit.Serial;

namespace MkpKit.Controller;

public sealed class Controller(SFSerialPort sfPort)
{
    private const int DefaultM10StepMs = 8;

    public SFSerialPort SerialPort { get; } = sfPort;

    public Task OpenAsync(CancellationToken cancellationToken = default) => SerialPort.OpenAsync(cancellationToken);
    public Task CloseAsync(CancellationToken cancellationToken = default) => SerialPort.CloseAsync(cancellationToken);
    public Task MouseReleaseAllAsync(CancellationToken cancellationToken = default) => DeviceHelpers.MouseReleaseAllAsync(SerialPort, cancellationToken);
    public Task KeyTapAsync(string key, KpadOption? option = null, CancellationToken cancellationToken = default) => DeviceHelpers.KeyTapAsync(SerialPort, key, option, cancellationToken);
    public Task KeyDownAsync(string key, KpadOption? option = null, CancellationToken cancellationToken = default) => DeviceHelpers.KeyDownAsync(SerialPort, key, option, cancellationToken);
    public Task KeyUpAsync(string key, KpadOption? option = null, CancellationToken cancellationToken = default) => DeviceHelpers.KeyUpAsync(SerialPort, key, option, cancellationToken);
    public Task KeyPressesAsync(IEnumerable<string> keys, int sleepMs = 0, KpadOption? option = null, CancellationToken cancellationToken = default) => DeviceHelpers.KeyPressesAsync(SerialPort, keys, sleepMs, option, cancellationToken);
    public Task KeypadReleaseAsync(KpadOption? option = null, CancellationToken cancellationToken = default) => DeviceHelpers.KeypadReleaseAsync(SerialPort, option, cancellationToken);
    public Task KeypadReleaseAllAsync(KpadOption? option = null, CancellationToken cancellationToken = default) => DeviceHelpers.KeypadReleaseAllAsync(SerialPort, option, cancellationToken);
    public Task TypeTextAsync(string text, KpadOption? option = null, CancellationToken cancellationToken = default) => DeviceHelpers.TypeTextAsync(SerialPort, text, option, cancellationToken);

    public async Task MouseMoveSmoothAsync(int relX, int relY, int durationMs, M10Option? option = null, CancellationToken cancellationToken = default)
    {
        var steps = StepCount(durationMs, relX, relY);
        var xs = SplitAxis(relX, steps);
        var ys = SplitAxis(relY, steps);

        for (var index = 0; index < steps; index++)
        {
            var next = option is null ? new M10Option() : new M10Option().WithAsync(option.AsyncMode).WithSyncIgnoreOutput(option.SyncIgnoreOutput);
            if (option?.SyncOutputTimeoutMs is int timeoutMs)
            {
                next.WithSyncOutputTimeout(timeoutMs);
            }
            next.SetX(xs[index]).SetY(ys[index]);
            await SerialPort.Mouse10Async(next, cancellationToken);
            await Task.Delay(DefaultM10StepMs, cancellationToken);
        }
    }

    private static int StepCount(int durationMs, int relX, int relY)
    {
        var intervalSteps = Math.Max(durationMs, 0) / DefaultM10StepMs;
        var distanceSteps = Math.Min(Math.Max(Math.Abs(relX), Math.Abs(relY)), 64);
        return Math.Max(Math.Max(intervalSteps, distanceSteps), 1);
    }

    private static IReadOnlyList<int> SplitAxis(int total, int steps)
    {
        var values = new List<int>(steps);
        var sent = 0;
        for (var index = 1; index <= steps; index++)
        {
            var target = (total * index) / steps;
            values.Add(target - sent);
            sent = target;
        }

        return values;
    }
}
