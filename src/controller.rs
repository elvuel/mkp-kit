use crate::error::Result;
use crate::helper::auto_m10_duration;
use crate::models::{
    AGetOption, AHTTPBase, AHTTPBaseOption, AJSON2LogOption, APutOption, ActionDump, FileSystem,
    Heartbeat, JoinOption, KpadOption, LogInfo, LogLength, LogOption, M10Option, MKPVersion,
    MouseMoveOffset, SN, SerialPortStatus, WifiAutoOption, mouse_button_mask,
};
use crate::parser::ParsedOutput;
use crate::sdk::{
    SFSerialPort, adownload_from_mkp, adumj, ahttpbase, ainspect, ajson2log, alive, alog, astop,
    atime, aupload_to_mkp, aversion, cancel, clean_dir, compose_log_directory,
    compose_log_fullpath, delete_file, device_sn, join, key_down, key_presses, key_tap, key_up,
    keypad_release, keypad_release_all, list_dir, mouse_release_all, start_record, stop_record,
    wifi_auto,
};
use std::thread;
use std::time::Duration;

const DEFAULT_CLICK_SLEEP_MS: u64 = 120;
const DEFAULT_M10_STEP_MS: u64 = 8;
const DEFAULT_M10_UNITS_PER_SECOND: f64 = 2600.0;

fn sleep_ms(ms: i32) {
    if ms > 0 {
        thread::sleep(Duration::from_millis(ms as u64));
    }
}

fn base_m10_option(override_opt: Option<&M10Option>) -> M10Option {
    let mut opt = M10Option::default();
    if let Some(override_opt) = override_opt {
        opt.async_mode = override_opt.async_mode;
        opt.sync_ignore_output = override_opt.sync_ignore_output;
    }
    opt
}

fn step_count(duration: Duration, rel_x: i32, rel_y: i32) -> usize {
    let interval_steps = (duration.as_millis() / DEFAULT_M10_STEP_MS as u128) as usize;
    let distance_steps = (rel_x.abs().max(rel_y.abs()) as usize).min(64);
    interval_steps.max(distance_steps).max(1)
}

fn split_axis(total: i32, steps: usize) -> Vec<i32> {
    if steps == 0 {
        return Vec::new();
    }
    let mut items = Vec::with_capacity(steps);
    let mut sent = 0;
    for index in 1..=steps {
        let target = ((total as i64 * index as i64) / steps as i64) as i32;
        items.push(target - sent);
        sent = target;
    }
    items
}

fn split_relative_steps(rel_x: i32, rel_y: i32, steps: usize) -> Vec<(i32, i32)> {
    let xs = split_axis(rel_x, steps);
    let ys = split_axis(rel_y, steps);
    xs.into_iter().zip(ys).collect()
}

fn button_field(default_button_mask: i32) -> Option<i32> {
    if default_button_mask == 0 {
        None
    } else {
        Some(default_button_mask)
    }
}

pub struct Controller {
    pub sfport: SFSerialPort,
}

impl Controller {
    pub fn new(sfport: SFSerialPort) -> Self {
        Self { sfport }
    }

    pub fn bind_sfport(&mut self, sfport: SFSerialPort) {
        self.sfport = sfport;
    }

    pub fn open(&mut self) -> Result<()> {
        self.sfport.open()?;
        self.sfport.start_read_loop()
    }

    pub fn close(&mut self) -> Result<()> {
        self.sfport.close()
    }

    pub fn compose_log_directory(&self, log_dir: &str) -> String {
        compose_log_directory(log_dir)
    }

    pub fn compose_log_fullpath(&self, log_path: &str) -> String {
        compose_log_fullpath(log_path)
    }

    pub fn start_record(&mut self, log_name: &str, opt: Option<LogOption>) -> Result<()> {
        start_record(&mut self.sfport, log_name, opt)
    }

    pub fn stop_record(&mut self) -> Result<()> {
        stop_record(&mut self.sfport)
    }

    pub fn alog(
        &mut self,
        log_name: &str,
        opt: Option<LogOption>,
        timeout: Option<Duration>,
    ) -> Result<String> {
        alog(&mut self.sfport, log_name, opt, timeout)
    }

    pub fn astop(&mut self, timeout: Option<Duration>) -> Result<String> {
        astop(&mut self.sfport, timeout)
    }

