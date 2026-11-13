using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;

namespace MkpKit.Client;

public sealed class ClientDeps
{
    public required TextWriter Out { get; init; }
    public required TextWriter Err { get; init; }
    public required Func<HttpClient> CreateHttpClient { get; init; }
    public required Func<string, string?> GetEnv { get; init; }
    public required Func<DateTimeOffset> UtcNow { get; init; }
    public required Func<string> GetCurrentDirectory { get; init; }
    public required Func<string> GetUserHomeDirectory { get; init; }
}

internal sealed record ParsedClientArgs(Dictionary<string, string?> GlobalFlags, HashSet<string> ChangedGlobals, List<string> Positionals);

internal sealed class ClientRuntime
{
    public required ClientDeps Deps { get; init; }
    public required string ConfigPath { get; init; }
    public required ClientConfig Config { get; init; }
    public required string ServerAddr { get; set; }
    public required string Mode { get; set; }
    public required string AuthToken { get; set; }
    public required string AuthUser { get; set; }
    public required string AuthPassword { get; set; }
    public required TimeSpan HttpTimeout { get; set; }
    public required ParsedClientArgs Parsed { get; init; }
}

internal sealed class ClientConfig
{
    [JsonPropertyName("server_addr")]
    public string ServerAddr { get; set; } = string.Empty;

    [JsonPropertyName("mode")]
    public string Mode { get; set; } = string.Empty;

    [JsonPropertyName("token")]
    public string Token { get; set; } = string.Empty;

    [JsonPropertyName("token_expires_at")]
    public string TokenExpiresAt { get; set; } = string.Empty;

    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("password")]
    public string Password { get; set; } = string.Empty;

    [JsonPropertyName("timeout_seconds")]
    public int TimeoutSeconds { get; set; }

    [JsonPropertyName("version_cache")]
    public VersionCacheEntry? VersionCache { get; set; }
}

internal sealed class VersionCacheEntry
{
    [JsonPropertyName("server_addr")]
    public string ServerAddr { get; set; } = string.Empty;

    [JsonPropertyName("cached_at")]
    public string CachedAt { get; set; } = string.Empty;

    [JsonPropertyName("response")]
    public VersionResponse? Response { get; set; }
}

internal sealed class VersionResponse
{
    [JsonPropertyName("ok")]
    public bool Ok { get; set; } = true;

    [JsonPropertyName("directive")]
    public string Directive { get; set; } = string.Empty;

    [JsonPropertyName("mkp_server")]
    public string ServerVersion { get; set; } = string.Empty;

    [JsonPropertyName("mkp_device")]
    public DeviceVersion? Device { get; set; }

    [JsonPropertyName("error")]
    public string Error { get; set; } = string.Empty;
}

internal sealed class DeviceVersion
{
    [JsonPropertyName("app")]
    public string App { get; set; } = string.Empty;

    [JsonPropertyName("boot")]
    public string Boot { get; set; } = string.Empty;

    [JsonPropertyName("hw")]
    public string Hw { get; set; } = string.Empty;

    [JsonPropertyName("uver")]
    public string Uver { get; set; } = string.Empty;

    [JsonPropertyName("aver")]
    public string Aver { get; set; } = string.Empty;
}

internal sealed class ListRecord
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("unique_id")]
    public string UniqueId { get; set; } = string.Empty;

    [JsonPropertyName("mkp_path")]
    public string MkpPath { get; set; } = string.Empty;

    [JsonPropertyName("start_point_x")]
    public int StartPointX { get; set; }

    [JsonPropertyName("start_point_y")]
    public int StartPointY { get; set; }

    [JsonPropertyName("screen_width")]
    public int ScreenWidth { get; set; }

    [JsonPropertyName("screen_height")]
    public int ScreenHeight { get; set; }

    [JsonPropertyName("os")]
    public string Os { get; set; } = string.Empty;

    [JsonPropertyName("seconds")]
    public int Seconds { get; set; }

    [JsonPropertyName("milliseconds")]
    public int Milliseconds { get; set; }

    [JsonPropertyName("created_at")]
    public string CreatedAt { get; set; } = string.Empty;
}

internal sealed class RecordingRequest
{
    [JsonPropertyName("log_name")]
    public string LogName { get; set; } = string.Empty;

