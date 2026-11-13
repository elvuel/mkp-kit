using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.TestHost;
using MkpKit.Models;
using MkpKit.Serial;
using MkpKit.Server;
using Xunit;

namespace MkpKit.Server.Tests;

public sealed class ServerTests
{
    [Fact]
    public void ServerConfigLoaderPrefersExplicitPathAndMapsSettings()
    {
        var dir = Path.Combine(Path.GetTempPath(), "mkp-server-config-" + Guid.NewGuid());
        Directory.CreateDirectory(dir);
        var configPath = Path.Combine(dir, "server.json");

        try
        {
            File.WriteAllText(configPath, """
            {
              "mode": "debug",
              "port": 9090,
              "sfPort": "COM9",
              "dbPath": "records.json",
              "jwt": { "secret": "jwt-secret", "user": "demo", "password": "pass", "issuer": "issuer", "ttlSeconds": 1234, "muteInDebug": true },
              "runtime": { "syncDirectiveTimeoutMs": 111, "asyncDirectiveTimeoutMs": 222, "replayCompletionGraceMs": 333, "replayMinimumDurationMs": 444 },
              "cors": { "allowOrigins": ["http://localhost:3000"], "allowMethods": ["GET", "POST"], "allowHeaders": ["Authorization"], "maxAgeSeconds": 60 }
            }
            """);

            Assert.Equal(Path.GetFullPath(configPath), ServerConfigLoader.ResolvePath(configPath, new Dictionary<string, string>()));
            var loaded = ServerConfigLoader.Load(configPath, new Dictionary<string, string>());
            Assert.Equal(Path.GetFullPath(configPath), loaded.ConfigPath);
            var settings = ServerConfigLoader.Apply(ServerSettings.Default, loaded.Config);
            Assert.Equal("debug", settings.Mode);
            Assert.Equal(9090, settings.Port);
            Assert.Equal("COM9", settings.SfPort);
            Assert.Equal("records.json", settings.RecordStorePath);
            Assert.Equal("jwt-secret", settings.JwtSecret);
            Assert.Equal("demo", settings.User);
            Assert.Equal("pass", settings.Password);
            Assert.Equal("issuer", settings.Issuer);
            Assert.Equal(1234, settings.JwtTtlSeconds);
            Assert.Equal(222, settings.AsyncDirectiveTimeoutMs);
            Assert.Equal(333, settings.ReplayCompletionGraceMs);
            Assert.Equal(["http://localhost:3000"], settings.CorsAllowOrigins);
        }
        finally
        {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public async Task ServerAuthTokenIsJwtAndWorksAcrossInstancesWithSameSecret()
    {
        await using var first = await StartServerAsync(new FakeServerPort(), ServerSettings.Default with { JwtSecret = "shared-secret" });
        var token = await IssueTokenAsync(first.GetTestClient());
        Assert.Equal(3, token.Split('.').Length);

        await using var second = await StartServerAsync(new FakeServerPort(), ServerSettings.Default with { JwtSecret = "shared-secret" });
        var request = new HttpRequestMessage(HttpMethod.Get, "/api/v1/directives/replay/status");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await second.GetTestClient().SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ServerAddsCorsHeadersAndHandlesPreflight()
    {
        var settings = ServerSettings.Default with
        {
            CorsAllowOrigins = ["http://localhost:3000"],
            CorsAllowMethods = ["GET", "POST", "DELETE", "OPTIONS"],
            CorsAllowHeaders = ["Authorization", "Content-Type"],
            CorsMaxAgeSeconds = 60
        };
        await using var app = await StartServerAsync(new FakeServerPort(), settings);
        var client = app.GetTestClient();

        var preflight = new HttpRequestMessage(HttpMethod.Options, "/api/v1/directives/list");
        preflight.Headers.Add("Origin", "http://localhost:3000");
        preflight.Headers.Add("Access-Control-Request-Method", "GET");
        var preflightResponse = await client.SendAsync(preflight);
        Assert.Equal(HttpStatusCode.NoContent, preflightResponse.StatusCode);
        Assert.Equal("http://localhost:3000", preflightResponse.Headers.GetValues("Access-Control-Allow-Origin").Single());
        Assert.Equal("60", preflightResponse.Headers.GetValues("Access-Control-Max-Age").Single());

        var health = new HttpRequestMessage(HttpMethod.Get, "/health");
        health.Headers.Add("Origin", "http://localhost:3000");
        var healthResponse = await client.SendAsync(health);
        Assert.Equal("http://localhost:3000", healthResponse.Headers.GetValues("Access-Control-Allow-Origin").Single());
    }

    [Fact]
    public async Task ServerVersionEndpointIsPublic()
    {
        await using var app = await StartServerAsync(new FakeServerPort(), ServerSettings.Default);
        var response = await app.GetTestClient().GetAsync("/api/v1/version");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ServerVersionAndSnEndpointsUseSerialPort()
    {
        var fake = new FakeServerPort();
        await using var app = await StartServerAsync(fake, ServerSettings.Default);
        var client = app.GetTestClient();
        var token = await IssueTokenAsync(client);

        var version = await client.GetAsync("/api/v1/version");
        Assert.Equal(HttpStatusCode.OK, version.StatusCode);

        var sn = new HttpRequestMessage(HttpMethod.Get, "/api/v1/directives/sn");
        sn.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var snResponse = await client.SendAsync(sn);
        var snText = await snResponse.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, snResponse.StatusCode);
        Assert.Contains("SAMPLE-SN", snText);
    }

    [Fact]
    public async Task ServerListGetDeleteRecordsRoundTrip()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), "mkp-dotnet-server-" + Guid.NewGuid(), "records.json");
        await using var app = await StartServerAsync(new FakeServerPort(), ServerSettings.Default with { RecordStorePath = dbPath });
        var client = app.GetTestClient();
        var token = await IssueTokenAsync(client);
        var auth = new AuthenticationHeaderValue("Bearer", token);

        var start = new HttpRequestMessage(HttpMethod.Post, "/api/v1/directives/alog");
        start.Headers.Authorization = auth;
        start.Content = JsonContent(new { log_name = "persisted-demo", width = 800, height = 600, stposx = 1, stposy = 2 });
        var startResponse = await client.SendAsync(start);
        Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);

