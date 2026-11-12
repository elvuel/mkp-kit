#[path = "../../support/common.rs"]
mod common;

use common::{init_sfport, log};
use mkp_rust::{JoinOption, join};
use std::time::Duration;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let opt = match args.as_slice() {
        [] => None,
        [ssid, password] => Some(JoinOption {
            ssid: ssid.clone(),
            password: password.clone(),
        }),
        _ => {
            return Err("usage: cargo run --example join -- [ssid password]".into());
        }
    };
    let mut sfport = init_sfport()?;
    let output = join(&mut sfport, opt, Some(Duration::from_secs(30)))?;
    log(output);
    sfport.close()?;
    Ok(())
}

