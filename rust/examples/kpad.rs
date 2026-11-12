#[path = "support/common.rs"]
mod common;

use common::init_sfport;
use mkp_rust::{KpadOption, keypad_release_all};
use std::{thread, time::Duration};

fn tap(
    sfport: &mut mkp_rust::SFSerialPort,
    keys: &[&str],
) -> Result<(), Box<dyn std::error::Error>> {
    sfport.keypad(
        KpadOption::default()
            .with_keys(keys.iter().map(|item| (*item).to_string()).collect())
            .with_auto_release(),
    )?;
    thread::sleep(Duration::from_millis(60));
    Ok(())
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut sfport = init_sfport()?;
    println!("3s 后开始输出文本: Hello MKP!");
    thread::sleep(Duration::from_secs(3));

    let sequence: &[&[&str]] = &[
        &["MOD_LSHIFT", "H"],
        &["E"],
        &["L"],
        &["L"],
        &["O"],
        &["SPACE"],
        &["MOD_LSHIFT", "M"],
        &["MOD_LSHIFT", "K"],
        &["MOD_LSHIFT", "P"],
        &["MOD_LSHIFT", "1"],
    ];
    for keys in sequence {
        tap(&mut sfport, keys)?;
    }

    thread::sleep(Duration::from_millis(120));
    keypad_release_all(&mut sfport, None)?;

    println!("kpad 示例完成");
    sfport.close()?;
    Ok(())
}
