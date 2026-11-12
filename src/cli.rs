use chrono::{Duration as ChronoDuration, Utc};
use clap::{Args, Parser, Subcommand};
use reqwest::blocking::Client;
use reqwest::{Method, StatusCode, Url};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use thiserror::Error;

const DEFAULT_SERVER: &str = "http://127.0.0.1:8080";
const DEFAULT_TIMEOUT: f64 = 15.0;

#[derive(Debug, Error)]
pub enum CliError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Http(#[from] reqwest::Error),
    #[error("{0}")]
    Message(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
struct ClientConfig {
    server_addr: String,
    mode: String,
    token: String,
    token_expires_at: String,
    username: String,
    password: String,
    timeout_seconds: u64,
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            server_addr: DEFAULT_SERVER.to_string(),
            mode: "release".to_string(),
            token: String::new(),
            token_expires_at: String::new(),
            username: String::new(),
            password: String::new(),
            timeout_seconds: DEFAULT_TIMEOUT as u64,
        }
    }
}

#[derive(Debug, Clone)]
struct RuntimeConfig {
    cfg: ClientConfig,
    base: String,
    token: String,
    username: String,
    password: String,
    timeout: f64,
}

#[derive(Debug, Parser)]
#[command(name = "mkp", about = "MKP API client")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    Version(ServerArgs),
    List(ListArgs),
    Record(RecordArgs),
    Stop(ConnectionArgs),
    Replay(RecordIdArgs),
    Cancel(ConnectionArgs),
    Remove(RecordIdArgs),
    Auth(AuthArgs),
}

#[derive(Debug, Args)]
struct RecordArgs {
    #[command(subcommand)]
    command: RecordCommand,
}

#[derive(Debug, Args)]
struct AuthArgs {
    #[command(subcommand)]
    command: AuthCommand,
}

#[derive(Debug, Subcommand)]
enum AuthCommand {
    Login(AuthLoginArgs),
    Token,
    Revoke(AuthRevokeArgs),
}

#[derive(Debug, Subcommand)]
enum RecordCommand {
    Start(RecordStartArgs),
}

#[derive(Debug, Clone, Args, Default)]
struct ServerArgs {
    #[arg(long)]
    server: Option<String>,
    #[arg(long)]
    timeout: Option<f64>,
}

#[derive(Debug, Clone, Args, Default)]
struct ConnectionArgs {
    #[arg(long)]
    server: Option<String>,
    #[arg(long)]
    token: Option<String>,
    #[arg(long)]
    username: Option<String>,
    #[arg(long)]
    password: Option<String>,
    #[arg(long)]
    timeout: Option<f64>,
}

#[derive(Debug, Clone, Args)]
struct ListArgs {
    #[command(flatten)]
    conn: ConnectionArgs,
    #[arg(long, default_value_t = 10)]
    limits: u32,
    #[arg(long, default_value = "")]
    name: String,
}

#[derive(Debug, Clone, Args)]
struct AuthLoginArgs {
    username: String,
    password: String,
    #[arg(long)]
    server: Option<String>,
    #[arg(long)]
    timeout: Option<f64>,
}

#[derive(Debug, Clone, Args)]
struct AuthRevokeArgs {
    #[arg(long, default_value_t = false)]
    forget: bool,
}

#[derive(Debug, Clone, Args)]
struct RecordIdArgs {
    record_id: String,
    #[command(flatten)]
    conn: ConnectionArgs,
}

#[derive(Debug, Clone, Args)]
struct RecordStartArgs {
    log_name: String,
    #[arg(long, default_value_t = 0)]
    width: i32,
    #[arg(long, default_value_t = 0)]
    height: i32,
    #[arg(long)]
    stposx: Option<i32>,
    #[arg(long)]
    stposy: Option<i32>,
    #[command(flatten)]
    conn: ConnectionArgs,
}