    [JsonPropertyName("width")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public int Width { get; set; }

    [JsonPropertyName("height")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public int Height { get; set; }

    [JsonPropertyName("stposx")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? StPosX { get; set; }

    [JsonPropertyName("stposy")]
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? StPosY { get; set; }
}

internal sealed record TokenFetchResult(string Token, DateTimeOffset ExpiresAt);
internal sealed record ClientHttpResponse(JsonObject Payload, HttpStatusCode StatusCode);

public static class ClientRunner
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private static readonly TimeSpan TokenRefreshSkew = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan DefaultHttpTimeout = TimeSpan.FromSeconds(15);
    private static readonly TimeSpan VersionCacheTtl = TimeSpan.FromHours(24);
    private const string DefaultServerEndpoint = "http://127.0.0.1:8080";
    private const string DefaultClientMode = "release";

    public static Task<int> RunAsync(string[] args, ClientDeps? deps = null, CancellationToken cancellationToken = default)
    {
        deps ??= DefaultDeps();
        return RunCoreAsync(args, deps, cancellationToken);
    }

    public static string Usage() => string.Join('\n',
    [
        "Usage:",
        "  mkp-dotnet-client [global options] <command> [args...]",
        string.Empty,
        "Commands:",
        "  version",
        "  auth login [--username <user>] [--password <pass>]",
        "  auth token",
        "  auth revoke [--forget]",
        "  list [--limits <n>] [--name <filter>]",
        "  recording [--name <name>] [--width <n>] [--height <n>] [--stposx <n>] [--stposy <n>]",
        "  replay --id <record-id>",
        "  remove --id <record-id>",
        "  stop",
        string.Empty,
        "Global options:",
        "  -s, --server <url>",
        "  --mode <debug|release>",
        "  --token <bearer-token>",
        "  --username <user>",
        "  --password <pass>",
        "  --config <path>",
        "  --timeout <duration>",
        "  -h, --help"
    ]);

    private static async Task<int> RunCoreAsync(string[] args, ClientDeps deps, CancellationToken cancellationToken)
    {
        if (args.Length == 0 || args.Contains("-h") || args.Contains("--help"))
        {
            await deps.Out.WriteLineAsync(Usage());
            return 0;
        }

        ParsedClientArgs parsed;
        try
        {
            parsed = ParseArgs(args);
        }
        catch (Exception ex)
        {
            await deps.Err.WriteLineAsync(ex.Message);
            await deps.Err.WriteLineAsync(Usage());
            return 1;
        }

        if (parsed.Positionals.Count == 0)
        {
            await deps.Out.WriteLineAsync(Usage());
            return 0;
        }

        ClientRuntime runtime;
        try
        {
            runtime = await HydrateRuntimeAsync(parsed, deps, cancellationToken);
        }
        catch (Exception ex)
        {
            await deps.Err.WriteLineAsync(ex.Message);
            return 1;
        }

        try
        {
            return await DispatchAsync(runtime, cancellationToken);
        }
        catch (Exception ex)
        {
            await deps.Err.WriteLineAsync(ex.Message);
            return 1;
        }
    }

    private static async Task<int> DispatchAsync(ClientRuntime runtime, CancellationToken cancellationToken)
    {
        var command = runtime.Parsed.Positionals[0].Trim().ToLowerInvariant();
        var args = runtime.Parsed.Positionals.Skip(1).ToArray();

        switch (command)
        {
            case "version":
                return await RunVersionAsync(runtime, cancellationToken);
            case "auth":
                return await RunAuthAsync(runtime, args, cancellationToken);
            case "list":
            case "l":
                return await RunListAsync(runtime, args, cancellationToken);
            case "recording":
            case "record":
            case "r":
                return await RunRecordingAsync(runtime, args, cancellationToken);
            case "replay":
                return await RunReplayAsync(runtime, args, cancellationToken);
            case "remove":
                return await RunRemoveAsync(runtime, args, cancellationToken);
            case "stop":
            case "s":
                return await RunStopAsync(runtime, cancellationToken);
            default:
                throw new InvalidOperationException($"unknown command: {command}");
        }
    }

    private static async Task<int> RunVersionAsync(ClientRuntime runtime, CancellationToken cancellationToken)
    {
        if (TryGetCachedVersion(runtime, out var cached) && cached is not null)
        {
            await runtime.Deps.Out.WriteLineAsync(RenderVersionTable(cached));
            return 0;
        }

        var response = await SendJsonAsync(runtime, HttpMethod.Get, "/api/v1/version", null, false, cancellationToken);
        var parsed = Deserialize<VersionResponse>(response.Payload) ?? throw new InvalidOperationException("invalid version response");
        if (!parsed.Ok)
        {
            throw string.IsNullOrWhiteSpace(parsed.Error)
                ? new InvalidOperationException("request failed")
                : new InvalidOperationException("request failed: " + parsed.Error.Trim());
        }

        SaveVersionCache(runtime, parsed);
        await runtime.Deps.Out.WriteLineAsync(RenderVersionTable(parsed));
        return 0;
    }

    private static async Task<int> RunAuthAsync(ClientRuntime runtime, string[] args, CancellationToken cancellationToken)
    {
        if (args.Length == 0)
        {
            throw new InvalidOperationException("auth expects login|token|revoke");
        }

        var subcommand = args[0].Trim().ToLowerInvariant();
        var subArgs = args.Skip(1).ToArray();
        switch (subcommand)
        {
            case "login":
                return await RunAuthLoginAsync(runtime, subArgs, cancellationToken);
            case "token":
                return await RunAuthTokenAsync(runtime, cancellationToken);
            case "revoke":
                return await RunAuthRevokeAsync(runtime, subArgs);
            default:
                throw new InvalidOperationException($"unknown auth command: {subcommand}");
        }
    }

    private static async Task<int> RunAuthLoginAsync(ClientRuntime runtime, string[] args, CancellationToken cancellationToken)
    {
        var username = string.Empty;
        var password = string.Empty;
        for (var index = 0; index < args.Length; index++)
        {
            var token = args[index];
            switch (token)
            {
                case "--username":
                    username = ReadStringValue(args, ref index, token);
                    break;
                case "--password":
                    password = ReadStringValue(args, ref index, token);
                    break;
                default:
                    throw new InvalidOperationException($"unknown auth login flag: {token}");
            }
        }

        if (string.IsNullOrWhiteSpace(username)) username = runtime.AuthUser;
        if (string.IsNullOrWhiteSpace(password)) password = runtime.AuthPassword;
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password)) throw new InvalidOperationException("username/password are required");

        var tokenResult = await FetchTokenAsync(runtime, username, password, cancellationToken);
        runtime.Config.ServerAddr = runtime.ServerAddr;
        runtime.Config.Mode = runtime.Mode;
        runtime.Config.Username = username;
        runtime.Config.Password = password;
        runtime.Config.Token = tokenResult.Token;
        runtime.Config.TokenExpiresAt = tokenResult.ExpiresAt.ToString("O");
        runtime.Config.TimeoutSeconds = Math.Max(1, (int)runtime.HttpTimeout.TotalSeconds);
        runtime.AuthToken = tokenResult.Token;
        runtime.AuthUser = username;
        runtime.AuthPassword = password;
        SaveClientConfig(runtime.ConfigPath, runtime.Config);
        await runtime.Deps.Out.WriteLineAsync($"token saved (expires at {tokenResult.ExpiresAt:O})");
        return 0;
    }

