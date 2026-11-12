use crate::controller::Controller;
use crate::error::{MkpError, Result};
use crate::models::{LogLength, LogOption, MKPVersion, SerialPortStatus};
use crate::sdk::{check_sf_serial_port, new_sf_serial_port};
use axum::extract::{Path, Query, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use chrono::{DateTime, Duration as ChronoDuration, Utc};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use rusqlite::{Connection, OptionalExtension, params};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::net::TcpListener;
use uuid::Uuid;

const APP_VERSION: &str = "0.1.0";
const SERIAL_SYNC_TIMEOUT_GRACE_MS: u64 = 2000;

#[derive(Debug, Clone)]
pub struct Settings {
    pub mode: String,
    pub sf_port: String,
    pub port: u16,
    pub jwt_secret: String,
    pub user: String,
    pub password: String,
    pub issuer: String,
    pub token_ttl_seconds: i64,
    pub mute_auth_in_debug: bool,
    pub database_url: String,
    pub sync_directive_timeout_ms: u64,
    pub async_directive_timeout_ms: u64,
    pub db_timeout_ms: u64,
    pub replay_completion_grace_ms: u64,
    pub replay_minimum_duration_ms: u64,
}

#[derive(Debug, Clone)]
struct AlogSession {
    name: String,
    unique_id: String,
    mkp_path: String,
    start_point_x: i32,
    start_point_y: i32,
    screen_width: i32,
    screen_height: i32,
    os: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TokenRequest {
    username: String,
    password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AlogRequest {
    log_name: String,
    #[serde(default)]
    width: i32,
    #[serde(default)]
    height: i32,
    stposx: Option<i32>,
    stposy: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TokenClaims {
    username: String,
    sub: String,
    iss: String,
    iat: i64,
    nbf: i64,
    exp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ListRecordsQuery {
    #[serde(default = "default_limits")]
    limits: u32,
    #[serde(default)]
    name: String,
}

fn default_limits() -> u32 {
    10
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MacroRecord {
    id: i64,
    name: String,
    unique_id: String,
    mkp_path: String,
    start_point_x: i32,
    start_point_y: i32,
    screen_width: i32,
    screen_height: i32,
    os: String,
    seconds: i32,
    milliseconds: i32,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone)]
struct NewMacroRecord {
    name: String,
    unique_id: String,
    mkp_path: String,
    start_point_x: i32,
    start_point_y: i32,
    screen_width: i32,
    screen_height: i32,
    os: String,
    seconds: i32,
    milliseconds: i32,
}

#[derive(Debug, Default)]
struct AlogRuntimeState {
    running: bool,
    started: bool,
    current_id: String,
    current_session: Option<AlogSession>,
}

#[derive(Debug, Default)]
struct ReplayRuntimeState {
    running: bool,
    current_id: String,
    started_at: Option<DateTime<Utc>>,
    done_at: Option<DateTime<Utc>>,
    release_at: Option<DateTime<Utc>>,
}

trait ServerOps: Send + Sync {
    fn snapshot_status(&self) -> SerialPortStatus;
    fn aversion(&self, timeout: Duration) -> Result<MKPVersion>;
    fn delete_file(&self, path: &str, timeout: Duration) -> Result<String>;
    fn compose_log_fullpath(&self, log_path: &str) -> String;
    fn move_cursor(&self, x: i32, y: i32) -> Result<()>;
    fn alog(&self, log_name: &str, opt: LogOption, timeout: Duration) -> Result<String>;
    fn astop(&self, timeout: Duration) -> Result<String>;
    fn atime(&self, path: &str, timeout: Duration) -> Result<LogLength>;
    fn start_replaying(&self, log_name: &str, delay: i32) -> Result<()>;
    fn cancel(&self, timeout: Duration) -> Result<()>;
    fn close(&self) -> Result<()>;
}

struct RealServerOps {
    ctrl: Mutex<Controller>,
}

impl RealServerOps {
    fn from_settings(settings: &Settings) -> Result<Self> {
        let port_name = if settings.sf_port.trim().is_empty() {
            check_sf_serial_port()?
        } else {
            settings.sf_port.clone()
        };
        let mut sfport = new_sf_serial_port();
        sfport.name = port_name;
        sfport.set_sync_output_enabled(true);
        sfport.sync_output_timeout = Duration::from_millis(settings.sync_directive_timeout_ms);
        sfport.open()?;
        std::thread::sleep(Duration::from_millis(50));
        sfport.reset_input_buffer()?;
        sfport.start_read_loop()?;
        let _ = sfport.stop_recording();
        Ok(Self {
            ctrl: Mutex::new(Controller::new(sfport)),
        })
    }
}

impl ServerOps for RealServerOps {
    fn snapshot_status(&self) -> SerialPortStatus {
        self.ctrl
            .lock()
            .expect("controller mutex poisoned")
            .snapshot_status()
    }
    fn aversion(&self, timeout: Duration) -> Result<MKPVersion> {
        self.ctrl
            .lock()
            .expect("controller mutex poisoned")
            .aversion(Some(timeout))
    }
    fn delete_file(&self, path: &str, timeout: Duration) -> Result<String> {
        self.ctrl
            .lock()
            .expect("controller mutex poisoned")
            .delete_file(path, Some(timeout))
    }
    fn compose_log_fullpath(&self, log_path: &str) -> String {
        self.ctrl
            .lock()
            .expect("controller mutex poisoned")
            .compose_log_fullpath(log_path)
    }
    fn move_cursor(&self, _x: i32, _y: i32) -> Result<()> {
        Ok(())
    }
    fn alog(&self, log_name: &str, opt: LogOption, timeout: Duration) -> Result<String> {
        self.ctrl.lock().expect("controller mutex poisoned").alog(
            log_name,
            Some(opt),
            Some(timeout),
        )
    }
    fn astop(&self, timeout: Duration) -> Result<String> {
        self.ctrl
            .lock()
            .expect("controller mutex poisoned")
            .astop(Some(timeout))
    }
    fn atime(&self, path: &str, timeout: Duration) -> Result<LogLength> {
        self.ctrl
            .lock()
            .expect("controller mutex poisoned")
            .atime(path, Some(timeout))
    }
    fn start_replaying(&self, log_name: &str, delay: i32) -> Result<()> {
        self.ctrl
            .lock()
            .expect("controller mutex poisoned")
            .start_replaying(log_name, delay)
    }
    fn cancel(&self, timeout: Duration) -> Result<()> {
        self.ctrl
            .lock()
            .expect("controller mutex poisoned")
            .cancel(Some(timeout))
            .map(|_| ())
    }
    fn close(&self) -> Result<()> {
        self.ctrl.lock().expect("controller mutex poisoned").close()
    }
}

struct AppState {
    settings: Settings,
    ops: Arc<dyn ServerOps>,
    db: Mutex<Connection>,
    alog: Mutex<AlogRuntimeState>,
    replay: Mutex<ReplayRuntimeState>,
}
impl AppState {
    fn new(settings: Settings, ops: Arc<dyn ServerOps>) -> Result<Self> {
        let db_path = resolve_sqlite_path(&settings.database_url);
        let connection = Connection::open(db_path)?;
        connection.busy_timeout(Duration::from_millis(settings.db_timeout_ms))?;
        init_schema(&connection)?;
        Ok(Self {
            settings,
            ops,
            db: Mutex::new(connection),
            alog: Mutex::new(AlogRuntimeState::default()),
            replay: Mutex::new(ReplayRuntimeState::default()),
        })
    }

    fn replay_window_for_record(
        &self,
        record: &MacroRecord,
        started_at: DateTime<Utc>,
    ) -> (DateTime<Utc>, DateTime<Utc>) {
        let duration_ms = std::cmp::max(
            self.settings.replay_minimum_duration_ms as i64,
            i64::from(record.seconds) * 1000 + i64::from(record.milliseconds),
        );
        let done_at = started_at + ChronoDuration::milliseconds(duration_ms);
        let release_at =
            done_at + ChronoDuration::milliseconds(self.settings.replay_completion_grace_ms as i64);
        (done_at, release_at)
    }

    fn reset_replay_state_locked(replay: &mut ReplayRuntimeState) {
        *replay = ReplayRuntimeState::default();
    }

    fn normalize_replay_state_locked(replay: &mut ReplayRuntimeState, now: DateTime<Utc>) {
        if replay.running
            && replay
                .release_at
                .is_some_and(|release_at| now >= release_at)
        {
            Self::reset_replay_state_locked(replay);
        }
    }

    fn is_replay_blocking_locked(
        replay: &mut ReplayRuntimeState,
        now: DateTime<Utc>,
        record_id: &str,
    ) -> (bool, ChronoDuration) {
        Self::normalize_replay_state_locked(replay, now);
        if !replay.running {
            return (false, ChronoDuration::zero());
        }
        if !record_id.is_empty() && !replay.current_id.is_empty() && replay.current_id != record_id
        {
            return (false, ChronoDuration::zero());
        }
        if let Some(release_at) = replay.release_at {
            if now < release_at {
                return (true, release_at - now);
            }
        }
        (false, ChronoDuration::zero())
    }

    fn snapshot_alog_state(&self) -> Value {
        let alog = self.alog.lock().expect("alog mutex poisoned");
        json!({"running": alog.running, "started": alog.started, "current_id": alog.current_id})
    }

    fn snapshot_replay_state(&self) -> Value {
        let now = Utc::now();
        let mut replay = self.replay.lock().expect("replay mutex poisoned");
        let (blocking, retry_after) = Self::is_replay_blocking_locked(&mut replay, now, "");
        let mut payload = json!({
            "running": replay.running,
            "current_id": replay.current_id,
            "started_at": replay.started_at.map(|value| value.to_rfc3339()),
            "estimated_done_at": replay.done_at.map(|value| value.to_rfc3339()),
            "release_after": replay.release_at.map(|value| value.to_rfc3339()),
            "active": blocking,
        });
        if retry_after > ChronoDuration::zero() {
            payload["retry_after_seconds"] = json!(retry_after.num_seconds() + 1);
        }
        payload
    }

    fn list_records(&self, limits: u32, name: &str) -> Result<Vec<MacroRecord>> {
        let connection = self.db.lock().expect("db mutex poisoned");
        let limits = limits.clamp(1, 10) as i64;
        let mut records = Vec::new();
        if name.trim().is_empty() {
            let mut stmt = connection.prepare("SELECT id, name, unique_id, mkp_path, start_point_x, start_point_y, screen_width, screen_height, os, seconds, milliseconds, created_at, updated_at FROM macro_records ORDER BY created_at DESC LIMIT ?1")?;
            let rows = stmt.query_map(params![limits], row_to_record)?;
            for row in rows {
                records.push(row?);
            }
        } else {
            let pattern = format!("%{}%", name.trim());
            let mut stmt = connection.prepare("SELECT id, name, unique_id, mkp_path, start_point_x, start_point_y, screen_width, screen_height, os, seconds, milliseconds, created_at, updated_at FROM macro_records WHERE name LIKE ?1 ORDER BY created_at DESC LIMIT ?2")?;
            let rows = stmt.query_map(params![pattern, limits], row_to_record)?;
            for row in rows {
                records.push(row?);
            }
        }
        Ok(records)
    }

    fn get_record(&self, record_id: &str) -> Result<Option<MacroRecord>> {
        let connection = self.db.lock().expect("db mutex poisoned");
        connection.query_row(
            "SELECT id, name, unique_id, mkp_path, start_point_x, start_point_y, screen_width, screen_height, os, seconds, milliseconds, created_at, updated_at FROM macro_records WHERE unique_id = ?1",
            params![record_id],
            row_to_record,
        ).optional().map_err(MkpError::from)
    }

    fn delete_record(&self, record_id: &str) -> Result<()> {
        let connection = self.db.lock().expect("db mutex poisoned");
        connection.execute(
            "DELETE FROM macro_records WHERE unique_id = ?1",
            params![record_id],
        )?;
        Ok(())
    }

    fn insert_record(&self, record: NewMacroRecord) -> Result<i64> {
        let connection = self.db.lock().expect("db mutex poisoned");
        let now = Utc::now().to_rfc3339();
        connection.execute(
            "INSERT INTO macro_records (name, unique_id, mkp_path, start_point_x, start_point_y, screen_width, screen_height, os, seconds, milliseconds, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![record.name, record.unique_id, record.mkp_path, record.start_point_x, record.start_point_y, record.screen_width, record.screen_height, record.os, record.seconds, record.milliseconds, now, now],
        )?;
        Ok(connection.last_insert_rowid())
    }
}

impl Drop for AppState {
    fn drop(&mut self) {
        let _ = self.ops.close();
    }
}

#[derive(Debug)]
struct ApiError {
    status: StatusCode,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (
            self.status,
            Json(json!({"ok": false, "error": self.message})),
        )
            .into_response()
    }
}

fn first_non_empty(values: &[Option<String>]) -> String {
    values
        .iter()
        .filter_map(|value| value.as_deref())
        .map(str::trim)
        .find(|value| !value.is_empty())
        .unwrap_or_default()
        .to_string()
}

fn parse_positive_int(raw: Option<String>, default: u64) -> u64 {
    raw.and_then(|value| value.trim().parse::<u64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(default)
}

fn parse_bool(raw: Option<String>, default: bool) -> bool {
    raw.map(|value| {
        matches!(
            value.trim().to_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        )
    })
    .unwrap_or(default)
}

fn resolve_run_mode(file_mode: &str) -> String {
    let mode = first_non_empty(&[
        std::env::var("APP_MODE").ok(),
        std::env::var("RUN_MODE").ok(),
        std::env::var("GIN_MODE").ok(),
        std::env::var("MKP_MODE").ok(),
        Some(file_mode.to_string()),
        Some("release".to_string()),
    ])
    .to_lowercase();
    match mode.as_str() {
        "dev" | "development" | "debug" => "debug".to_string(),
        "test" | "testing" => "test".to_string(),
        _ => "release".to_string(),
    }
}

fn resolve_database_url() -> String {
    if let Ok(value) = std::env::var("MKP_DATABASE_URL") {
        if !value.trim().is_empty() {
            return value.trim().to_string();
        }
    }
    let driver = first_non_empty(&[std::env::var("DB_DRIVER").ok(), Some("sqlite3".to_string())])
        .to_lowercase();
    let dsn = std::env::var("DB_DSN").unwrap_or_default();
    if dsn.trim().is_empty() {
        return "sqlite:///mkp.db".to_string();
    }
    if dsn.contains("://") {
        return dsn;
    }
    if matches!(driver.as_str(), "" | "sqlited" | "sqlite" | "sqlite3") {
        return format!("sqlite:///{}", dsn);
    }
    dsn
}

fn resolve_sqlite_path(database_url: &str) -> String {
    database_url
        .strip_prefix("sqlite:///")
        .unwrap_or(database_url)
        .to_string()
}
fn screen_size() -> (i32, i32) {
    (1920, 1080)
}
fn now_timestamp() -> i64 {
    Utc::now().timestamp()
}
fn issue_token(settings: &Settings, username: &str) -> Result<(String, i64)> {
    let now = now_timestamp();
    let expires_in = settings.token_ttl_seconds;
    let claims = TokenClaims {
        username: username.to_string(),
        sub: username.to_string(),
        iss: settings.issuer.clone(),
        iat: now,
        nbf: now,
        exp: now + expires_in,
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(settings.jwt_secret.as_bytes()),
    )
    .map_err(|error| MkpError::State(error.to_string()))?;
    Ok((token, expires_in))
}

fn decode_token(settings: &Settings, token: &str) -> Result<TokenClaims> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_issuer(&[settings.issuer.as_str()]);
    decode::<TokenClaims>(
        token,
        &DecodingKey::from_secret(settings.jwt_secret.as_bytes()),
        &validation,
    )
    .map(|data| data.claims)
    .map_err(|_| MkpError::State("invalid or expired token".to_string()))
}

fn init_schema(connection: &Connection) -> Result<()> {
    connection.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS macro_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            unique_id TEXT NOT NULL UNIQUE,
            mkp_path TEXT NOT NULL,
            start_point_x INTEGER NOT NULL DEFAULT 0,
            start_point_y INTEGER NOT NULL DEFAULT 0,
            screen_width INTEGER NOT NULL DEFAULT 0,
            screen_height INTEGER NOT NULL DEFAULT 0,
            os TEXT NOT NULL,
            seconds INTEGER NOT NULL DEFAULT 0,
            milliseconds INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        ",
    )?;
    Ok(())
}

fn row_to_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<MacroRecord> {
    Ok(MacroRecord {
        id: row.get(0)?,
        name: row.get(1)?,
        unique_id: row.get(2)?,
        mkp_path: row.get(3)?,
        start_point_x: row.get(4)?,
        start_point_y: row.get(5)?,
        screen_width: row.get(6)?,
        screen_height: row.get(7)?,
        os: row.get(8)?,
        seconds: row.get(9)?,
        milliseconds: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

pub fn load_settings() -> Settings {
    Settings {
        mode: resolve_run_mode(""),
        sf_port: first_non_empty(&[
            std::env::var("SF_PORT").ok(),
            std::env::var("MKP_SF_PORT").ok(),
        ]),
        port: parse_positive_int(
            Some(first_non_empty(&[
                std::env::var("PORT").ok(),
                std::env::var("MKP_PORT").ok(),
                Some("8080".to_string()),
            ])),
            8080,
        ) as u16,
        jwt_secret: first_non_empty(&[
            std::env::var("JWT_SECRET").ok(),
            std::env::var("MKP_JWT_SECRET").ok(),
            Some("mkp-go-dev-secret".to_string()),
        ]),
        user: first_non_empty(&[
            std::env::var("JWT_USER").ok(),
            std::env::var("MKP_USER").ok(),
            Some("admin".to_string()),
        ]),
        password: first_non_empty(&[
            std::env::var("JWT_PASSWORD").ok(),
            std::env::var("MKP_PASSWORD").ok(),
            Some("admin123".to_string()),
        ]),
        issuer: first_non_empty(&[
            std::env::var("JWT_ISSUER").ok(),
            std::env::var("MKP_ISSUER").ok(),
            Some("mkp-go-server".to_string()),
        ]),
        token_ttl_seconds: parse_positive_int(
            Some(first_non_empty(&[
                std::env::var("JWT_TTL_SECONDS").ok(),
                std::env::var("MKP_TOKEN_TTL_SECONDS").ok(),
                Some("86400".to_string()),
            ])),
            86400,
        ) as i64,
        mute_auth_in_debug: parse_bool(
            Some(first_non_empty(&[
                std::env::var("MUTE_JWT_AUTH").ok(),
                std::env::var("MKP_MUTE_JWT_AUTH").ok(),
            ])),
            false,
        ),
        database_url: resolve_database_url(),
        sync_directive_timeout_ms: parse_positive_int(
            std::env::var("MKP_SYNC_DIRECTIVE_TIMEOUT_MS").ok(),
            10000,
        ),
        async_directive_timeout_ms: parse_positive_int(
            std::env::var("MKP_ASYNC_DIRECTIVE_TIMEOUT_MS").ok(),
            3000,
        ),
        db_timeout_ms: parse_positive_int(std::env::var("MKP_DB_TIMEOUT_MS").ok(), 5000),
        replay_completion_grace_ms: parse_positive_int(
            std::env::var("MKP_REPLAY_COMPLETION_GRACE_MS").ok(),
            1500,
        ),
        replay_minimum_duration_ms: parse_positive_int(
            std::env::var("MKP_REPLAY_MIN_DURATION_MS").ok(),
            1000,
        ),
    }
}

pub fn create_app(settings: Option<Settings>) -> Result<Router> {
    let settings = settings.unwrap_or_else(load_settings);
    let ops: Arc<dyn ServerOps> = Arc::new(RealServerOps::from_settings(&settings)?);
    create_app_with_ops(settings, ops)
}

fn create_app_with_ops(settings: Settings, ops: Arc<dyn ServerOps>) -> Result<Router> {
    let state = Arc::new(AppState::new(settings, ops)?);
    Ok(Router::new()
        .route("/health", get(health))
        .route("/api/v1/auth/token", post(auth_token))
        .route("/api/v1/version", get(version))
        .route("/api/v1/directives/list", get(list_records))
        .route(
            "/api/v1/directives/records/{record_id}",
            get(get_record).delete(remove_record),
        )
        .route("/api/v1/directives/replay/status", get(replay_status))
        .route("/api/v1/directives/alog", post(start_alog))
        .route("/api/v1/directives/astop", post(stop_alog))
        .route("/api/v1/directives/aplay/{record_id}", post(replay_record))
        .route("/api/v1/directives/acancel", post(cancel_record))
        .with_state(state))
}

fn require_auth(headers: &HeaderMap, state: &AppState) -> std::result::Result<String, ApiError> {
    if state.settings.mute_auth_in_debug && state.settings.mode == "debug" {
        return Ok(state.settings.user.clone());
    }
    let Some(authorization) = headers.get(axum::http::header::AUTHORIZATION) else {
        return Err(ApiError::new(
            StatusCode::UNAUTHORIZED,
            "missing Authorization header",
        ));
    };
    let Ok(authorization) = authorization.to_str() else {
        return Err(ApiError::new(
            StatusCode::UNAUTHORIZED,
            "invalid Authorization header format",
        ));
    };
    let mut parts = authorization.splitn(2, ' ');
    let scheme = parts.next().unwrap_or_default();
    let token = parts.next().unwrap_or_default().trim();
    if !scheme.eq_ignore_ascii_case("bearer") || token.is_empty() {
        return Err(ApiError::new(
            StatusCode::UNAUTHORIZED,
            "invalid Authorization header format",
        ));
    }
    let claims = decode_token(&state.settings, token)
        .map_err(|_| ApiError::new(StatusCode::UNAUTHORIZED, "invalid or expired token"))?;
    Ok(if claims.username.is_empty() {
        claims.sub
    } else {
        claims.username
    })
}
async fn health(State(state): State<Arc<AppState>>) -> Json<Value> {
    let serial_snapshot = state.ops.snapshot_status();
    let serial_ready = serial_snapshot.port_open
        && serial_snapshot.read_loop_running
        && !serial_snapshot.read_closed;
    let ready = serial_ready;
    Json(
        json!({"ok": true, "status": if ready { "up" } else { "degraded" }, "ready": ready, "db_ready": true, "serial": serial_snapshot, "alog": state.snapshot_alog_state(), "replay": state.snapshot_replay_state()}),
    )
}

async fn auth_token(
    State(state): State<Arc<AppState>>,
    Json(req): Json<TokenRequest>,
) -> std::result::Result<Json<Value>, ApiError> {
    if req.username != state.settings.user || req.password != state.settings.password {
        return Err(ApiError::new(
            StatusCode::UNAUTHORIZED,
            "invalid username or password",
        ));
    }
    let (token, expires_in) = issue_token(&state.settings, &req.username)
        .map_err(|error| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    Ok(Json(
        json!({"ok": true, "token": token, "token_type": "Bearer", "expires_in": expires_in}),
    ))
}

async fn version(State(state): State<Arc<AppState>>) -> std::result::Result<Json<Value>, ApiError> {
    let timeout = Duration::from_millis(
        state.settings.sync_directive_timeout_ms + SERIAL_SYNC_TIMEOUT_GRACE_MS,
    );
    let mkp_version = state
        .ops
        .aversion(timeout)
        .map_err(|error| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    Ok(Json(
        json!({"ok": true, "directive": "version", "mkp_server": APP_VERSION, "mkp_device": mkp_version}),
    ))
}

async fn list_records(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<ListRecordsQuery>,
) -> std::result::Result<Json<Value>, ApiError> {
    let _user = require_auth(&headers, &state)?;
    let limits = query.limits.clamp(1, 10);
    let records = state
        .list_records(limits, &query.name)
        .map_err(|error| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    let mut payload = json!({"ok": true, "directive": "list", "limits": limits, "count": records.len(), "records": records});
    if !query.name.trim().is_empty() {
        payload["name"] = json!(query.name.trim());
    }
    Ok(Json(payload))
}

async fn get_record(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(record_id): Path<String>,
) -> std::result::Result<Json<Value>, ApiError> {
    let _user = require_auth(&headers, &state)?;
    let record_id = record_id.trim();
    if record_id.is_empty() {
        return Err(ApiError::new(StatusCode::BAD_REQUEST, "missing record id"));
    }
    let Some(record) = state
        .get_record(record_id)
        .map_err(|error| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?
    else {
        return Err(ApiError::new(StatusCode::NOT_FOUND, "record not found"));
    };
    Ok(Json(
        json!({"ok": true, "directive": "record", "record": record}),
    ))
}

async fn remove_record(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(record_id): Path<String>,
) -> std::result::Result<Response, ApiError> {
    let _user = require_auth(&headers, &state)?;
    let record_id = record_id.trim().to_string();
    if record_id.is_empty() {
        return Err(ApiError::new(StatusCode::BAD_REQUEST, "missing record id"));
    }
    let Some(record) = state
        .get_record(&record_id)
        .map_err(|error| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?
    else {
        return Err(ApiError::new(StatusCode::NOT_FOUND, "record not found"));
    };
    {
        let mut replay = state.replay.lock().expect("replay mutex poisoned");
        let (blocking, retry_after) =
            AppState::is_replay_blocking_locked(&mut replay, Utc::now(), &record.unique_id);
        if blocking {
            let mut payload = json!({"ok": false, "error": "record is currently being replayed"});
            if retry_after > ChronoDuration::zero() {
                payload["retry_after_seconds"] = json!(retry_after.num_seconds() + 1);
            }
            return Ok((StatusCode::CONFLICT, Json(payload)).into_response());
        }
    }
    let timeout = Duration::from_millis(
        state.settings.sync_directive_timeout_ms + SERIAL_SYNC_TIMEOUT_GRACE_MS,
    );
    if !record.mkp_path.is_empty() {
        state
            .ops
            .delete_file(&record.mkp_path, timeout)
            .map_err(|error| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    }
    state
        .delete_record(&record.unique_id)
        .map_err(|error| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    Ok(Json(json!({"ok": true, "directive": "record_delete", "id": record.unique_id, "file_deleted": !record.mkp_path.is_empty()})).into_response())
}

async fn replay_status(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> std::result::Result<Json<Value>, ApiError> {
    let _user = require_auth(&headers, &state)?;
    Ok(Json(
        json!({"ok": true, "directive": "replay_status", "replay": state.snapshot_replay_state()}),
    ))
}

async fn start_alog(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(req): Json<AlogRequest>,
) -> std::result::Result<Response, ApiError> {
    let _user = require_auth(&headers, &state)?;
    let alog_id = Uuid::new_v4().simple().to_string()[..20].to_string();
    let start_x = req.stposx.unwrap_or(0).max(0);
    let start_y = req.stposy.unwrap_or(0).max(0);
    let (width, height) = if req.width > 0 && req.height > 0 {
        (req.width, req.height)
    } else {
        screen_size()
    };
    let session = AlogSession {
        name: req.log_name.clone(),
        unique_id: alog_id.clone(),
        mkp_path: state.ops.compose_log_fullpath(&alog_id),
        start_point_x: start_x,
        start_point_y: start_y,
        screen_width: width,
        screen_height: height,
        os: std::env::consts::OS.to_string(),
    };
    {
        let mut alog = state.alog.lock().expect("alog mutex poisoned");
        if alog.running {
            return Ok((
                StatusCode::CONFLICT,
                Json(json!({"ok": false, "error": "alog is already running"})),
            )
                .into_response());
        }
        alog.running = true;
        alog.started = false;
        alog.current_id = alog_id.clone();
        alog.current_session = Some(session.clone());
    }
    let timeout = Duration::from_millis(
        state.settings.sync_directive_timeout_ms + SERIAL_SYNC_TIMEOUT_GRACE_MS,
    );
    let result = state.ops.alog(
        &alog_id,
        LogOption {
            width,
            height,
            stposx: start_x,
            stposy: start_y,
        },
        timeout,
    );
    if let Err(error) = result {
        let mut alog = state.alog.lock().expect("alog mutex poisoned");
        if alog.current_id == alog_id {
            *alog = AlogRuntimeState::default();
        }
        return Err(ApiError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            error.to_string(),
        ));
    }
    let mut alog = state.alog.lock().expect("alog mutex poisoned");
    if alog.current_id == alog_id {
        alog.started = true;
    }
    Ok(Json(json!({"ok": true, "directive": "alog", "id": alog_id, "log_name": req.log_name, "status": "started"})).into_response())
}

async fn stop_alog(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> std::result::Result<Json<Value>, ApiError> {
    let _user = require_auth(&headers, &state)?;
    state
        .ops
        .astop(Duration::from_millis(
            state.settings.async_directive_timeout_ms,
        ))
        .map_err(|error| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    let (stopped_id, stopped_started, stopped_session) = {
        let mut alog = state.alog.lock().expect("alog mutex poisoned");
        if !alog.running {
            return Ok(Json(
                json!({"ok": true, "directive": "astop", "status": "The stop command has been sent."}),
            ));
        }
        let values = (
            alog.current_id.clone(),
            alog.started,
            alog.current_session.clone(),
        );
        *alog = AlogRuntimeState::default();
        values
    };
    let mut response =
        json!({"ok": true, "directive": "astop", "id": stopped_id, "status": "stopped"});
    if let Some(session) = stopped_session {
        if stopped_started {
            let length = state
                .ops
                .atime(
                    &session.mkp_path,
                    Duration::from_millis(state.settings.db_timeout_ms),
                )
                .unwrap_or_else(|_| LogLength::default());
            let record_id = state.insert_record(NewMacroRecord {
                name: session.name,
                unique_id: session.unique_id,
                mkp_path: session.mkp_path,
                start_point_x: session.start_point_x,
                start_point_y: session.start_point_y,
                screen_width: session.screen_width,
                screen_height: session.screen_height,
                os: session.os,
                seconds: length.seconds,
                milliseconds: length.milsec,
            });
            match record_id {
                Ok(id) => {
                    response["persisted"] = json!(true);
                    response["macro_record_id"] = json!(id);
                }
                Err(error) => {
                    response["persisted"] = json!(false);
                    response["persist_error"] = json!(error.to_string());
                }
            }
        } else {
            response["persisted"] = json!(false);
            response["persist_error"] = json!("alog session was not fully started");
        }
    } else {
        response["persisted"] = json!(false);
        response["persist_error"] = json!("missing alog session state");
    }
    Ok(Json(response))
}
async fn replay_record(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(record_id): Path<String>,
) -> std::result::Result<Response, ApiError> {
    let _user = require_auth(&headers, &state)?;
    {
        let mut replay = state.replay.lock().expect("replay mutex poisoned");
        if replay.running {
            let (blocking, remaining) =
                AppState::is_replay_blocking_locked(&mut replay, Utc::now(), "");
            if blocking {
                return Ok((
                    StatusCode::CONFLICT,
                    Json(json!({
                        "ok": false,
                        "error": "replay is already running",
                        "retry_after_seconds": remaining.num_seconds() + 1,
                        "estimated_done_at": replay.done_at.map(|value| value.to_rfc3339()),
                        "release_after": replay.release_at.map(|value| value.to_rfc3339()),
                    })),
                )
                    .into_response());
            }
            AppState::reset_replay_state_locked(&mut replay);
        }
    }
    let record_id = record_id.trim().to_string();
    if record_id.is_empty() {
        return Err(ApiError::new(StatusCode::BAD_REQUEST, "missing record id"));
    }
    let Some(record) = state
        .get_record(&record_id)
        .map_err(|error| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?
    else {
        return Err(ApiError::new(StatusCode::NOT_FOUND, "record not found"));
    };
    state
        .ops
        .move_cursor(record.start_point_x.max(0), record.start_point_y.max(0))
        .map_err(|error| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    state
        .ops
        .start_replaying(&record.mkp_path, -1)
        .map_err(|error| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    let started_at = Utc::now();
    let (done_at, release_after) = state.replay_window_for_record(&record, started_at);
    {
        let mut replay = state.replay.lock().expect("replay mutex poisoned");
        replay.running = true;
        replay.current_id = record.unique_id.clone();
        replay.started_at = Some(started_at);
        replay.done_at = Some(done_at);
        replay.release_at = Some(release_after);
    }
    Ok(Json(json!({"ok": true, "directive": "aplay", "id": record.unique_id, "mkp_path": record.mkp_path, "status": "started", "estimated_done_at": done_at.to_rfc3339(), "release_after": release_after.to_rfc3339()})).into_response())
}

async fn cancel_record(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> std::result::Result<Json<Value>, ApiError> {
    let _user = require_auth(&headers, &state)?;
    state
        .ops
        .cancel(Duration::from_millis(
            state.settings.async_directive_timeout_ms,
        ))
        .map_err(|error| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    let (replay_id, was_running) = {
        let mut replay = state.replay.lock().expect("replay mutex poisoned");
        let values = (replay.current_id.clone(), replay.running);
        AppState::reset_replay_state_locked(&mut replay);
        values
    };
    Ok(Json(
        json!({"ok": true, "directive": "acancel", "id": replay_id, "was_running": was_running, "status": "cancel_sent"}),
    ))
}

pub async fn run_server(settings: Settings) -> Result<()> {
    let addr = SocketAddr::from(([0, 0, 0, 0], settings.port));
    let app = create_app(Some(settings))?;
    let listener = TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .await
        .map_err(|error| MkpError::State(error.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use http_body_util::BodyExt;
    use tower::util::ServiceExt;

    #[derive(Default)]
    struct MockOps {
        serial: SerialPortStatus,
        version: MKPVersion,
        atime: LogLength,
        replay_starts: Mutex<Vec<String>>,
        deleted_files: Mutex<Vec<String>>,
    }

    impl MockOps {
        fn ready() -> Self {
            Self {
                serial: SerialPortStatus {
                    name: "COM5".to_string(),
                    port_open: true,
                    read_closed: false,
                    read_loop_running: true,
                    sync_output_enabled: true,
                    sync_output_timeout_ms: 10000,
                    current_sync_directive: String::new(),
                    sync_output_ignored: false,
                    async_marked: false,
                    last_read_at: None,
                    last_read_error: None,
                    last_read_error_at: None,
                },
                version: MKPVersion {
                    uver: "u1".to_string(),
                    aver: "a1".to_string(),
                },
                atime: LogLength {
                    seconds: 6,
                    milsec: 950,
                },
                replay_starts: Mutex::new(Vec::new()),
                deleted_files: Mutex::new(Vec::new()),
            }
        }
    }

    impl ServerOps for MockOps {
        fn snapshot_status(&self) -> SerialPortStatus {
            self.serial.clone()
        }
        fn aversion(&self, _timeout: Duration) -> Result<MKPVersion> {
            Ok(self.version.clone())
        }
        fn delete_file(&self, path: &str, _timeout: Duration) -> Result<String> {
            self.deleted_files
                .lock()
                .expect("deleted_files mutex poisoned")
                .push(path.to_string());
            Ok("OK".to_string())
        }
        fn compose_log_fullpath(&self, log_path: &str) -> String {
            crate::sdk::compose_log_fullpath(log_path)
        }
        fn move_cursor(&self, _x: i32, _y: i32) -> Result<()> {
            Ok(())
        }
        fn alog(&self, _log_name: &str, _opt: LogOption, _timeout: Duration) -> Result<String> {
            Ok("OK".to_string())
        }
        fn astop(&self, _timeout: Duration) -> Result<String> {
            Ok("OK".to_string())
        }
        fn atime(&self, _path: &str, _timeout: Duration) -> Result<LogLength> {
            Ok(self.atime.clone())
        }
        fn start_replaying(&self, log_name: &str, _delay: i32) -> Result<()> {
            self.replay_starts
                .lock()
                .expect("replay_starts mutex poisoned")
                .push(log_name.to_string());
            Ok(())
        }
        fn cancel(&self, _timeout: Duration) -> Result<()> {
            Ok(())
        }
        fn close(&self) -> Result<()> {
            Ok(())
        }
    }

    fn test_settings() -> Settings {
        Settings {
            mode: "release".to_string(),
            sf_port: "COM5".to_string(),
            port: 8080,
            jwt_secret: "secret".to_string(),
            user: "admin".to_string(),
            password: "admin123".to_string(),
            issuer: "mkp-go-server".to_string(),
            token_ttl_seconds: 86400,
            mute_auth_in_debug: false,
            database_url: "sqlite:///:memory:".to_string(),
            sync_directive_timeout_ms: 10000,
            async_directive_timeout_ms: 3000,
            db_timeout_ms: 5000,
            replay_completion_grace_ms: 1500,
            replay_minimum_duration_ms: 1000,
        }
    }

    async fn request_token(app: &Router) -> String {
        let response = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("POST")
                    .uri("/api/v1/auth/token")
                    .header(
                        axum::http::header::CONTENT_TYPE,
                        axum::http::HeaderValue::from_static("application/json"),
                    )
                    .body(Body::from(r#"{"username":"admin","password":"admin123"}"#))
                    .expect("request build should succeed"),
            )
            .await
            .expect("request should succeed");
        let body = response
            .into_body()
            .collect()
            .await
            .expect("body collect should succeed")
            .to_bytes();
        let value: Value = serde_json::from_slice(&body).expect("token json should parse");
        value["token"]
            .as_str()
            .expect("token must be string")
            .to_string()
    }

    #[tokio::test]
    async fn auth_and_empty_list_work() {
        let app = create_app_with_ops(test_settings(), Arc::new(MockOps::ready()))
            .expect("app should build");
        let token = request_token(&app).await;
        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .method("GET")
                    .uri("/api/v1/directives/list")
                    .header(axum::http::header::AUTHORIZATION, format!("Bearer {token}"))
                    .body(Body::empty())
                    .expect("request build should succeed"),
            )
            .await
            .expect("request should succeed");
        assert_eq!(response.status(), StatusCode::OK);
        let body = response
            .into_body()
            .collect()
            .await
            .expect("body collect should succeed")
            .to_bytes();
        let value: Value = serde_json::from_slice(&body).expect("list json should parse");
        assert_eq!(value["count"], 0);
    }

    #[tokio::test]
    async fn alog_stop_persists_record_and_replay_works() {
        let mock = Arc::new(MockOps::ready());
        let app = create_app_with_ops(test_settings(), mock.clone()).expect("app should build");
        let token = request_token(&app).await;
        let start_response = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("POST")
                    .uri("/api/v1/directives/alog")
                    .header(axum::http::header::AUTHORIZATION, format!("Bearer {token}"))
                    .header(
                        axum::http::header::CONTENT_TYPE,
                        axum::http::HeaderValue::from_static("application/json"),
                    )
                    .body(Body::from(
                        r#"{"log_name":"demo","width":1920,"height":1080,"stposx":10,"stposy":20}"#,
                    ))
                    .expect("request build should succeed"),
            )
            .await
            .expect("request should succeed");
        assert_eq!(start_response.status(), StatusCode::OK);
        let stop_response = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("POST")
                    .uri("/api/v1/directives/astop")
                    .header(axum::http::header::AUTHORIZATION, format!("Bearer {token}"))
                    .body(Body::empty())
                    .expect("request build should succeed"),
            )
            .await
            .expect("request should succeed");
        assert_eq!(stop_response.status(), StatusCode::OK);
        let stop_body = stop_response
            .into_body()
            .collect()
            .await
            .expect("body collect should succeed")
            .to_bytes();
        let stop_value: Value = serde_json::from_slice(&stop_body).expect("stop json should parse");
        assert_eq!(stop_value["persisted"], true);
        let list_response = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("GET")
                    .uri("/api/v1/directives/list")
                    .header(axum::http::header::AUTHORIZATION, format!("Bearer {token}"))
                    .body(Body::empty())
                    .expect("request build should succeed"),
            )
            .await
            .expect("request should succeed");
        let list_body = list_response
            .into_body()
            .collect()
            .await
            .expect("body collect should succeed")
            .to_bytes();
        let list_value: Value = serde_json::from_slice(&list_body).expect("list json should parse");
        assert_eq!(list_value["count"], 1);
        let record_id = list_value["records"][0]["unique_id"]
            .as_str()
            .expect("record id must exist");
        let replay_response = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .method("POST")
                    .uri(format!("/api/v1/directives/aplay/{record_id}"))
                    .header(axum::http::header::AUTHORIZATION, format!("Bearer {token}"))
                    .body(Body::empty())
                    .expect("request build should succeed"),
            )
            .await
            .expect("request should succeed");
        assert_eq!(replay_response.status(), StatusCode::OK);
        assert_eq!(
            mock.replay_starts
                .lock()
                .expect("replay starts mutex poisoned")
                .len(),
            1
        );
    }
}
