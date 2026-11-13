using System.Net;
using System.Text;
using System.Text.Json;
using MkpKit.Client;
using Xunit;
using Xunit.Sdk;

namespace MkpKit.Tests;

public sealed class ClientRunnerTests
{
    [Fact]
    public async Task ClientPrintsUsageWithNoArgs()
    {
        using var harness = new ClientHarness();
        var code = await ClientRunner.RunAsync([], harness.Deps);
        Assert.Equal(0, code);
        Assert.Contains("Usage:", harness.Stdout);
        Assert.Empty(harness.Requests);
    }

    [Fact]
    public async Task AuthLoginFetchesTokenAndPersistsConfig()
    {
        using var harness = new ClientHarness();
        harness.EnqueueJson(HttpStatusCode.OK, new { token = "jwt-login", expires_in = 3600 }, request =>
        {
            Assert.Equal("POST", request.Method);
            Assert.Equal("/api/v1/auth/token", request.PathAndQuery);
            Assert.Contains("\"username\": \"alice\"", request.Body);
            Assert.Contains("\"password\": \"secret\"", request.Body);
        });

        var code = await ClientRunner.RunAsync([
            "--config", harness.ConfigPath,
            "auth", "login",
            "--username", "alice",
            "--password", "secret"
        ], harness.Deps);

        Assert.Equal(0, code);
        Assert.Contains("token saved", harness.Stdout);
        var saved = File.ReadAllText(harness.ConfigPath);
        Assert.Contains("\"server_addr\": \"http://127.0.0.1:8080\"", saved);
        Assert.Contains("\"username\": \"alice\"", saved);
        Assert.Contains("\"password\": \"secret\"", saved);
        Assert.Contains("\"token\": \"jwt-login\"", saved);
    }

    [Fact]
    public async Task VersionUsesCachedResponseOnSecondRun()
    {
        using var harness = new ClientHarness();
        harness.EnqueueJson(HttpStatusCode.OK, new
        {
            ok = true,
            directive = "averion",
            mkp_server = "1.2.3",
            mkp_device = new { app = "2.0.0", boot = "1.0.0", hw = "m10" }
        }, request =>
        {
            Assert.Equal("GET", request.Method);
            Assert.Equal("/api/v1/version", request.PathAndQuery);
        });

        var first = await ClientRunner.RunAsync(["--config", harness.ConfigPath, "version"], harness.Deps);
        var second = await ClientRunner.RunAsync(["--config", harness.ConfigPath, "version"], harness.Deps);

        Assert.Equal(0, first);
        Assert.Equal(0, second);
        Assert.Single(harness.Requests);
        Assert.Contains("mkp agent server", harness.Stdout);
        Assert.Contains("mkp device uver", harness.Stdout);
        Assert.Contains("mkp device aver", harness.Stdout);
        Assert.Contains("1.2.3", harness.Stdout);
    }

    [Fact]
    public async Task VersionReturnsErrorWhenPayloadOkIsFalse()
    {
        using var harness = new ClientHarness();
        harness.EnqueueJson(HttpStatusCode.OK, new
        {
            ok = false,
            error = "device unavailable"
        });

        var code = await ClientRunner.RunAsync(["--config", harness.ConfigPath, "version"], harness.Deps);

        Assert.Equal(1, code);
        Assert.Contains("request failed: device unavailable", harness.Stderr);
    }

    [Fact]
    public async Task AuthTokenRefreshesExpiredStoredToken()
    {
        using var harness = new ClientHarness();
        harness.WriteConfig(new
        {
            server_addr = "http://127.0.0.1:8080",
            username = "alice",
            password = "secret",
            token = "stale-token",
            token_expires_at = "2026-11-12T00:00:00Z"
        });

        harness.EnqueueJson(HttpStatusCode.OK, new { token = "fresh-token", expires_in = 3600 }, request =>
        {
            Assert.Equal("POST", request.Method);
            Assert.Equal("/api/v1/auth/token", request.PathAndQuery);
        });

        var code = await ClientRunner.RunAsync(["--config", harness.ConfigPath, "auth", "token"], harness.Deps);

        Assert.Equal(0, code);
        Assert.Contains("fresh-token", harness.Stdout);
        var saved = File.ReadAllText(harness.ConfigPath);
        Assert.Contains("\"token\": \"fresh-token\"", saved);
    }

    [Fact]
    public async Task ListFetchesManagedTokenAndRendersTable()
    {
        using var harness = new ClientHarness();
        harness.WriteConfig(new
        {
            server_addr = "http://127.0.0.1:8080",
            username = "alice",
            password = "secret"
        });

        harness.EnqueueJson(HttpStatusCode.OK, new { token = "jwt-list", expires_in = 3600 }, request =>
        {
            Assert.Equal("POST", request.Method);
            Assert.Equal("/api/v1/auth/token", request.PathAndQuery);
        });
        harness.EnqueueJson(HttpStatusCode.OK, new
        {
            ok = true,
            count = 1,
            records = new[]
            {
                new
                {
                    name = "demo",
                    unique_id = "RID-001",
                    mkp_path = "/eMMC/applog/demo.log",
                    start_point_x = 11,
                    start_point_y = 22,
                    screen_width = 1080,
                    screen_height = 1920,
                    os = "windows",
                    seconds = 3,
                    milliseconds = 450,
                    created_at = "2026-11-13T00:00:00Z"
                }
            }
        }, request =>
        {
            Assert.Equal("GET", request.Method);
            Assert.Equal("/api/v1/directives/list?limits=2&name=demo", request.PathAndQuery);
            Assert.Equal("Bearer jwt-list", request.Authorization);
        });

        var code = await ClientRunner.RunAsync(["--config", harness.ConfigPath, "list", "--limits", "2", "--name", "demo"], harness.Deps);

        Assert.Equal(0, code);
        Assert.Equal(2, harness.Requests.Count);
        Assert.Contains("| Name | RID |", harness.Stdout);
        Assert.Contains("RID-001", harness.Stdout);
    }