pub fn run_cli() -> std::result::Result<(), CliError> {
    let cli = Cli::parse();
    match cli.command {
        Command::Version(args) => print_json(request_json(
            Method::GET,
            "/api/v1/version",
            None,
            false,
            args.server.as_deref(),
            None,
            None,
            None,
            args.timeout,
        )?)?,
        Command::List(args) => print_json(list_command(args)?)?,
        Command::Record(args) => match args.command {
            RecordCommand::Start(args) => print_json(start_record_command(args)?)?,
        },
        Command::Stop(args) => print_json(request_json(
            Method::POST,
            "/api/v1/directives/astop",
            None,
            true,
            args.server.as_deref(),
            args.token.as_deref(),
            args.username.as_deref(),
            args.password.as_deref(),
            args.timeout,
        )?)?,
        Command::Replay(args) => print_json(request_json(
            Method::POST,
            &format!("/api/v1/directives/aplay/{}", args.record_id),
            None,
            true,
            args.conn.server.as_deref(),
            args.conn.token.as_deref(),
            args.conn.username.as_deref(),
            args.conn.password.as_deref(),
            args.conn.timeout,
        )?)?,
        Command::Cancel(args) => print_json(request_json(
            Method::POST,
            "/api/v1/directives/acancel",
            None,
            true,
            args.server.as_deref(),
            args.token.as_deref(),
            args.username.as_deref(),
            args.password.as_deref(),
            args.timeout,
        )?)?,
        Command::Remove(args) => print_json(request_json(
            Method::DELETE,
            &format!("/api/v1/directives/records/{}", args.record_id),
            None,
            true,
            args.conn.server.as_deref(),
            args.conn.token.as_deref(),
            args.conn.username.as_deref(),
            args.conn.password.as_deref(),
            args.conn.timeout,
        )?)?,
        Command::Auth(args) => match args.command {
            AuthCommand::Login(args) => auth_login(args)?,
            AuthCommand::Token => auth_token()?,
            AuthCommand::Revoke(args) => auth_revoke(args)?,
        },
    }
    Ok(())
}

fn list_command(args: ListArgs) -> std::result::Result<Value, CliError> {
    let limits = args.limits.clamp(1, 10);
    let mut endpoint = format!("/api/v1/directives/list?limits={limits}");
    let trimmed_name = args.name.trim();
    if !trimmed_name.is_empty() {
        let mut helper_url = Url::parse("http://localhost/")
            .map_err(|error| CliError::Message(error.to_string()))?;
        helper_url
            .query_pairs_mut()
            .append_pair("name", trimmed_name);
        if let Some(query) = helper_url.query() {
            endpoint.push('&');
            endpoint.push_str(query);
        }
    }
    request_json(
        Method::GET,
        &endpoint,
        None,
        true,
        args.conn.server.as_deref(),
        args.conn.token.as_deref(),
        args.conn.username.as_deref(),
        args.conn.password.as_deref(),
        args.conn.timeout,
    )
}

fn start_record_command(args: RecordStartArgs) -> std::result::Result<Value, CliError> {
    request_json(
        Method::POST,
        "/api/v1/directives/alog",
        Some(json!({
            "log_name": args.log_name,
            "width": args.width,
            "height": args.height,
            "stposx": args.stposx,
            "stposy": args.stposy,
        })),
        true,
        args.conn.server.as_deref(),
        args.conn.token.as_deref(),
        args.conn.username.as_deref(),
        args.conn.password.as_deref(),
        args.conn.timeout,
    )
}

fn auth_login(args: AuthLoginArgs) -> std::result::Result<(), CliError> {
    let runtime = resolve_runtime(
        args.server.as_deref(),
        None,
        Some(args.username.as_str()),
        Some(args.password.as_str()),
        args.timeout,
    )?;
    let data = request_json(
        Method::POST,
        "/api/v1/auth/token",
        Some(json!({
            "username": args.username,
            "password": args.password,
        })),
        false,
        Some(runtime.base.as_str()),
        None,
        Some(runtime.username.as_str()),
        Some(runtime.password.as_str()),
        Some(runtime.timeout),
    )?;
    let mut cfg = runtime.cfg;
    cfg.server_addr = runtime.base;
    cfg.username = runtime.username;
    cfg.password = runtime.password;
    cfg.token = json_string(&data, "token")?;
    cfg.token_expires_at = expires_at_from_response(&data);
    save_config(&cfg)?;
    println!(
        "token saved (expires in {}s)",
        json_i64(&data, "expires_in").unwrap_or(0)
    );
    Ok(())
}

fn auth_token() -> std::result::Result<(), CliError> {
    let cfg = load_config()?;
    if cfg.token.is_empty() {
        return Err(CliError::Message("no local token stored".to_string()));
    }
    println!("{}", cfg.token);
    Ok(())
}

fn auth_revoke(args: AuthRevokeArgs) -> std::result::Result<(), CliError> {
    let mut cfg = load_config()?;
    cfg.token.clear();
    cfg.token_expires_at.clear();
    if args.forget {
        cfg.username.clear();
        cfg.password.clear();
    }
    save_config(&cfg)?;
    println!(
        "{}",
        if args.forget {
            "local token and credentials cleared"
        } else {
            "local token cleared"
        }
    );
    Ok(())
}

