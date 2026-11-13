namespace MkpKit.Models;

public static class KpadKeycodes
{
    public static readonly IReadOnlyList<string> ModKeyNames =
    [
        "MOD_LCTRL",
        "MOD_LSHIFT",
        "MOD_LALT",
        "MOD_LMETA",
        "MOD_RCTRL",
        "MOD_RSHIFT",
        "MOD_RALT",
        "MOD_RMETA"
    ];

    public static readonly IReadOnlyList<string> ModKeyShortNames =
    [
        "LCTRL",
        "LSHIFT",
        "LALT",
        "LMETA",
        "RCTRL",
        "RSHIFT",
        "RALT",
        "RMETA"
    ];

    public static readonly IReadOnlyDictionary<string, int> KeyNameToNCode = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
    {
        ["MOD_LCTRL"] = 0x01,
        ["MOD_LSHIFT"] = 0x02,
        ["MOD_LALT"] = 0x04,
        ["MOD_LMETA"] = 0x08,
        ["MOD_RCTRL"] = 0x10,
        ["MOD_RSHIFT"] = 0x20,
        ["MOD_RALT"] = 0x40,
        ["MOD_RMETA"] = 0x80,
        ["NONE"] = 0x00,
        ["A"] = 0x04,
        ["B"] = 0x05,
        ["C"] = 0x06,
        ["D"] = 0x07,
        ["E"] = 0x08,
        ["F"] = 0x09,
        ["G"] = 0x0a,
        ["H"] = 0x0b,
        ["I"] = 0x0c,
        ["J"] = 0x0d,
        ["K"] = 0x0e,
        ["L"] = 0x0f,
        ["M"] = 0x10,
        ["N"] = 0x11,
        ["O"] = 0x12,
        ["P"] = 0x13,
        ["Q"] = 0x14,
        ["R"] = 0x15,
        ["S"] = 0x16,
        ["T"] = 0x17,
        ["U"] = 0x18,
        ["V"] = 0x19,
        ["W"] = 0x1a,
        ["X"] = 0x1b,
        ["Y"] = 0x1c,
        ["Z"] = 0x1d,
        ["1"] = 0x1e,
        ["2"] = 0x1f,
        ["3"] = 0x20,
        ["4"] = 0x21,
        ["5"] = 0x22,
        ["6"] = 0x23,
        ["7"] = 0x24,
        ["8"] = 0x25,
        ["9"] = 0x26,
        ["0"] = 0x27,
        ["ENTER"] = 0x28,
        ["ESC"] = 0x29,
        ["BACKSPACE"] = 0x2a,
        ["TAB"] = 0x2b,
        ["SPACE"] = 0x2c,
        ["MINUS"] = 0x2d,
        ["EQUAL"] = 0x2e,
        ["LEFTBRACE"] = 0x2f,
        ["RIGHTBRACE"] = 0x30,
        ["BACKSLASH"] = 0x31,
        ["SEMICOLON"] = 0x33,
        ["APOSTROPHE"] = 0x34,
        ["GRAVE"] = 0x35,
        ["COMMA"] = 0x36,
        ["DOT"] = 0x37,
        ["SLASH"] = 0x38,
        ["RIGHT"] = 0x4f,
        ["LEFT"] = 0x50,
        ["DOWN"] = 0x51,
        ["UP"] = 0x52
    };

