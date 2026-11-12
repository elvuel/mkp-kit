from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

EOF_DEFAULT = "<EOF>"
EOF_CLI = "cli>"


class ErrDirectiveParserMissing(RuntimeError):
    pass


class ErrRawDirectiveParseFailed(RuntimeError):
    pass


class ErrRawDirectiveExecutionFailed(RuntimeError):
    pass


@dataclass(slots=True)
class RawDirectiveParser:
    name: str
    json_output: bool = False
    eof_flag: str = EOF_CLI

    def sanitize_r(self, data: str) -> str:
        return data.replace("\r", "")

    def preflight(self, data: str) -> str:
        data = self.sanitize_r(data)
        if self.is_execution_failed(data):
            raise ErrRawDirectiveExecutionFailed(self.name)
        return data

    def is_execution_failed(self, data: str) -> bool:
        lowered = data.lower()
        return "command returned non-zero error code" in lowered or "server returned status 404" in lowered

    def unmarshal_to(self, data: str) -> Any:
        return json.loads(data)

    def parse(self, cli: str, data: str) -> str:
        data = self.preflight(data).strip()
        if not data:
            raise ErrRawDirectiveParseFailed(self.name)
        return data.removeprefix(cli).strip()


def get_raw_directive(directive: str) -> str:
    return directive.split()[0]


def _extract_json_blob(data: str) -> str:
    object_match = re.search(r"(\{.*\})", data, re.S)
    if object_match:
        return object_match.group(1).strip()
    array_match = re.search(r"(\[.*\])", data, re.S)
    if array_match:
        return array_match.group(1).strip()
    raise ErrRawDirectiveParseFailed("json")


def _trim_cli_output(data: str, cli: str = "", trim_default_eof: bool = True) -> str:
    data = data.strip()
    if cli:
        data = data.removeprefix(cli)
    data = data.strip()
    data = data.removesuffix(EOF_CLI).strip()
    if trim_default_eof:
        data = data.removesuffix(EOF_DEFAULT).strip()
    return data


class JSONParser(RawDirectiveParser):
    def __init__(self, name: str, eof_flag: str = EOF_DEFAULT) -> None:
        super().__init__(name=name, json_output=True, eof_flag=eof_flag)

    def parse(self, cli: str, data: str) -> str:
        return _extract_json_blob(_trim_cli_output(self.preflight(data), cli))


class RawJSONTextParser(JSONParser):
    def __init__(self, name: str, eof_flag: str = EOF_DEFAULT, allow_empty: bool = False) -> None:
        super().__init__(name=name, eof_flag=eof_flag)
        self.allow_empty = allow_empty

    def parse(self, cli: str, data: str) -> str:
        normalized = _trim_cli_output(self.preflight(data), cli)
        if not normalized:
            if self.allow_empty:
                return ""
            raise ErrRawDirectiveParseFailed(self.name)
        try:
            return _extract_json_blob(normalized)
        except ErrRawDirectiveParseFailed:
            return normalized


class LineJSONParser(JSONParser):
    def __init__(self, name: str, *required_fragments: str, eof_flag: str = EOF_DEFAULT) -> None:
        super().__init__(name=name, eof_flag=eof_flag)
        self.required_fragments = required_fragments

    def parse(self, cli: str, data: str) -> str:
        normalized = _trim_cli_output(self.preflight(data), cli)
        if not normalized:
            return ""
        for line in normalized.splitlines():
            candidate = line.strip()
            if not candidate.startswith("{"):
                continue
            if all(fragment in candidate for fragment in self.required_fragments):
                return candidate
        return ""


class AHTTPBaseParser(JSONParser):
    def __init__(self) -> None:
        super().__init__(name="ahttpbase", eof_flag=EOF_CLI)

    def parse(self, cli: str, data: str) -> str:
        data = self.preflight(data)
        try:
            return _extract_json_blob(data)
        except ErrRawDirectiveParseFailed:
            normalized = _trim_cli_output(self.sanitize_r(data), cli)
            if normalized.upper() == "OK":
                url = cli.removeprefix(self.name).strip()
                return json.dumps({"ahttpbase": url}, ensure_ascii=False)
            raise


