from __future__ import annotations

from types import SimpleNamespace
import threading

import pytest

import mkp_python.sdk as sdk
from mkp_python.models import (
    AGetOption,
    AHTTPBase,
    AHTTPBaseOption,
    AJSON2LogOption,
    APutOption,
    ActionDump,
    FileSystem,
    Heartbeat,
    JoinOption,
    LogInfo,
    LogLength,
    MKPVersion,
    SN,
    WifiAutoOption,
)
from mkp_python.parser import EOF_CLI, EOF_DEFAULT


def test_extract_sync_output_ignores_stale_prompt_before_echo() -> None:
    output, remaining = sdk._extract_sync_output(
        """cli>
atime /eMMC/applog/spike.log
{"seconds": 6, "milsec": 950}
<EOF>
""",
        "atime /eMMC/applog/spike.log",
        EOF_DEFAULT,
    )
    assert output == 'atime /eMMC/applog/spike.log\n{"seconds": 6, "milsec": 950}\n'
    assert remaining == ""


def test_extract_sync_output_waits_until_directive_echo_exists() -> None:
    output, remaining = sdk._extract_sync_output("cli>\nnoise only\n", "atime /eMMC/applog/spike.log", EOF_DEFAULT)
    assert output is None
    assert remaining == "cli>\nnoise only\n"


def test_extract_sync_output_honors_cli_eof_mode() -> None:
    output, remaining = sdk._extract_sync_output(
        """boot
adumj demo-log
{
  "format": "mkp-action-v1"
}
<EOF>
cli>""",
        "adumj demo-log",
        EOF_CLI,
    )
    assert output == 'adumj demo-log\n{\n  "format": "mkp-action-v1"\n}\n<EOF>\n'
    assert remaining == ""


class DummyPort:
    def __init__(self, payload=None, sync_output_enabled: bool = True) -> None:
        self.payload = payload
        self.sync_output_enabled = sync_output_enabled
        self.calls: list[tuple[str, float | None]] = []

    def send_parsed(self, directive: str, timeout: float | None = None):
        self.calls.append((directive, timeout))
        return self.payload


@pytest.mark.parametrize(
    ("label", "invoke"),
    [
        ("join", lambda port: sdk.join(port)),
        ("device_sn", lambda port: sdk.device_sn(port)),
        ("list_dir", lambda port: sdk.list_dir(port, "/eMMC")),
        ("alive", lambda port: sdk.alive(port)),
        ("ahttpbase", lambda port: sdk.ahttpbase(port)),
        ("ainspect", lambda port: sdk.ainspect(port, "demo/record1")),
    ],
)
def test_sync_helpers_require_sync_mode(label: str, invoke) -> None:
    port = DummyPort(sync_output_enabled=False)
    with pytest.raises(RuntimeError, match="please enable sync mode first"):
        invoke(port)
    assert port.calls == []


def test_wifi_auto_validates_state_before_send() -> None:
    port = DummyPort(payload="on")
    with pytest.raises(RuntimeError, match='wifi_auto state must be "1" or "0"'):
        sdk.wifi_auto(port, WifiAutoOption(state="2"))
    assert port.calls == []


@pytest.mark.parametrize(
    ("invoke", "message"),
    [
        (lambda port: sdk.aupload_to_mkp(port, AGetOption()), "aget file path is required"),
        (lambda port: sdk.adownload_from_mkp(port, APutOption()), "aput file path is required"),
        (lambda port: sdk.ajson2log(port, AJSON2LogOption()), "ajson2log json path is required"),
        (lambda port: sdk.ajson2log(port, AJSON2LogOption(jsonpath="demo.json")), "ajson2log output log path is required"),
        (lambda port: sdk.adumj(port, ""), "adumj log path is required"),
    ],
)
def test_required_argument_validation_matches_go(invoke, message: str) -> None:
    port = DummyPort(sync_output_enabled=False)
    with pytest.raises(RuntimeError, match=message):
        invoke(port)
    assert port.calls == []


def test_list_dir_raises_embedded_error_field() -> None:
    port = DummyPort(payload={"rootDir": None, "error": "directory not found"})
    with pytest.raises(RuntimeError, match="directory not found"):
        sdk.list_dir(port, "/eMMC/applog")
    assert port.calls == [("list_dir /eMMC/applog", None)]


