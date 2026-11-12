#[path = "../../support/common.rs"]
mod common;

use common::{init_sfport, log};
use mkp_rust::clean_dir;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "/eMMC/applog/subdir1".to_string());
    let mut sfport = init_sfport()?;
    let _ = clean_dir(&mut sfport, &path, None)?;
    log("succeed");
    sfport.close()?;
    Ok(())
}

