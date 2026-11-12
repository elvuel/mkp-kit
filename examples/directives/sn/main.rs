#[path = "../../support/common.rs"]
mod common;

use common::init_sfport;
use mkp_rust::device_sn;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut sfport = init_sfport()?;
    let sn = device_sn(&mut sfport, None)?;
    println!("{sn:?}");
    sfport.close()?;
    Ok(())
}

