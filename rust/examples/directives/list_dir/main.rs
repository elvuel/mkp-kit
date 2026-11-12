#[path = "../../support/common.rs"]
mod common;

use common::{init_sfport, log};
use mkp_rust::list_dir;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "/eMMC".to_string());
    let mut sfport = init_sfport()?;
    let output = list_dir(&mut sfport, &path, None)?;
    log(output);
    sfport.close()?;
    Ok(())
}