class AGetParser(RawDirectiveParser):
    def parse(self, cli: str, data: str) -> str:
        normalized = _trim_cli_output(self.preflight(data), cli, trim_default_eof=False)
        lowered = normalized.lower()
        if "error code" in lowered or "server returned status" in lowered:
            raise ErrRawDirectiveExecutionFailed(self.name)
        if "GET status=200" in normalized:
            return normalized
        if "GET status=" in normalized:
            raise ErrRawDirectiveExecutionFailed(self.name)
        if not normalized:
            raise ErrRawDirectiveParseFailed(self.name)
        raise ErrRawDirectiveParseFailed(self.name)


class APutParser(RawDirectiveParser):
    def parse(self, cli: str, data: str) -> str:
        normalized = _trim_cli_output(self.preflight(data), cli, trim_default_eof=False)
        lowered = normalized.lower()
        if "upload failed" in lowered or "failed to open file" in lowered or "error code" in lowered:
            raise ErrRawDirectiveExecutionFailed(self.name)
        if "Upload OK" in normalized:
            return normalized
        if not normalized:
            raise ErrRawDirectiveParseFailed(self.name)
        raise ErrRawDirectiveParseFailed(self.name)


class AJSON2LogParser(RawDirectiveParser):
    def parse(self, cli: str, data: str) -> str:
        normalized = _trim_cli_output(self.preflight(data), cli, trim_default_eof=False)
        if "error code" in normalized.lower():
            raise ErrRawDirectiveExecutionFailed(self.name)
        if not normalized:
            raise ErrRawDirectiveParseFailed(self.name)
        return normalized


class AdumjParser(JSONParser):
    def __init__(self) -> None:
        super().__init__(name="adumj", eof_flag=EOF_CLI)

    def parse(self, cli: str, data: str) -> str:
        normalized = _trim_cli_output(self.preflight(data), cli)
        try:
            return _extract_json_blob(normalized)
        except ErrRawDirectiveParseFailed:
            if not normalized:
                return ""
            raise ErrRawDirectiveParseFailed(self.name)


class AstopParser(RawDirectiveParser):
    def parse(self, cli: str, data: str) -> str:
        data = self.preflight(data).strip()
        if data:
            return data
        raise ErrRawDirectiveParseFailed(self.name)


class JoinParser(RawDirectiveParser):
    def parse(self, cli: str, data: str) -> str:
        lowered = self.preflight(data).lower()
        if "connected" in lowered:
            return "connected"
        if "connecting to" in lowered:
            return "connecting"
        raise ErrRawDirectiveParseFailed(self.name)


class WifiAutoParser(RawDirectiveParser):
    def parse(self, cli: str, data: str) -> str:
        data = self.preflight(data).removeprefix(cli).strip().lower()
        if "auto: on" in data:
            return "on"
        if "auto: off" in data:
            return "off"
        return ""


class PlainSuccessParser(RawDirectiveParser):
    pass


PARSERS: dict[str, RawDirectiveParser] = {
    "astop": AstopParser("astop"),
    "acancel": RawJSONTextParser("acancel"),
    "sn": RawJSONTextParser("sn"),
    "list_dir": RawJSONTextParser("list_dir", allow_empty=True),
    "clean_dir": PlainSuccessParser("clean_dir"),
    "delete_file": PlainSuccessParser("delete_file"),
    "alive": RawJSONTextParser("alive", allow_empty=True),
    "atime": LineJSONParser("atime", '"seconds":'),
    "aversion": RawJSONTextParser("aversion", allow_empty=True),
    "ainsp": LineJSONParser("ainsp", '"seconds":', '"width":'),
    "join": JoinParser("join"),
    "wifi_auto": WifiAutoParser("wifi_auto"),
    "adumj": AdumjParser(),
    "ahttpbase": AHTTPBaseParser(),
    "aget": AGetParser("aget"),
    "aput": APutParser("aput"),
    "ajson2log": AJSON2LogParser("ajson2log"),
    "alog": PlainSuccessParser("alog", eof_flag=EOF_CLI),
}


def init_parsers() -> None:
    return None


def get_raw_directive_output_parser(directive: str) -> RawDirectiveParser:
    raw = get_raw_directive(directive)
    parser = PARSERS.get(raw)
    if parser is None:
        raise ErrDirectiveParserMissing(raw)
    return parser