fn request_json(
    method: Method,
    path: &str,
    payload: Option<Value>,
    require_auth: bool,
    server: Option<&str>,
    token: Option<&str>,
    username: Option<&str>,
    password: Option<&str>,
    timeout: Option<f64>,
) -> std::result::Result<Value, CliError> {
    let mut runtime = resolve_runtime(server, token, username, password, timeout)?;
    if require_auth && runtime.token.is_empty() {
        if runtime.username.is_empty() || runtime.password.is_empty() {
            return Err(CliError::Message(
                "missing token and stored credentials".to_string(),
            ));
        }
        let login = request_json(
            Method::POST,
            "/api/v1/auth/token",
            Some(json!({
                "username": runtime.username.clone(),
                "password": runtime.password.clone(),
            })),
            false,
            Some(runtime.base.as_str()),
            None,
            Some(runtime.username.as_str()),
            Some(runtime.password.as_str()),
            Some(runtime.timeout),
        )?;
        runtime.cfg.server_addr = runtime.base.clone();
        runtime.cfg.username = runtime.username.clone();
        runtime.cfg.password = runtime.password.clone();
        runtime.cfg.token = json_string(&login, "token")?;
        runtime.cfg.token_expires_at = expires_at_from_response(&login);
        save_config(&runtime.cfg)?;
        runtime.token = runtime.cfg.token.clone();
    }

    let client = Client::builder()
        .timeout(timeout_duration(runtime.timeout)?)
        .build()?;
    let url = format!("{}{}", runtime.base, path);
    let mut request = client.request(method, url);
    if require_auth && !runtime.token.is_empty() {
        request = request.bearer_auth(runtime.token);
    }
    if let Some(ref body) = payload {
        request = request.json(body);
    }
    let response = request.send()?;
    decode_response(response.status(), response.text()?)
}

fn resolve_runtime(
    server: Option<&str>,
    token: Option<&str>,
    username: Option<&str>,
    password: Option<&str>,
    timeout: Option<f64>,
) -> std::result::Result<RuntimeConfig, CliError> {
    let cfg = load_config()?;
    let base = normalize_base_url(
        server
            .map(ToOwned::to_owned)
            .or_else(|| std::env::var("MKP_SERVER").ok())
            .unwrap_or_else(|| cfg.server_addr.clone()),
    );
    let token = token
        .map(ToOwned::to_owned)
        .or_else(|| std::env::var("MKP_TOKEN").ok())
        .unwrap_or_else(|| cfg.token.clone());
    let username = username
        .map(ToOwned::to_owned)
        .or_else(|| std::env::var("MKP_USER").ok())
        .unwrap_or_else(|| cfg.username.clone());
    let password = password
        .map(ToOwned::to_owned)
        .or_else(|| std::env::var("MKP_PASSWORD").ok())
        .unwrap_or_else(|| cfg.password.clone());
    let timeout = resolve_timeout(timeout, cfg.timeout_seconds)?;
    Ok(RuntimeConfig {
        cfg,
        base,
        token,
        username,
        password,
        timeout,
    })
}

fn resolve_timeout(
    timeout: Option<f64>,
    stored_timeout: u64,
) -> std::result::Result<f64, CliError> {
    if let Some(value) = timeout {
        return timeout_duration(value).map(|duration| duration.as_secs_f64());
    }
    if let Ok(value) = std::env::var("MKP_TIMEOUT") {
        let parsed = value
            .parse::<f64>()
            .map_err(|_| CliError::Message(format!("invalid MKP_TIMEOUT: {value}")))?;
        return timeout_duration(parsed).map(|duration| duration.as_secs_f64());
    }
    let fallback = if stored_timeout == 0 {
        DEFAULT_TIMEOUT
    } else {
        stored_timeout as f64
    };
    timeout_duration(fallback).map(|duration| duration.as_secs_f64())
}

fn decode_response(status: StatusCode, body: String) -> std::result::Result<Value, CliError> {
    let value = if body.trim().is_empty() {
        json!({})
    } else {
        match serde_json::from_str::<Value>(&body) {
            Ok(value) => value,
            Err(_) if status.is_success() => {
                return Err(CliError::Message(format!(
                    "server returned non-json body: {body}"
                )));
            }
            Err(_) => json!({ "error": body }),
        }
    };
    if status.is_client_error() || status.is_server_error() {
        let message = value
            .get("detail")
            .and_then(Value::as_str)
            .or_else(|| value.get("error").and_then(Value::as_str))
            .map(ToOwned::to_owned)
            .unwrap_or_else(|| value.to_string());
        return Err(CliError::Message(message));
    }
    Ok(value)
}

