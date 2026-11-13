using MkpKit;
using MkpKit.Server;

var cli = ServerCli.Parse(args);
if (cli.HelpRequested)
{
    Console.WriteLine(ServerCli.Usage());
    return;
}

if (cli.ShowVersion)
{
    Console.WriteLine($"mkp-dotnet-server {MkpKitInfo.Version}");
    return;
}

var loaded = ServerConfigLoader.Load(cli.ConfigPath, Environment.GetEnvironmentVariables().Keys.Cast<object>().ToDictionary(static key => key.ToString()!, key => Environment.GetEnvironmentVariable(key.ToString()!) ?? string.Empty));
var settings = ServerConfigLoader.Apply(ServerSettings.Default, loaded.Config);

var builder = WebApplication.CreateBuilder(args);
ServerApp.ConfigureServices(builder, settings);
var app = builder.Build();
ServerApp.MapRoutes(app);
app.Run($"http://{settings.Bind}:{settings.Port}");
