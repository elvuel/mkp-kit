from __future__ import annotations

import json
from dataclasses import asdict

from mkp_python.converter import (
    MAGIC_V1,
    ButtonEv,
    Envelope,
    Event,
    KeyEvent,
    LogHeader,
    MetaJSON,
    MouseMoveEv,
    Record,
    WheelEv,
    convert_json_file_to_log_file,
    convert_log_file_to_json_file,
    json_to_log,
    mouse_decode,
    mouse_encode,
    read_json_file,
    write_json_file,
    write_log_file,
)


def envelope_obj(env: Envelope) -> dict[str, object]:
    return {
        "format": env.format,
        "version": env.version,
        "meta": asdict(env.meta),
        "events": [event.to_json_obj() for event in env.events],
    }


def synthetic_records() -> tuple[LogHeader, list[Record]]:
    return (
        LogHeader(version=MAGIC_V1),
        [
            Record(port=1, delta=0, length=5, payload=mouse_encode(0, 5, -3, 0)),
            Record(port=1, delta=8, length=5, payload=mouse_encode(1, 0, 0, 0)),
            Record(port=1, delta=16, length=5, payload=mouse_encode(0, 10, 7, 0)),
            Record(port=1, delta=8, length=5, payload=mouse_encode(0, 0, 0, 1)),
            Record(port=2, delta=8, length=8, payload=bytes([0, 0, 0x04, 0, 0, 0, 0, 0])),
            Record(port=2, delta=16, length=8, payload=bytes([0, 0, 0, 0, 0, 0, 0, 0])),
            Record(port=2, delta=8, length=8, payload=bytes([0x02, 0, 0x04, 0, 0, 0, 0, 0])),
            Record(port=2, delta=8, length=8, payload=bytes([0x02, 0, 0, 0, 0, 0, 0, 0])),
            Record(port=2, delta=8, length=8, payload=bytes([0, 0, 0, 0, 0, 0, 0, 0])),
        ],
    )


def test_mouse_encode_decode_roundtrip() -> None:
    cases = [
        (0, 0, 0, 0),
        (1, 5, -3, 0),
        (2, -2048, 2047, -1),
        (4, 1024, -1024, 12),
    ]
    for button, x, y, wheel in cases:
        report = mouse_decode(mouse_encode(button, x, y, wheel))
        assert report.button == button
        assert report.x == x
        assert report.y == y
        assert report.wheel == wheel


def test_json_read_write_roundtrip(tmp_path) -> None:
    env = Envelope(
        version="MKv2",
        meta=MetaJSON(width=1920, height=1080, startX=200, startY=300),
        events=[
            Event(TypeName="MouseMove", MouseMove=MouseMoveEv(x=10, y=-5, ts=15)),
            Event(TypeName="MouseDown", MouseDown=ButtonEv(button="left", ts=16)),
            Event(TypeName="Wheel", Wheel=WheelEv(delta=1, ts=17)),
            Event(TypeName="KeyDown", KeyDown=KeyEvent(keys=["lshift", "a"], ts=18)),
        ],
    )
    path = tmp_path / "sample.json"
    write_json_file(path, env)
    loaded = read_json_file(path)
    assert envelope_obj(loaded) == envelope_obj(env)


def test_log_json_roundtrip_idempotent(tmp_path) -> None:
    header, records = synthetic_records()
    log_path = tmp_path / "rt.log"
    json_path = tmp_path / "rt.json"
    log2_path = tmp_path / "rt2.log"
    json2_path = tmp_path / "rt2.json"

    write_log_file(log_path, header, records, has_mouse=True, has_keyboard=True)
    convert_log_file_to_json_file(str(log_path), str(json_path))
    convert_json_file_to_log_file(str(json_path), str(log2_path))
    convert_log_file_to_json_file(str(log2_path), str(json2_path))

    first = json.loads(json_path.read_text(encoding="utf-8"))
    second = json.loads(json2_path.read_text(encoding="utf-8"))
    assert first == second


def test_json_to_log_preserves_first_event_timestamp() -> None:
    env = Envelope(
        events=[
            Event(TypeName="MouseMove", MouseMove=MouseMoveEv(x=4, y=9, ts=123)),
            Event(TypeName="MouseDown", MouseDown=ButtonEv(button="left", ts=140)),
            Event(TypeName="KeyDown", KeyDown=KeyEvent(keys=["a"], ts=160)),
        ]
    )
    header, records, has_mouse, has_keyboard = json_to_log(env)
    assert header.version == MAGIC_V1
    assert has_mouse is True
    assert has_keyboard is True
    assert records[0].delta == 123
    assert records[1].delta == 17
    assert records[2].delta == 20
