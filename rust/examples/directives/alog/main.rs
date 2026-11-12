#[path = "../../support/common.rs"]
mod common;

use common::{init_sfport, log};
use mkp_rust::alog;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let log_name = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "subdir1/test".to_string());
    let mut sfport = init_sfport()?;
    let output = alog(&mut sfport, &log_name, None, None)?;
    log(output);
    sfport.close()?;
    Ok(())
}

