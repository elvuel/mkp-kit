use thiserror::Error;

pub type Result<T> = std::result::Result<T, MkpError>;

#[derive(Debug, Clone, Error, PartialEq, Eq)]
#[error("timeout waiting for sync output: {directive}")]
pub struct DirectiveTimeoutError {
    pub directive: String,
}

#[derive(Debug, Error)]
pub enum MkpError {
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Serial(#[from] serialport::Error),
    #[error(transparent)]
    Sqlite(#[from] rusqlite::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
    #[error(transparent)]
    Timeout(#[from] DirectiveTimeoutError),
    #[error("directive parser missing: {0}")]
    DirectiveParserMissing(String),
    #[error("raw directive parse failed: {0}")]
    RawDirectiveParseFailed(String),
    #[error("raw directive execution failed: {0}")]
    RawDirectiveExecutionFailed(String),
    #[error("invalid argument: {0}")]
    InvalidArgument(String),
    #[error("serial port is not open: {0}")]
    PortNotOpen(String),
    #[error("sync output mode is disabled")]
    SyncOutputDisabled,
    #[error("state error: {0}")]
    State(String),
}