    pub fn cancel(&mut self, timeout: Option<Duration>) -> Result<ParsedOutput> {
        cancel(&mut self.sfport, timeout)
    }

    pub fn join(&mut self, opt: Option<JoinOption>, timeout: Option<Duration>) -> Result<String> {
        join(&mut self.sfport, opt, timeout)
    }

    pub fn wifi_auto(
        &mut self,
        opt: Option<WifiAutoOption>,
        timeout: Option<Duration>,
    ) -> Result<String> {
        wifi_auto(&mut self.sfport, opt, timeout)
    }

    pub fn device_sn(&mut self, timeout: Option<Duration>) -> Result<SN> {
        device_sn(&mut self.sfport, timeout)
    }

    pub fn list_dir(&mut self, path: &str, timeout: Option<Duration>) -> Result<FileSystem> {
        list_dir(&mut self.sfport, path, timeout)
    }

    pub fn clean_dir(&mut self, path: &str, timeout: Option<Duration>) -> Result<String> {
        clean_dir(&mut self.sfport, path, timeout)
    }

    pub fn delete_file(&mut self, path: &str, timeout: Option<Duration>) -> Result<String> {
        delete_file(&mut self.sfport, path, timeout)
    }

    pub fn alive(&mut self, timeout: Option<Duration>) -> Result<Heartbeat> {
        alive(&mut self.sfport, timeout)
    }

    pub fn atime(&mut self, path: &str, timeout: Option<Duration>) -> Result<LogLength> {
        atime(&mut self.sfport, path, timeout)
    }

    pub fn aversion(&mut self, timeout: Option<Duration>) -> Result<MKPVersion> {
        aversion(&mut self.sfport, timeout)
    }

    pub fn aupload_to_mkp(&mut self, opt: AGetOption, timeout: Option<Duration>) -> Result<String> {
        aupload_to_mkp(&mut self.sfport, opt, timeout)
    }

    pub fn adownload_from_mkp(
        &mut self,
        opt: APutOption,
        timeout: Option<Duration>,
    ) -> Result<String> {
        adownload_from_mkp(&mut self.sfport, opt, timeout)
    }

    pub fn ajson2log(&mut self, opt: AJSON2LogOption, timeout: Option<Duration>) -> Result<String> {
        ajson2log(&mut self.sfport, opt, timeout)
    }

    pub fn ahttpbase(
        &mut self,
        opt: Option<AHTTPBaseOption>,
        timeout: Option<Duration>,
    ) -> Result<AHTTPBase> {
        ahttpbase(&mut self.sfport, opt, timeout)
    }

    pub fn adumj(&mut self, log_path: &str, timeout: Option<Duration>) -> Result<ActionDump> {
        adumj(&mut self.sfport, log_path, timeout)
    }

    pub fn ainspect(&mut self, path: &str, timeout: Option<Duration>) -> Result<LogInfo> {
        ainspect(&mut self.sfport, path, timeout)
    }

    pub fn start_replaying(&mut self, log_name: &str, delay: i32) -> Result<()> {
        self.sfport.start_replaying(log_name, delay)
    }

    pub fn snapshot_status(&self) -> SerialPortStatus {
        self.sfport.snapshot_status()
    }

    pub fn key_down(&mut self, key: &str, opt: Option<KpadOption>) -> Result<()> {
        key_down(&mut self.sfport, key, opt)
    }

    pub fn key_up(&mut self, key: &str, opt: Option<KpadOption>) -> Result<()> {
        key_up(&mut self.sfport, key, opt)
    }

    pub fn key_tap(&mut self, key: &str, opt: Option<KpadOption>) -> Result<()> {
        key_tap(&mut self.sfport, key, opt)
    }

    pub fn key_presses(
        &mut self,
        keys: &[&str],
        sleep_ms: u64,
        opt: Option<KpadOption>,
    ) -> Result<()> {
        key_presses(&mut self.sfport, keys, sleep_ms, opt)
    }

    pub fn keypad_release(&mut self, opt: Option<KpadOption>) -> Result<()> {
        keypad_release(&mut self.sfport, opt)
    }

    pub fn keypad_release_all(&mut self, opt: Option<KpadOption>) -> Result<()> {
        keypad_release_all(&mut self.sfport, opt)
    }

