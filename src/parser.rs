use crate::error::{MkpError, Result};
use regex::Regex;
use serde::de::DeserializeOwned;
use serde_json::Value;

pub const EOF_DEFAULT: &str = "<EOF>";
pub const EOF_CLI: &str = "cli>";

#[derive(Debug, Clone, PartialEq)]
pub enum ParsedOutput {
    Json(Value),
    Text(String),
}

impl ParsedOutput {
    pub fn deserialize<T: DeserializeOwned>(self) -> Result<T> {
        match self {
            Self::Json(value) => Ok(serde_json::from_value(value)?),
            Self::Text(text) => Ok(serde_json::from_str(&text)?),
        }
    }

    pub fn into_text(self) -> Result<String> {
        match self {
            Self::Json(value) => Ok(value.to_string()),
            Self::Text(text) => Ok(text),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParserKind {
    Json,
    RawJsonText {
        allow_empty: bool,
    },
    LineJson {
        required_fragments: &'static [&'static str],
    },
    AHttpBase,
    AGet,
    APut,
    AJson2Log,
    Adumj,
    AStop,
    Join,
    WifiAuto,
    PlainSuccess,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RawDirectiveParser {
    pub name: &'static str,
    pub json_output: bool,
    pub eof_flag: &'static str,
    pub kind: ParserKind,
}

impl RawDirectiveParser {
    pub fn parse(&self, cli: &str, data: &str) -> Result<ParsedOutput> {
        match self.kind {
            ParserKind::Json => parse_json(self.name, cli, data, self.eof_flag),
            ParserKind::RawJsonText { allow_empty } => {
                parse_raw_json_text(self.name, cli, data, self.eof_flag, allow_empty)
            }
            ParserKind::LineJson { required_fragments } => {
                parse_line_json(self.name, cli, data, self.eof_flag, required_fragments)
            }
            ParserKind::AHttpBase => parse_ahttpbase(cli, data),
            ParserKind::AGet => parse_aget(self.name, cli, data),
            ParserKind::APut => parse_aput(self.name, cli, data),
            ParserKind::AJson2Log => parse_ajson2log(self.name, cli, data),
            ParserKind::Adumj => parse_adumj(cli, data),
            ParserKind::AStop => parse_astop(self.name, data),
            ParserKind::Join => parse_join(self.name, data),
            ParserKind::WifiAuto => parse_wifi_auto(cli, data),
            ParserKind::PlainSuccess => parse_plain_success(self.name, cli, data),
        }
    }
}

pub fn get_raw_directive(directive: &str) -> String {
    directive
        .split_whitespace()
        .next()
        .unwrap_or_default()
        .to_string()
}

pub fn get_raw_directive_output_parser(directive: &str) -> Result<RawDirectiveParser> {
    match get_raw_directive(directive).as_str() {
        "astop" => Ok(RawDirectiveParser {
            name: "astop",
            json_output: false,
            eof_flag: EOF_CLI,
            kind: ParserKind::AStop,
        }),
        "acancel" => Ok(RawDirectiveParser {
            name: "acancel",
            json_output: true,
            eof_flag: EOF_DEFAULT,
            kind: ParserKind::RawJsonText { allow_empty: false },
        }),
        "sn" => Ok(RawDirectiveParser {
            name: "sn",
            json_output: true,
            eof_flag: EOF_DEFAULT,
            kind: ParserKind::RawJsonText { allow_empty: false },
        }),
        "list_dir" => Ok(RawDirectiveParser {
            name: "list_dir",
            json_output: true,
            eof_flag: EOF_DEFAULT,
            kind: ParserKind::RawJsonText { allow_empty: true },
        }),
        "clean_dir" => Ok(RawDirectiveParser {
            name: "clean_dir",
            json_output: false,
            eof_flag: EOF_CLI,
            kind: ParserKind::PlainSuccess,
        }),
        "delete_file" => Ok(RawDirectiveParser {
            name: "delete_file",
            json_output: false,
            eof_flag: EOF_CLI,
            kind: ParserKind::PlainSuccess,
        }),
        "alive" => Ok(RawDirectiveParser {
            name: "alive",
            json_output: true,
            eof_flag: EOF_DEFAULT,
            kind: ParserKind::RawJsonText { allow_empty: true },
        }),
        "atime" => Ok(RawDirectiveParser {
            name: "atime",
            json_output: true,
            eof_flag: EOF_DEFAULT,
            kind: ParserKind::LineJson {
                required_fragments: &["\"seconds\":"],
            },
        }),
        "aversion" => Ok(RawDirectiveParser {
            name: "aversion",
            json_output: true,
            eof_flag: EOF_DEFAULT,
            kind: ParserKind::RawJsonText { allow_empty: true },
        }),
        "ainsp" => Ok(RawDirectiveParser {
            name: "ainsp",
            json_output: true,
            eof_flag: EOF_DEFAULT,
            kind: ParserKind::LineJson {
                required_fragments: &["\"seconds\":", "\"width\":"],
            },
        }),
        "join" => Ok(RawDirectiveParser {
            name: "join",
            json_output: false,
            eof_flag: EOF_CLI,
            kind: ParserKind::Join,
        }),
        "wifi_auto" => Ok(RawDirectiveParser {
            name: "wifi_auto",
            json_output: false,
            eof_flag: EOF_CLI,
            kind: ParserKind::WifiAuto,
        }),
        "adumj" => Ok(RawDirectiveParser {
            name: "adumj",
            json_output: true,
            eof_flag: EOF_CLI,
            kind: ParserKind::Adumj,
        }),
        "ahttpbase" => Ok(RawDirectiveParser {
            name: "ahttpbase",
            json_output: true,
            eof_flag: EOF_CLI,
            kind: ParserKind::AHttpBase,
        }),
        "aget" => Ok(RawDirectiveParser {
            name: "aget",
            json_output: false,
            eof_flag: EOF_CLI,
            kind: ParserKind::AGet,
        }),
        "aput" => Ok(RawDirectiveParser {
            name: "aput",
            json_output: false,
            eof_flag: EOF_CLI,
            kind: ParserKind::APut,
        }),
        "ajson2log" => Ok(RawDirectiveParser {
            name: "ajson2log",
            json_output: false,
            eof_flag: EOF_CLI,
            kind: ParserKind::AJson2Log,
        }),
        "alog" => Ok(RawDirectiveParser {
            name: "alog",
            json_output: false,
            eof_flag: EOF_CLI,
            kind: ParserKind::PlainSuccess,
        }),
        raw => Err(MkpError::DirectiveParserMissing(raw.to_string())),
    }
}

fn sanitize_r(data: &str) -> String {
    data.replace('\r', "")
}

fn preflight(name: &str, data: &str) -> Result<String> {
    let data = sanitize_r(data);
    if is_execution_failed(&data) {
        return Err(MkpError::RawDirectiveExecutionFailed(name.to_string()));
    }
    Ok(data)
}

fn is_execution_failed(data: &str) -> bool {
    let lowered = data.to_lowercase();
    lowered.contains("command returned non-zero error code")
        || lowered.contains("server returned status 404")
}

fn extract_json_blob(data: &str) -> Result<String> {
    let object_re = Regex::new(r"(\{.*\})").expect("valid object regex");
    if let Some(found) = object_re.find(data) {
        return Ok(found.as_str().trim().to_string());
    }
    let array_re = Regex::new(r"(\[.*\])").expect("valid array regex");
    if let Some(found) = array_re.find(data) {
        return Ok(found.as_str().trim().to_string());
    }
    Err(MkpError::RawDirectiveParseFailed("json".to_string()))
}

fn trim_cli_output(data: &str, cli: &str, trim_default_eof: bool) -> String {
    let mut value = data.trim().to_string();
    if !cli.is_empty() {
        if let Some(stripped) = value.strip_prefix(cli) {
            value = stripped.trim().to_string();
        }
    }
    if let Some(stripped) = value.strip_suffix(EOF_CLI) {
        value = stripped.trim().to_string();
    }
    if trim_default_eof {
        if let Some(stripped) = value.strip_suffix(EOF_DEFAULT) {
            value = stripped.trim().to_string();
        }
    }
    value
}

fn parse_json(name: &str, cli: &str, data: &str, eof_flag: &str) -> Result<ParsedOutput> {
    let normalized = trim_cli_output(&preflight(name, data)?, cli, eof_flag != EOF_CLI);
    let blob = extract_json_blob(&normalized)?;
    Ok(ParsedOutput::Json(serde_json::from_str(&blob)?))
}

fn parse_raw_json_text(
    name: &str,
    cli: &str,
    data: &str,
    _eof_flag: &str,
    allow_empty: bool,
) -> Result<ParsedOutput> {
    let normalized = trim_cli_output(&preflight(name, data)?, cli, true);
    if normalized.is_empty() {
        if allow_empty {
            return Ok(ParsedOutput::Text(String::new()));
        }
        return Err(MkpError::RawDirectiveParseFailed(name.to_string()));
    }
    match extract_json_blob(&normalized) {
        Ok(blob) => Ok(ParsedOutput::Json(serde_json::from_str(&blob)?)),
        Err(_) => Ok(ParsedOutput::Text(normalized)),
    }
}

fn parse_line_json(
    name: &str,
    cli: &str,
    data: &str,
    _eof_flag: &str,
    required_fragments: &[&str],
) -> Result<ParsedOutput> {
    let normalized = trim_cli_output(&preflight(name, data)?, cli, true);
    if normalized.is_empty() {
        return Ok(ParsedOutput::Text(String::new()));
    }
    for line in normalized.lines() {
        let candidate = line.trim();
        if !candidate.starts_with('{') {
            continue;
        }
        if required_fragments
            .iter()
            .all(|fragment| candidate.contains(fragment))
        {
            return Ok(ParsedOutput::Json(serde_json::from_str(candidate)?));
        }
    }
    Ok(ParsedOutput::Text(String::new()))
}

fn parse_ahttpbase(cli: &str, data: &str) -> Result<ParsedOutput> {
    let data = preflight("ahttpbase", data)?;
    match extract_json_blob(&data) {
        Ok(blob) => Ok(ParsedOutput::Json(serde_json::from_str(&blob)?)),
        Err(_) => {
            let normalized = trim_cli_output(&sanitize_r(&data), cli, true);
            if normalized.to_uppercase() == "OK" {
                let url = cli.trim_start_matches("ahttpbase").trim();
                let text = format!("{{\"ahttpbase\":{}}}", serde_json::to_string(url)?);
                return Ok(ParsedOutput::Json(serde_json::from_str(&text)?));
            }
            Err(MkpError::RawDirectiveParseFailed("ahttpbase".to_string()))
        }
    }
}

fn parse_aget(name: &str, cli: &str, data: &str) -> Result<ParsedOutput> {
    let normalized = trim_cli_output(&preflight(name, data)?, cli, false);
    let lowered = normalized.to_lowercase();
    if lowered.contains("error code") || lowered.contains("server returned status") {
        return Err(MkpError::RawDirectiveExecutionFailed(name.to_string()));
    }
    if normalized.contains("GET status=200") {
        return Ok(ParsedOutput::Text(normalized));
    }
    if normalized.contains("GET status=") {
        return Err(MkpError::RawDirectiveExecutionFailed(name.to_string()));
    }
    if normalized.is_empty() {
        return Err(MkpError::RawDirectiveParseFailed(name.to_string()));
    }
    Err(MkpError::RawDirectiveParseFailed(name.to_string()))
}

fn parse_aput(name: &str, cli: &str, data: &str) -> Result<ParsedOutput> {
    let normalized = trim_cli_output(&preflight(name, data)?, cli, false);
    let lowered = normalized.to_lowercase();
    if lowered.contains("upload failed")
        || lowered.contains("failed to open file")
        || lowered.contains("error code")
    {
        return Err(MkpError::RawDirectiveExecutionFailed(name.to_string()));
    }
    if normalized.contains("Upload OK") {
        return Ok(ParsedOutput::Text(normalized));
    }
    if normalized.is_empty() {
        return Err(MkpError::RawDirectiveParseFailed(name.to_string()));
    }
    Err(MkpError::RawDirectiveParseFailed(name.to_string()))
}

fn parse_ajson2log(name: &str, cli: &str, data: &str) -> Result<ParsedOutput> {
    let normalized = trim_cli_output(&preflight(name, data)?, cli, false);
    if normalized.to_lowercase().contains("error code") {
        return Err(MkpError::RawDirectiveExecutionFailed(name.to_string()));
    }
    if normalized.is_empty() {
        return Err(MkpError::RawDirectiveParseFailed(name.to_string()));
    }
    Ok(ParsedOutput::Text(normalized))
}

fn parse_adumj(cli: &str, data: &str) -> Result<ParsedOutput> {
    let normalized = trim_cli_output(&preflight("adumj", data)?, cli, true);
    match extract_json_blob(&normalized) {
        Ok(blob) => Ok(ParsedOutput::Json(serde_json::from_str(&blob)?)),
        Err(_) if normalized.is_empty() => Ok(ParsedOutput::Text(String::new())),
        Err(_) => Err(MkpError::RawDirectiveParseFailed("adumj".to_string())),
    }
}

fn parse_astop(name: &str, data: &str) -> Result<ParsedOutput> {
    let normalized = preflight(name, data)?.trim().to_string();
    if normalized.is_empty() {
        return Err(MkpError::RawDirectiveParseFailed(name.to_string()));
    }
    Ok(ParsedOutput::Text(normalized))
}

fn parse_join(name: &str, data: &str) -> Result<ParsedOutput> {
    let lowered = preflight(name, data)?.to_lowercase();
    if lowered.contains("connected") {
        return Ok(ParsedOutput::Text("connected".to_string()));
    }
    if lowered.contains("connecting to") {
        return Ok(ParsedOutput::Text("connecting".to_string()));
    }
    Err(MkpError::RawDirectiveParseFailed(name.to_string()))
}

fn parse_wifi_auto(cli: &str, data: &str) -> Result<ParsedOutput> {
    let normalized = preflight("wifi_auto", data)?;
    let value = normalized
        .strip_prefix(cli)
        .unwrap_or(&normalized)
        .trim()
        .to_lowercase();
    if value.contains("auto: on") {
        return Ok(ParsedOutput::Text("on".to_string()));
    }
    if value.contains("auto: off") {
        return Ok(ParsedOutput::Text("off".to_string()));
    }
    Ok(ParsedOutput::Text(String::new()))
}

fn parse_plain_success(name: &str, cli: &str, data: &str) -> Result<ParsedOutput> {
    let normalized = trim_cli_output(&preflight(name, data)?, cli, true);
    if normalized.is_empty() {
        return Err(MkpError::RawDirectiveParseFailed(name.to_string()));
    }
    Ok(ParsedOutput::Text(normalized))
}

#[cfg(test)]
mod tests {
    use super::{ParsedOutput, get_raw_directive_output_parser};

    #[test]
    fn parses_atime_line_json() {
        let parser = get_raw_directive_output_parser("atime /eMMC/applog/demo.log").unwrap();
        let data =
            "atime /eMMC/applog/demo.log\r\nnoise\r\n{\"seconds\":6,\"milsec\":950}\r\n<EOF>";
        let parsed = parser.parse("atime /eMMC/applog/demo.log", data).unwrap();
        match parsed {
            ParsedOutput::Json(value) => {
                assert_eq!(value["seconds"], 6);
                assert_eq!(value["milsec"], 950);
            }
            _ => panic!("expected json"),
        }
    }

    #[test]
    fn parses_ahttpbase_ok_fallback() {
        let parser = get_raw_directive_output_parser("ahttpbase http://127.0.0.1:8080").unwrap();
        let parsed = parser
            .parse(
                "ahttpbase http://127.0.0.1:8080",
                "ahttpbase http://127.0.0.1:8080\r\nOK\r\ncli>",
            )
            .unwrap();
        match parsed {
            ParsedOutput::Json(value) => assert_eq!(value["ahttpbase"], "http://127.0.0.1:8080"),
            _ => panic!("expected json"),
        }
    }

    #[test]
    fn parses_join_status() {
        let parser = get_raw_directive_output_parser("join demo pass").unwrap();
        let parsed = parser
            .parse("join demo pass", "connecting to demo\r\ncli>")
            .unwrap();
        assert_eq!(parsed.into_text().unwrap(), "connecting");
    }

    #[test]
    fn parses_aput_success() {
        let parser = get_raw_directive_output_parser("aput /eMMC/applog/demo.log").unwrap();
        let parsed = parser
            .parse(
                "aput /eMMC/applog/demo.log",
                "aput /eMMC/applog/demo.log\r\nUpload OK\r\ncli>",
            )
            .unwrap();
        assert_eq!(parsed.into_text().unwrap(), "Upload OK");
    }
}