    private static async Task<int> RunAuthTokenAsync(ClientRuntime runtime, CancellationToken cancellationToken)
    {
        var token = runtime.AuthToken.Trim();
        var shouldRefresh = string.IsNullOrWhiteSpace(token);
        if (!shouldRefresh
            && !runtime.Parsed.ChangedGlobals.Contains("--token")
            && !string.IsNullOrWhiteSpace(runtime.Config.Token)
            && string.Equals(token, runtime.Config.Token, StringComparison.Ordinal)
            && !TokenStillValid(runtime, runtime.Config.TokenExpiresAt))
        {
            shouldRefresh = true;
        }

        if (shouldRefresh)
        {
            token = await EnsureManagedTokenAsync(runtime, false, cancellationToken);
        }

        await runtime.Deps.Out.WriteLineAsync(token);
        return 0;
    }

    private static async Task<int> RunAuthRevokeAsync(ClientRuntime runtime, string[] args)
    {
        var forgetCreds = false;
        foreach (var token in args)
        {
            if (token == "--forget")
            {
                forgetCreds = true;
                continue;
            }

            throw new InvalidOperationException($"unknown auth revoke flag: {token}");
        }

        runtime.Config.Token = string.Empty;
        runtime.Config.TokenExpiresAt = string.Empty;
        runtime.AuthToken = string.Empty;
        if (forgetCreds)
        {
            runtime.Config.Username = string.Empty;
            runtime.Config.Password = string.Empty;
            runtime.AuthUser = string.Empty;
            runtime.AuthPassword = string.Empty;
        }

        SaveClientConfig(runtime.ConfigPath, runtime.Config);
        await runtime.Deps.Out.WriteLineAsync(forgetCreds ? "local token and credentials cleared" : "local token cleared");
        return 0;
    }

