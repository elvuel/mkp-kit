#pragma once

#include <memory>
#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "mkp/models.hpp"

namespace mkp {

class DirectiveTransport {
public:
  virtual ~DirectiveTransport() = default;
  virtual void open() {}
  virtual void close() {}
  virtual void send(const std::string &directive) = 0;
  virtual std::string send_and_receive(const std::string &directive, int timeout_ms) = 0;
  virtual bool is_open() const = 0;
  virtual std::vector<std::string> sent_directives() const { return {}; }
};

class DryRunTransport final : public DirectiveTransport {
public:
  void send(const std::string &directive) override;
  std::string send_and_receive(const std::string &directive, int timeout_ms) override;
  bool is_open() const override;
  std::vector<std::string> sent_directives() const override;

private:
  std::vector<std::string> sent_;
};

struct SerialPortOptions {
  std::string name = "COM3";
  std::string mouse_port_flag = "1";
  std::string keyboard_port_flag = "2";
  int sync_output_timeout_ms = 10000;
  int baud_rate = 115200;
  std::shared_ptr<DirectiveTransport> transport;
};

class Win32SerialTransport final : public DirectiveTransport {
public:
  explicit Win32SerialTransport(std::string path, int baud_rate = 115200);
  ~Win32SerialTransport() override;

  void open() override;
  void close() override;
  void send(const std::string &directive) override;
  std::string send_and_receive(const std::string &directive, int timeout_ms) override;
  bool is_open() const override;

private:
  std::string read_until_complete(const std::string &directive, int timeout_ms);
  std::string path_;
  int baud_rate_;
  void *handle_ = nullptr;
};

class SerialPort {
public:
  explicit SerialPort(SerialPortOptions options = {});
  virtual ~SerialPort() = default;

  std::string name;
  std::string mouse_port_flag;
  std::string keyboard_port_flag;
  int sync_output_timeout_ms;

  SerialPort &set_transport(std::shared_ptr<DirectiveTransport> transport);
  void open();
  void close();
  std::string send_directive(const std::string &directive, std::optional<int> timeout_ms = std::nullopt);
  void send_directive_async(const std::string &directive);
  std::string send_parsed_raw(const std::string &directive, std::optional<int> timeout_ms = std::nullopt);
  nlohmann::json send_parsed_json(const std::string &directive, std::optional<int> timeout_ms = std::nullopt);

  void start_recording(const std::string &args = {});
  std::string alog(const std::string &log_name, const LogOption &opt = {}, std::optional<int> timeout_ms = std::nullopt);
  void start_replaying(const std::string &log_name, int delay = 0);
  std::string stop_recording();
  nlohmann::json cancel_replay();
  void mouse10(const M10Option &opt);
  void keypad(KpadOption opt);