def test_controller_wraps_remaining_go_helpers(monkeypatch: pytest.MonkeyPatch) -> None:
    port1 = SimpleNamespace(name="one")
    port2 = SimpleNamespace(name="two")
    ctrl = sdk.Controller(port1)
    ctrl.bind_sfport(port2)

    calls: list[tuple[str, object, tuple[object, ...]]] = []

    def record(name: str, result):
        def inner(sfport, *args):
            calls.append((name, sfport, args))
            return result

        return inner

    monkeypatch.setattr(sdk, "join", record("join", "joined"))
    monkeypatch.setattr(sdk, "wifi_auto", record("wifi_auto", "on"))
    monkeypatch.setattr(sdk, "device_sn", record("device_sn", SN(sn="MKP-001")))
    monkeypatch.setattr(sdk, "list_dir", record("list_dir", FileSystem()))
    monkeypatch.setattr(sdk, "clean_dir", record("clean_dir", "cleaned"))
    monkeypatch.setattr(sdk, "delete_file", record("delete_file", "deleted"))
    monkeypatch.setattr(sdk, "alive", record("alive", Heartbeat(timetamp=1)))
    monkeypatch.setattr(sdk, "atime", record("atime", LogLength(seconds=1, milsec=250)))
    monkeypatch.setattr(sdk, "aversion", record("aversion", MKPVersion(uver="u", aver="a")))
    monkeypatch.setattr(sdk, "aupload_to_mkp", record("aupload_to_mkp", "uploaded"))
    monkeypatch.setattr(sdk, "adownload_from_mkp", record("adownload_from_mkp", "downloaded"))
    monkeypatch.setattr(sdk, "ajson2log", record("ajson2log", "converted"))
    monkeypatch.setattr(sdk, "ahttpbase", record("ahttpbase", AHTTPBase(ahttpbase="http://localhost")))
    monkeypatch.setattr(sdk, "adumj", record("adumj", ActionDump(format="mkp-action-v1", version="MKv2", meta={}, events=[])))
    monkeypatch.setattr(sdk, "ainspect", record("ainspect", LogInfo(seconds=1, milsec=0, width=1920, heigh=1080, stpos={"x": 0, "y": 0})))

    assert ctrl.join(JoinOption(ssid="ssid", password="pwd"), 1.0) == "joined"
    assert ctrl.wifi_auto(WifiAutoOption(state="1"), 2.0) == "on"
    assert ctrl.device_sn(3.0).sn == "MKP-001"
    assert ctrl.list_dir("/eMMC", 4.0).rootDir is None
    assert ctrl.clean_dir("/eMMC/applog/demo", 5.0) == "cleaned"
    assert ctrl.delete_file("demo", 6.0) == "deleted"
    assert ctrl.alive(7.0).timetamp == 1
    assert ctrl.atime("demo/record1", 8.0).seconds == 1
    assert ctrl.aversion(9.0).uver == "u"
    assert ctrl.aupload_to_mkp(AGetOption(filepath="applog/demo.log"), 10.0) == "uploaded"
    assert ctrl.adownload_from_mkp(APutOption(filepath="applog/demo.log"), 11.0) == "downloaded"
    assert ctrl.ajson2log(AJSON2LogOption(jsonpath="demo.json", outputlogpath="demo.log"), 12.0) == "converted"
    assert ctrl.ahttpbase(AHTTPBaseOption(url="http://localhost"), 13.0).ahttpbase == "http://localhost"
    assert ctrl.adumj("demo-log", 14.0).version == "MKv2"
    assert ctrl.ainspect("demo/record1", 15.0).width == 1920

    assert [name for name, _, _ in calls] == [
        "join",
        "wifi_auto",
        "device_sn",
        "list_dir",
        "clean_dir",
        "delete_file",
        "alive",
        "atime",
        "aversion",
        "aupload_to_mkp",
        "adownload_from_mkp",
        "ajson2log",
        "ahttpbase",
        "adumj",
        "ainspect",
    ]
    assert all(sfport is port2 for _, sfport, _ in calls)


class ScriptedSerial:
    def __init__(self, responses: dict[str, list[str]]) -> None:
        self.responses = {key: list(value) for key, value in responses.items()}
        self._buffer = bytearray()
        self._lock = threading.Lock()
        self.closed = False

    @property
    def in_waiting(self) -> int:
        with self._lock:
            return len(self._buffer)

    def write(self, data: bytes) -> None:
        directive = data.decode("utf-8").strip()
        queue = self.responses.get(directive)
        if not queue:
            raise AssertionError(f"unexpected directive: {directive}")
        response = queue.pop(0)
        with self._lock:
            self._buffer.extend(response.encode("utf-8"))

    def read(self, size: int) -> bytes:
        with self._lock:
            if not self._buffer:
                return b""
            chunk = self._buffer[:size]
            del self._buffer[:size]
            return bytes(chunk)

    def close(self) -> None:
        self.closed = True


def make_scripted_serial_port(responses: dict[str, list[str]]) -> sdk.SerialPort:
    sfport = sdk.SerialPort()
    sfport.name = "COM_TEST"
    sfport._port = ScriptedSerial(responses)
    sfport.start_read_loop()
    return sfport