    private static async Task<int> RunListAsync(ClientRuntime runtime, string[] args, CancellationToken cancellationToken)
    {
        var limits = 10;
        var name = string.Empty;
        for (var index = 0; index < args.Length; index++)
        {
            var token = args[index];
            switch (token)
            {
                case "--limits":
                case "-l":
                    limits = ParsePositiveIntValue(args, ref index, token);
                    break;
                case "--name":
                case "-n":
                    name = ReadStringValue(args, ref index, token);
                    break;
                default:
                    throw new InvalidOperationException($"unknown list flag: {token}");
            }
        }

        var query = new List<string> { $"limits={limits}" };
        if (!string.IsNullOrWhiteSpace(name)) query.Add($"name={Uri.EscapeDataString(name)}");
        var response = await SendJsonAsync(runtime, HttpMethod.Get, "/api/v1/directives/list?" + string.Join('&', query), null, true, cancellationToken);
        var count = response.Payload["count"]?.GetValue<int?>() ?? 0;
        if (count == 0)
        {
            await runtime.Deps.Out.WriteLineAsync("No records found");
            return 0;
        }

        var recordsNode = response.Payload["records"];
        if (recordsNode is null)
        {
            throw new InvalidOperationException("response missing records");
        }

        var records = Deserialize<List<ListRecord>>(recordsNode) ?? [];
        if (records.Count == 0)
        {
            await runtime.Deps.Out.WriteLineAsync("No records found");
            return 0;
        }

        await runtime.Deps.Out.WriteLineAsync(RenderRecordTable(records));
        return 0;
    }

    private static async Task<int> RunRecordingAsync(ClientRuntime runtime, string[] args, CancellationToken cancellationToken)
    {
        var request = new RecordingRequest();
        for (var index = 0; index < args.Length; index++)
        {
            var token = args[index];
            switch (token)
            {
                case "--name":
                case "-n":
                    request.LogName = ReadStringValue(args, ref index, token);
                    break;
                case "--width":
                    request.Width = ParseIntValue(args, ref index, token);
                    break;
                case "--height":
                    request.Height = ParseIntValue(args, ref index, token);
                    break;
                case "--stposx":
                    request.StPosX = ParseIntValue(args, ref index, token);
                    break;
                case "--stposy":
                    request.StPosY = ParseIntValue(args, ref index, token);
                    break;
                default:
                    throw new InvalidOperationException($"unknown recording flag: {token}");
            }
        }

        if (string.IsNullOrWhiteSpace(request.LogName))
        {
            request.LogName = "mkp-" + runtime.Deps.UtcNow().ToString("yyyy-MM-dd HH:mm:ss");
        }

        var response = await SendJsonAsync(runtime, HttpMethod.Post, "/api/v1/directives/alog", request, true, cancellationToken);
        await WriteJsonAsync(runtime.Deps.Out, response.Payload);
        return 0;
    }

    private static async Task<int> RunReplayAsync(ClientRuntime runtime, string[] args, CancellationToken cancellationToken)
    {
        var recordId = string.Empty;
        for (var index = 0; index < args.Length; index++)
        {
            var token = args[index];
            switch (token)
            {
                case "--id":
                case "-i":
                    recordId = ReadStringValue(args, ref index, token);
                    break;
                default:
                    throw new InvalidOperationException($"unknown replay flag: {token}");
            }
        }

        if (string.IsNullOrWhiteSpace(recordId)) throw new InvalidOperationException("id is required");
        var response = await SendJsonAsync(runtime, HttpMethod.Post, "/api/v1/directives/aplay/" + Uri.EscapeDataString(recordId.Trim()), null, true, cancellationToken);
        await WriteJsonAsync(runtime.Deps.Out, response.Payload);
        return 0;
    }

