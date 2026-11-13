using Microsoft.AspNetCore.Http;

namespace MkpKit.FileServer;

public sealed record FileServerSettings(string Bind = "0.0.0.0", int Port = 8080, string FileRoot = "./file_root");
public sealed record FileServerCliParseResult(bool HelpRequested, FileServerSettings Settings);
public sealed record FileServerEntry(string Name, string Type, long Size, string Path);
public sealed record FileServerUploadResponse(string Status, string Path, long Size);
public sealed record FileServerErrorResponse(string Error);

public static class FileServerCli
{
    public static string Usage() => string.Join('\n',
    [
        "usage: mkp-dotnet-file-server [--port 8080] [--root ./file_root] [--bind 0.0.0.0]",
        string.Empty,
        "Endpoints:",
        "  GET  /<path>        Download file",
        "  PUT  /<path>        Raw upload",
        "  POST /upload        Multipart form upload",
        "  GET  /list?path=    List directory"
    ]);

    public static FileServerCliParseResult Parse(string[] args)
    {
        var bind = "0.0.0.0";
        var port = 8080;
        var root = "./file_root";
        var help = false;

        for (var index = 0; index < args.Length; index++)
        {
            var token = args[index];
            switch (token)
            {
                case "-h":
                case "--help":
                    help = true;
                    break;
                case "--port":
                case "-p":
                    if (index + 1 >= args.Length || !int.TryParse(args[++index], out port)) throw new InvalidOperationException("invalid --port");
                    break;
                case "--root":
                case "-r":
                    if (index + 1 >= args.Length) throw new InvalidOperationException("invalid --root");
                    root = args[++index];
                    break;
                case "--bind":
                case "-b":
                    if (index + 1 >= args.Length) throw new InvalidOperationException("invalid --bind");
                    bind = args[++index];
                    break;
                default:
                    throw new InvalidOperationException($"unknown argument: {token}");
            }
        }

        root = Path.GetFullPath(root);
        return new FileServerCliParseResult(help, new FileServerSettings(bind, port, root));
    }
}

public static class FileServerApp
{
    public static void MapRoutes(IEndpointRouteBuilder app, FileServerSettings settings)
    {
        Directory.CreateDirectory(settings.FileRoot);

        app.MapGet("/healthz", () => Results.Json(new { status = "ok", service = "mkp-file-server", file_root = settings.FileRoot }));

        app.MapGet("/list", (HttpRequest request) =>
        {
            var path = request.Query["path"].ToString();
            var joined = FileServerHelpers.SafeJoin(settings.FileRoot, path);
            if (joined is null)
            {
                return Results.BadRequest(new FileServerErrorResponse("Path traversal rejected"));
            }

            if (!Directory.Exists(joined))
            {
                return Results.NotFound(new FileServerErrorResponse($"Directory not found: {path}"));
            }

            return Results.Json(FileServerHelpers.ListDirectory(joined, settings.FileRoot));
        });

        app.MapPost("/upload", async (HttpRequest request) =>
        {
            if (!request.HasFormContentType)
            {
                return Results.BadRequest(new FileServerErrorResponse("Expected multipart form data"));
            }

            var form = await request.ReadFormAsync();
            var file = form.Files.GetFile("file");
            if (file is null)
            {
                return Results.BadRequest(new FileServerErrorResponse("Missing file field"));
            }

            var pathField = form["path"].ToString();
            var safeName = FileServerHelpers.SanitizeFilename(file.FileName);
            var targetPath = FileServerHelpers.SafeJoin(settings.FileRoot, pathField, safeName);
            if (targetPath is null)
            {
                return Results.BadRequest(new FileServerErrorResponse("Path traversal rejected"));
            }

            Directory.CreateDirectory(Path.GetDirectoryName(targetPath)!);
            await using var input = file.OpenReadStream();
            await using var output = File.Create(targetPath);
            await input.CopyToAsync(output);
            var size = new FileInfo(targetPath).Length;
            var rel = Path.GetRelativePath(settings.FileRoot, targetPath).Replace('\\', '/');
            return Results.Json(new FileServerUploadResponse("ok", rel, size));
        });

        app.MapPut("/{**path}", async (HttpRequest request, string path) =>
        {
            var targetPath = FileServerHelpers.SafeJoin(settings.FileRoot, path);
            if (targetPath is null)
            {
                return Results.BadRequest(new FileServerErrorResponse("Path traversal rejected"));
            }

            Directory.CreateDirectory(Path.GetDirectoryName(targetPath)!);
            await using var output = File.Create(targetPath);
            await request.Body.CopyToAsync(output);
            var size = new FileInfo(targetPath).Length;
            return Results.Json(new FileServerUploadResponse("ok", path.Replace('\\', '/'), size));
        });

        app.MapGet("/{**path}", (string path) =>
        {
            var fsPath = FileServerHelpers.SafeJoin(settings.FileRoot, path);
            if (fsPath is null)
            {
                return Results.BadRequest(new FileServerErrorResponse("Path traversal rejected"));
            }

            if (!File.Exists(fsPath))
            {
                return Results.NotFound(new FileServerErrorResponse($"File not found: {path}"));
            }

            return Results.File(fsPath, fileDownloadName: Path.GetFileName(fsPath));
        });
    }
}

public static class FileServerHelpers
{
    public static string? SafeJoin(string fileRoot, params string[] paths)
    {
        var parts = new List<string> { fileRoot };
        foreach (var path in paths)
        {
            var normalized = (path ?? string.Empty).Replace('\\', '/').TrimStart('/');
            if (string.IsNullOrWhiteSpace(normalized)) continue;
            var element = Path.GetFullPath(Path.Combine(fileRoot, normalized));
            var root = Path.GetFullPath(fileRoot);
            if (!element.StartsWith(root, StringComparison.OrdinalIgnoreCase)) return null;
            parts.Add(normalized.Replace('/', Path.DirectorySeparatorChar));
        }

        var combined = Path.GetFullPath(Path.Combine(parts.ToArray()));
        var fullRoot = Path.GetFullPath(fileRoot);
        return combined.StartsWith(fullRoot, StringComparison.OrdinalIgnoreCase) ? combined : null;
    }

    public static string SanitizeFilename(string filename)
    {
        var name = Path.GetFileName((filename ?? string.Empty).Replace('\\', '/'));
        if (string.IsNullOrWhiteSpace(name)) return "unnamed_file";
        var chars = name.Select(static ch => ch is '<' or '>' or ':' or '"' or '|' or '?' or '*' ? '_' : ch).ToArray();
        var cleaned = new string(chars);
        return string.IsNullOrWhiteSpace(cleaned) || cleaned == "." ? "unnamed_file" : cleaned;
    }

    public static IReadOnlyList<FileServerEntry> ListDirectory(string dirPath, string fileRoot)
    {
        return Directory
            .GetFileSystemEntries(dirPath)
            .Select(path =>
            {
                var info = new FileInfo(path);
                var isDir = Directory.Exists(path);
                return new FileServerEntry(
                    Path.GetFileName(path),
                    isDir ? "dir" : "file",
                    isDir ? 0 : info.Length,
                    Path.GetRelativePath(fileRoot, path).Replace('\\', '/'));
            })
            .OrderBy(static item => item.Name, StringComparer.Ordinal)
            .ToArray();
    }
}
