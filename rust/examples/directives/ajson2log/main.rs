#[path = "../../support/common.rs"]
mod common;

use common::{init_sfport, log};
use mkp_rust::{AJSON2LogOption, ajson2log};
use std::time::Duration;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let [jsonpath, outputlogpath] = args.as_slice() else {
        return Err("usage: cargo run --example ajson2log -- <jsonpath> <outputlogpath>".into());
    };
    let mut sfport = init_sfport()?;
    let output = ajson2log(
        &mut sfport,
        AJSON2LogOption {
            jsonpath: jsonpath.clone(),
            outputlogpath: outputlogpath.clone(),
        },
        Some(Duration::from_secs(30)),
    )?;
    log(output);
    sfport.close()?;
    Ok(())
}

