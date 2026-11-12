#[path = "../../support/common.rs"]
mod common;

use common::{init_sfport, log};
use mkp_rust::adumj;
use std::time::Duration;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let Some(log_path) = std::env::args().nth(1) else {
        return Err("usage: cargo run --example adumj -- <log_path>".into());
    };
    let mut sfport = init_sfport()?;
    let output = adumj(&mut sfport, &log_path, Some(Duration::from_secs(30)))?;
    log(output);
    sfport.close()?;
    Ok(())
}

