use axum::extract::{Multipart, Path, Query, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use clap::Parser;
use serde::Deserialize;
use serde::Serialize;
use std::fs;
use std::io;
use std::net::SocketAddr;
use std::path::{Path as FsPath, PathBuf};
use std::sync::Arc;

#[derive(Debug, Clone)]
struct AppState {
    file_root: PathBuf,
}

#[derive(Debug, Parser)]
#[command(name = "file_server")]
#[command(about = "Simple file server compatible with MKP file-management flows")]
struct Args {
    #[arg(short = 'p', long = "port", default_value_t = 8080)]
    port: u16,
    #[arg(short = 'r', long = "root", default_value = "./file_root")]
    root: PathBuf,
    #[arg(short = 'b', long = "bind", default_value = "0.0.0.0")]
    bind: String,
}

#[derive(Debug, Serialize)]
struct DirEntry {
    name: String,
    r#type: String,
    size: i64,
    path: String,
}

#[derive(Debug, Serialize)]
struct UploadResponse {
    status: String,
    path: String,
    size: i64,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
}

#[derive(Debug, Deserialize)]
struct ListQuery {
    path: Option<String>,
}

#[derive(Debug)]
struct ApiError(StatusCode, String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(ErrorResponse { error: self.1 })).into_response()
    }
}

fn safe_join(file_root: &FsPath, parts: &[&str]) -> Option<PathBuf> {
    let mut out = file_root.to_path_buf();
    for part in parts {
        let normalized = part.replace('\\', "/");
        let normalized = normalized.trim_start_matches('/');
        if normalized.is_empty() {
            continue;
        }
        let candidate =
            PathBuf::from(normalized.replace('/', &std::path::MAIN_SEPARATOR.to_string()));
        if candidate.is_absolute()
            || candidate
                .components()
                .any(|component| matches!(component, std::path::Component::ParentDir))
        {
            return None;
        }
        out.push(candidate);
    }
    Some(out)
}

fn sanitize_filename(filename: &str) -> String {
    let mut file_name = FsPath::new(&filename.replace('\\', "/"))
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("unnamed_file")
        .to_string();
    file_name = file_name
        .chars()
        .map(|ch| match ch {
            '<' | '>' | ':' | '"' | '|' | '?' | '*' => '_',
            value => value,
        })
        .collect();
    if file_name.is_empty() || file_name == "." {
        "unnamed_file".to_string()
    } else {
        file_name
    }
}

fn list_directory(dir: &FsPath, root: &FsPath) -> Result<Vec<DirEntry>, ApiError> {
    let mut entries = Vec::new();
    for item in fs::read_dir(dir).map_err(io_to_api)? {
        let item = item.map_err(io_to_api)?;
        let path = item.path();
        let meta = item.metadata().map_err(io_to_api)?;
        let rel = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        entries.push(DirEntry {
            name: item.file_name().to_string_lossy().to_string(),
            r#type: if meta.is_dir() { "dir" } else { "file" }.to_string(),
            size: if meta.is_dir() { 0 } else { meta.len() as i64 },
            path: rel,
        });
    }
    entries.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(entries)
}

fn io_to_api(error: io::Error) -> ApiError {
    ApiError(StatusCode::INTERNAL_SERVER_ERROR, error.to_string())
}

async fn handle_list(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListQuery>,
) -> Result<Json<Vec<DirEntry>>, ApiError> {
    let path = query.path.unwrap_or_default();
    let fs_path = safe_join(&state.file_root, &[&path]).ok_or_else(|| {
        ApiError(
            StatusCode::BAD_REQUEST,
            "Path traversal rejected".to_string(),
        )
    })?;
    let meta = fs::metadata(&fs_path).map_err(|_| {
        ApiError(
            StatusCode::NOT_FOUND,
            format!("Directory not found: {path}"),
        )
    })?;
    if !meta.is_dir() {
        return Err(ApiError(
            StatusCode::NOT_FOUND,
            format!("Directory not found: {path}"),
        ));
    }
    Ok(Json(list_directory(&fs_path, &state.file_root)?))
}