    private static async Task<int> RunRemoveAsync(ClientRuntime runtime, string[] args, CancellationToken cancellationToken)
    {
        var recordId = string.Empty;
        for (var index = 0; index < args.Length; index++)
        {
            var token = args[index];
            switch (token)
            {
                case "--id":
                case "-i":
                    recordId = ReadStringValue(args, ref index, token);
                    break;
                default:
                    throw new InvalidOperationException($"unknown remove flag: {token}");
            }
        }

        if (string.IsNullOrWhiteSpace(recordId)) throw new InvalidOperationException("id is required");
        var response = await SendJsonAsync(runtime, HttpMethod.Delete, "/api/v1/directives/records/" + Uri.EscapeDataString(recordId.Trim()), null, true, cancellationToken);
        await WriteJsonAsync(runtime.Deps.Out, response.Payload);
        return 0;
    }

    private static async Task<int> RunStopAsync(ClientRuntime runtime, CancellationToken cancellationToken)
    {
        var response = await SendJsonAsync(runtime, HttpMethod.Post, "/api/v1/directives/astop", null, true, cancellationToken);
        await WriteJsonAsync(runtime.Deps.Out, response.Payload);
        return 0;
    }

    private static async Task<ClientRuntime> HydrateRuntimeAsync(ParsedClientArgs parsed, ClientDeps deps, CancellationToken cancellationToken)
    {
        var configPath = ResolveConfigPath(parsed, deps);
        var config = LoadClientConfig(configPath);
        var serverAddr = FirstNonEmpty(FlagValue(parsed, "--server"), deps.GetEnv("MKP_SERVER"), config.ServerAddr, DefaultServerEndpoint);
        var mode = FirstNonEmpty(FlagValue(parsed, "--mode"), deps.GetEnv("MKP_MODE"), config.Mode, DefaultClientMode);
        var authToken = FirstNonEmpty(FlagValue(parsed, "--token"), deps.GetEnv("MKP_TOKEN"), config.Token);
        var authUser = FirstNonEmpty(FlagValue(parsed, "--username"), deps.GetEnv("MKP_USER"), config.Username);
        var authPassword = FirstNonEmpty(FlagValue(parsed, "--password"), deps.GetEnv("MKP_PASSWORD"), config.Password);
        var timeout = ResolveTimeout(parsed, deps, config);

        await Task.CompletedTask;
        return new ClientRuntime
        {
            Deps = deps,
            ConfigPath = configPath,
            Config = config,
            ServerAddr = serverAddr,
            Mode = mode,
            AuthToken = authToken,
            AuthUser = authUser,
            AuthPassword = authPassword,
            HttpTimeout = timeout,
            Parsed = parsed
        };
    }

    private static async Task<ClientHttpResponse> SendJsonAsync(ClientRuntime runtime, HttpMethod method, string path, object? payload, bool requireAuth, CancellationToken cancellationToken)
    {
        requireAuth = requireAuth && !IsDebugMode(runtime);
        var token = runtime.AuthToken.Trim();
        if (requireAuth && token.Length == 0)
        {
            token = await EnsureManagedTokenAsync(runtime, false, cancellationToken);
        }

        var response = await DoJsonRequestAsync(runtime, method, path, payload, token, cancellationToken);
        if (response.StatusCode == HttpStatusCode.Unauthorized && requireAuth && token.Length > 0 && !runtime.Parsed.ChangedGlobals.Contains("--token"))
        {
            token = await EnsureManagedTokenAsync(runtime, true, cancellationToken);
            response = await DoJsonRequestAsync(runtime, method, path, payload, token, cancellationToken);
        }

        if ((int)response.StatusCode >= 400)
        {
            throw FormatApiError(response.StatusCode, response.Payload);
        }

        return response;
    }

