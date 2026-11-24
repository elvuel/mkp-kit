#include "mkp/models.hpp"

#include <algorithm>
#include <mutex>
#include <sstream>

#include "mkp/keycodes.hpp"

namespace mkp {

namespace {

std::mutex g_kpad_mutex;
std::vector<std::string> g_pressed_mod_keys;
std::vector<std::string> g_pressed_keys;

void append_once(std::vector<std::string> &items, const std::string &value) {
  if (std::find(items.begin(), items.end(), value) == items.end()) {
    items.push_back(value);
  }
}

void remove_once(std::vector<std::string> &items, const std::string &value) {
  const auto it = std::find(items.begin(), items.end(), value);
  if (it != items.end()) {
    items.erase(it);
  }
}

std::array<std::string, 6> empty_keys() {
  return {"", "", "", "", "", ""};
}

template <typename T>
void push_if(std::vector<std::string> &args, const std::string &flag, const std::optional<T> &value) {
  if (value.has_value()) {
    args.push_back(flag);
    args.push_back(std::to_string(*value));
  }
}

} // namespace

std::vector<std::string> LogOption::cli_args() const {
  std::vector<std::string> args;
  if (width > 0) {
    args.insert(args.end(), {"--width", std::to_string(width)});
  }
  if (height > 0) {
    args.insert(args.end(), {"--height", std::to_string(height)});
  }
  if (stposx > -1) {
    args.insert(args.end(), {"--stposx", std::to_string(stposx)});
  }
  if (stposy > -1) {
    args.insert(args.end(), {"--stposy", std::to_string(stposy)});
  }
  return args;
}

std::vector<std::string> JoinOption::cli_args() const {
  std::vector<std::string> args;
  if (!ssid.empty()) {
    args.push_back(ssid);
  }
  if (!password.empty()) {
    args.push_back(password);
  }
  return args;
}

std::vector<std::string> WifiAutoOption::cli_args() const { return state.empty() ? std::vector<std::string>{} : std::vector<std::string>{state}; }
std::vector<std::string> AGetOption::cli_args() const { return filepath.empty() ? std::vector<std::string>{} : std::vector<std::string>{filepath}; }
std::vector<std::string> APutOption::cli_args() const { return filepath.empty() ? std::vector<std::string>{} : std::vector<std::string>{filepath}; }

std::vector<std::string> AJSON2LogOption::cli_args() const {
  std::vector<std::string> args;
  if (!jsonpath.empty()) {
    args.push_back(jsonpath);
  }
  if (!savepath.empty()) {
    args.insert(args.end(), {"-o", savepath});
  }
  return args;
}

std::vector<std::string> AHTTPBaseOption::cli_args() const { return ahttpbase.empty() ? std::vector<std::string>{} : std::vector<std::string>{ahttpbase}; }

int mouse_button_mask(const std::string &name) {
  std::string normalized;
  normalized.reserve(name.size());
  for (char ch : name) {
    normalized.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(ch))));
  }
  if (normalized == "left") return 1;
  if (normalized == "right") return 2;
  if (normalized == "both") return 3;
  if (normalized == "middle") return 4;
  if (normalized == "backward" || normalized == "backword") return 8;
  if (normalized == "forward" || normalized == "forword") return 16;
  return 0;
}

MouseMoveOffset &MouseMoveOffset::with_wheel(int value) {
  wheel = value;
  return *this;
}
MouseMoveOffset &MouseMoveOffset::without_wheel() {
  wheel.reset();
  return *this;
}
MouseMoveOffset &MouseMoveOffset::with_pause(int pause_ms) {
  pause = pause_ms;
  return *this;
}
MouseMoveOffset &MouseMoveOffset::without_pause() {
  pause.reset();
  return *this;
}
MouseMoveOffset &MouseMoveOffset::with_button(const std::string &button_name) {
  button = mouse_button_mask(button_name);
  return *this;
}
MouseMoveOffset &MouseMoveOffset::with_button_mask(int mask) {
  button = mask;
  return *this;
}
MouseMoveOffset &MouseMoveOffset::without_button() {
  button = 0;
  return *this;
}

