using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using MkpKit.Models;
using MkpKit.Serial;

namespace MkpKit.Server;

public sealed record ServerSettings(
    string Mode,
    string Bind,
    int Port,
    string SfPort,
    string JwtSecret,
    string User,
    string Password,
    string Issuer,
    int JwtTtlSeconds,
    bool MuteInDebug,
    IReadOnlyList<string> CorsAllowOrigins,
    IReadOnlyList<string> CorsAllowMethods,
    IReadOnlyList<string> CorsAllowHeaders,
    int CorsMaxAgeSeconds,
    int SyncDirectiveTimeoutMs,
    int AsyncDirectiveTimeoutMs,
    int ReplayCompletionGraceMs,
    int ReplayMinimumDurationMs,
    string RecordStorePath)
{
    public static readonly ServerSettings Default = new(
        Mode: "production",
        Bind: "0.0.0.0",
        Port: 8080,
        SfPort: string.Empty,
        JwtSecret: "mkp-dotnet-dev-secret",
        User: "admin",
        Password: "admin",
        Issuer: "mkp-dotnet",
        JwtTtlSeconds: 3600,
        MuteInDebug: false,
        CorsAllowOrigins: ["*"],
        CorsAllowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
        CorsAllowHeaders: ["Origin", "Content-Type", "Accept", "Authorization"],
        CorsMaxAgeSeconds: 60,
        SyncDirectiveTimeoutMs: 10_000,
        AsyncDirectiveTimeoutMs: 3_000,
        ReplayCompletionGraceMs: 1_500,
        ReplayMinimumDurationMs: 1_000,
        RecordStorePath: ".mkp-server-records.json");
}

public sealed record ServerCliParseResult(bool HelpRequested, bool ShowVersion, string? ConfigPath);
public sealed record ServerCliArgs(string? ConfigPath = null, bool Help = false, bool Version = false);
public sealed record LoginRequest(string Username, string Password);
public sealed record PathRequest(string Path);
public sealed record JoinRequest(string Ssid, string Password);
public sealed record WifiAutoRequest(string? State);
public sealed record AHttpBaseRequest(string? Ahttpbase, string? Url);

public sealed class JsonToLogRequest
{
    [JsonPropertyName("json_path")]
    public string JsonPath { get; set; } = string.Empty;

    [JsonPropertyName("save_path")]
    public string SavePath { get; set; } = string.Empty;
}

public sealed class AlogRequest
{
    [JsonPropertyName("log_name")]
    public string? LogName { get; set; }

    [JsonPropertyName("width")]
    public int Width { get; set; }

    [JsonPropertyName("height")]
    public int Height { get; set; }

    [JsonPropertyName("stposx")]
    public int? StPosX { get; set; }

    [JsonPropertyName("stposy")]
    public int? StPosY { get; set; }
}

public sealed class ServerFileConfig
{
    public string? Mode { get; set; }
    public string? Bind { get; set; }
    public string? SfPort { get; set; }
    public string? DbPath { get; set; }
    public object? Port { get; set; }
    public ServerJwtConfig? Jwt { get; set; }
    public ServerRuntimeConfig? Runtime { get; set; }
    public ServerCorsConfig? Cors { get; set; }
}

public sealed class ServerJwtConfig
{
    public string? Secret { get; set; }
    public string? User { get; set; }
    public string? Password { get; set; }
    public string? Issuer { get; set; }
    public int? TtlSeconds { get; set; }
    public bool? MuteInDebug { get; set; }
}

public sealed class ServerRuntimeConfig
{
    public int? SyncDirectiveTimeoutMs { get; set; }
    public int? AsyncDirectiveTimeoutMs { get; set; }
    public int? ReplayCompletionGraceMs { get; set; }
    public int? ReplayMinimumDurationMs { get; set; }
}

public sealed class ServerCorsConfig
{
    public string[]? AllowOrigins { get; set; }
    public string[]? AllowMethods { get; set; }
    public string[]? AllowHeaders { get; set; }
    public int? MaxAgeSeconds { get; set; }
}

public sealed record LoadedServerConfig(string? ConfigPath, ServerFileConfig? Config);

public static class ServerCli
{
    public static string Usage() => string.Join('\n',
    [
        "Usage:",
        "  mkp-dotnet-server [--config path] [--version]",
        string.Empty,
        "Options:",
        "  --config <path>  Load server settings from server.json-like file",
        "  --version        Show version and exit",
        "  -h, --help       Show this help message"
    ]);

