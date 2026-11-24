#include "mkp/controller.hpp"

#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <thread>
#include <utility>

#include "mkp/helper.hpp"

namespace mkp {

namespace {
constexpr int DEFAULT_CLICK_SLEEP_MS = 120;
constexpr int DEFAULT_M10_STEP_MS = 8;
constexpr double DEFAULT_M10_UNITS_PER_SECOND = 2600.0;

M10Option base_m10_option(const std::optional<M10Option> &override_option) {
  auto next = M10Option{};
  if (override_option) {
    next.async_mode = override_option->async_mode;
    next.sync_ignore_output = override_option->sync_ignore_output;
    next.sync_output_timeout_ms = override_option->sync_output_timeout_ms;
  }
  return next;
}

int step_count(int interval_ms, int rel_x, int rel_y) {
  const auto interval_steps = std::max(interval_ms, 0) / DEFAULT_M10_STEP_MS;
  const auto distance_steps = std::min(std::max(std::abs(rel_x), std::abs(rel_y)), 64);
  return std::max({interval_steps, distance_steps, 1});
}

std::vector<int> split_axis(int total, int steps) {
  std::vector<int> values;
  int sent = 0;
  for (int index = 1; index <= steps; ++index) {
    const auto target = (total * index) / steps;
    values.push_back(target - sent);
    sent = target;
  }
  return values;
}

} // namespace

Controller::Controller(SFSerialPort sfport) : sfport_(std::move(sfport)) {}
void Controller::bind_sfport(SFSerialPort sfport) { sfport_ = std::move(sfport); }
void Controller::open() { sfport_.open(); }
void Controller::close() { sfport_.close(); }
std::string Controller::compose_log_directory(const std::string &log_dir) const { return mkp::compose_log_directory(log_dir); }
std::string Controller::compose_log_fullpath(const std::string &log_path) const { return mkp::compose_log_fullpath(log_path); }
void Controller::start_record(const std::string &log_name, const LogOption &opt) { mkp::start_record(sfport_, log_name, opt); }
std::string Controller::stop_record() { return mkp::stop_record(sfport_); }
std::string Controller::alog(const std::string &log_name, const LogOption &opt, std::optional<int> timeout_ms) { return mkp::alog(sfport_, log_name, opt, timeout_ms); }
std::string Controller::astop(std::optional<int> timeout_ms) { return mkp::astop(sfport_, timeout_ms); }
nlohmann::json Controller::cancel(std::optional<int> timeout_ms) { return mkp::cancel(sfport_, timeout_ms); }
std::string Controller::join(const JoinOption &opt, std::optional<int> timeout_ms) { return mkp::join(sfport_, opt, timeout_ms); }
std::string Controller::wifi_auto(const WifiAutoOption &opt, std::optional<int> timeout_ms) { return mkp::wifi_auto(sfport_, opt, timeout_ms); }
SN Controller::device_sn(std::optional<int> timeout_ms) { return mkp::device_sn(sfport_, timeout_ms); }
FileSystem Controller::list_dir(const std::string &path, std::optional<int> timeout_ms) { return mkp::list_dir(sfport_, path, timeout_ms); }
std::string Controller::clean_dir(const std::string &path, std::optional<int> timeout_ms) { return mkp::clean_dir(sfport_, path, timeout_ms); }
std::string Controller::delete_file(const std::string &path, std::optional<int> timeout_ms) { return mkp::delete_file(sfport_, path, timeout_ms); }
Heartbeat Controller::alive(std::optional<int> timeout_ms) { return mkp::alive(sfport_, timeout_ms); }
LogLength Controller::atime(const std::string &path, std::optional<int> timeout_ms) { return mkp::atime(sfport_, path, timeout_ms); }
MKPVersion Controller::aversion(std::optional<int> timeout_ms) { return mkp::aversion(sfport_, timeout_ms); }
std::string Controller::aget(const AGetOption &opt, std::optional<int> timeout_ms) { return mkp::aupload_to_mkp(sfport_, opt, timeout_ms); }
std::string Controller::aput(const APutOption &opt, std::optional<int> timeout_ms) { return mkp::adownload_from_mkp(sfport_, opt, timeout_ms); }
std::string Controller::aupload_to_mkp(const AGetOption &opt, std::optional<int> timeout_ms) { return mkp::aupload_to_mkp(sfport_, opt, timeout_ms); }
std::string Controller::adownload_from_mkp(const APutOption &opt, std::optional<int> timeout_ms) { return mkp::adownload_from_mkp(sfport_, opt, timeout_ms); }
std::string Controller::ajson2log(const AJSON2LogOption &opt, std::optional<int> timeout_ms) { return mkp::ajson2log(sfport_, opt, timeout_ms); }
AHTTPBase Controller::ahttpbase(const AHTTPBaseOption &opt, std::optional<int> timeout_ms) { return mkp::ahttpbase(sfport_, opt, timeout_ms); }
ActionDump Controller::adumj(const std::string &log_path, std::optional<int> timeout_ms) { return mkp::adumj(sfport_, log_path, timeout_ms); }
LogInfo Controller::ainsp(const std::string &path, std::optional<int> timeout_ms) { return mkp::ainspect(sfport_, path, timeout_ms); }
LogInfo Controller::ainspect(const std::string &path, std::optional<int> timeout_ms) { return mkp::ainspect(sfport_, path, timeout_ms); }
void Controller::start_replaying(const std::string &log_name, int delay) { sfport_.start_replaying(log_name, delay); }
SerialPortStatus Controller::snapshot_status() const { return sfport_.snapshot_status(); }
void Controller::mouse_move(int x, int y, std::optional<M10Option> option) { auto next = option.value_or(M10Option{}); next.set_x(x).set_y(y); sfport_.mouse10(next); }
void Controller::mouse_release_all(std::optional<M10Option> option) { mkp::mouse_release_all(sfport_, option); }
void Controller::key_tap(const std::string &key, std::optional<KpadOption> option) { mkp::key_tap(sfport_, key, option); }
void Controller::key_down(const std::string &key, std::optional<KpadOption> option) { mkp::key_down(sfport_, key, option); }
void Controller::key_up(const std::string &key, std::optional<KpadOption> option) { mkp::key_up(sfport_, key, option); }
void Controller::key_presses(const std::vector<std::string> &keys, int sleep_ms, std::optional<KpadOption> option) { mkp::key_presses(sfport_, keys, sleep_ms, option); }
void Controller::keypad_release(std::optional<KpadOption> option) { mkp::keypad_release(sfport_, option); }
void Controller::keypad_release_all(std::optional<KpadOption> option) { mkp::keypad_release_all(sfport_, option); }
void Controller::type_text(const std::string &text, std::optional<KpadOption> option) { mkp::type_text(sfport_, text, option); }

void Controller::mouse_down(const std::string &button, std::optional<M10Option> option) {
  auto directive = base_m10_option(option).set_button(mouse_button_mask(button)).set_x(0).set_y(0);
  sfport_.mouse10(directive);
}

void Controller::mouse_up(std::optional<M10Option> option) { mkp::mouse_release_all(sfport_, option); }

void Controller::mouse_click(const std::string &button, bool twice, int sleep_interval_ms, std::optional<M10Option> option) {
  sfport_.mouse10(base_m10_option(option).set_button(mouse_button_mask(button)).set_x(0).set_y(0));
  mouse_release_all(option);
  if (!twice) return;
  std::this_thread::sleep_for(std::chrono::milliseconds(sleep_interval_ms > 0 ? sleep_interval_ms : DEFAULT_CLICK_SLEEP_MS));
  sfport_.mouse10(base_m10_option(option).set_button(mouse_button_mask(button)).set_x(0).set_y(0));
  mouse_release_all(option);
}

void Controller::mouse_scroll(const std::string &dir, int steps, int sleep_interval_ms, std::optional<M10Option> option) {
  if (steps <= 0) return;
  const auto wheel = dir == "up" ? 1 : -1;
  for (int index = 0; index < steps; ++index) {
    sfport_.mouse10(base_m10_option(option).set_x(0).set_y(0).set_wheel(wheel));
    std::this_thread::sleep_for(std::chrono::milliseconds(DEFAULT_M10_STEP_MS));
    mouse_release_all(option);
    if (index + 1 < steps) {
      std::this_thread::sleep_for(std::chrono::milliseconds(sleep_interval_ms > 0 ? sleep_interval_ms : DEFAULT_CLICK_SLEEP_MS));
    }
  }
}

void Controller::mouse_move_smooth(int rel_x, int rel_y, int duration_ms, std::optional<M10Option> option) {
  const auto steps = step_count(duration_ms, rel_x, rel_y);
  const auto xs = split_axis(rel_x, steps);
  const auto ys = split_axis(rel_y, steps);
  for (int index = 0; index < steps; ++index) {
    auto next = base_m10_option(option);
    next.set_x(xs[index]).set_y(ys[index]);
    if (option && option->button.has_value()) next.set_button(*option->button);
    if (option && option->wheel.has_value()) next.set_wheel(*option->wheel);
    sfport_.mouse10(next);
    std::this_thread::sleep_for(std::chrono::milliseconds(DEFAULT_M10_STEP_MS));
  }
}

} // namespace mkp