fn timeout_duration(timeout: f64) -> std::result::Result<Duration, CliError> {
    if !timeout.is_finite() || timeout <= 0.0 {
        return Err(CliError::Message(format!("invalid timeout: {timeout}")));
    }
    Ok(Duration::from_secs_f64(timeout))
}

fn expires_at_from_response(data: &Value) -> String {
    let expires_in = json_i64(data, "expires_in").unwrap_or(0).max(0);
    (Utc::now() + ChronoDuration::seconds(expires_in)).to_rfc3339()
}

fn json_string(data: &Value, key: &str) -> std::result::Result<String, CliError> {
    data.get(key)
        .and_then(Value::as_str)
        .map(ToOwned::to_owned)
        .ok_or_else(|| CliError::Message(format!("missing or invalid `{key}` in server response")))
}

fn json_i64(data: &Value, key: &str) -> Option<i64> {
    data.get(key).and_then(Value::as_i64)
}

fn normalize_base_url(base: String) -> String {
    let trimmed = base.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        DEFAULT_SERVER.to_string()
    } else {
        trimmed.to_string()
    }
}

fn config_path() -> std::result::Result<PathBuf, CliError> {
    if let Ok(path) = std::env::var("MKP_CLIENT_CONFIG") {
        let trimmed = path.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }
    let home = dirs::home_dir()
        .ok_or_else(|| CliError::Message("could not determine home directory".to_string()))?;
    Ok(config_path_from_home(&home))
}

fn config_path_from_home(home: &Path) -> PathBuf {
    home.join(".mkp").join("client.json")
}

fn load_config() -> std::result::Result<ClientConfig, CliError> {
    let path = config_path()?;
    load_config_from_path(&path)
}

fn load_config_from_path(path: &Path) -> std::result::Result<ClientConfig, CliError> {
    if !path.exists() {
        return Ok(ClientConfig::default());
    }
    let payload = fs::read_to_string(path)?;
    let cfg = serde_json::from_str::<ClientConfig>(&payload)?;
    Ok(cfg)
}

fn save_config(cfg: &ClientConfig) -> std::result::Result<(), CliError> {
    let path = config_path()?;
    save_config_to_path(cfg, &path)
}

fn save_config_to_path(cfg: &ClientConfig, path: &Path) -> std::result::Result<(), CliError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let payload = serde_json::to_string_pretty(cfg)?;
    fs::write(path, format!("{payload}\n"))?;
    Ok(())
}

fn print_json(value: Value) -> std::result::Result<(), CliError> {
    println!("{}", serde_json::to_string_pretty(&value)?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn config_roundtrip_preserves_fields() {
        let temp = tempdir().expect("temp dir should be created");
        let path = temp.path().join("client.json");
        let cfg = ClientConfig {
            server_addr: "http://10.0.0.8:8080".to_string(),
            mode: "debug".to_string(),
            token: "abc".to_string(),
            token_expires_at: "2026-11-12T00:00:00Z".to_string(),
            username: "user".to_string(),
            password: "pass".to_string(),
            timeout_seconds: 22,
        };

        save_config_to_path(&cfg, &path).expect("config should save");
        let loaded = load_config_from_path(&path).expect("config should load");
        assert_eq!(loaded, cfg);
    }

    #[test]
    fn partial_config_uses_defaults() {
        let temp = tempdir().expect("temp dir should be created");
        let path = temp.path().join("client.json");
        fs::write(&path, r#"{"server_addr":"http://localhost:9000"}"#)
            .expect("partial config should save");

        let loaded = load_config_from_path(&path).expect("config should load");
        assert_eq!(loaded.server_addr, "http://localhost:9000");
        assert_eq!(loaded.mode, "release");
        assert_eq!(loaded.timeout_seconds, 15);
    }

    #[test]
    fn normalize_base_url_trims_trailing_slashes() {
        assert_eq!(
            normalize_base_url("http://127.0.0.1:8080///".to_string()),
            "http://127.0.0.1:8080"
        );
        assert_eq!(normalize_base_url("   ".to_string()), DEFAULT_SERVER);
    }

    #[test]
    fn decode_response_prefers_error_message() {
        let err = decode_response(
            StatusCode::UNAUTHORIZED,
            r#"{"ok":false,"error":"bad token"}"#.to_string(),
        )
        .expect_err("error response should fail");
        assert_eq!(err.to_string(), "bad token");
    }
}
