#[path = "../../support/common.rs"]
mod common;

use common::{init_sfport, log};
use mkp_rust::{AGetOption, aupload_to_mkp};
use std::time::Duration;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let Some(filepath) = std::env::args().nth(1) else {
        return Err("usage: cargo run --example aget -- <filepath>".into());
    };
    let mut sfport = init_sfport()?;
    let output = aupload_to_mkp(
        &mut sfport,
        AGetOption { filepath },
        Some(Duration::from_secs(30)),
    )?;
    log(output);
    sfport.close()?;
    Ok(())
}