    public static ServerCliParseResult Parse(string[] args)
    {
        string? configPath = null;
        var help = false;
        var version = false;
        for (var index = 0; index < args.Length; index++)
        {
            var token = args[index];
            switch (token)
            {
                case "-h":
                case "--help": help = true; break;
                case "--version": version = true; break;
                case "--config":
                case "-c":
                    if (index + 1 >= args.Length) throw new InvalidOperationException("missing value for --config");
                    configPath = args[++index];
                    break;
                default: throw new InvalidOperationException($"unknown argument: {token}");
            }
        }
        return new ServerCliParseResult(help, version, configPath);
    }
}

public static class ServerConfigLoader
{
    public static string? ResolvePath(string? cliPath, IReadOnlyDictionary<string, string> env)
    {
        var explicitPath = string.IsNullOrWhiteSpace(cliPath) ? (env.TryGetValue("MKP_CONFIG_PATH", out var path) ? path : string.Empty) : cliPath;
        if (!string.IsNullOrWhiteSpace(explicitPath)) return Path.GetFullPath(explicitPath);
        var cwdPath = Path.Combine(Directory.GetCurrentDirectory(), "server.json");
        if (File.Exists(cwdPath)) return cwdPath;
        var homePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".mkp", "server.json");
        return File.Exists(homePath) ? homePath : null;
    }

    public static LoadedServerConfig Load(string? cliPath, IReadOnlyDictionary<string, string> env)
    {
        var configPath = ResolvePath(cliPath, env);
        if (string.IsNullOrWhiteSpace(configPath)) return new LoadedServerConfig(null, null);
        var raw = File.ReadAllText(configPath);
        var config = string.IsNullOrWhiteSpace(raw) ? new ServerFileConfig() : System.Text.Json.JsonSerializer.Deserialize<ServerFileConfig>(raw, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        return new LoadedServerConfig(configPath, config);
    }

    public static ServerSettings Apply(ServerSettings defaults, ServerFileConfig? config)
    {
        if (config is null) return defaults;
        return defaults with
        {
            Mode = string.IsNullOrWhiteSpace(config.Mode) ? defaults.Mode : config.Mode,
            Bind = string.IsNullOrWhiteSpace(config.Bind) ? defaults.Bind : config.Bind,
            SfPort = string.IsNullOrWhiteSpace(config.SfPort) ? defaults.SfPort : config.SfPort,
            RecordStorePath = string.IsNullOrWhiteSpace(config.DbPath) ? defaults.RecordStorePath : config.DbPath,
            Port = ParsePositive(config.Port, defaults.Port),
            JwtSecret = string.IsNullOrWhiteSpace(config.Jwt?.Secret) ? defaults.JwtSecret : config.Jwt.Secret,
            User = string.IsNullOrWhiteSpace(config.Jwt?.User) ? defaults.User : config.Jwt.User,
            Password = string.IsNullOrWhiteSpace(config.Jwt?.Password) ? defaults.Password : config.Jwt.Password,
            Issuer = string.IsNullOrWhiteSpace(config.Jwt?.Issuer) ? defaults.Issuer : config.Jwt.Issuer,
            JwtTtlSeconds = config.Jwt?.TtlSeconds is > 0 ? config.Jwt.TtlSeconds.Value : defaults.JwtTtlSeconds,
            MuteInDebug = config.Jwt?.MuteInDebug ?? defaults.MuteInDebug,
            SyncDirectiveTimeoutMs = config.Runtime?.SyncDirectiveTimeoutMs is > 0 ? config.Runtime.SyncDirectiveTimeoutMs.Value : defaults.SyncDirectiveTimeoutMs,
            AsyncDirectiveTimeoutMs = config.Runtime?.AsyncDirectiveTimeoutMs is > 0 ? config.Runtime.AsyncDirectiveTimeoutMs.Value : defaults.AsyncDirectiveTimeoutMs,
            ReplayCompletionGraceMs = config.Runtime?.ReplayCompletionGraceMs is > 0 ? config.Runtime.ReplayCompletionGraceMs.Value : defaults.ReplayCompletionGraceMs,
            ReplayMinimumDurationMs = config.Runtime?.ReplayMinimumDurationMs is > 0 ? config.Runtime.ReplayMinimumDurationMs.Value : defaults.ReplayMinimumDurationMs,
            CorsAllowOrigins = Clean(config.Cors?.AllowOrigins) ?? defaults.CorsAllowOrigins,
            CorsAllowMethods = Clean(config.Cors?.AllowMethods) ?? defaults.CorsAllowMethods,
            CorsAllowHeaders = Clean(config.Cors?.AllowHeaders) ?? defaults.CorsAllowHeaders,
            CorsMaxAgeSeconds = config.Cors?.MaxAgeSeconds is > 0 ? config.Cors.MaxAgeSeconds.Value : defaults.CorsMaxAgeSeconds
        };
    }

    private static int ParsePositive(object? value, int fallback)
    {
        if (value is int i && i > 0) return i;
        if (value is long l && l > 0 && l <= int.MaxValue) return (int)l;
        if (value is string s && int.TryParse(s, out var parsed) && parsed > 0) return parsed;
        if (value is System.Text.Json.JsonElement json)
        {
            if (json.ValueKind == System.Text.Json.JsonValueKind.Number && json.TryGetInt32(out var number) && number > 0) return number;
            if (json.ValueKind == System.Text.Json.JsonValueKind.String && int.TryParse(json.GetString(), out var stringNumber) && stringNumber > 0) return stringNumber;
        }
        return fallback;
    }

    private static IReadOnlyList<string>? Clean(IEnumerable<string>? values)
    {
        var cleaned = values?.Where(static item => !string.IsNullOrWhiteSpace(item)).Select(static item => item.Trim()).ToArray();
        return cleaned is { Length: > 0 } ? cleaned : null;
    }
}