    pub fn mouse_release_all(&mut self, opt: Option<M10Option>) -> Result<()> {
        mouse_release_all(&mut self.sfport, opt)
    }

    pub fn mouse_down(&mut self, button: &str, opt: Option<M10Option>) -> Result<()> {
        let button_mask = mouse_button_mask(button);
        let directive = base_m10_option(opt.as_ref())
            .set_button(button_mask)
            .set_x(0)
            .set_y(0);
        self.sfport.mouse10(directive)
    }

    pub fn mouse_up(&mut self, opt: Option<M10Option>) -> Result<()> {
        self.mouse_release_all(opt)
    }

    pub fn mouse_click(
        &mut self,
        button: &str,
        double: bool,
        sleep_interval_ms: i32,
        opt: Option<M10Option>,
    ) -> Result<()> {
        self.mouse_click_with_option(mouse_button_mask(button), double, sleep_interval_ms, opt)
    }

    pub fn mouse_click_with_option(
        &mut self,
        button: i32,
        double: bool,
        sleep_interval_ms: i32,
        opt: Option<M10Option>,
    ) -> Result<()> {
        let press = base_m10_option(opt.as_ref())
            .set_button(button)
            .set_x(0)
            .set_y(0);
        self.sfport.mouse10(press)?;
        self.mouse_release_all(opt.clone())?;

        if double {
            if sleep_interval_ms > 0 {
                sleep_ms(sleep_interval_ms);
            } else {
                thread::sleep(Duration::from_millis(DEFAULT_CLICK_SLEEP_MS));
            }
            let second = base_m10_option(opt.as_ref())
                .set_button(button)
                .set_x(0)
                .set_y(0);
            self.sfport.mouse10(second)?;
            self.mouse_release_all(opt)?;
        }

        Ok(())
    }

    pub fn mouse_scroll(&mut self, dir: &str, steps: i32, sleep_interval_ms: i32) -> Result<()> {
        self.mouse_scroll_with_option(dir, steps, sleep_interval_ms, None)
    }

    pub fn mouse_scroll_with_option(
        &mut self,
        dir: &str,
        steps: i32,
        sleep_interval_ms: i32,
        opt: Option<M10Option>,
    ) -> Result<()> {
        if steps <= 0 {
            return Ok(());
        }
        let wheel = if dir.eq_ignore_ascii_case("up") {
            1
        } else {
            -1
        };
        for index in 0..steps {
            let scroll = base_m10_option(opt.as_ref())
                .set_x(0)
                .set_y(0)
                .set_wheel(wheel);
            self.sfport.mouse10(scroll)?;
            thread::sleep(Duration::from_millis(DEFAULT_M10_STEP_MS));
            self.mouse_release_all(opt.clone())?;
            if index + 1 < steps {
                if sleep_interval_ms > 0 {
                    sleep_ms(sleep_interval_ms);
                } else {
                    thread::sleep(Duration::from_millis(DEFAULT_CLICK_SLEEP_MS));
                }
            }
        }
        Ok(())
    }

    pub fn mouse_scroll_with_button(
        &mut self,
        dir: &str,
        steps: i32,
        button: &str,
        sleep_interval_ms: i32,
    ) -> Result<()> {
        self.mouse_scroll_with_button_option(dir, steps, button, sleep_interval_ms, None)
    }

    pub fn mouse_scroll_with_button_option(
        &mut self,
        dir: &str,
        steps: i32,
        button: &str,
        sleep_interval_ms: i32,
        opt: Option<M10Option>,
    ) -> Result<()> {
        if steps <= 0 {
            return Ok(());
        }
        let button_mask = mouse_button_mask(button);
        let wheel = if dir.eq_ignore_ascii_case("up") {
            1
        } else {
            -1
        };
        let hold_button = !button.trim().is_empty() && button_mask != 0;

        if hold_button {
            self.mouse_down(button, opt.clone())?;
        }

        for index in 0..steps {
            let mut scroll = base_m10_option(opt.as_ref())
                .set_x(0)
                .set_y(0)
                .set_wheel(wheel);
            if hold_button {
                scroll = scroll.set_button(button_mask);
            }
            self.sfport.mouse10(scroll)?;
            thread::sleep(Duration::from_millis(DEFAULT_M10_STEP_MS));
            if !hold_button {
                self.mouse_release_all(opt.clone())?;
            }
            if index + 1 < steps {
                if sleep_interval_ms > 0 {
                    sleep_ms(sleep_interval_ms);
                } else {
                    thread::sleep(Duration::from_millis(DEFAULT_CLICK_SLEEP_MS));
                }
            }
        }

        if hold_button {
            self.mouse_release_all(opt)?;
        }

        Ok(())
    }

