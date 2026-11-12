#pragma once

#include <optional>
#include <string>
#include <vector>

#include "mkp/models.hpp"
#include "mkp/sdk.hpp"

namespace mkp {

class Controller {
public:
  explicit Controller(SFSerialPort sfport);

  void bind_sfport(SFSerialPort sfport);
  void open();
  void close();

  std::string compose_log_directory(const std::string &log_dir) const;
  std::string compose_log_fullpath(const std::string &log_path) const;
  void start_record(const std::string &log_name, const LogOption &opt = {});
  std::string stop_record();
  std::string alog(const std::string &log_name, const LogOption &opt = {}, std::optional<int> timeout_ms = std::nullopt);
  std::string astop(std::optional<int> timeout_ms = std::nullopt);
  nlohmann::json cancel(std::optional<int> timeout_ms = std::nullopt);
  std::string join(const JoinOption &opt, std::optional<int> timeout_ms = std::nullopt);
  std::string wifi_auto(const WifiAutoOption &opt = {}, std::optional<int> timeout_ms = std::nullopt);
  SN device_sn(std::optional<int> timeout_ms = std::nullopt);
  FileSystem list_dir(const std::string &path, std::optional<int> timeout_ms = std::nullopt);
  std::string clean_dir(const std::string &path, std::optional<int> timeout_ms = std::nullopt);
  std::string delete_file(const std::string &path, std::optional<int> timeout_ms = std::nullopt);
  Heartbeat alive(std::optional<int> timeout_ms = std::nullopt);
  LogLength atime(const std::string &path, std::optional<int> timeout_ms = std::nullopt);
  MKPVersion aversion(std::optional<int> timeout_ms = std::nullopt);
  std::string aget(const AGetOption &opt, std::optional<int> timeout_ms = std::nullopt);
  std::string aput(const APutOption &opt, std::optional<int> timeout_ms = std::nullopt);
  std::string aupload_to_mkp(const AGetOption &opt, std::optional<int> timeout_ms = std::nullopt);
  std::string adownload_from_mkp(const APutOption &opt, std::optional<int> timeout_ms = std::nullopt);
  std::string ajson2log(const AJSON2LogOption &opt, std::optional<int> timeout_ms = std::nullopt);
  AHTTPBase ahttpbase(const AHTTPBaseOption &opt = {}, std::optional<int> timeout_ms = std::nullopt);
  ActionDump adumj(const std::string &log_path, std::optional<int> timeout_ms = std::nullopt);
  LogInfo ainsp(const std::string &path, std::optional<int> timeout_ms = std::nullopt);
  LogInfo ainspect(const std::string &path, std::optional<int> timeout_ms = std::nullopt);
  void start_replaying(const std::string &log_name, int delay = 0);
  SerialPortStatus snapshot_status() const;
  void mouse_move(int x, int y, std::optional<M10Option> option = std::nullopt);
  void mouse_release_all(std::optional<M10Option> option = std::nullopt);
  void key_tap(const std::string &key, std::optional<KpadOption> option = std::nullopt);
  void key_down(const std::string &key, std::optional<KpadOption> option = std::nullopt);
  void key_up(const std::string &key, std::optional<KpadOption> option = std::nullopt);
  void key_presses(const std::vector<std::string> &keys, int sleep_ms = 0, std::optional<KpadOption> option = std::nullopt);
  void keypad_release(std::optional<KpadOption> option = std::nullopt);
  void keypad_release_all(std::optional<KpadOption> option = std::nullopt);
  void type_text(const std::string &text, std::optional<KpadOption> option = std::nullopt);
  void mouse_down(const std::string &button, std::optional<M10Option> option = std::nullopt);
  void mouse_up(std::optional<M10Option> option = std::nullopt);
  void mouse_click(const std::string &button, bool twice = false, int sleep_interval_ms = 0, std::optional<M10Option> option = std::nullopt);
  void mouse_scroll(const std::string &dir, int steps, int sleep_interval_ms = 0, std::optional<M10Option> option = std::nullopt);
  void mouse_move_smooth(int rel_x, int rel_y, int duration_ms = 0, std::optional<M10Option> option = std::nullopt);

private:
  SFSerialPort sfport_;
};

} // namespace mkp
