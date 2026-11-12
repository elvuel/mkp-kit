#[path = "../../support/common.rs"]
mod common;

use common::{init_sfport, log};
use mkp_rust::astop;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut sfport = init_sfport()?;
    let _ = astop(&mut sfport, None)?;
    log("done");
    sfport.close()?;
    Ok(())
}

