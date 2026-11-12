#[path = "../../support/common.rs"]
mod common;

use common::{init_sfport, log};
use mkp_rust::aversion;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut sfport = init_sfport()?;
    let output = aversion(&mut sfport, None)?;
    log(output);
    sfport.close()?;
    Ok(())
}