    pub fn m10_move(&mut self, opt: M10Option) -> Result<()> {
        self.sfport.mouse10(opt)
    }

    pub fn mouse_move(
        &mut self,
        button: &str,
        rel_x: i32,
        rel_y: i32,
        interval: Duration,
        opt: Option<M10Option>,
    ) -> Result<()> {
        if rel_x == 0 && rel_y == 0 {
            return Ok(());
        }

        let button_mask = mouse_button_mask(button);
        let steps = step_count(interval, rel_x, rel_y);
        let parts = split_relative_steps(rel_x, rel_y, steps);
        let per_step_delay = if steps > 1 {
            Duration::from_millis((interval.as_millis() / steps as u128) as u64)
        } else {
            Duration::ZERO
        };

        for (dx, dy) in parts {
            if dx == 0 && dy == 0 {
                continue;
            }
            let mut directive = base_m10_option(opt.as_ref()).set_x(dx).set_y(dy);
            if let Some(button_mask) = button_field(button_mask) {
                directive = directive.set_button(button_mask);
            }
            self.sfport.mouse10(directive)?;
            if per_step_delay > Duration::ZERO {
                thread::sleep(per_step_delay);
            }
        }

        self.mouse_release_all(opt)
    }

    pub fn mouse_move_offsets(
        &mut self,
        button: &str,
        offsets: &[MouseMoveOffset],
        opt: Option<M10Option>,
    ) -> Result<()> {
        if offsets.is_empty() {
            return Ok(());
        }

        let default_button = mouse_button_mask(button);
        let need_release = default_button != 0
            || offsets
                .iter()
                .any(|offset| offset.button.is_some_and(|value| value != 0));

        for offset in offsets {
            let button_mask = offset.button.unwrap_or(default_button);
            let wheel = offset.wheel;

            if offset.x == 0 && offset.y == 0 {
                if button_mask != 0 || wheel.is_some() {
                    let mut directive = base_m10_option(opt.as_ref()).set_x(0).set_y(0);
                    if button_mask != 0 {
                        directive = directive.set_button(button_mask);
                    }
                    if let Some(wheel) = wheel {
                        directive = directive.set_wheel(wheel);
                    }
                    self.sfport.mouse10(directive)?;
                }
                if let Some(pause_ms) = offset.pause {
                    sleep_ms(pause_ms);
                }
                continue;
            }

            let distance = ((offset.x as f64).powi(2) + (offset.y as f64).powi(2)).sqrt();
            let duration = auto_m10_duration(distance, DEFAULT_M10_UNITS_PER_SECOND);
            let steps = step_count(duration, offset.x, offset.y);
            let parts = split_relative_steps(offset.x, offset.y, steps);
            let per_step_delay = if steps > 1 {
                Duration::from_millis((duration.as_millis() / steps as u128) as u64)
            } else {
                Duration::ZERO
            };
            let mut wheel_sent = false;

            for (dx, dy) in parts {
                if dx == 0 && dy == 0 {
                    continue;
                }
                let mut directive = base_m10_option(opt.as_ref()).set_x(dx).set_y(dy);
                if button_mask != 0 {
                    directive = directive.set_button(button_mask);
                }
                if let Some(wheel) = wheel
                    && !wheel_sent
                {
                    directive = directive.set_wheel(wheel);
                    wheel_sent = true;
                }
                self.sfport.mouse10(directive)?;
                if per_step_delay > Duration::ZERO {
                    thread::sleep(per_step_delay);
                }
            }

            if let Some(pause_ms) = offset.pause {
                sleep_ms(pause_ms);
            }
        }

        if need_release {
            self.mouse_release_all(opt)?;
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::split_relative_steps;

    #[test]
    fn splits_relative_steps_without_losing_distance() {
        let steps = split_relative_steps(10, -5, 3);
        assert_eq!(steps.iter().map(|(x, _)| *x).sum::<i32>(), 10);
        assert_eq!(steps.iter().map(|(_, y)| *y).sum::<i32>(), -5);
    }
}