def test_repeated_atime_handles_stale_prompt_between_runs() -> None:
    directive = "atime /eMMC/applog/spike.log"
    good = """atime /eMMC/applog/spike.log
{"seconds": 6, "milsec": 950}
<EOF>
"""
    stale_then_good = "cli>\n" + good
    sfport = make_scripted_serial_port({directive: [good, stale_then_good]})
    try:
        first = sdk.atime(sfport, "/eMMC/applog/spike.log", timeout=0.5)
        second = sdk.atime(sfport, "/eMMC/applog/spike.log", timeout=0.5)
    finally:
        sfport.close()
    assert first.seconds == 6
    assert first.milsec == 950
    assert second.seconds == 6
    assert second.milsec == 950



def test_repeated_list_dir_handles_stale_prompt_between_runs() -> None:
    directive = "list_dir /eMMC/applog"
    good = """list_dir /eMMC/applog
{"rootDir":{"name":"applog","path":"/eMMC/applog","type":"directory","size":0,"contents":[]},"error":""}
<EOF>
"""
    stale_then_good = "cli>\n" + good
    sfport = make_scripted_serial_port({directive: [good, stale_then_good]})
    try:
        first = sdk.list_dir(sfport, "/eMMC/applog", timeout=0.5)
        second = sdk.list_dir(sfport, "/eMMC/applog", timeout=0.5)
    finally:
        sfport.close()
    assert first.rootDir is not None
    assert first.rootDir.path == "/eMMC/applog"
    assert second.rootDir is not None
    assert second.rootDir.path == "/eMMC/applog"



def test_repeated_ainspect_handles_stale_prompt_between_runs() -> None:
    directive = "ainsp /eMMC/applog/spike.log"
    good = """ainsp /eMMC/applog/spike.log
I (456) alog: logfile /eMMC/applog/spike.log
{"seconds": 6, "milsec": 950, "width": 1920, "heigh": 1080, "stpos": {"x": 0, "y": 0}}
<EOF>
"""
    stale_then_good = "cli>\n" + good
    sfport = make_scripted_serial_port({directive: [good, stale_then_good]})
    try:
        first = sdk.ainspect(sfport, "/eMMC/applog/spike.log", timeout=0.5)
        second = sdk.ainspect(sfport, "/eMMC/applog/spike.log", timeout=0.5)
    finally:
        sfport.close()
    assert first.seconds == 6
    assert first.width == 1920
    assert second.seconds == 6
    assert second.width == 1920


class ResettableStubSerial:
    def __init__(self) -> None:
        self.reset_calls = 0
        self.closed = False

    def reset_input_buffer(self) -> None:
        self.reset_calls += 1

    def close(self) -> None:
        self.closed = True



def test_open_resets_input_buffer_and_runtime_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    stub = ResettableStubSerial()
    monkeypatch.setattr(sdk.serial, "Serial", lambda *args, **kwargs: stub)
    sfport = sdk.SerialPort()
    sfport.name = "COM_TEST"
    sfport._read_buffer = "stale"
    sfport.open()
    try:
        assert sfport._port is stub
        assert sfport._read_buffer == ""
        assert stub.reset_calls == 1
    finally:
        sfport.close()



def test_send_parsed_failure_writes_debug_capture(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MKP_DEBUG_SERIAL_DIR", str(tmp_path))
    sfport = sdk.SerialPort()
    sfport.name = "COM_TEST"
    monkeypatch.setattr(sfport, "send_directive", lambda directive, timeout=None: """atime /eMMC/applog/spike.log
<EOF>
""")

    with pytest.raises(Exception) as excinfo:
        sfport.send_parsed("atime /eMMC/applog/spike.log", timeout=0.1)

    captures = list(tmp_path.glob("*_parse_failed_*.log"))
    assert len(captures) == 1
    content = captures[0].read_text(encoding="utf-8")
    assert "directive: atime /eMMC/applog/spike.log" in content
    assert "[summary]" in content
    assert "parser produced an empty payload before JSON decode" in content
    assert "[raw_output]" in content
    assert "<EOF>" in content
    notes = getattr(excinfo.value, "__notes__", [])
    assert any("serial summary:" in note for note in notes)
    assert any("serial debug saved to" in note for note in notes)



def test_send_directive_timeout_writes_debug_capture(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MKP_DEBUG_SERIAL_DIR", str(tmp_path))
    sfport = sdk.SerialPort()
    sfport.name = "COM_TEST"
    sfport._port = SimpleNamespace(write=lambda data: None)
    sfport._read_buffer = "cli>\nnoise only\n"

    with pytest.raises(sdk.DirectiveTimeoutError) as excinfo:
        sfport.send_directive("alive", timeout=0.01)

    captures = list(tmp_path.glob("*_timeout_*.log"))
    assert len(captures) == 1
    content = captures[0].read_text(encoding="utf-8")
    assert "directive: alive" in content
    assert "[summary]" in content
    assert "timed out before current directive echo appeared" in content
    assert "[pending_read_buffer]" in content
    assert "noise only" in content
    notes = getattr(excinfo.value, "__notes__", [])
    assert any("serial summary:" in note for note in notes)
    assert any("serial debug saved to" in note for note in notes)
