#[path = "../../support/common.rs"]
mod common;

use common::{init_sfport, log};
use mkp_rust::{WifiAutoOption, wifi_auto};
use std::time::Duration;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let opt = match args.as_slice() {
        [] => None,
        [state] if state == "0" || state == "1" => Some(WifiAutoOption {
            state: state.clone(),
        }),
        _ => return Err("usage: cargo run --example wifi_auto -- [0|1]".into()),
    };
    let mut sfport = init_sfport()?;
    let output = wifi_auto(&mut sfport, opt, Some(Duration::from_secs(30)))?;
    log(output);
    sfport.close()?;
    Ok(())
}

