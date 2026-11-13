package io.github.elvuel.mkpkit.java;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class TransportBehaviorTests {
    @Test
    void extractsSyncOutputUsingDefaultEofAndSkipsStalePrompt() {
        String buffer = "cli>\r\nold noise\r\nsn\r\n{\"sn\":\"demo-sn\"}\r\n<EOF>\r\ncli>";

        SyncOutputExtraction.ExtractedSyncOutput extracted = SyncOutputExtraction.extract(buffer, "sn", DirectiveParsing.EOF_DEFAULT);

        assertNotNull(extracted.output());
        assertTrue(extracted.output().contains("demo-sn"));
        assertFalse(extracted.output().contains("cli>"));
    }

    @Test
    void sendDirectiveUsesParserSpecificEofFlag() throws Exception {
        FixtureTransport transport = new FixtureTransport().addFixture("sn", "sn\n{\"sn\":\"demo-sn\"}\n<EOF>\n");
        SFSerialPort sfport = new SFSerialPort(new SerialPortOptions().withTransport(transport));

        sfport.sendDirective("sn");

        assertEquals("sn", transport.lastDirective());
        assertEquals(DirectiveParsing.EOF_DEFAULT, transport.lastEofFlag());
    }

    @Test
    void sendDirectiveFallsBackToCliPromptForUnknownDirective() throws Exception {
        FixtureTransport transport = new FixtureTransport().addFixture("m10 --port 1 --x 10", "m10 --port 1 --x 10\ncli>");
        SFSerialPort sfport = new SFSerialPort(new SerialPortOptions().withTransport(transport));

        sfport.sendDirective("m10 --port 1 --x 10");

        assertEquals(DirectiveParsing.EOF_CLI, transport.lastEofFlag());
    }

    @Test
    void parsedDirectiveUsesAhttpbaseOkFallback() throws Exception {
        FixtureTransport transport = new FixtureTransport().addFixture("ahttpbase http://127.0.0.1:8080", "ahttpbase http://127.0.0.1:8080\nOK\ncli>");
        SFSerialPort sfport = new SFSerialPort(new SerialPortOptions().withTransport(transport));

        Models.AHttpBase parsed = sfport.ahttpbase(new Models.AHttpBaseOption("http://127.0.0.1:8080"));

        assertEquals("http://127.0.0.1:8080", parsed.ahttpbase());
    }
}
