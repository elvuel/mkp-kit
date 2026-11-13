using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.TestHost;
using MkpKit.FileServer;
using Xunit;

namespace MkpKit.Server.Tests;

public sealed class FileServerTests
{
    [Fact]
    public async Task FileServerPutThenGetRoundTripsBytes()
    {
        var root = CreateTempRoot();
        await using var app = await StartFileServerAsync(root);
        var client = app.GetTestClient();

        var put = await client.PutAsync("/nested/demo.txt", new ByteArrayContent("hello mkp"u8.ToArray()));
        Assert.True(put.IsSuccessStatusCode);
        Assert.Contains("nested/demo.txt", await put.Content.ReadAsStringAsync());

        var get = await client.GetAsync("/nested/demo.txt");
        Assert.True(get.IsSuccessStatusCode);
        Assert.Equal("hello mkp", await get.Content.ReadAsStringAsync());
        Assert.Contains("demo.txt", string.Join(';', get.Content.Headers.ContentDisposition?.Parameters?.Select(static item => item.Value) ?? []));

        Assert.Equal("hello mkp", await File.ReadAllTextAsync(Path.Combine(root, "nested", "demo.txt")));
    }

    [Fact]
    public async Task FileServerListReturnsSortedEntries()
    {
        var root = CreateTempRoot();
        await using var app = await StartFileServerAsync(root);
        var client = app.GetTestClient();

        await client.PutAsync("/dir/b.txt", new ByteArrayContent("b"u8.ToArray()));
        await client.PutAsync("/dir/a.txt", new ByteArrayContent("aa"u8.ToArray()));

        var response = await client.GetAsync("/list?path=dir");
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode);
        Assert.Contains("a.txt", text);
        Assert.Contains("b.txt", text);
        Assert.True(text.IndexOf("a.txt", StringComparison.Ordinal) < text.IndexOf("b.txt", StringComparison.Ordinal));
    }

    [Fact]
    public async Task FileServerMultipartUploadStoresSanitizedFilename()
    {
        var root = CreateTempRoot();
        await using var app = await StartFileServerAsync(root);
        var client = app.GetTestClient();

        using var form = new MultipartFormDataContent();
        form.Add(new StringContent("uploads"), "path");
        form.Add(new ByteArrayContent("payload"u8.ToArray()), "file", "bad:name?.txt");

        var response = await client.PostAsync("/upload", form);
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode);
        Assert.Contains("uploads/bad_name_.txt", text);
        Assert.Equal("payload", await File.ReadAllTextAsync(Path.Combine(root, "uploads", "bad_name_.txt")));
    }

    [Fact]
    public async Task FileServerRejectsTraversalAttempts()
    {
        var root = CreateTempRoot();
        await using var app = await StartFileServerAsync(root);
        var client = app.GetTestClient();

        var response = await client.GetAsync("/list?path=../secret");
        Assert.Equal(System.Net.HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Path traversal rejected", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public void FileServerHelpersMatchGoLikeNormalization()
    {
        Assert.Contains("nested", FileServerHelpers.SafeJoin("C:/root", "nested/file.txt"));
        Assert.Null(FileServerHelpers.SafeJoin("C:/root", "../escape.txt"));
        Assert.Equal("demo_name_.txt", FileServerHelpers.SanitizeFilename("demo:name?.txt"));
    }

    private static async Task<WebApplication> StartFileServerAsync(string root)
    {
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseTestServer();
        var app = builder.Build();
        FileServerApp.MapRoutes(app, new FileServerSettings(FileRoot: root));
        await app.StartAsync();
        return app;
    }

    private static string CreateTempRoot()
    {
        var path = Path.Combine(Path.GetTempPath(), "mkp-dotnet-file-server-" + Guid.NewGuid());
        Directory.CreateDirectory(path);
        return path;
    }
}