    private static async Task<ClientHttpResponse> DoJsonRequestAsync(ClientRuntime runtime, HttpMethod method, string path, object? payload, string bearerToken, CancellationToken cancellationToken)
    {
        var baseAddress = runtime.ServerAddr.Trim().TrimEnd('/');
        if (baseAddress.Length == 0) throw new InvalidOperationException("server address is required");

        using var request = new HttpRequestMessage(method, baseAddress + path);
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (!string.IsNullOrWhiteSpace(bearerToken))
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken.Trim());
        }

        if (payload is not null)
        {
            var json = JsonSerializer.Serialize(payload, JsonOptions);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        using var httpClient = runtime.Deps.CreateHttpClient();
        httpClient.Timeout = runtime.HttpTimeout;
        using var response = await httpClient.SendAsync(request, cancellationToken);
        var raw = await response.Content.ReadAsStringAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(raw))
        {
            return new ClientHttpResponse(new JsonObject(), response.StatusCode);
        }

        var node = JsonNode.Parse(raw) as JsonObject;
        if (node is null)
        {
            throw new InvalidOperationException("invalid response: " + raw);
        }

        return new ClientHttpResponse(node, response.StatusCode);
    }

    private static Exception FormatApiError(HttpStatusCode statusCode, JsonObject payload)
    {
        var error = payload["error"]?.GetValue<string>();
        return !string.IsNullOrWhiteSpace(error)
            ? new InvalidOperationException($"request failed ({(int)statusCode}): {error}")
            : new InvalidOperationException($"request failed with status {(int)statusCode}");
    }

    private static async Task<string> EnsureManagedTokenAsync(ClientRuntime runtime, bool forceRefresh, CancellationToken cancellationToken)
    {
        runtime.Config.Username = FirstNonEmpty(runtime.AuthUser, runtime.Config.Username);
        runtime.Config.Password = FirstNonEmpty(runtime.AuthPassword, runtime.Config.Password);

        if (!forceRefresh && !string.IsNullOrWhiteSpace(runtime.Config.Token) && TokenStillValid(runtime, runtime.Config.TokenExpiresAt))
        {
            runtime.AuthToken = runtime.Config.Token;
            return runtime.Config.Token;
        }

        if (string.IsNullOrWhiteSpace(runtime.Config.Username) || string.IsNullOrWhiteSpace(runtime.Config.Password))
        {
            throw new InvalidOperationException("missing auth credentials: run `mkp-dotnet-client auth login` or pass --username/--password");
        }

        var token = await FetchTokenAsync(runtime, runtime.Config.Username, runtime.Config.Password, cancellationToken);
        runtime.Config.ServerAddr = runtime.ServerAddr;
        runtime.Config.Mode = runtime.Mode;
        runtime.Config.Token = token.Token;
        runtime.Config.TokenExpiresAt = token.ExpiresAt.ToString("O");
        runtime.Config.TimeoutSeconds = Math.Max(1, (int)runtime.HttpTimeout.TotalSeconds);
        SaveClientConfig(runtime.ConfigPath, runtime.Config);
        runtime.AuthToken = token.Token;
        return token.Token;
    }

    private static async Task<TokenFetchResult> FetchTokenAsync(ClientRuntime runtime, string username, string password, CancellationToken cancellationToken)
    {
        var response = await DoJsonRequestAsync(runtime, HttpMethod.Post, "/api/v1/auth/token", new Dictionary<string, string>
        {
            ["username"] = username,
            ["password"] = password
        }, string.Empty, cancellationToken);

        if ((int)response.StatusCode >= 400)
        {
            throw FormatApiError(response.StatusCode, response.Payload);
        }

        var token = response.Payload["token"]?.GetValue<string>()?.Trim() ?? string.Empty;
        if (token.Length == 0) throw new InvalidOperationException("auth response missing token");

        var expiresIn = response.Payload["expires_in"]?.GetValue<int?>() ?? 0;
        var expiresAt = runtime.Deps.UtcNow().Add(expiresIn > 0 ? TimeSpan.FromSeconds(expiresIn) : TimeSpan.FromHours(24));
        return new TokenFetchResult(token, expiresAt);
    }

    private static string ResolveConfigPath(ParsedClientArgs parsed, ClientDeps deps)
    {
        var explicitPath = FirstNonEmpty(FlagValue(parsed, "--config"), deps.GetEnv("MKP_CONFIG_PATH"));
        if (explicitPath.Length > 0) return Path.GetFullPath(explicitPath);

        var localPath = Path.Combine(deps.GetCurrentDirectory(), "client.json");
        if (File.Exists(localPath)) return localPath;
        return Path.Combine(deps.GetUserHomeDirectory(), ".mkp", "client.json");
    }

    private static ClientConfig LoadClientConfig(string path)
    {
        if (!File.Exists(path)) return new ClientConfig();
        var data = File.ReadAllText(path);
        if (string.IsNullOrWhiteSpace(data)) return new ClientConfig();
        return JsonSerializer.Deserialize<ClientConfig>(data, JsonOptions) ?? new ClientConfig();
    }

    private static void SaveClientConfig(string path, ClientConfig config)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path) ?? ".");
        File.WriteAllText(path, JsonSerializer.Serialize(config, JsonOptions));
    }

    private static TimeSpan ResolveTimeout(ParsedClientArgs parsed, ClientDeps deps, ClientConfig config)
    {
        var flagValue = FlagValue(parsed, "--timeout");
        if (flagValue.Length > 0) return ParseTimeout(flagValue);
        var envValue = deps.GetEnv("MKP_TIMEOUT")?.Trim() ?? string.Empty;
        if (envValue.Length > 0) return ParseTimeout(envValue);
        if (config.TimeoutSeconds > 0) return TimeSpan.FromSeconds(config.TimeoutSeconds);
        return DefaultHttpTimeout;
    }

    private static TimeSpan ParseTimeout(string raw)
    {
        var value = raw.Trim();
        if (double.TryParse(value, out var numeric) && numeric > 0)
        {
            return TimeSpan.FromSeconds(numeric);
        }

        if (TimeSpan.TryParse(value, out var parsed) && parsed > TimeSpan.Zero)
        {
            return parsed;
        }

        foreach (var suffix in new[] { "ms", "s", "m", "h" })
        {
            if (value.EndsWith(suffix, StringComparison.OrdinalIgnoreCase) && double.TryParse(value[..^suffix.Length], out numeric) && numeric > 0)
            {
                return suffix.ToLowerInvariant() switch
                {
                    "ms" => TimeSpan.FromMilliseconds(numeric),
                    "s" => TimeSpan.FromSeconds(numeric),
                    "m" => TimeSpan.FromMinutes(numeric),
                    "h" => TimeSpan.FromHours(numeric),
                    _ => DefaultHttpTimeout
                };
            }
        }

        throw new InvalidOperationException("invalid timeout value");
    }

    private static bool TokenStillValid(ClientRuntime runtime, string expiresAt)
    {
        if (!DateTimeOffset.TryParse(expiresAt, out var parsed)) return false;
        return runtime.Deps.UtcNow().Add(TokenRefreshSkew) < parsed;
    }

    private static bool TryGetCachedVersion(ClientRuntime runtime, out VersionResponse? response)
    {
        response = null;
        var cache = runtime.Config.VersionCache;
        if (cache?.Response is null) return false;
        if (!string.Equals(NormalizeServerAddr(cache.ServerAddr), NormalizeServerAddr(runtime.ServerAddr), StringComparison.OrdinalIgnoreCase)) return false;
        if (!DateTimeOffset.TryParse(cache.CachedAt, out var cachedAt)) return false;
        if (cachedAt > runtime.Deps.UtcNow().Add(VersionCacheTtl)) return false;
        if (runtime.Deps.UtcNow() - cachedAt > VersionCacheTtl) return false;
        response = cache.Response;
        return true;
    }

    private static void SaveVersionCache(ClientRuntime runtime, VersionResponse response)
    {
        runtime.Config.VersionCache = new VersionCacheEntry
        {
            ServerAddr = NormalizeServerAddr(runtime.ServerAddr),
            CachedAt = runtime.Deps.UtcNow().ToString("O"),
            Response = response
        };
        SaveClientConfig(runtime.ConfigPath, runtime.Config);
    }

    private static string NormalizeServerAddr(string value) => value.Trim().TrimEnd('/');

    private static string RenderVersionTable(VersionResponse response)
    {
        var deviceUver = DefaultVersionValue(FirstNonEmpty(response.Device?.Uver, response.Device?.App));
        var deviceAver = DefaultVersionValue(FirstNonEmpty(response.Device?.Aver, response.Device?.Boot));
        var rows = new List<string[]>
        {
            new[] { "mkp agent server", DefaultVersionValue(response.ServerVersion) },
            new[] { "mkp agent client", MkpKitInfo.Version },
            new[] { "mkp device uver", deviceUver },
            new[] { "mkp device aver", deviceAver }
        };

        return RenderTable(["Component", "Version"], rows);
    }

    private static string RenderRecordTable(IReadOnlyList<ListRecord> records)
    {
        var rows = records.Select(record => new[]
        {
            record.Name,
            record.UniqueId,
            record.MkpPath,
            $"({record.StartPointX},{record.StartPointY})",
            $"{record.ScreenWidth}x{record.ScreenHeight}",
            record.Os,
            $"{record.Seconds}s {record.Milliseconds}ms",
            record.CreatedAt
        });

        return RenderTable(["Name", "RID", "Location", "Cursor Initial Position", "Screen Size", "OS", "Length", "created At"], rows);
    }

    private static string RenderTable(IReadOnlyList<string> headers, IEnumerable<string[]> rows)
    {
        var builder = new StringBuilder();
        builder.Append("| ").Append(string.Join(" | ", headers)).AppendLine(" |");
        builder.Append("| ").Append(string.Join(" | ", Enumerable.Repeat("---", headers.Count))).AppendLine(" |");
        foreach (var row in rows)
        {
            builder.Append("| ").Append(string.Join(" | ", row.Select(EscapeTableValue))).AppendLine(" |");
        }

        return builder.ToString().TrimEnd();
    }

    private static string EscapeTableValue(string? value)
    {
        return (value ?? string.Empty).Replace("|", "\\|").Replace("\r", " ").Replace("\n", " ").Trim();
    }

    private static string DefaultVersionValue(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? "unknown" : value.Trim();
    }

    private static bool IsDebugMode(ClientRuntime runtime)
    {
        return string.Equals(runtime.Mode.Trim(), "debug", StringComparison.OrdinalIgnoreCase);
    }

    private static ParsedClientArgs ParseArgs(string[] args)
    {
        var globalFlags = new Dictionary<string, string?>(StringComparer.Ordinal);
        var changed = new HashSet<string>(StringComparer.Ordinal);
        var positionals = new List<string>();
        var globalValueFlags = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["--server"] = "--server",
            ["-s"] = "--server",
            ["--mode"] = "--mode",
            ["--token"] = "--token",
            ["--username"] = "--username",
            ["--password"] = "--password",
            ["--config"] = "--config",
            ["--timeout"] = "--timeout"
        };

        for (var index = 0; index < args.Length; index++)
        {
            var token = args[index];
            if (globalValueFlags.TryGetValue(token, out var canonicalName))
            {
                if (index + 1 >= args.Length) throw new InvalidOperationException($"missing value for {token}");
                globalFlags[canonicalName] = args[++index];
                changed.Add(canonicalName);
                continue;
            }

            positionals.Add(token);
        }

        return new ParsedClientArgs(globalFlags, changed, positionals);
    }

    private static string FlagValue(ParsedClientArgs parsed, string name)
    {
        return parsed.GlobalFlags.TryGetValue(name, out var value) && !string.IsNullOrWhiteSpace(value) ? value.Trim() : string.Empty;
    }

    private static string FirstNonEmpty(params string?[] values)
    {
        foreach (var value in values)
        {
            if (!string.IsNullOrWhiteSpace(value)) return value.Trim();
        }

        return string.Empty;
    }

    private static string ReadStringValue(IReadOnlyList<string> args, ref int index, string token)
    {
        index += 1;
        if (index >= args.Count) throw new InvalidOperationException($"missing value for {token}");
        return args[index];
    }

    private static int ParseIntValue(IReadOnlyList<string> args, ref int index, string token)
    {
        var value = ReadStringValue(args, ref index, token);
        if (!int.TryParse(value, out var parsed)) throw new InvalidOperationException($"invalid value for {token}");
        return parsed;
    }

    private static int ParsePositiveIntValue(IReadOnlyList<string> args, ref int index, string token)
    {
        var value = ParseIntValue(args, ref index, token);
        if (value <= 0) throw new InvalidOperationException($"invalid value for {token}");
        return value;
    }

    private static T? Deserialize<T>(JsonNode? node)
    {
        return node is null ? default : node.Deserialize<T>(JsonOptions);
    }

    private static async Task WriteJsonAsync(TextWriter writer, JsonObject payload)
    {
        await writer.WriteLineAsync(payload.ToJsonString(JsonOptions));
    }

    private static ClientDeps DefaultDeps()
    {
        return new ClientDeps
        {
            Out = Console.Out,
            Err = Console.Error,
            CreateHttpClient = static () => new HttpClient(),
            GetEnv = Environment.GetEnvironmentVariable,
            UtcNow = static () => DateTimeOffset.UtcNow,
            GetCurrentDirectory = Directory.GetCurrentDirectory,
            GetUserHomeDirectory = () => Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)
        };
    }
}
