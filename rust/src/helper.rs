use crate::error::Result;
use crate::models::M10Option;
use crate::sdk::SFSerialPort;
use std::time::Duration;

pub use crate::sdk::{
    adownload_from_mkp, adumj, ahttpbase, ainspect, ajson2log, alive, alog, astop, atime,
    aupload_to_mkp, aversion, cancel, check_sf_serial_port, clean_dir, compose_log_directory,
    compose_log_fullpath, delete_file, device_sn, join, key_down, key_presses, key_tap, key_up,
    keypad_release, keypad_release_all, list_dir, mouse_release_all, new_sf_serial_port,
    start_record, stop_record, wifi_auto,
};

const AUTO_M10_DURATION_MIN_MS: u64 = 60;
const AUTO_M10_DURATION_MAX_MS: u64 = 360;

pub fn compose_log_dirctory(log_dir: &str) -> String {
    compose_log_directory(log_dir)
}

pub fn m10(sfport: &mut SFSerialPort, opt: M10Option) -> Result<()> {
    sfport.mouse10(opt)
}

pub fn pixels_to_m10_units(distance_pixels: f64, pixels_per_m10_unit: f64) -> f64 {
    if pixels_per_m10_unit <= 0.0 {
        return 0.0;
    }
    distance_pixels / pixels_per_m10_unit
}

pub fn auto_m10_duration(distance_m10_units: f64, m10_units_per_second: f64) -> Duration {
    let distance_m10_units = distance_m10_units.abs();
    if distance_m10_units <= 0.0 || m10_units_per_second <= 0.0 {
        return Duration::ZERO;
    }

    let duration_secs = distance_m10_units / m10_units_per_second;
    let duration = Duration::from_secs_f64(duration_secs);
    duration.clamp(
        Duration::from_millis(AUTO_M10_DURATION_MIN_MS),
        Duration::from_millis(AUTO_M10_DURATION_MAX_MS),
    )
}

#[cfg(test)]
mod tests {
    use super::{
        AUTO_M10_DURATION_MAX_MS, AUTO_M10_DURATION_MIN_MS, auto_m10_duration, pixels_to_m10_units,
    };
    use std::time::Duration;

    #[test]
    fn converts_pixels_to_m10_units() {
        assert_eq!(pixels_to_m10_units(100.0, 2.0), 50.0);
        assert_eq!(pixels_to_m10_units(100.0, 0.0), 0.0);
    }

    #[test]
    fn clamps_auto_m10_duration() {
        assert_eq!(auto_m10_duration(0.0, 2600.0), Duration::ZERO);
        assert_eq!(
            auto_m10_duration(1.0, 2600.0),
            Duration::from_millis(AUTO_M10_DURATION_MIN_MS)
        );
        assert_eq!(
            auto_m10_duration(26000.0, 2600.0),
            Duration::from_millis(AUTO_M10_DURATION_MAX_MS)
        );
    }
}
