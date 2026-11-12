#[path = "../../support/common.rs"]
mod common;

use common::{init_sfport, log};
use mkp_rust::atime;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "/eMMC/applog/uuu2.log".to_string());
    let mut sfport = init_sfport()?;
    let output = atime(&mut sfport, &path, None)?;
    log(output);
    sfport.close()?;
    Ok(())
}