        var stop = new HttpRequestMessage(HttpMethod.Post, "/api/v1/directives/astop");
        stop.Headers.Authorization = auth;
        var stopResponse = await client.SendAsync(stop);
        var stopJson = await stopResponse.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, stopResponse.StatusCode);
        Assert.Contains("\"persisted\":true", stopJson);

        var list = new HttpRequestMessage(HttpMethod.Get, "/api/v1/directives/list?limits=10&name=persisted");
        list.Headers.Authorization = auth;
        var listResponse = await client.SendAsync(list);
        var listText = await listResponse.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        Assert.Contains("persisted-demo", listText);

        using var listDoc = JsonDocument.Parse(listText);
        var uniqueId = listDoc.RootElement.GetProperty("records")[0].GetProperty("unique_id").GetString()!;

        var get = new HttpRequestMessage(HttpMethod.Get, $"/api/v1/directives/records/{uniqueId}");
        get.Headers.Authorization = auth;
        var getResponse = await client.SendAsync(get);
        var getText = await getResponse.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        Assert.Contains(uniqueId, getText);

        var delete = new HttpRequestMessage(HttpMethod.Delete, $"/api/v1/directives/records/{uniqueId}");
        delete.Headers.Authorization = auth;
        var deleteResponse = await client.SendAsync(delete);
        var deleteText = await deleteResponse.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
        Assert.Contains("record_delete", deleteText);
    }

    [Fact]
    public async Task ServerRecordsPersistAcrossAppInstances()
    {
        var root = Path.Combine(Path.GetTempPath(), "mkp-dotnet-server-persist-" + Guid.NewGuid());
        Directory.CreateDirectory(root);
        var dbPath = Path.Combine(root, "records.json");
        try
        {
            await using (var first = await StartServerAsync(new FakeServerPort(), ServerSettings.Default with { RecordStorePath = dbPath }))
            {
                var client = first.GetTestClient();
                var token = await IssueTokenAsync(client);
                var auth = new AuthenticationHeaderValue("Bearer", token);
                await StartAndStopRecordingAsync(client, auth, "persisted");
            }

            await using var second = await StartServerAsync(new FakeServerPort(), ServerSettings.Default with { RecordStorePath = dbPath });
            var secondClient = second.GetTestClient();
            var secondToken = await IssueTokenAsync(secondClient);
            var list = new HttpRequestMessage(HttpMethod.Get, "/api/v1/directives/list?limits=10");
            list.Headers.Authorization = new AuthenticationHeaderValue("Bearer", secondToken);
            var listText = await (await secondClient.SendAsync(list)).Content.ReadAsStringAsync();
            Assert.Contains("persisted", listText);
        }
        finally
        {
            if (Directory.Exists(root)) Directory.Delete(root, true);
        }
    }

    [Fact]
    public async Task ServerAplayConflictIncludesRetryWindow()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), "mkp-dotnet-server-conflict-" + Guid.NewGuid(), "records.json");
        var fake = new FakeServerPort { LogLengthSeconds = 2, LogLengthMilsec = 250 };
        await using var app = await StartServerAsync(fake, ServerSettings.Default with { RecordStorePath = dbPath, ReplayCompletionGraceMs = 5000 });
        var client = app.GetTestClient();
        var token = await IssueTokenAsync(client);
        var auth = new AuthenticationHeaderValue("Bearer", token);

        await StartAndStopRecordingAsync(client, auth, "conflict-demo");
        var uniqueId = await FirstRecordIdAsync(client, auth);

        var first = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/directives/aplay/{uniqueId}");
        first.Headers.Authorization = auth;
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(first)).StatusCode);

        var second = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/directives/aplay/{uniqueId}");
        second.Headers.Authorization = auth;
        var secondResponse = await client.SendAsync(second);
        var body = await secondResponse.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);
        Assert.Contains("retry_after_seconds", body);
    }

    [Fact]
    public async Task ServerAplayStartsReplayAndUpdatesState()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), "mkp-dotnet-server-aplay-" + Guid.NewGuid(), "records.json");
        var fake = new FakeServerPort { LogLengthSeconds = 1, LogLengthMilsec = 250 };
        await using var app = await StartServerAsync(fake, ServerSettings.Default with { RecordStorePath = dbPath, ReplayCompletionGraceMs = 5000 });
        var client = app.GetTestClient();
        var token = await IssueTokenAsync(client);
        var auth = new AuthenticationHeaderValue("Bearer", token);

        await StartAndStopRecordingAsync(client, auth, "play-demo");
        var uniqueId = await FirstRecordIdAsync(client, auth);

        var play = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/directives/aplay/{uniqueId}");
        play.Headers.Authorization = auth;
        var playResponse = await client.SendAsync(play);
        var playText = await playResponse.Content.ReadAsStringAsync();
        Assert.Equal(HttpStatusCode.OK, playResponse.StatusCode);
        Assert.Contains("\"directive\":\"aplay\"", playText);
        Assert.Contains($"aplay /eMMC/applog/{uniqueId}.log --delay -1", fake.AsyncCalls);

        var status = new HttpRequestMessage(HttpMethod.Get, "/api/v1/directives/replay/status");
        status.Headers.Authorization = auth;
        var statusText = await (await client.SendAsync(status)).Content.ReadAsStringAsync();
        Assert.Contains("\"running\":true", statusText);
        Assert.Contains(uniqueId, statusText);
    }

    [Fact]
    public async Task ServerAcancelClearsReplayState()
    {
        var dbPath = Path.Combine(Path.GetTempPath(), "mkp-dotnet-server-cancel-" + Guid.NewGuid(), "records.json");
        await using var app = await StartServerAsync(new FakeServerPort(), ServerSettings.Default with { RecordStorePath = dbPath, ReplayCompletionGraceMs = 5000 });
        var client = app.GetTestClient();
        var token = await IssueTokenAsync(client);
        var auth = new AuthenticationHeaderValue("Bearer", token);

        await StartAndStopRecordingAsync(client, auth, "cancel-demo");
        var uniqueId = await FirstRecordIdAsync(client, auth);

        var play = new HttpRequestMessage(HttpMethod.Post, $"/api/v1/directives/aplay/{uniqueId}");
        play.Headers.Authorization = auth;
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(play)).StatusCode);

        var cancel = new HttpRequestMessage(HttpMethod.Post, "/api/v1/directives/acancel");
        cancel.Headers.Authorization = auth;
        var cancelText = await (await client.SendAsync(cancel)).Content.ReadAsStringAsync();
        Assert.Contains("\"status\":\"cancel_sent\"", cancelText);

        var status = new HttpRequestMessage(HttpMethod.Get, "/api/v1/directives/replay/status");
        status.Headers.Authorization = auth;
        var statusText = await (await client.SendAsync(status)).Content.ReadAsStringAsync();
        Assert.Contains("\"running\":false", statusText);
    }

    private static StringContent JsonContent(object payload)
    {
        return new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
    }

    private static async Task StartAndStopRecordingAsync(HttpClient client, AuthenticationHeaderValue auth, string logName)
    {
        var start = new HttpRequestMessage(HttpMethod.Post, "/api/v1/directives/alog");
        start.Headers.Authorization = auth;
        start.Content = JsonContent(new { log_name = logName });
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(start)).StatusCode);

        var stop = new HttpRequestMessage(HttpMethod.Post, "/api/v1/directives/astop");
        stop.Headers.Authorization = auth;
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(stop)).StatusCode);
    }

    private static async Task<string> FirstRecordIdAsync(HttpClient client, AuthenticationHeaderValue auth)
    {
        var list = new HttpRequestMessage(HttpMethod.Get, "/api/v1/directives/list?limits=10");
        list.Headers.Authorization = auth;
        var text = await (await client.SendAsync(list)).Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(text);
        return doc.RootElement.GetProperty("records")[0].GetProperty("unique_id").GetString()!;
    }

    private static async Task<string> IssueTokenAsync(HttpClient client)
    {
        var payload = new StringContent(JsonSerializer.Serialize(new { username = "admin", password = "admin" }), Encoding.UTF8, "application/json");
        var response = await client.PostAsync("/api/v1/auth/login", payload);
        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        return doc.RootElement.GetProperty("token").GetString()!;
    }

    private static async Task<WebApplication> StartServerAsync(ISFSerialPort port, ServerSettings settings)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        ServerApp.ConfigureServices(builder, settings, port);
        var app = builder.Build();
        ServerApp.MapRoutes(app);
        await app.StartAsync();
        return app;
    }

    private sealed class FakeServerPort : ISFSerialPort
    {
        public int LogLengthSeconds { get; set; } = 1;
        public int LogLengthMilsec { get; set; } = 2;
        public List<string> AsyncCalls { get; } = [];

        public string Name => "COM77";
        public string MousePortFlag => "1";
        public string KeyboardPortFlag => "2";
        public int SyncOutputTimeoutMs => 10_000;
        public SerialPortStatus SnapshotStatus() => new(Name, true, SyncOutputTimeoutMs, true);
        public Task OpenAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task CloseAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        public ValueTask DisposeAsync() => ValueTask.CompletedTask;
        public Task<string> SendDirectiveAsync(string directive, CancellationToken cancellationToken = default) => Task.FromResult(directive + "\ncli>");
        public Task SendDirectiveNoWaitAsync(string directive, CancellationToken cancellationToken = default) { AsyncCalls.Add(directive); return Task.CompletedTask; }
        public Task<SN> SnAsync(CancellationToken cancellationToken = default) => Task.FromResult(new SN("SAMPLE-SN"));
        public Task<Heartbeat> AliveAsync(CancellationToken cancellationToken = default) => Task.FromResult(new Heartbeat(1));
        public Task<MKPVersion> AVersionAsync(CancellationToken cancellationToken = default) => Task.FromResult(new MKPVersion(App: "1.0.0"));
        public Task<LogLength> ATimeAsync(string path, CancellationToken cancellationToken = default) => Task.FromResult(new LogLength(LogLengthSeconds, LogLengthMilsec));
        public Task<LogInfo> AInspAsync(string path, CancellationToken cancellationToken = default) => Task.FromResult(new LogInfo(Path: path));
        public Task<FileSystem> ListDirAsync(string path, CancellationToken cancellationToken = default) => Task.FromResult(new FileSystem(RootDir: new FileNode("root", path, "dir")));
        public Task<string> CleanDirAsync(string path, CancellationToken cancellationToken = default) => Task.FromResult("cleaned:" + path);
        public Task<string> DeleteFileAsync(string path, CancellationToken cancellationToken = default) => Task.FromResult("deleted:" + path);
        public Task<string> JoinAsync(JoinOption? option = null, CancellationToken cancellationToken = default) => Task.FromResult("joined");
        public Task<string> WifiAutoAsync(WifiAutoOption? option = null, CancellationToken cancellationToken = default) => Task.FromResult("ok");
        public Task<AHTTPBase> AHttpBaseAsync(AHTTPBaseOption? option = null, CancellationToken cancellationToken = default) => Task.FromResult(new AHTTPBase("http://127.0.0.1:8080"));
        public Task<ActionDump> ADumjAsync(string path, CancellationToken cancellationToken = default) => Task.FromResult(new ActionDump());
        public Task<string> AGetAsync(AGetOption option, CancellationToken cancellationToken = default) => Task.FromResult("downloaded");
        public Task<string> APutAsync(APutOption option, CancellationToken cancellationToken = default) => Task.FromResult("uploaded");
        public Task<string> AJson2LogAsync(AJSON2LogOption option, CancellationToken cancellationToken = default) => Task.FromResult("saved");
        public Task<string> ALogAsync(string args = "", CancellationToken cancellationToken = default) => Task.FromResult("recording");
        public Task<string> AStopAsync(CancellationToken cancellationToken = default) => Task.FromResult("stopped");
        public Task<string> ACancelAsync(CancellationToken cancellationToken = default) => Task.FromResult("canceled");
        public Task APlayAsync(APlayOption option, CancellationToken cancellationToken = default) { AsyncCalls.Add($"aplay {SFSerialPort.ComposeLogFullpath(option.LogPath)} --delay {option.Delay}"); return Task.CompletedTask; }
        public Task Mouse10Async(M10Option option, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task KeypadAsync(KpadOption option, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }
}
