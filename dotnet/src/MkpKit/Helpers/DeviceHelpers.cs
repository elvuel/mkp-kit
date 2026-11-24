using MkpKit.Models;
using MkpKit.Serial;

namespace MkpKit.Helpers;

public static class DeviceHelpers
{
    private static KpadOption CloneKpadBase(KpadOption? option)
    {
        var next = new KpadOption();
        if (option is null)
        {
            return next;
        }

        next.WithModKeys(option.ModKeys);
        next.WithKeys(option.ModKeys.Concat(option.Keys));
        next.WithRelease(option.Release);
        next.WithDelay(option.Delay);
        next.WithVerbose(option.Verbose);
        next.WithAsync(option.AsyncMode);
        next.WithSyncIgnoreOutput(option.SyncIgnoreOutput);
        if (option.SyncOutputTimeoutMs is int timeoutMs)
        {
            next.WithSyncOutputTimeout(timeoutMs);
        }
        return next;
    }

    public static Task MouseReleaseAllAsync(SFSerialPort sfPort, CancellationToken cancellationToken = default)
    {
        return sfPort.Mouse10Async(new M10Option().WithAsync(true).SetButton(0).SetX(0).SetY(0), cancellationToken);
    }

    public static Task KeyTapAsync(SFSerialPort sfPort, string key, KpadOption? baseOption = null, CancellationToken cancellationToken = default)
    {
        return sfPort.KeypadAsync(CloneKpadBase(baseOption).WithKeys(KpadKeycodes.ExpandKpadInputKey(key)).WithAutoRelease(), cancellationToken);
    }

    public static async Task KeyPressesAsync(SFSerialPort sfPort, IEnumerable<string> keys, int sleepMs = 0, KpadOption? baseOption = null, CancellationToken cancellationToken = default)
    {
        var items = keys.ToArray();
        for (var index = 0; index < items.Length; index++)
        {
            await KeyTapAsync(sfPort, items[index], baseOption, cancellationToken);
            if (sleepMs > 0 && index + 1 < items.Length)
            {
                await Task.Delay(sleepMs, cancellationToken);
            }
        }
    }

    public static Task KeyDownAsync(SFSerialPort sfPort, string key, KpadOption? baseOption = null, CancellationToken cancellationToken = default)
    {
        return sfPort.KeypadAsync(CloneKpadBase(baseOption).KeyDown(key), cancellationToken);
    }

    public static async Task KeyUpAsync(SFSerialPort sfPort, string key, KpadOption? baseOption = null, CancellationToken cancellationToken = default)
    {
        var (release, remain) = CloneKpadBase(baseOption).KeyUp(key);
        if (release is not null)
        {
            await sfPort.KeypadAsync(release, cancellationToken);
        }

        if (remain is not null)
        {
            await sfPort.KeypadAsync(remain, cancellationToken);
        }
    }

    public static Task KeypadReleaseAsync(SFSerialPort sfPort, KpadOption? baseOption = null, CancellationToken cancellationToken = default)
    {
        return sfPort.KeypadAsync(CloneKpadBase(baseOption).WithKey("NONE").WithHold(), cancellationToken);
    }

    public static async Task KeypadReleaseAllAsync(SFSerialPort sfPort, KpadOption? baseOption = null, CancellationToken cancellationToken = default)
    {
        await sfPort.KeypadAsync(CloneKpadBase(baseOption).WithRelease(0).WithDelay(baseOption?.Delay ?? 0), cancellationToken);
        KpadPressedState.Reset();
    }

    public static Task TypeTextAsync(SFSerialPort sfPort, string text, KpadOption? baseOption = null, CancellationToken cancellationToken = default)
    {
        return KeyPressesAsync(sfPort, text.Select(character => character.ToString()), 0, baseOption, cancellationToken);
    }
}