M10Option &M10Option::set_button(int value) { button = value; return *this; }
M10Option &M10Option::with_button(int value) { return set_button(value); }
M10Option &M10Option::without_button() { button.reset(); return *this; }
M10Option &M10Option::set_x(int value) { x = value; return *this; }
M10Option &M10Option::set_y(int value) { y = value; return *this; }
M10Option &M10Option::set_wheel(int value) { wheel = value; return *this; }
M10Option &M10Option::with_async(bool value) { async_mode = value; sync_ignore_output = !value; return *this; }
M10Option &M10Option::with_sync_ignore_output(bool value) { sync_ignore_output = value; async_mode = !value; return *this; }
M10Option &M10Option::with_sync_output_timeout(int timeout_ms) { sync_output_timeout_ms = timeout_ms; return *this; }
bool M10Option::is_async() const { return async_mode && !sync_ignore_output; }

std::string M10Option::to_cli_fragment() const {
  std::vector<std::string> args;
  push_if(args, "--b", button);
  push_if(args, "--x", x);
  push_if(args, "--y", y);
  push_if(args, "--w", wheel);
  std::ostringstream out;
  for (std::size_t i = 0; i < args.size(); ++i) {
    if (i > 0) out << ' ';
    out << args[i];
  }
  return out.str();
}

KpadOption &KpadOption::with_keys(const std::vector<std::string> &value) {
  const auto [mods, normals] = split_keys(value);
  mod_keys = mods;
  keys = empty_keys();
  for (std::size_t i = 0; i < normals.size() && i < keys.size(); ++i) {
    keys[i] = normalize_kpad_key(normals[i]);
  }
  return *this;
}

KpadOption &KpadOption::with_key(const std::string &key) {
  keys = empty_keys();
  keys[0] = normalize_kpad_key(key);
  return *this;
}

KpadOption &KpadOption::with_mod_keys(const std::vector<std::string> &value) { mod_keys = value; return *this; }
KpadOption &KpadOption::with_delay(int value) { delay = value; return *this; }
KpadOption &KpadOption::with_release(int value) { release = value; return *this; }
KpadOption &KpadOption::with_hold() { release = 0; return *this; }
KpadOption &KpadOption::with_auto_release() { release = 1; return *this; }
KpadOption &KpadOption::with_duration(int value) { if (value > 1) release = value; return *this; }
KpadOption &KpadOption::with_verbose(bool value) { verbose = value; return *this; }
KpadOption &KpadOption::with_async(bool value) { async_mode = value; sync_ignore_output = !value; return *this; }
KpadOption &KpadOption::with_sync_ignore_output(bool value) { sync_ignore_output = value; async_mode = !value; return *this; }
KpadOption &KpadOption::with_sync_output_timeout(int timeout_ms) { sync_output_timeout_ms = timeout_ms; return *this; }
bool KpadOption::is_async() const { return async_mode && !sync_ignore_output; }

std::string KpadOption::to_cli_fragment() const {
  std::vector<std::string> args;
  const auto status = mod_status(mod_keys);
  if (!status.empty()) {
    args.insert(args.end(), {"--s", status});
  }
  for (std::size_t i = 0; i < keys.size(); ++i) {
    if (keys[i].empty()) continue;
    const auto code = key_name_to_hexcode(keys[i]);
    if (code.empty()) {
      throw std::runtime_error("unknown key name: " + keys[i]);
    }
    args.insert(args.end(), {"--x" + std::to_string(i + 1), code});
  }
  args.insert(args.end(), {"--rel", std::to_string(release), "--d", std::to_string(delay)});
  if (verbose) {
    args.insert(args.end(), {"--v", "1"});
  }
  std::ostringstream out;
  for (std::size_t i = 0; i < args.size(); ++i) {
    if (i > 0) out << ' ';
    out << args[i];
  }
  return out.str();
}

