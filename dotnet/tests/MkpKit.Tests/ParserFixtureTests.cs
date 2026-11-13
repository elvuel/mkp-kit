using MkpKit.Models;
using MkpKit.Parser;
using Xunit;

namespace MkpKit.Tests;

public sealed class ParserFixtureTests
{
    private static readonly DirectiveParserRegistry Registry = DirectiveParserRegistry.CreateDefault();

    [Fact]
    public void ParsesAtimeLineJson()
    {
        const string directive = "atime /eMMC/applog/demo.log";
        const string raw = "atime /eMMC/applog/demo.log\r\nnoise\r\n{\"seconds\":6,\"milsec\":950}\r\n<EOF>\r\n";

        var parsed = Assert.IsType<LogLength>(Registry.Resolve(directive).Parse(directive, raw));

        Assert.Equal(6, parsed.Seconds);
        Assert.Equal(950, parsed.Milsec);
    }

    [Fact]
    public void ParsesAHttpBaseOkFallback()
    {
        const string directive = "ahttpbase http://127.0.0.1:8080";
        const string raw = "ahttpbase http://127.0.0.1:8080\r\nOK\r\ncli>";

        var parsed = Assert.IsType<AHTTPBase>(Registry.Resolve(directive).Parse(directive, raw));

        Assert.Equal("http://127.0.0.1:8080", parsed.Ahttpbase);
    }

    [Fact]
    public void ParsesListDirJsonBlobWithPromptNoise()
    {
        const string directive = "list_dir /eMMC/applog";
        const string raw = "boot noise\r\nlist_dir /eMMC/applog\r\nW (954891) setupnvs: log\r\n{\"error\":\"\",\"rootDir\":{\"name\":\"applog\",\"path\":\"/eMMC/applog\",\"type\":\"dir\",\"contents\":[{\"name\":\"spike.log\",\"path\":\"/eMMC/applog/spike.log\",\"type\":\"file\",\"size\":123}]}}\r\n<EOF>\r\ncli>";

        var parsed = Assert.IsType<FileSystem>(Registry.Resolve(directive).Parse(directive, raw));

        Assert.NotNull(parsed.RootDir);
        Assert.Equal("applog", parsed.RootDir!.Name);
        Assert.Single(parsed.RootDir.Contents!);
        Assert.Equal("spike.log", parsed.RootDir.Contents![0].Name);
    }
}
