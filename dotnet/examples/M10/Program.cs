using MkpKit.Examples.Common;
using MkpKit.Models;

return await MainAsync(args);

static async Task<int> MainAsync(string[] args)
{
    const string usage = "usage: dotnet run --project .\\examples\\M10 [--port COMx]";

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

        Console.WriteLine("3s 后开始移动鼠标：先向左 400，再向上 400");
        await Task.Delay(TimeSpan.FromSeconds(3));

        await sfport.Mouse10Async(new M10Option().SetX(-400).WithSyncIgnoreOutput(true));
        await sfport.Mouse10Async(new M10Option().SetY(-400).WithSyncIgnoreOutput(true));

        Console.WriteLine("m10 示例完成");
        return 0;
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine(ex);
        return 1;
    }
}
