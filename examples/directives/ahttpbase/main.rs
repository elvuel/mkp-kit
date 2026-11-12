#[path = "../../support/common.rs"]
mod common;

use common::{init_sfport, log};
use mkp_rust::{AHTTPBaseOption, ahttpbase};
use std::time::Duration;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let opt = std::env::args().nth(1).map(|url| AHTTPBaseOption { url });
    let mut sfport = init_sfport()?;
    let output = ahttpbase(&mut sfport, opt, Some(Duration::from_secs(10)))?;
    log(output);
    sfport.close()?;
    Ok(())
}

