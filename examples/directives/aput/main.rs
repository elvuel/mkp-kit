#[path = "../../support/common.rs"]
mod common;

use common::{init_sfport, log};
use mkp_rust::{APutOption, adownload_from_mkp};
use std::time::Duration;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let Some(filepath) = std::env::args().nth(1) else {
        return Err("usage: cargo run --example aput -- <filepath>".into());
    };
    let mut sfport = init_sfport()?;
    let output = adownload_from_mkp(
        &mut sfport,
        APutOption { filepath },
        Some(Duration::from_secs(30)),
    )?;
    log(output);
    sfport.close()?;
    Ok(())
}

