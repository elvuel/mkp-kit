using MkpKit.FileServer;

var parsed = FileServerCli.Parse(args);
if (parsed.HelpRequested)
{
    Console.WriteLine(FileServerCli.Usage());
    return;
}

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
FileServerApp.MapRoutes(app, parsed.Settings);
app.Run($"http://{parsed.Settings.Bind}:{parsed.Settings.Port}");