KpadOption &KpadOption::key_down(const std::string &key) {
  const auto commit = expand_kpad_input_key(key);
  if (commit.empty()) {
    return *this;
  }
  std::lock_guard<std::mutex> lock(g_kpad_mutex);
  auto next_mod = g_pressed_mod_keys;
  auto next_keys = g_pressed_keys;
  for (const auto &item : commit) {
    if (is_mod_key(item)) {
      append_once(next_mod, item);
    } else {
      append_once(next_keys, item);
    }
  }
  with_keys([&] {
    auto all = next_mod;
    all.insert(all.end(), next_keys.begin(), next_keys.end());
    return all;
  }());
  with_mod_keys(next_mod).with_hold();
  commit_keys_ = commit;
  commit_is_down_ = true;
  return *this;
}

std::pair<std::optional<KpadOption>, std::optional<KpadOption>> KpadOption::key_up(const std::string &key) const {
  const auto release_keys = expand_kpad_input_key(key);
  if (release_keys.empty()) {
    return {std::nullopt, std::nullopt};
  }
  std::lock_guard<std::mutex> lock(g_kpad_mutex);
  auto release_mod = g_pressed_mod_keys;
  auto next_mod = g_pressed_mod_keys;
  auto next_keys = g_pressed_keys;
  for (const auto &item : release_keys) {
    if (is_mod_key(item)) {
      remove_once(next_mod, item);
    } else {
      remove_once(next_keys, item);
    }
  }

  KpadOption release_opt;
  release_opt.with_delay(delay).with_verbose(verbose).with_async(async_mode).with_keys(release_keys).with_auto_release();
  release_opt.sync_ignore_output = sync_ignore_output;
  release_opt.sync_output_timeout_ms = sync_output_timeout_ms;
  if (std::any_of(release_keys.begin(), release_keys.end(), [](const auto &value) { return is_mod_key(value); })) {
    release_opt.with_mod_keys(release_mod);
  }

  KpadOption remain_opt;
  remain_opt.with_delay(delay).with_verbose(verbose).with_async(async_mode);
  remain_opt.sync_ignore_output = sync_ignore_output;
  remain_opt.sync_output_timeout_ms = sync_output_timeout_ms;
  auto remain = next_mod;
  remain.insert(remain.end(), next_keys.begin(), next_keys.end());
  if (!remain.empty()) {
    remain_opt.with_keys(remain);
    if (std::any_of(release_keys.begin(), release_keys.end(), [](const auto &value) { return is_mod_key(value); })) {
      remain_opt.with_mod_keys(next_mod);
    }
  } else {
    remain_opt.with_key("NONE").with_hold();
  }
  remain_opt.commit_keys_ = release_keys;
  remain_opt.commit_is_down_ = false;
  return {release_opt, remain_opt};
}

void KpadOption::commit_state() {
  std::lock_guard<std::mutex> lock(g_kpad_mutex);
  for (const auto &item : commit_keys_) {
    if (is_mod_key(item)) {
      if (commit_is_down_) append_once(g_pressed_mod_keys, item); else remove_once(g_pressed_mod_keys, item);
    } else {
      if (commit_is_down_) append_once(g_pressed_keys, item); else remove_once(g_pressed_keys, item);
    }
  }
  commit_keys_.clear();
}

void reset_kpad_pressed_caches() {
  std::lock_guard<std::mutex> lock(g_kpad_mutex);
  g_pressed_mod_keys.clear();
  g_pressed_keys.clear();
}

