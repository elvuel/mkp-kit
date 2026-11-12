#pragma once

#include <array>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include <nlohmann/json.hpp>

namespace mkp {

struct SN {
  std::string sn;
};

struct Heartbeat {
  long long timetamp = 0;
};

struct MKPVersion {
  std::optional<std::string> app;
  std::optional<std::string> boot;
  std::optional<std::string> hw;
  nlohmann::json raw;
};

struct LogLength {
  int seconds = 0;
  int milsec = 0;
};

struct LogInfo {
  std::optional<std::string> name;
  std::optional<std::string> path;
  int size = 0;
  int seconds = 0;
  int milsec = 0;
  int width = 0;
  int heigh = 0;
  nlohmann::json stpos;
  nlohmann::json raw;
};

struct AHTTPBase {
  std::string ahttpbase;
};

struct FileNode {
  std::string name;
  std::string path;
  std::string type;
  int size = 0;
  std::string display_name;
  std::vector<FileNode> contents;
};

struct FileSystem {
  std::optional<FileNode> root_dir;
  std::string error;
  nlohmann::json raw;
};

struct ActionDump {
  nlohmann::json actions;
  nlohmann::json meta;
  nlohmann::json raw;
};

struct SerialPortStatus {
  std::string name;
  bool port_open = false;
  int sync_output_timeout_ms = 10000;
  bool transport_configured = false;
};

struct LogOption {
  int width = 0;
  int height = 0;
  int stposx = -1;
  int stposy = -1;
  std::vector<std::string> cli_args() const;
};

struct JoinOption {
  std::string ssid;
  std::string password;
  std::vector<std::string> cli_args() const;
};

struct WifiAutoOption {
  std::string state;
  std::vector<std::string> cli_args() const;
};

struct AGetOption {
  std::string filepath;
  std::vector<std::string> cli_args() const;
};

struct APutOption {
  std::string filepath;
  std::vector<std::string> cli_args() const;
};

struct AJSON2LogOption {
  std::string jsonpath;
  std::string savepath;
  std::vector<std::string> cli_args() const;
};

struct AHTTPBaseOption {
  std::string ahttpbase;
  std::vector<std::string> cli_args() const;
};

int mouse_button_mask(const std::string &name);

struct MouseMoveOffset {
  int x = 0;
  int y = 0;
  std::optional<int> wheel;
  std::optional<int> button;
  std::optional<int> pause;

  MouseMoveOffset &with_wheel(int value);
  MouseMoveOffset &without_wheel();
  MouseMoveOffset &with_pause(int pause_ms);
  MouseMoveOffset &without_pause();
  MouseMoveOffset &with_button(const std::string &button_name);
  MouseMoveOffset &with_button_mask(int mask);
  MouseMoveOffset &without_button();
};

struct M10Option {
  std::optional<int> button;
  std::optional<int> x;
  std::optional<int> y;
  std::optional<int> wheel;
  bool async_mode = true;
  bool sync_ignore_output = false;

  M10Option &set_button(int value);
  M10Option &with_button(int value);
  M10Option &without_button();
  M10Option &set_x(int value);
  M10Option &set_y(int value);
  M10Option &set_wheel(int value);
  M10Option &with_async(bool value);
  M10Option &with_sync_ignore_output(bool value);
  bool is_async() const;
  std::string to_cli_fragment() const;
};

struct KpadOption {
  std::vector<std::string> mod_keys;
  std::array<std::string, 6> keys{};
  int release = 0;
  int delay = 0;
  bool verbose = false;
  bool async_mode = true;
  bool sync_ignore_output = false;

  KpadOption &with_keys(const std::vector<std::string> &value);
  KpadOption &with_key(const std::string &key);
  KpadOption &with_mod_keys(const std::vector<std::string> &value);
  KpadOption &with_delay(int value);
  KpadOption &with_release(int value);
  KpadOption &with_hold();
  KpadOption &with_auto_release();
  KpadOption &with_duration(int value);
  KpadOption &with_verbose(bool value);
  KpadOption &with_async(bool value);
  KpadOption &with_sync_ignore_output(bool value);
  bool is_async() const;
  std::string to_cli_fragment() const;
  KpadOption &key_down(const std::string &key);
  std::pair<std::optional<KpadOption>, std::optional<KpadOption>> key_up(const std::string &key) const;
  void commit_state();

private:
  std::vector<std::string> commit_keys_;
  bool commit_is_down_ = false;
};

void reset_kpad_pressed_caches();

void from_json(const nlohmann::json &j, SN &value);
void to_json(nlohmann::json &j, const SN &value);
void from_json(const nlohmann::json &j, Heartbeat &value);
void to_json(nlohmann::json &j, const Heartbeat &value);
void from_json(const nlohmann::json &j, MKPVersion &value);
void to_json(nlohmann::json &j, const MKPVersion &value);
void from_json(const nlohmann::json &j, LogLength &value);
void to_json(nlohmann::json &j, const LogLength &value);
void from_json(const nlohmann::json &j, LogInfo &value);
void to_json(nlohmann::json &j, const LogInfo &value);
void from_json(const nlohmann::json &j, AHTTPBase &value);
void to_json(nlohmann::json &j, const AHTTPBase &value);
void from_json(const nlohmann::json &j, FileNode &value);
void to_json(nlohmann::json &j, const FileNode &value);
void from_json(const nlohmann::json &j, FileSystem &value);
void to_json(nlohmann::json &j, const FileSystem &value);
void from_json(const nlohmann::json &j, ActionDump &value);
void to_json(nlohmann::json &j, const ActionDump &value);

} // namespace mkp
