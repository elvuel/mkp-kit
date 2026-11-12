import json

from mkp_python.models import JoinOption, WifiAutoOption
from mkp_python.parser import AHTTPBaseParser, EOF_CLI, ErrRawDirectiveExecutionFailed, PARSERS


def test_join_parse_connected() -> None:
    parser = PARSERS["join"]
    out = """join ssid password1234
I (29664) connect: Connecting to 'ssid'
I (31648) connect: Connected
"""
    assert parser.parse("join ssid password1234", out) == "connected"


def test_join_parse_execution_failed() -> None:
    parser = PARSERS["join"]
    out = """join ssid password1234
W (18376) connect: Connection timed out
Command returned non-zero error code: 0x1 (ERROR)
"""
    try:
        parser.parse("join ssid password1234", out)
    except ErrRawDirectiveExecutionFailed:
        return
    raise AssertionError("expected ErrRawDirectiveExecutionFailed")


def test_wifi_auto_parse_status_on() -> None:
    parser = PARSERS["wifi_auto"]
    out = """wifi_auto
auto: on
cli>"""
    assert parser.parse("wifi_auto", out) == "on"
    assert parser.eof_flag == EOF_CLI


def test_acancel_parse_json_text() -> None:
    parser = PARSERS["acancel"]
    out = """acancel
{"ok":true}
<EOF>
cli>"""
    assert parser.parse("acancel", out) == '{"ok":true}'


def test_sn_parse_json_text() -> None:
    parser = PARSERS["sn"]
    out = """sn
{"sn":"MKP-001"}
<EOF>
cli>"""
    assert json.loads(parser.parse("sn", out)) == {"sn": "MKP-001"}


def test_list_dir_parse_json_text() -> None:
    parser = PARSERS["list_dir"]
    out = """list_dir /eMMC/applog
{"rootDir":{"name":"applog","path":"/eMMC/applog","type":"directory","size":0,"contents":[]},"error":""}
<EOF>
cli>"""
    parsed = parser.parse("list_dir /eMMC/applog", out)
    assert json.loads(parsed)["rootDir"]["path"] == "/eMMC/applog"


def test_list_dir_parse_empty_allowed() -> None:
    parser = PARSERS["list_dir"]
    out = """list_dir /eMMC/applog
<EOF>
cli>"""
    assert parser.parse("list_dir /eMMC/applog", out) == ""


def test_alive_parse_json_text() -> None:
    parser = PARSERS["alive"]
    out = """alive
{"timetamp":1234567890}
<EOF>
cli>"""
    assert json.loads(parser.parse("alive", out)) == {"timetamp": 1234567890}


def test_atime_parse_matching_json_line() -> None:
    parser = PARSERS["atime"]
    out = """atime demo/record1
I (123) alog: logfile /eMMC/applog/demo/record1.log
{"seconds": 1, "milsec": 230}
<EOF>
cli>"""
    assert json.loads(parser.parse("atime demo/record1", out)) == {"seconds": 1, "milsec": 230}


def test_aversion_parse_json_text() -> None:
    parser = PARSERS["aversion"]
    out = """aversion
{"uver":"1.0.0","aver":"2.0.0"}
<EOF>
cli>"""
    assert json.loads(parser.parse("aversion", out)) == {"uver": "1.0.0", "aver": "2.0.0"}


def test_ainsp_parse_matching_json_line() -> None:
    parser = PARSERS["ainsp"]
    out = """ainsp demo/record1
I (456) alog: logfile /eMMC/applog/demo/record1.log
{"seconds": 1, "milsec": 230, "width": 1920, "heigh": 1080, "stpos": {"x": 0, "y": 0}}
<EOF>
cli>"""
    parsed = json.loads(parser.parse("ainsp demo/record1", out))
    assert parsed["seconds"] == 1
    assert parsed["width"] == 1920


def test_adumj_parse_json_blob_with_markers() -> None:
    parser = PARSERS["adumj"]
    out = """adumj demo-log
I (922627) alog: logfile /eMMC/applog/demo-log.log
I (922635) alog: v2 format
{
  "format": "mkp-action-v1",
  "version": "MKv2",
  "meta": {"width": 1920, "height": 1080, "startX": 0, "startY": 0},
  "events": [{"MouseMove": {"x": 1, "y": 2, "ts": 1064}}]
}
<EOF>
cli>"""
    parsed = json.loads(parser.parse("adumj demo-log", out))
    assert parsed["format"] == "mkp-action-v1"
    assert parsed["version"] == "MKv2"