void from_json(const nlohmann::json &j, SN &value) { value.sn = j.value("sn", ""); }
void to_json(nlohmann::json &j, const SN &value) { j = nlohmann::json{{"sn", value.sn}}; }
void from_json(const nlohmann::json &j, Heartbeat &value) { value.timetamp = j.value("timetamp", 0LL); }
void to_json(nlohmann::json &j, const Heartbeat &value) { j = nlohmann::json{{"timetamp", value.timetamp}}; }
void from_json(const nlohmann::json &j, MKPVersion &value) {
  if (j.contains("app")) value.app = j["app"].get<std::string>();
  if (j.contains("boot")) value.boot = j["boot"].get<std::string>();
  if (j.contains("hw")) value.hw = j["hw"].get<std::string>();
  if (j.contains("aver") && !value.app) value.app = j["aver"].get<std::string>();
  if (j.contains("uver") && !value.boot) value.boot = j["uver"].get<std::string>();
  value.raw = j;
}
void to_json(nlohmann::json &j, const MKPVersion &value) {
  j = value.raw.is_null() ? nlohmann::json::object() : value.raw;
  if (value.app) j["app"] = *value.app;
  if (value.boot) j["boot"] = *value.boot;
  if (value.hw) j["hw"] = *value.hw;
}
void from_json(const nlohmann::json &j, LogLength &value) { value.seconds = j.value("seconds", 0); value.milsec = j.value("milsec", 0); }
void to_json(nlohmann::json &j, const LogLength &value) { j = nlohmann::json{{"seconds", value.seconds}, {"milsec", value.milsec}}; }
void from_json(const nlohmann::json &j, LogInfo &value) {
  value.name = j.contains("name") ? std::optional<std::string>(j["name"].get<std::string>()) : std::nullopt;
  value.path = j.contains("path") ? std::optional<std::string>(j["path"].get<std::string>()) : std::nullopt;
  value.size = j.value("size", 0);
  value.seconds = j.value("seconds", 0);
  value.milsec = j.value("milsec", 0);
  value.width = j.value("width", 0);
  value.heigh = j.value("heigh", 0);
  value.stpos = j.contains("stpos") ? j["stpos"] : nlohmann::json::object();
  value.raw = j;
}
void to_json(nlohmann::json &j, const LogInfo &value) {
  j = value.raw.is_null() ? nlohmann::json::object() : value.raw;
  if (value.name) j["name"] = *value.name;
  if (value.path) j["path"] = *value.path;
  j["size"] = value.size;
  j["seconds"] = value.seconds;
  j["milsec"] = value.milsec;
  j["width"] = value.width;
  j["heigh"] = value.heigh;
  j["stpos"] = value.stpos;
}
void from_json(const nlohmann::json &j, AHTTPBase &value) { value.ahttpbase = j.value("ahttpbase", ""); }
void to_json(nlohmann::json &j, const AHTTPBase &value) { j = nlohmann::json{{"ahttpbase", value.ahttpbase}}; }
void from_json(const nlohmann::json &j, FileNode &value) {
  value.name = j.value("name", "");
  value.path = j.value("path", "");
  value.type = j.value("type", "");
  value.size = j.value("size", 0);
  value.display_name = j.value("displayName", "");
  value.contents.clear();
  if (j.contains("contents") && j["contents"].is_array()) {
    value.contents = j["contents"].get<std::vector<FileNode>>();
  }
}
void to_json(nlohmann::json &j, const FileNode &value) {
  j = nlohmann::json{{"name", value.name}, {"path", value.path}, {"type", value.type}, {"size", value.size}, {"displayName", value.display_name}, {"contents", value.contents}};
}
void from_json(const nlohmann::json &j, FileSystem &value) {
  if (j.contains("rootDir") && j["rootDir"].is_object()) {
    value.root_dir = j["rootDir"].get<FileNode>();
  }
  value.error = j.value("error", "");
  value.raw = j;
}
void to_json(nlohmann::json &j, const FileSystem &value) {
  j = value.raw.is_null() ? nlohmann::json::object() : value.raw;
  if (value.root_dir) j["rootDir"] = *value.root_dir;
  j["error"] = value.error;
}
void from_json(const nlohmann::json &j, ActionDump &value) {
  value.actions = j.contains("actions") ? j["actions"] : (j.contains("events") ? j["events"] : nlohmann::json::array());
  value.meta = j.contains("meta") ? j["meta"] : nlohmann::json::object();
  value.raw = j;
}
void to_json(nlohmann::json &j, const ActionDump &value) {
  j = value.raw.is_null() ? nlohmann::json::object() : value.raw;
  j["actions"] = value.actions;
  j["meta"] = value.meta;
}

} // namespace mkp
