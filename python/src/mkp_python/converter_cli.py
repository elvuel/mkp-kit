from __future__ import annotations

import argparse
from pathlib import Path

from .converter import (
    Envelope,
    LogHeader,
    json_to_log,
    log_to_json,
    read_json_file,
    read_log_file,
    write_json_file,
    write_log_file,
)

DIR_UNKNOWN = 0
DIR_LOG_TO_JSON = 1
DIR_JSON_TO_LOG = 2


def direction_from_path(path: str) -> int:
    suffix = Path(path).suffix.lower()
    if suffix == ".log":
        return DIR_LOG_TO_JSON
    if suffix == ".json":
        return DIR_JSON_TO_LOG
    return DIR_UNKNOWN


def target_ext(direction: int) -> str:
    if direction == DIR_LOG_TO_JSON:
        return ".json"
    if direction == DIR_JSON_TO_LOG:
        return ".log"
    return ""


def swap_ext(path: str, new_ext: str) -> str:
    return str(Path(path).with_suffix(new_ext))


def _ensure_output_parent(path: str) -> None:
    Path(path).expanduser().resolve().parent.mkdir(parents=True, exist_ok=True)


def _print_log_to_json(out_path: str, env: Envelope) -> None:
    print(f"log -> json: {out_path} ({len(env.events)} events)")


def _print_json_to_log(out_path: str, header: LogHeader, has_mouse: bool, has_keyboard: bool) -> None:
    print(
        f"json -> log: {out_path} "
        f"(version={header.version}, mouse={1 if has_mouse else 0}, kbd={1 if has_keyboard else 0})"
    )


def _build_parser(program_name: str, description: str) -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog=program_name, description=description)
    parser.add_argument("-f", dest="input_path", required=True, help="input file")
    parser.add_argument("-o", dest="output_path", default="", help="output file")
    return parser


def _resolve_output(input_path: str, output_path: str, expected_direction: int) -> str:
    if not output_path:
        return swap_ext(input_path, target_ext(expected_direction))
    canonical_ext = target_ext(expected_direction)
    if Path(output_path).suffix.lower() != canonical_ext:
        return output_path + canonical_ext
    return output_path


def run_converter(argv: list[str] | None = None) -> int:
    parser = _build_parser(
        "mkp-converter",
        "Convert between binary applog (.log) and JSON action envelope (.json).",
    )
    args = parser.parse_args(argv)
    direction = direction_from_path(args.input_path)
    if direction == DIR_UNKNOWN:
        raise SystemExit(f'unrecognized input extension on {args.input_path!r} (expected .log or .json)')
    out_path = _resolve_output(args.input_path, args.output_path, direction)
    _ensure_output_parent(out_path)
    if direction == DIR_LOG_TO_JSON:
        header, records = read_log_file(args.input_path)
        env = log_to_json(header, records)
        write_json_file(out_path, env)
        _print_log_to_json(out_path, env)
    else:
        env = read_json_file(args.input_path)
        header, records, has_mouse, has_keyboard = json_to_log(env)
        write_log_file(out_path, header, records, has_mouse, has_keyboard)
        _print_json_to_log(out_path, header, has_mouse, has_keyboard)
    return 0


def run_json2log(argv: list[str] | None = None) -> int:
    parser = _build_parser(
        "mkp-json2log",
        "Convert firmware action JSON (.json) to binary applog (.log).",
    )
    args = parser.parse_args(argv)
    if Path(args.input_path).suffix.lower() != ".json":
        raise SystemExit(f'unrecognized input extension on {args.input_path!r} (expected .json)')
    out_path = _resolve_output(args.input_path, args.output_path, DIR_JSON_TO_LOG)
    _ensure_output_parent(out_path)
    env = read_json_file(args.input_path)
    header, records, has_mouse, has_keyboard = json_to_log(env)
    write_log_file(out_path, header, records, has_mouse, has_keyboard)
    _print_json_to_log(out_path, header, has_mouse, has_keyboard)
    return 0


def run_log2json(argv: list[str] | None = None) -> int:
    parser = _build_parser(
        "mkp-log2json",
        "Convert between binary applog (.log) and JSON action envelope (.json).",
    )
    args = parser.parse_args(argv)
    direction = direction_from_path(args.input_path)
    if direction == DIR_UNKNOWN:
        raise SystemExit(f'unrecognized input extension on {args.input_path!r} (expected .log or .json)')
    out_path = _resolve_output(args.input_path, args.output_path, direction)
    _ensure_output_parent(out_path)
    if direction == DIR_LOG_TO_JSON:
        header, records = read_log_file(args.input_path)
        env = log_to_json(header, records)
        write_json_file(out_path, env)
        _print_log_to_json(out_path, env)
    else:
        env = read_json_file(args.input_path)
        header, records, has_mouse, has_keyboard = json_to_log(env)
        write_log_file(out_path, header, records, has_mouse, has_keyboard)
        _print_json_to_log(out_path, header, has_mouse, has_keyboard)
    return 0


def main() -> None:
    raise SystemExit(run_converter())


def main_json2log() -> None:
    raise SystemExit(run_json2log())


def main_log2json() -> None:
    raise SystemExit(run_log2json())
