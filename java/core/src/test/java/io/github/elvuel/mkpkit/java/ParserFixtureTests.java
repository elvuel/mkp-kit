package io.github.elvuel.mkpkit.java;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import org.junit.jupiter.api.Test;

final class ParserFixtureTests {
    @Test
    void parsesAtimeLineJsonWithNoise() {
        DirectiveParsing.Registry registry = DirectiveParsing.createDefaultRegistry();
        String raw = "atime /eMMC/applog/demo.log\r\nnoise\r\n{\"seconds\":6,\"milsec\":950}\r\n<EOF>\r\n";

        Models.LogLength parsed = (Models.LogLength) registry.resolve("atime /eMMC/applog/demo.log").parse("atime /eMMC/applog/demo.log", raw);

        assertEquals(6, parsed.seconds());
        assertEquals(950, parsed.milsec());
    }

    @Test
    void parsesAhttpbaseOkFallback() {
        DirectiveParsing.Registry registry = DirectiveParsing.createDefaultRegistry();
        String raw = "ahttpbase http://127.0.0.1:8080\r\nOK\r\ncli>";

        Models.AHttpBase parsed = (Models.AHttpBase) registry.resolve("ahttpbase http://127.0.0.1:8080").parse("ahttpbase http://127.0.0.1:8080", raw);

        assertEquals("http://127.0.0.1:8080", parsed.ahttpbase());
    }

    @Test
    void parsesAversionCanonicalFields() {
        DirectiveParsing.Registry registry = DirectiveParsing.createDefaultRegistry();
        String raw = "aversion\r\n{\"uver\":\"u1\",\"aver\":\"a1\"}\r\n<EOF>\r\n";

        Models.MkpVersion parsed = (Models.MkpVersion) registry.resolve("aversion").parse("aversion", raw);

        assertEquals("u1", parsed.uver());
        assertEquals("a1", parsed.aver());
    }

    @Test
    void parsesAinspCanonicalFields() {
        DirectiveParsing.Registry registry = DirectiveParsing.createDefaultRegistry();
        String raw = "ainsp /eMMC/applog/demo.log\r\nnoise\r\n{\"seconds\":6,\"milsec\":950,\"width\":1920,\"heigh\":1080,\"stpos\":{\"x\":10,\"y\":20}}\r\n<EOF>\r\n";

        Models.LogInfo parsed = (Models.LogInfo) registry.resolve("ainsp /eMMC/applog/demo.log").parse("ainsp /eMMC/applog/demo.log", raw);

        assertEquals(6, parsed.seconds());
        assertEquals(950, parsed.milsec());
        assertEquals(1920, parsed.width());
        assertEquals(1080, parsed.heigh());
        assertNotNull(parsed.stpos());
        assertEquals(10, parsed.stpos().x());
        assertEquals(20, parsed.stpos().y());
    }

    @Test
    void parsesListDirFixtureWithNoise() {
        DirectiveParsing.Registry registry = DirectiveParsing.createDefaultRegistry();
        String raw = "boot noise\r\nlist_dir /eMMC/applog\r\nW (954891) setupnvs: log\r\n{\"error\":\"\",\"rootDir\":{\"name\":\"applog\",\"path\":\"/eMMC/applog\",\"type\":\"dir\",\"contents\":[{\"name\":\"spike.log\",\"path\":\"/eMMC/applog/spike.log\",\"type\":\"file\",\"size\":123}]}}\r\n<EOF>\r\ncli>";

        Models.FileSystem parsed = (Models.FileSystem) registry.resolve("list_dir /eMMC/applog").parse("list_dir /eMMC/applog", raw);

        assertNotNull(parsed.rootDir());
        assertEquals("applog", parsed.rootDir().name());
        assertEquals(1, parsed.rootDir().contents().size());
        assertEquals("spike.log", parsed.rootDir().contents().getFirst().name());
    }
}