async fn handle_upload(
    State(state): State<Arc<AppState>>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, ApiError> {
    let mut upload_path = String::new();
    let mut file_name = None;
    let mut data = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|error| ApiError(StatusCode::BAD_REQUEST, error.to_string()))?
    {
        match field.name() {
            Some("path") => upload_path = field.text().await.unwrap_or_default(),
            Some("file") => {
                file_name = field.file_name().map(|name| name.to_string());
                data = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|error| ApiError(StatusCode::BAD_REQUEST, error.to_string()))?,
                );
            }
            _ => {}
        }
    }

    let file_name = sanitize_filename(&file_name.unwrap_or_else(|| "unnamed_file".to_string()));
    let data = data.ok_or_else(|| {
        ApiError(
            StatusCode::BAD_REQUEST,
            "Missing 'file' field in form data".to_string(),
        )
    })?;
    let target = safe_join(&state.file_root, &[&upload_path, &file_name]).ok_or_else(|| {
        ApiError(
            StatusCode::BAD_REQUEST,
            "Path traversal rejected".to_string(),
        )
    })?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(io_to_api)?;
    }
    fs::write(&target, &data).map_err(io_to_api)?;
    let rel = target
        .strip_prefix(&state.file_root)
        .unwrap_or(&target)
        .to_string_lossy()
        .replace('\\', "/");
    Ok(Json(UploadResponse {
        status: "ok".to_string(),
        path: rel,
        size: data.len() as i64,
    }))
}

async fn handle_put(
    State(state): State<Arc<AppState>>,
    Path(path): Path<String>,
    body: axum::body::Bytes,
) -> Result<Json<UploadResponse>, ApiError> {
    if body.is_empty() {
        return Err(ApiError(
            StatusCode::BAD_REQUEST,
            "Empty request body".to_string(),
        ));
    }
    let target = safe_join(&state.file_root, &[&path]).ok_or_else(|| {
        ApiError(
            StatusCode::BAD_REQUEST,
            "Path traversal rejected".to_string(),
        )
    })?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent).map_err(io_to_api)?;
    }
    fs::write(&target, &body).map_err(io_to_api)?;
    Ok(Json(UploadResponse {
        status: "ok".to_string(),
        path,
        size: body.len() as i64,
    }))
}

async fn handle_get(
    State(state): State<Arc<AppState>>,
    Path(path): Path<String>,
) -> Result<Response, ApiError> {
    let target = safe_join(&state.file_root, &[&path]).ok_or_else(|| {
        ApiError(
            StatusCode::BAD_REQUEST,
            "Path traversal rejected".to_string(),
        )
    })?;
    let meta = fs::metadata(&target)
        .map_err(|_| ApiError(StatusCode::NOT_FOUND, format!("File not found: {path}")))?;
    if meta.is_dir() {
        return Err(ApiError(
            StatusCode::NOT_FOUND,
            format!("File not found: {path}"),
        ));
    }
    let bytes = fs::read(&target).map_err(io_to_api)?;
    Ok((StatusCode::OK, bytes).into_response())
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    let root = args
        .root
        .canonicalize()
        .unwrap_or_else(|_| args.root.clone());
    if let Err(error) = fs::create_dir_all(&root) {
        eprintln!("file_server: create file root directory: {error}");
        std::process::exit(1);
    }

    let state = Arc::new(AppState {
        file_root: root.clone(),
    });
    let app = Router::new()
        .route("/list", get(handle_list))
        .route("/upload", post(handle_upload))
        .route("/*path", get(handle_get).put(handle_put))
        .with_state(state);

    let addr: SocketAddr = format!("{}:{}", args.bind, args.port)
        .parse()
        .expect("bind address should parse");

    println!("http4dev server started");
    println!("  FileRoot: {}", root.display());
    println!("  Listen: {}", addr);
    println!("  Endpoints:");
    println!("    GET  /<path>        Download file");
    println!("    PUT  /<path>        Raw upload");
    println!("    POST /upload        Multipart form upload");
    println!("    GET  /list?path=    List directory");

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("bind listener should succeed");
    if let Err(error) = axum::serve(listener, app).await {
        eprintln!("file_server: server failed: {error}");
        std::process::exit(1);
    }
}