    [Fact]
    public async Task ListFailsWhenRecordsFieldIsMissingButCountIsPositive()
    {
        using var harness = new ClientHarness();
        harness.WriteConfig(new
        {
            server_addr = "http://127.0.0.1:8080",
            token = "jwt-ready",
            token_expires_at = "2099-01-01T00:00:00Z"
        });

        harness.EnqueueJson(HttpStatusCode.OK, new
        {
            ok = true,
            count = 1
        });

        var code = await ClientRunner.RunAsync(["--config", harness.ConfigPath, "list"], harness.Deps);

        Assert.Equal(1, code);
        Assert.Contains("response missing records", harness.Stderr);
    }

    [Fact]
    public async Task ReplayRemoveAndStopCallExpectedEndpoints()
    {
        using var harness = new ClientHarness();
        harness.WriteConfig(new
        {
            server_addr = "http://127.0.0.1:8080",
            token = "jwt-ready",
            token_expires_at = "2099-01-01T00:00:00Z"
        });

        harness.EnqueueJson(HttpStatusCode.OK, new { ok = true, directive = "aplay" });
        harness.EnqueueJson(HttpStatusCode.OK, new { ok = true, directive = "remove" });
        harness.EnqueueJson(HttpStatusCode.OK, new { ok = true, directive = "astop" });

        var replay = await ClientRunner.RunAsync(["--config", harness.ConfigPath, "replay", "--id", "RID 1"], harness.Deps);
        var remove = await ClientRunner.RunAsync(["--config", harness.ConfigPath, "remove", "--id", "RID 1"], harness.Deps);
        var stop = await ClientRunner.RunAsync(["--config", harness.ConfigPath, "stop"], harness.Deps);

        Assert.Equal(0, replay);
        Assert.Equal(0, remove);
        Assert.Equal(0, stop);
        Assert.Collection(harness.Requests,
            request =>
            {
                Assert.Equal("POST", request.Method);
                Assert.Equal("/api/v1/directives/aplay/RID%201", request.PathAndQuery);
                Assert.Equal("Bearer jwt-ready", request.Authorization);
            },
            request =>
            {
                Assert.Equal("DELETE", request.Method);
                Assert.Equal("/api/v1/directives/records/RID%201", request.PathAndQuery);
                Assert.Equal("Bearer jwt-ready", request.Authorization);
            },
            request =>
            {
                Assert.Equal("POST", request.Method);
                Assert.Equal("/api/v1/directives/astop", request.PathAndQuery);
                Assert.Equal("Bearer jwt-ready", request.Authorization);
            });
    }

    private sealed class ClientHarness : IDisposable
    {
        private readonly StringWriter _out = new();
        private readonly StringWriter _err = new();
        private readonly Queue<Func<RequestLog, HttpResponseMessage>> _responses = new();
        private readonly string _root = Path.Combine(Path.GetTempPath(), "mkp-dotnet-client-tests", Guid.NewGuid().ToString("N"));

        public ClientHarness()
        {
            Directory.CreateDirectory(_root);
        }

        public string Stdout => _out.ToString();
        public string Stderr => _err.ToString();
        public string ConfigPath => Path.Combine(_root, "client.json");
        public List<RequestLog> Requests { get; } = [];

        public ClientDeps Deps => new()
        {
            Out = _out,
            Err = _err,
            CreateHttpClient = () => new HttpClient(new StubHandler(this)),
            GetEnv = _ => null,
            UtcNow = static () => new DateTimeOffset(2026, 11, 13, 0, 0, 0, TimeSpan.Zero),
            GetCurrentDirectory = () => _root,
            GetUserHomeDirectory = () => _root
        };

        public void EnqueueJson(HttpStatusCode statusCode, object payload, Action<RequestLog>? inspect = null)
        {
            _responses.Enqueue(request =>
            {
                inspect?.Invoke(request);
                return JsonResponse(statusCode, payload);
            });
        }

        public void WriteConfig(object payload)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(ConfigPath)!);
            File.WriteAllText(ConfigPath, JsonSerializer.Serialize(payload, JsonOptions));
        }

        public void Dispose()
        {
            try
            {
                if (Directory.Exists(_root))
                {
                    Directory.Delete(_root, true);
                }
            }
            catch
            {
            }
        }

        private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

        private static HttpResponseMessage JsonResponse(HttpStatusCode statusCode, object payload)
        {
            return new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(JsonSerializer.Serialize(payload, JsonOptions), Encoding.UTF8, "application/json")
            };
        }

        private sealed class StubHandler(ClientHarness harness) : HttpMessageHandler
        {
            protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            {
                var body = request.Content is null ? string.Empty : await request.Content.ReadAsStringAsync(cancellationToken);
                var log = new RequestLog(
                    request.Method.Method,
                    request.RequestUri?.PathAndQuery ?? string.Empty,
                    request.Headers.Authorization?.ToString() ?? string.Empty,
                    body);
                harness.Requests.Add(log);

                if (harness._responses.Count == 0)
                {
                    throw new XunitException($"unexpected request: {log.Method} {log.PathAndQuery}");
                }

                return harness._responses.Dequeue()(log);
            }
        }
    }

    private sealed record RequestLog(string Method, string PathAndQuery, string Authorization, string Body);
}
