using MkpKit.Controller;
using MkpKit.Examples.Common;
using MkpKit.Models;

return await MainAsync(args);

static async Task<int> MainAsync(string[] args)
{
    const string usage = "usage: dotnet run --project .\\examples\\Kpad [--port COMx]";

    ExampleArguments parsed;
    try
    {
        parsed = ExampleSupport.Parse(args);
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine(ex.Message);
        Console.WriteLine(usage);
        return 1;
    }

    if (parsed.HelpRequested || parsed.Positionals.Count != 0)
    {
        Console.WriteLine(usage);
        return parsed.HelpRequested ? 0 : 1;
    }

    try
    {
        await using var sfport = ExampleSupport.CreateSfPort(parsed.Port);
        await sfport.OpenAsync();

        var controller = new Controller(sfport);
        Console.WriteLine("3s 后开始输出文本: Hello MKP!");
        await Task.Delay(TimeSpan.FromSeconds(3));
        await controller.TypeTextAsync("Hello MKP!", new KpadOption().WithSyncIgnoreOutput(true));
        Console.WriteLine("kpad 示例完成");
        return 0;
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine(ex);
        return 1;
    }
}
