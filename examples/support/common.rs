use mkp_rust::{Result, SFSerialPort, check_sf_serial_port, new_sf_serial_port, stop_record};
use std::{env, fmt::Debug, thread, time::Duration};

pub fn init_sfport() -> Result<SFSerialPort> {
    let mut sfport = new_sf_serial_port();
    let resolved = env::var("MKP_SF_PORT")
        .ok()
        .filter(|value| !value.is_empty())
        .or_else(|| env::var("SF_PORT").ok().filter(|value| !value.is_empty()))
        .map(Ok)
        .unwrap_or_else(check_sf_serial_port)?;
    sfport.name = resolved;
    println!("using serial port: {}", sfport.name);
    sfport.open()?;
    thread::sleep(Duration::from_millis(50));
    sfport.reset_input_buffer()?;
    sfport.start_read_loop()?;
    let _ = stop_record(&mut sfport);
    sfport.set_sync_output_enabled(true);
    Ok(sfport)
}

#[allow(dead_code)]
pub fn log<T: Debug>(value: T) {
    println!("{value:#?}");
}