def test_ahttpbase_parse_query_json() -> None:
    parser = AHTTPBaseParser()
    out = """ahttpbase
W (954891) setupnvs: Error reading 'ahttpbase' from NVS: ESP_ERR_NVS_NOT_FOUND
{ "ahttpbase": "" }

<EOF>
cli>"""
    assert parser.parse("ahttpbase", out) == '{ "ahttpbase": "" }'


def test_ahttpbase_parse_set_ok() -> None:
    parser = AHTTPBaseParser()
    out = """ahttpbase http://localhost:3000
OK

cli>"""
    assert parser.parse("ahttpbase http://localhost:3000", out) == '{"ahttpbase": "http://localhost:3000"}'


def test_aget_parse_success() -> None:
    parser = PARSERS["aget"]
    out = """aget applog/demo.log
Downloading http://192.168.71.6:8000/applog/demo.log

I (2925224) heh: HTTP_EVENT_ON_CONNECTED
I (2925424) heh: HTTP_EVENT_ON_DATA, len=75
I (2925424) heh: HTTP_EVENT_ON_FINISH
I (2925424) httpfile: GET status=200, length=75
Saved to /eMMC/applog/demo.log (75 bytes)

I (2925448) heh: HTTP_EVENT_DISCONNECTED
cli>"""
    parsed = parser.parse("aget applog/demo.log", out)
    assert "GET status=200" in parsed
    assert "Saved to /eMMC/applog/demo.log" in parsed


def test_aget_parse_http_failure() -> None:
    parser = PARSERS["aget"]
    out = """aget applog/missing.log
Downloading http://192.168.71.6:8000/applog/missing.log

I (2970792) httpfile: GET status=404, length=76
E (2970792) httpfile: Server returned status 404
I (2970816) heh: HTTP_EVENT_DISCONNECTED
cli>"""
    try:
        parser.parse("aget applog/missing.log", out)
    except ErrRawDirectiveExecutionFailed:
        return
    raise AssertionError("expected ErrRawDirectiveExecutionFailed")


def test_aput_parse_success() -> None:
    parser = PARSERS["aput"]
    out = """aput applog/demo.log
Uploading /eMMC/applog/demo.log -> http://192.168.71.6:8000/upload

I (297931) httpfile: Upload OK (75 bytes) -> http://192.168.71.6:8000/upload
Upload OK

cli>"""
    parsed = parser.parse("aput applog/demo.log", out)
    assert "Upload OK" in parsed
    assert "Uploading /eMMC/applog/demo.log" in parsed


def test_aput_parse_failure() -> None:
    parser = PARSERS["aput"]
    out = """aput applog/missing.log
Uploading /eMMC/applog/missing.log -> http://192.168.71.6:8000/upload

E (345995) httpfile: Failed to open file: /eMMC/applog/missing.log
Upload FAILED

Command returned non-zero error code: 0xffffffff (ESP_FAIL)
cli>"""
    try:
        parser.parse("aput applog/missing.log", out)
    except ErrRawDirectiveExecutionFailed:
        return
    raise AssertionError("expected ErrRawDirectiveExecutionFailed")


def test_ajson2log_parse_success() -> None:
    parser = PARSERS["ajson2log"]
    out = """ajson2log jsons/aaaa.json -o jsons/aaaa.log
I (140523) ajson2log: Written /eMMC/applog/jsons/aaaa.log (version=MKv2, mouse=1, kbd=0)
JSON -> log: /eMMC/applog/jsons/aaaa.log

cli>"""
    parsed = parser.parse("ajson2log jsons/aaaa.json -o jsons/aaaa.log", out)
    assert "JSON -> log: /eMMC/applog/jsons/aaaa.log" in parsed


def test_ajson2log_parse_failure() -> None:
    parser = PARSERS["ajson2log"]
    out = """ajson2log jsons/aaaattt.json -o jsons/aaaa.log
E (374939) ajson2log: Cannot open /eMMC/applog/jsons/aaaattt.json
Command returned non-zero error code: 0xffffffff (ESP_FAIL)
cli>"""
    try:
        parser.parse("ajson2log jsons/aaaattt.json -o jsons/aaaa.log", out)
    except ErrRawDirectiveExecutionFailed:
        return
    raise AssertionError("expected ErrRawDirectiveExecutionFailed")


def test_option_cli_args() -> None:
    assert JoinOption(ssid="ssid", password="password1234").cli_args() == ["ssid", "password1234"]
    assert WifiAutoOption(state="1").cli_args() == ["1"]
