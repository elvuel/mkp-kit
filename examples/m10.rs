#[path = "support/common.rs"]
mod common;

use common::init_sfport;
use mkp_rust::M10Option;
use std::{thread, time::Duration};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut sfport = init_sfport()?;
    println!("3s 后开始移动鼠标：先向左 400，再向上 400");
    thread::sleep(Duration::from_secs(3));

    sfport.mouse10(M10Option::default().set_x(-400))?;
    thread::sleep(Duration::from_millis(80));
    sfport.mouse10(M10Option::default().set_y(-400))?;
    thread::sleep(Duration::from_millis(120));

    println!("m10 示例完成");
    sfport.close()?;
    Ok(())
}
