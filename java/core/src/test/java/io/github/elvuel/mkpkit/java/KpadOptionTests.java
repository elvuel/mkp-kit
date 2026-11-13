package io.github.elvuel.mkpkit.java;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;

import org.junit.jupiter.api.Test;

final class KpadOptionTests {
    @Test
    void kpadOptionFormatsCli() {
        KpadOption option = new KpadOption()
            .withKeys(Keycodes.expandKpadInputKey("H"))
            .withAutoRelease();

        assertEquals("--s 0x02 --x1 0x0b --rel 1 --d 0", option.toCliFragment());
    }

    @Test
    void expandPrintableSymbolToShiftCombo() {
        assertIterableEquals(
            java.util.List.of("MOD_LSHIFT", "1"),
            Keycodes.expandKpadInputKey("!")
        );
    }

    @Test
    void typeTextBuildsExpectedHelloMkpSequence() throws Exception {
        KpadPressedState.reset();
        FixtureTransport transport = new FixtureTransport();
        SFSerialPort sfport = new SFSerialPort(new SerialPortOptions().withTransport(transport));

        DeviceHelpers.typeText(sfport, "Hello MKP!", null);

        assertEquals(10, transport.getSentDirectives().size());
        assertEquals("kpad --port 2 --s 0x02 --x1 0x0b --rel 1 --d 0", transport.getSentDirectives().get(0));
        assertEquals("kpad --port 2 --x1 0x08 --rel 1 --d 0", transport.getSentDirectives().get(1));
        assertEquals("kpad --port 2 --x1 0x2c --rel 1 --d 0", transport.getSentDirectives().get(5));
        assertEquals("kpad --port 2 --s 0x02 --x1 0x1e --rel 1 --d 0", transport.getSentDirectives().get(9));
    }

    @Test
    void keyDownAndKeyUpAdvancePressedState() throws Exception {
        KpadPressedState.reset();
        FixtureTransport transport = new FixtureTransport();
        SFSerialPort sfport = new SFSerialPort(new SerialPortOptions().withTransport(transport));

        DeviceHelpers.keyDown(sfport, "a", null);
        DeviceHelpers.keyUp(sfport, "a", null);

        assertEquals("kpad --port 2 --x1 0x04 --rel 0 --d 0", transport.getSentDirectives().get(0));
        assertEquals("kpad --port 2 --x1 0x04 --rel 1 --d 0", transport.getSentDirectives().get(1));
        assertEquals("kpad --port 2 --x1 0x00 --rel 0 --d 0", transport.getSentDirectives().get(2));

        KpadPressedState.Snapshot snapshot = KpadPressedState.snapshot();
        assertEquals(0, snapshot.modKeys().size());
        assertEquals(0, snapshot.keys().size());
    }
}