  SN sn(std::optional<int> timeout_ms = std::nullopt);
  Heartbeat alive(std::optional<int> timeout_ms = std::nullopt);
  MKPVersion aversion(std::optional<int> timeout_ms = std::nullopt);
  LogLength atime(const std::string &path, std::optional<int> timeout_ms = std::nullopt);
  LogInfo ainsp(const std::string &path, std::optional<int> timeout_ms = std::nullopt);
  FileSystem list_dir(const std::string &path, std::optional<int> timeout_ms = std::nullopt);
  std::string clean_dir(const std::string &path, std::optional<int> timeout_ms = std::nullopt);
  std::string delete_file(const std::string &path, std::optional<int> timeout_ms = std::nullopt);
  std::string join(const JoinOption &opt, std::optional<int> timeout_ms = std::nullopt);
  std::string wifi_auto(const WifiAutoOption &opt = {}, std::optional<int> timeout_ms = std::nullopt);
  AHTTPBase ahttpbase(const AHTTPBaseOption &opt = {}, std::optional<int> timeout_ms = std::nullopt);
  std::string aget(const AGetOption &opt, std::optional<int> timeout_ms = std::nullopt);
  std::string aput(const APutOption &opt, std::optional<int> timeout_ms = std::nullopt);
  ActionDump adumj(const std::string &path, std::optional<int> timeout_ms = std::nullopt);
  std::string ajson2log(const AJSON2LogOption &opt, std::optional<int> timeout_ms = std::nullopt);
  SerialPortStatus snapshot_status() const;

protected:
  std::shared_ptr<DirectiveTransport> transport_;
};

using SFSerialPort = SerialPort;

SFSerialPort new_sf_serial_port(const SerialPortOptions &options = {});
std::string check_sf_serial_port();
std::string compose_log_directory(const std::string &log_dir);
std::string compose_log_fullpath(const std::string &log_path);

void start_record(SFSerialPort &sfport, const std::string &log_name, const LogOption &opt = {});
std::string stop_record(SFSerialPort &sfport);
std::string alog(SFSerialPort &sfport, const std::string &log_name, const LogOption &opt = {}, std::optional<int> timeout_ms = std::nullopt);
std::string astop(SFSerialPort &sfport, std::optional<int> timeout_ms = std::nullopt);
nlohmann::json cancel(SFSerialPort &sfport, std::optional<int> timeout_ms = std::nullopt);
std::string join(SFSerialPort &sfport, const JoinOption &opt = {}, std::optional<int> timeout_ms = std::nullopt);
std::string wifi_auto(SFSerialPort &sfport, const WifiAutoOption &opt = {}, std::optional<int> timeout_ms = std::nullopt);
SN device_sn(SFSerialPort &sfport, std::optional<int> timeout_ms = std::nullopt);
FileSystem list_dir(SFSerialPort &sfport, const std::string &path, std::optional<int> timeout_ms = std::nullopt);
std::string clean_dir(SFSerialPort &sfport, const std::string &path, std::optional<int> timeout_ms = std::nullopt);
std::string delete_file(SFSerialPort &sfport, const std::string &path, std::optional<int> timeout_ms = std::nullopt);
Heartbeat alive(SFSerialPort &sfport, std::optional<int> timeout_ms = std::nullopt);
LogLength atime(SFSerialPort &sfport, const std::string &path, std::optional<int> timeout_ms = std::nullopt);
MKPVersion aversion(SFSerialPort &sfport, std::optional<int> timeout_ms = std::nullopt);
std::string aupload_to_mkp(SFSerialPort &sfport, const AGetOption &opt, std::optional<int> timeout_ms = std::nullopt);
std::string adownload_from_mkp(SFSerialPort &sfport, const APutOption &opt, std::optional<int> timeout_ms = std::nullopt);
std::string ajson2log(SFSerialPort &sfport, const AJSON2LogOption &opt, std::optional<int> timeout_ms = std::nullopt);
AHTTPBase ahttpbase(SFSerialPort &sfport, const AHTTPBaseOption &opt = {}, std::optional<int> timeout_ms = std::nullopt);
ActionDump adumj(SFSerialPort &sfport, const std::string &log_path, std::optional<int> timeout_ms = std::nullopt);
LogInfo ainspect(SFSerialPort &sfport, const std::string &path, std::optional<int> timeout_ms = std::nullopt);
void key_down(SFSerialPort &sfport, const std::string &key, const std::optional<KpadOption> &opt = std::nullopt);
void key_up(SFSerialPort &sfport, const std::string &key, const std::optional<KpadOption> &opt = std::nullopt);
void key_tap(SFSerialPort &sfport, const std::string &key, const std::optional<KpadOption> &opt = std::nullopt);
void key_presses(SFSerialPort &sfport, const std::vector<std::string> &keys, int sleep_ms = 0, const std::optional<KpadOption> &opt = std::nullopt);
void keypad_release(SFSerialPort &sfport, const std::optional<KpadOption> &opt = std::nullopt);
void keypad_release_all(SFSerialPort &sfport, const std::optional<KpadOption> &opt = std::nullopt);
void mouse_release_all(SFSerialPort &sfport, const std::optional<M10Option> &opt = std::nullopt);

} // namespace mkp