public static class ServerApp
{
    public static void ConfigureServices(WebApplicationBuilder builder, ServerSettings settings, ISFSerialPort? port = null)
    {
        builder.Services.AddSingleton(settings);
        builder.Services.AddSingleton<ISFSerialPort>(_ => port ?? CreatePort(settings));
        builder.Services.AddSingleton<IMacroRecordStore>(_ => new JsonMacroRecordStore(settings.RecordStorePath));
        builder.Services.AddSingleton<ServerApiState>();
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("mkp", policy =>
            {
                if (settings.CorsAllowOrigins.Contains("*")) policy.AllowAnyOrigin();
                else policy.WithOrigins(settings.CorsAllowOrigins.ToArray());
                policy.WithMethods(settings.CorsAllowMethods.ToArray());
                policy.WithHeaders(settings.CorsAllowHeaders.ToArray());
                policy.SetPreflightMaxAge(TimeSpan.FromSeconds(settings.CorsMaxAgeSeconds));
            });
        });

        builder.Services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(DeriveJwtKey(settings.JwtSecret)),
                    ValidateIssuer = true,
                    ValidIssuer = settings.Issuer,
                    ValidateAudience = false,
                    ClockSkew = TimeSpan.Zero
                };
            });
        builder.Services.AddAuthorization();
    }

    public static void MapRoutes(WebApplication app)
    {
        app.UseCors("mkp");
        app.UseAuthentication();
        app.UseAuthorization();

        app.MapMethods("/{**path}", ["OPTIONS"], () => Results.NoContent());

        app.MapGet("/healthz", () => Results.Json(new { status = "ok", language = MkpKitInfo.Language, stage = MkpKitInfo.Stage, service = "mkp-server" }));

        app.MapGet("/health", (ISFSerialPort port, ServerApiState state) => Results.Json(new
        {
            ok = true,
            status = "up",
            ready = true,
            serial = port.SnapshotStatus(),
            alog = SerializeAlog(state.SnapshotAlogState()),
            replay = SerializeReplay(state.SnapshotReplayState())
        }));

        app.MapPost("/api/v1/auth/login", (LoginRequest request, ServerSettings settings) => Login(request, settings));
        app.MapPost("/api/v1/auth/token", (LoginRequest request, ServerSettings settings) => Login(request, settings));

        app.MapGet("/api/v1/version", async (ISFSerialPort port, CancellationToken ct) =>
        {
            var mkpDevice = await port.AVersionAsync(ct);
            return Results.Json(new { ok = true, directive = "version", mkp_server = MkpKitInfo.Version, mkp_device = mkpDevice });
        });

        var authed = app.MapGroup("/api/v1/directives");
        var settings = app.Services.GetRequiredService<ServerSettings>();
        if (!(settings.Mode == "debug" && settings.MuteInDebug))
        {
            authed.RequireAuthorization();
        }

        authed.MapGet("/catalog", () => Results.Json(new { ok = true, directive = "catalog", directives = SupportedDirectives() }));
        authed.MapGet("/list", (int? limits, string? name, IMacroRecordStore store) =>
        {
            var take = Math.Clamp(limits.GetValueOrDefault(10), 1, 10);
            var records = store.ListRecords(take, name);
            var response = new Dictionary<string, object?>
            {
                ["ok"] = true,
                ["directive"] = "list",
                ["limits"] = take,
                ["count"] = records.Count,
                ["records"] = records.Select(SerializeRecord).ToArray()
            };
            if (!string.IsNullOrWhiteSpace(name)) response["name"] = name.Trim();
            return Results.Json(response);
        });

        authed.MapGet("/records/{recordId}", (string recordId, IMacroRecordStore store) =>
        {
            var trimmed = recordId.Trim();
            if (trimmed.Length == 0) return ApiError(400, "missing record id");
            var record = store.GetRecord(trimmed);
            return record is null
                ? ApiError(404, "record not found")
                : Results.Json(new { ok = true, directive = "record", record = SerializeRecord(record) });
        });

        authed.MapDelete("/records/{recordId}", async (string recordId, IMacroRecordStore store, ServerApiState state, ISFSerialPort port, CancellationToken ct) =>
        {
            var trimmed = recordId.Trim();
            if (trimmed.Length == 0) return ApiError(400, "missing record id");
            var record = store.GetRecord(trimmed);
            if (record is null) return ApiError(404, "record not found");

            var (blocking, replay) = state.CurrentReplayConflict(record.UniqueId);
            if (blocking)
            {
                return Results.Json(new
                {
                    ok = false,
                    error = "record is currently being replayed",
                    retry_after_seconds = replay.RetryAfterSeconds
                }, statusCode: 409);
            }

            if (!string.IsNullOrWhiteSpace(record.MkpPath))
            {
                await port.DeleteFileAsync(record.MkpPath, ct);
            }

            store.DeleteRecord(record.UniqueId, out _);
            return Results.Json(new { ok = true, directive = "record_delete", id = record.UniqueId, file_deleted = !string.IsNullOrWhiteSpace(record.MkpPath) });
        });

        authed.MapGet("/replay/status", (ServerApiState state) => Results.Json(new { ok = true, directive = "replay_status", replay = SerializeReplay(state.SnapshotReplayState()) }));

        authed.MapPost("/alog", async (AlogRequest request, ServerApiState state, ISFSerialPort port, CancellationToken ct) =>
        {
            var logName = request.LogName?.Trim() ?? string.Empty;
            if (logName.Length == 0) return ApiError(400, "missing log_name");

            var uniqueId = Guid.NewGuid().ToString("N")[..20];
            var startX = request.StPosX is >= 0 ? request.StPosX.Value : 0;
            var startY = request.StPosY is >= 0 ? request.StPosY.Value : 0;
            var session = new AlogSession(
                logName,
                uniqueId,
                SFSerialPort.ComposeLogFullpath(uniqueId),
                startX,
                startY,
                request.Width > 0 ? request.Width : 0,
                request.Height > 0 ? request.Height : 0,
                Environment.OSVersion.Platform.ToString().ToLowerInvariant());

            if (!state.TryStartAlog(session, out _))
            {
                return Results.Json(new { ok = false, error = "alog is already running" }, statusCode: 409);
            }

            try
            {
                await port.ALogAsync(BuildAlogArgs(uniqueId, request), ct);
                state.MarkAlogStarted(uniqueId);
                return Results.Json(new { ok = true, directive = "alog", id = uniqueId, log_name = logName, status = "started" });
            }
            catch
            {
                state.ResetAlog(uniqueId);
                throw;
            }
        });

        authed.MapPost("/astop", async (ServerApiState state, IMacroRecordStore store, ISFSerialPort port, CancellationToken ct) =>
        {
            await port.AStopAsync(ct);
            var stopped = state.StopAlog();
            if (!stopped.WasRunning)
            {
                return Results.Json(new { ok = true, directive = "astop", status = "The stop command has been sent." });
            }

            var response = new Dictionary<string, object?>
            {
                ["ok"] = true,
                ["directive"] = "astop",
                ["id"] = stopped.CurrentId,
                ["status"] = "stopped"
            };

            if (stopped.Session is not null && stopped.Started)
            {
                try
                {
                    var length = await port.ATimeAsync(stopped.Session.MkpPath, ct);
                    var record = store.InsertRecord(new MacroRecordInput(
                        stopped.Session.Name,
                        stopped.Session.UniqueId,
                        stopped.Session.MkpPath,
                        stopped.Session.StartPointX,
                        stopped.Session.StartPointY,
                        stopped.Session.ScreenWidth,
                        stopped.Session.ScreenHeight,
                        stopped.Session.Os,
                        length.Seconds,
                        length.Milsec));
                    response["persisted"] = true;
                    response["macro_record_id"] = record.Id;
                }
                catch (Exception ex)
                {
                    response["persisted"] = false;
                    response["persist_error"] = ex.Message;
                }
            }
            else if (stopped.Session is not null)
            {
                response["persisted"] = false;
                response["persist_error"] = "alog session was not fully started";
            }
            else
            {
                response["persisted"] = false;
                response["persist_error"] = "missing alog session state";
            }

            return Results.Json(response);
        });

        authed.MapPost("/aplay/{recordId}", async (string recordId, IMacroRecordStore store, ServerApiState state, ISFSerialPort port, ServerSettings currentSettings, CancellationToken ct) =>
        {
            state.NormalizeReplayState();
            var (blocking, replay) = state.CurrentReplayConflict(string.Empty);
            if (blocking)
            {
                return Results.Json(new
                {
                    ok = false,
                    error = "replay is already running",
                    retry_after_seconds = replay.RetryAfterSeconds,
                    estimated_done_at = ToIsoString(replay.EstimatedDoneAt),
                    release_after = ToIsoString(replay.ReleaseAfter)
                }, statusCode: 409);
            }

            var trimmed = recordId.Trim();
            if (trimmed.Length == 0) return ApiError(400, "missing record id");
            var record = store.GetRecord(trimmed);
            if (record is null) return ApiError(404, "record not found");

            using var timeoutCts = LinkTimeout(ct, currentSettings.AsyncDirectiveTimeoutMs);
            await port.SendDirectiveNoWaitAsync($"aplay {record.MkpPath} --delay -1", timeoutCts.Token);

            var startedAt = DateTimeOffset.UtcNow;
            state.BeginReplay(record, startedAt);
            var snapshot = state.SnapshotReplayState();
            return Results.Json(new
            {
                ok = true,
                directive = "aplay",
                id = record.UniqueId,
                mkp_path = record.MkpPath,
                status = "started",
                estimated_done_at = ToIsoString(snapshot.EstimatedDoneAt),
                release_after = ToIsoString(snapshot.ReleaseAfter)
            });
        });

        authed.MapPost("/acancel", async (ServerApiState state, ISFSerialPort port, CancellationToken ct) =>
        {
            await port.ACancelAsync(ct);
            var canceled = state.CancelReplay();
            return Results.Json(new { ok = true, directive = "acancel", id = canceled.ReplayId, was_running = canceled.WasRunning, status = "cancel_sent" });
        });

        authed.MapGet("/sn", async (ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "sn", result = await port.SnAsync(ct) }));
        authed.MapGet("/alive", async (ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "alive", result = await port.AliveAsync(ct) }));
        authed.MapGet("/aversion", async (ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "aversion", result = await port.AVersionAsync(ct) }));
        authed.MapPost("/list_dir", async (PathRequest request, ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "list_dir", result = await port.ListDirAsync(request.Path, ct) }));
        authed.MapPost("/clean_dir", async (PathRequest request, ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "clean_dir", result = await port.CleanDirAsync(request.Path, ct) }));
        authed.MapPost("/delete_file", async (PathRequest request, ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "delete_file", result = await port.DeleteFileAsync(request.Path, ct) }));
        authed.MapPost("/join", async (JoinRequest request, ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "join", result = await port.JoinAsync(new JoinOption(request.Ssid, request.Password), ct) }));
        authed.MapPost("/wifi_auto", async (WifiAutoRequest request, ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "wifi_auto", result = await port.WifiAutoAsync(new WifiAutoOption(request.State), ct) }));
        authed.MapPost("/ahttpbase", async (AHttpBaseRequest request, ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "ahttpbase", result = await port.AHttpBaseAsync(new AHTTPBaseOption(request.Ahttpbase ?? request.Url), ct) }));
        authed.MapPost("/ainsp", async (PathRequest request, ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "ainsp", result = await port.AInspAsync(request.Path, ct) }));
        authed.MapPost("/atime", async (PathRequest request, ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "atime", result = await port.ATimeAsync(request.Path, ct) }));
        authed.MapPost("/adumj", async (PathRequest request, ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "adumj", result = await port.ADumjAsync(request.Path, ct) }));
        authed.MapPost("/aget", async (PathRequest request, ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "aget", result = await port.AGetAsync(new AGetOption(request.Path), ct) }));
        authed.MapPost("/aput", async (PathRequest request, ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "aput", result = await port.APutAsync(new APutOption(request.Path), ct) }));
        authed.MapPost("/ajson2log", async (JsonToLogRequest request, ISFSerialPort port, CancellationToken ct) => Results.Json(new { ok = true, directive = "ajson2log", result = await port.AJson2LogAsync(new AJSON2LogOption(request.JsonPath, request.SavePath), ct) }));
    }

    private static IResult Login(LoginRequest request, ServerSettings settings)
    {
        if (!string.Equals(request.Username, settings.User, StringComparison.Ordinal) || !string.Equals(request.Password, settings.Password, StringComparison.Ordinal))
        {
            return Results.Json(new { ok = false, error = "invalid username or password" }, statusCode: 401);
        }

        return Results.Json(new
        {
            ok = true,
            token = IssueToken(settings, request.Username),
            token_type = "Bearer",
            expires_in = settings.JwtTtlSeconds
        });
    }

    private static string BuildAlogArgs(string uniqueId, AlogRequest request)
    {
        var option = new LogOption
        {
            Width = request.Width,
            Height = request.Height,
            StPosX = request.StPosX ?? -1,
            StPosY = request.StPosY ?? -1
        };
        var args = new List<string> { uniqueId };
        args.AddRange(option.CliArgs());
        return string.Join(' ', args.Where(static item => !string.IsNullOrWhiteSpace(item)));
    }

    private static CancellationTokenSource LinkTimeout(CancellationToken parent, int timeoutMs)
    {
        var cts = CancellationTokenSource.CreateLinkedTokenSource(parent);
        if (timeoutMs > 0)
        {
            cts.CancelAfter(timeoutMs);
        }
        return cts;
    }

    private static IResult ApiError(int statusCode, string error)
    {
        return Results.Json(new { ok = false, error }, statusCode: statusCode);
    }

    private static object SerializeRecord(MacroRecord record) => new
    {
        id = record.Id,
        name = record.Name,
        unique_id = record.UniqueId,
        mkp_path = record.MkpPath,
        start_point_x = record.StartPointX,
        start_point_y = record.StartPointY,
        screen_width = record.ScreenWidth,
        screen_height = record.ScreenHeight,
        os = record.Os,
        seconds = record.Seconds,
        milliseconds = record.Milliseconds,
        created_at = ToIsoString(record.CreatedAt),
        updated_at = ToIsoString(record.UpdatedAt)
    };

    private static object SerializeAlog(AlogSnapshot state) => new
    {
        running = state.Running,
        started = state.Started,
        current_id = state.CurrentId
    };

    private static object SerializeReplay(ReplaySnapshot state) => new
    {
        running = state.Running,
        current_id = state.CurrentId,
        started_at = ToIsoString(state.StartedAt),
        estimated_done_at = ToIsoString(state.EstimatedDoneAt),
        release_after = ToIsoString(state.ReleaseAfter),
        active = state.Active,
        retry_after_seconds = state.RetryAfterSeconds
    };

    private static string? ToIsoString(DateTimeOffset? value)
    {
        return value?.ToUniversalTime().ToString("O").Replace("+00:00", "Z", StringComparison.Ordinal);
    }

    private static ISFSerialPort CreatePort(ServerSettings settings)
    {
        var portName = string.IsNullOrWhiteSpace(settings.SfPort) ? SFSerialPort.CheckSfSerialPort() : settings.SfPort;
        return new SFSerialPort(new SerialPortOptions { Name = portName, SyncOutputTimeoutMs = settings.SyncDirectiveTimeoutMs });
    }

    private static string IssueToken(ServerSettings settings, string username)
    {
        var credentials = new SigningCredentials(new SymmetricSecurityKey(DeriveJwtKey(settings.JwtSecret)), SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: settings.Issuer,
            audience: null,
            claims: [new Claim(ClaimTypes.Name, username)],
            expires: DateTime.UtcNow.AddSeconds(settings.JwtTtlSeconds),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static byte[] DeriveJwtKey(string secret)
    {
        return SHA256.HashData(Encoding.UTF8.GetBytes(secret));
    }

    private static string[] SupportedDirectives() =>
    [
        "sn", "alive", "aversion", "list_dir", "clean_dir", "delete_file", "join", "wifi_auto", "ahttpbase", "ainsp", "atime", "adumj", "aget", "aput", "ajson2log", "alog", "astop", "acancel", "aplay"
    ];
}