    private static readonly IReadOnlyDictionary<string, IReadOnlyList<string>> SymbolExpansions =
        new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal)
        {
            ["!"] = ["MOD_LSHIFT", "1"],
            ["@"] = ["MOD_LSHIFT", "2"],
            ["#"] = ["MOD_LSHIFT", "3"],
            ["$"] = ["MOD_LSHIFT", "4"],
            ["%"] = ["MOD_LSHIFT", "5"],
            ["^"] = ["MOD_LSHIFT", "6"],
            ["&"] = ["MOD_LSHIFT", "7"],
            ["*"] = ["MOD_LSHIFT", "8"],
            ["("] = ["MOD_LSHIFT", "9"],
            [")"] = ["MOD_LSHIFT", "0"],
            [" "] = ["SPACE"],
            ["-"] = ["MINUS"],
            ["_"] = ["MOD_LSHIFT", "MINUS"],
            ["="] = ["EQUAL"],
            ["+"] = ["MOD_LSHIFT", "EQUAL"],
            ["["] = ["LEFTBRACE"],
            ["{"] = ["MOD_LSHIFT", "LEFTBRACE"],
            ["]"] = ["RIGHTBRACE"],
            ["}"] = ["MOD_LSHIFT", "RIGHTBRACE"],
            ["\\"] = ["BACKSLASH"],
            ["|"] = ["MOD_LSHIFT", "BACKSLASH"],
            [";"] = ["SEMICOLON"],
            [":"] = ["MOD_LSHIFT", "SEMICOLON"],
            ["'"] = ["APOSTROPHE"],
            ["\""] = ["MOD_LSHIFT", "APOSTROPHE"],
            ["`"] = ["GRAVE"],
            ["~"] = ["MOD_LSHIFT", "GRAVE"],
            [","] = ["COMMA"],
            ["<"] = ["MOD_LSHIFT", "COMMA"],
            ["."] = ["DOT"],
            [">"] = ["MOD_LSHIFT", "DOT"],
            ["/"] = ["SLASH"],
            ["?"] = ["MOD_LSHIFT", "SLASH"]
        };

    public static bool IsModKey(string key) => ModKeyNames.Contains(key, StringComparer.OrdinalIgnoreCase);

    public static string? KeyNameToHexcode(string key)
    {
        return KeyNameToNCode.TryGetValue(key, out var code)
            ? $"0x{code:x2}"
            : null;
    }

    public static string NormalizeKpadKey(string key)
    {
        var normalized = key.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return string.Empty;
        }

        return normalized switch
        {
            "CTRL" => "MOD_LCTRL",
            "SHIFT" => "MOD_LSHIFT",
            "ALT" => "MOD_LALT",
            "META" => "MOD_LMETA",
            "LEFTBRACKET" => "LEFTBRACE",
            "RIGHTBRACKET" => "RIGHTBRACE",
            _ when ModKeyShortNames.Contains(normalized, StringComparer.Ordinal) => "MOD_" + normalized,
            _ => normalized
        };
    }

    public static IReadOnlyList<string> ExpandKpadInputKey(string key)
    {
        if (SymbolExpansions.TryGetValue(key, out var value))
        {
            return [.. value];
        }

        if (key.Length == 1 && char.IsLower(key[0]))
        {
            return [char.ToUpperInvariant(key[0]).ToString()];
        }

        if (key.Length == 1 && char.IsUpper(key[0]))
        {
            return ["MOD_LSHIFT", key];
        }

        var normalized = NormalizeKpadKey(key);
        return string.IsNullOrWhiteSpace(normalized) ? [] : [normalized];
    }

    public static string ModStatus(IEnumerable<string> modKeys)
    {
        var code = 0;
        foreach (var key in modKeys)
        {
            code |= KeyNameToNCode.TryGetValue(key, out var value) ? value : 0;
        }

        return code == 0 ? string.Empty : $"0x{code:x2}";
    }

    public static (List<string> ModKeys, List<string> NormalKeys) SplitKeys(IEnumerable<string> keys)
    {
        var modKeys = new List<string>();
        var normalKeys = new List<string>();
        foreach (var key in keys)
        {
            if (IsModKey(key))
            {
                modKeys.Add(key);
            }
            else
            {
                normalKeys.Add(key);
            }
        }

        return (modKeys, normalKeys);
    }
}

public static class KpadPressedState
{
    private static readonly object Gate = new();
    private static readonly List<string> PressedModKeys = [];
    private static readonly List<string> PressedKeys = [];

    public static void Reset()
    {
        lock (Gate)
        {
            PressedModKeys.Clear();
            PressedKeys.Clear();
        }
    }

    public static (List<string> ModKeys, List<string> Keys) Snapshot()
    {
        lock (Gate)
        {
            return ([.. PressedModKeys], [.. PressedKeys]);
        }
    }

    public static void Commit(IEnumerable<string> keys, bool isDown)
    {
        lock (Gate)
        {
            foreach (var key in keys)
            {
                if (KpadKeycodes.IsModKey(key))
                {
                    if (isDown)
                    {
                        AppendOnce(PressedModKeys, key);
                    }
                    else
                    {
                        RemoveOnce(PressedModKeys, key);
                    }
                }
                else if (isDown)
                {
                    AppendOnce(PressedKeys, key);
                }
                else
                {
                    RemoveOnce(PressedKeys, key);
                }
            }
        }
    }

    public static void AppendOnce(List<string> items, string value)
    {
        if (!items.Contains(value, StringComparer.Ordinal))
        {
            items.Add(value);
        }
    }

    public static void RemoveOnce(List<string> items, string value)
    {
        var index = items.FindIndex(item => string.Equals(item, value, StringComparison.Ordinal));
        if (index >= 0)
        {
            items.RemoveAt(index);
        }
    }
}
