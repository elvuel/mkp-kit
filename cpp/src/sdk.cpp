#include "mkp/sdk.hpp"

#include <chrono>
#include <cctype>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <sstream>
#include <utility>
#include "mkp/fs.hpp"
#include <stdexcept>
#include <thread>

#include "mkp/debug.hpp"
#include "mkp/error.hpp"
#include "mkp/parser.hpp"

#if defined(_WIN32)
#include <setupapi.h>
#include <windows.h>
#include <winreg.h>
#pragma comment(lib, "setupapi.lib")
#endif

namespace mkp {

namespace {

std::string join_args(const std::vector<std::string> &args) {
  std::ostringstream out;
  for (std::size_t i = 0; i < args.size(); ++i) {
    if (i > 0) out << ' ';
    out << args[i];
  }
  return out.str();
}

std::string build_alog_directive(const std::string &log_name, const LogOption &opt) {
  std::vector<std::string> args{compose_log_fullpath(log_name)};
  const auto extra = opt.cli_args();
  args.insert(args.end(), extra.begin(), extra.end());
  return "alog " + join_args(args);
}

std::string normalize_directive_label(const std::string &directive) {
  if (directive.rfind("alog", 0) == 0) return "alog";
  return directive;
}

std::string resolve_directive_eof_flag(const std::string &directive) {
  try {
    return get_raw_directive_output_parser(directive).eof_flag;
  } catch (...) {
    return EOF_CLI;
  }
}

std::string read_env_port() {
  if (const char *env = std::getenv("MKP_SFPORT"); env && *env) {
    return env;
  }
  if (const char *env = std::getenv("MKP_SF_PORT"); env && *env) {
    return env;
  }
  return {};
}

#if defined(_WIN32)
std::string win32_port_name(const std::string &path) {
  if (path.rfind("\\\\.\\", 0) == 0) return path;
  return path.size() > 4 ? "\\\\.\\" + path : path;
}

HANDLE require_handle(void *handle) {
  const auto native = static_cast<HANDLE>(handle);
  if (!native || native == INVALID_HANDLE_VALUE) {
    throw MkpError("serial handle not open");
  }
  return native;
}

std::string ascii_upper(std::string value) {
  for (auto &ch : value) ch = static_cast<char>(std::toupper(static_cast<unsigned char>(ch)));
  return value;
}

std::optional<std::string> extract_com_name(const std::string &text) {
  const auto upper = ascii_upper(text);
  const auto start = upper.rfind("(COM");
  if (start == std::string::npos) return std::nullopt;
  const auto end = upper.find(')', start);
  if (end == std::string::npos || end <= start + 1) return std::nullopt;
  return text.substr(start + 1, end - start - 1);
}

std::optional<std::string> get_device_property_string(HDEVINFO info, SP_DEVINFO_DATA &data, DWORD property) {
  DWORD type = 0;
  DWORD size = 0;
  SetupDiGetDeviceRegistryPropertyA(info, &data, property, &type, nullptr, 0, &size);
  if (size == 0) return std::nullopt;
  std::string buffer(size, '\0');
  if (!SetupDiGetDeviceRegistryPropertyA(info, &data, property, &type, reinterpret_cast<PBYTE>(&buffer[0]), size, nullptr)) {
    return std::nullopt;
  }
  buffer.resize(std::strlen(buffer.c_str()));
  return buffer;
}

std::vector<std::string> get_device_property_multi_string(HDEVINFO info, SP_DEVINFO_DATA &data, DWORD property) {
  DWORD type = 0;
  DWORD size = 0;
  SetupDiGetDeviceRegistryPropertyA(info, &data, property, &type, nullptr, 0, &size);
  if (size == 0) return {};
  std::vector<char> buffer(size, '\0');
  if (!SetupDiGetDeviceRegistryPropertyA(info, &data, property, &type, reinterpret_cast<PBYTE>(buffer.data()), size, nullptr)) {
    return {};
  }
  std::vector<std::string> values;
  const char *cursor = buffer.data();
  while (*cursor) {
    values.emplace_back(cursor);
    cursor += std::strlen(cursor) + 1;
  }
  return values;
}

std::optional<std::string> get_device_port_name(HDEVINFO info, SP_DEVINFO_DATA &data) {
  if (const auto friendly = get_device_property_string(info, data, SPDRP_FRIENDLYNAME)) {
    if (const auto com = extract_com_name(*friendly)) return com;
  }

  HKEY key = SetupDiOpenDevRegKey(info, &data, DICS_FLAG_GLOBAL, 0, DIREG_DEV, KEY_QUERY_VALUE);
  if (key == INVALID_HANDLE_VALUE) return std::nullopt;
  char buffer[256]{};
  DWORD type = 0;
  DWORD size = sizeof(buffer);
  const auto status = RegQueryValueExA(key, "PortName", nullptr, &type, reinterpret_cast<LPBYTE>(buffer), &size);
  RegCloseKey(key);
  if (status != ERROR_SUCCESS || type != REG_SZ || buffer[0] == '\0') return std::nullopt;
  return std::string(buffer);
}

std::optional<std::string> detect_mkp_port_windows() {
  HDEVINFO info = SetupDiGetClassDevsA(nullptr, "USB", nullptr, DIGCF_ALLCLASSES | DIGCF_PRESENT);
  if (info == INVALID_HANDLE_VALUE) return std::nullopt;

  SP_DEVINFO_DATA data{};
  data.cbSize = sizeof(data);
  for (DWORD index = 0; SetupDiEnumDeviceInfo(info, index, &data); ++index) {
    const auto hardware_ids = get_device_property_multi_string(info, data, SPDRP_HARDWAREID);
    bool match = false;
    for (const auto &id : hardware_ids) {
      const auto upper = ascii_upper(id);
      if (upper.find("VID_1A86") != std::string::npos && upper.find("PID_55D3") != std::string::npos) {
        match = true;
        break;
      }
    }
    if (!match) continue;
    if (const auto port = get_device_port_name(info, data)) {
      SetupDiDestroyDeviceInfoList(info);
      return port;
    }
  }

  SetupDiDestroyDeviceInfoList(info);
  return std::nullopt;
}

std::vector<std::string> list_openable_ports_windows() {
  std::vector<std::string> ports;
  for (int index = 1; index <= 32; ++index) {
    const auto port = "COM" + std::to_string(index);
    const auto full = win32_port_name(port);
    HANDLE handle = CreateFileA(full.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, 0, nullptr);
    if (handle != INVALID_HANDLE_VALUE) {
      CloseHandle(handle);
      ports.push_back(port);
    }
  }
  return ports;
}
#endif

template <typename T>
T from_directive_json(const std::string &directive, const std::string &raw) {
  return parse_directive_output_json(directive, raw).get<T>();
}

} // namespace

void DryRunTransport::send(const std::string &directive) { sent_.push_back(directive); }
std::string DryRunTransport::send_and_receive(const std::string &directive, int) {
  sent_.push_back(directive);
  return directive + "\ncli>";
}
bool DryRunTransport::is_open() const { return true; }
std::vector<std::string> DryRunTransport::sent_directives() const { return sent_; }

Win32SerialTransport::Win32SerialTransport(std::string path, int baud_rate) : path_(std::move(path)), baud_rate_(baud_rate) {}
Win32SerialTransport::~Win32SerialTransport() { close(); }

void Win32SerialTransport::open() {
#if defined(_WIN32)
  if (is_open()) return;
  const auto full_path = win32_port_name(path_);
  HANDLE handle = CreateFileA(full_path.c_str(), GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING, 0, nullptr);
  if (handle == INVALID_HANDLE_VALUE) {
    throw MkpError("failed to open serial port: " + path_);
  }
  DCB dcb{};
  dcb.DCBlength = sizeof(dcb);
  if (!GetCommState(handle, &dcb)) {
    CloseHandle(handle);
    throw MkpError("failed to read serial state: " + path_);
  }
  dcb.BaudRate = static_cast<DWORD>(baud_rate_);
  dcb.ByteSize = 8;
  dcb.StopBits = ONESTOPBIT;
  dcb.Parity = NOPARITY;
  if (!SetCommState(handle, &dcb)) {
    CloseHandle(handle);
    throw MkpError("failed to configure serial port: " + path_);
  }
  COMMTIMEOUTS timeouts{};
  timeouts.ReadIntervalTimeout = 50;
  timeouts.ReadTotalTimeoutConstant = 50;
  timeouts.ReadTotalTimeoutMultiplier = 1;
  timeouts.WriteTotalTimeoutConstant = 50;
  timeouts.WriteTotalTimeoutMultiplier = 1;
  SetCommTimeouts(handle, &timeouts);
  PurgeComm(handle, PURGE_RXCLEAR | PURGE_TXCLEAR);
  handle_ = handle;
#else
  throw MkpError("Win32 serial transport is only implemented on Windows");
#endif
}

void Win32SerialTransport::close() {
#if defined(_WIN32)
  if (!is_open()) return;
  CloseHandle(static_cast<HANDLE>(handle_));
  handle_ = nullptr;
#endif
}

bool Win32SerialTransport::is_open() const {
#if defined(_WIN32)
  return handle_ && static_cast<HANDLE>(handle_) != INVALID_HANDLE_VALUE;
#else
  return false;
#endif
}

void Win32SerialTransport::send(const std::string &directive) {
#if defined(_WIN32)
  open();
  const auto handle = require_handle(handle_);
  PurgeComm(handle, PURGE_TXCLEAR);
  const auto payload = directive + "\r\n";
  DWORD written = 0;
  if (!WriteFile(handle, payload.data(), static_cast<DWORD>(payload.size()), &written, nullptr)) {
    throw MkpError("failed to write serial directive");
  }
  FlushFileBuffers(handle);
#else
  (void)directive;
  throw MkpError("Win32 serial transport is only implemented on Windows");
#endif
}

std::string Win32SerialTransport::read_until_complete(const std::string &directive, int timeout_ms) {
#if defined(_WIN32)
  const auto handle = require_handle(handle_);
  PurgeComm(handle, PURGE_RXCLEAR);
  const auto payload = directive + "\r\n";
  DWORD written = 0;
  if (!WriteFile(handle, payload.data(), static_cast<DWORD>(payload.size()), &written, nullptr)) {
    throw MkpError("failed to write serial directive");
  }
  FlushFileBuffers(handle);

  std::string buffer;
  const auto eof_flag = resolve_directive_eof_flag(normalize_directive_label(directive));
  const auto started = std::chrono::steady_clock::now();
  char chunk[256];
  for (;;) {
    DWORD read = 0;
    if (!ReadFile(handle, chunk, sizeof(chunk), &read, nullptr)) {
      throw MkpError("failed to read serial response");
    }
    if (read > 0) {
      buffer.append(chunk, chunk + read);
      const auto hit = buffer.find(normalize_directive_label(directive));
      if (hit != std::string::npos) {
        const auto segment = buffer.substr(hit);
        if (eof_flag == EOF_CLI) {
          if (segment.find(EOF_CLI) != std::string::npos) return segment;
        } else if (segment.find(EOF_DEFAULT) != std::string::npos || segment.find(EOF_CLI) != std::string::npos) {
          return segment;
        }
      }
    }
    const auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now() - started).count();
    if (elapsed >= timeout_ms) {
      write_debug_capture("timeout", directive, buffer, buffer);
      throw DirectiveTimeoutError(directive, timeout_ms, path_);
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(10));
  }
#else
  (void)directive;
  (void)timeout_ms;
  throw MkpError("Win32 serial transport is only implemented on Windows");
#endif
}

std::string Win32SerialTransport::send_and_receive(const std::string &directive, int timeout_ms) {
  open();
  return read_until_complete(directive, timeout_ms);
}

SerialPort::SerialPort(SerialPortOptions options)
    : name(std::move(options.name)),
      mouse_port_flag(std::move(options.mouse_port_flag)),
      keyboard_port_flag(std::move(options.keyboard_port_flag)),
      sync_output_timeout_ms(options.sync_output_timeout_ms) {
  if (options.transport) {
    transport_ = std::move(options.transport);
  } else {
    transport_ = std::make_shared<Win32SerialTransport>(name, options.baud_rate);
  }
}

SerialPort &SerialPort::set_transport(std::shared_ptr<DirectiveTransport> transport) {
  transport_ = std::move(transport);
  return *this;
}

void SerialPort::open() {
  if (!transport_) throw TransportNotConfiguredError();
  transport_->open();
}
void SerialPort::close() { if (transport_) transport_->close(); }

std::string SerialPort::send_directive(const std::string &directive, std::optional<int> timeout_ms) {
  if (!transport_) throw TransportNotConfiguredError();
  return transport_->send_and_receive(directive, timeout_ms.value_or(sync_output_timeout_ms));
}

void SerialPort::send_directive_async(const std::string &directive) {
  if (!transport_) throw TransportNotConfiguredError();
  transport_->send(directive);
}

std::string SerialPort::send_parsed_raw(const std::string &directive, std::optional<int> timeout_ms) {
  return parse_directive_output_raw(directive, send_directive(directive, timeout_ms));
}

nlohmann::json SerialPort::send_parsed_json(const std::string &directive, std::optional<int> timeout_ms) {
  return parse_directive_output_json(directive, send_directive(directive, timeout_ms));
}

void SerialPort::start_recording(const std::string &args) { send_directive_async(args.empty() ? "alog" : ("alog " + args)); }
std::string SerialPort::alog(const std::string &log_name, const LogOption &opt, std::optional<int> timeout_ms) {
  return send_parsed_raw(build_alog_directive(log_name, opt), timeout_ms);
}
void SerialPort::start_replaying(const std::string &log_name, int delay) { send_directive_async("aplay " + log_name + " --delay " + std::to_string(delay)); }
std::string SerialPort::stop_recording() { return send_parsed_raw("astop", std::nullopt); }
nlohmann::json SerialPort::cancel_replay() { return send_parsed_json("acancel", std::nullopt); }

void SerialPort::mouse10(const M10Option &opt) {
  std::string directive = "m10 --port " + mouse_port_flag;
  const auto fragment = opt.to_cli_fragment();
  if (!fragment.empty()) directive += " " + fragment;
  if (opt.is_async()) send_directive_async(directive); else send_directive(directive, std::nullopt);
}

void SerialPort::keypad(KpadOption opt) {
  std::string directive = "kpad --port " + keyboard_port_flag;
  const auto fragment = opt.to_cli_fragment();
  if (!fragment.empty()) directive += " " + fragment;
  if (opt.is_async()) send_directive_async(directive); else send_directive(directive, std::nullopt);
  opt.commit_state();
}

SN SerialPort::sn(std::optional<int> timeout_ms) { return from_directive_json<SN>("sn", send_directive("sn", timeout_ms)); }
Heartbeat SerialPort::alive(std::optional<int> timeout_ms) { return from_directive_json<Heartbeat>("alive", send_directive("alive", timeout_ms)); }
MKPVersion SerialPort::aversion(std::optional<int> timeout_ms) { return from_directive_json<MKPVersion>("aversion", send_directive("aversion", timeout_ms)); }
LogLength SerialPort::atime(const std::string &path, std::optional<int> timeout_ms) { return from_directive_json<LogLength>("atime " + compose_log_fullpath(path), send_directive("atime " + compose_log_fullpath(path), timeout_ms)); }
LogInfo SerialPort::ainsp(const std::string &path, std::optional<int> timeout_ms) { return from_directive_json<LogInfo>("ainsp " + compose_log_fullpath(path), send_directive("ainsp " + compose_log_fullpath(path), timeout_ms)); }
FileSystem SerialPort::list_dir(const std::string &path, std::optional<int> timeout_ms) { return from_directive_json<FileSystem>("list_dir " + path, send_directive("list_dir " + path, timeout_ms)); }

std::string SerialPort::clean_dir(const std::string &path, std::optional<int> timeout_ms) {
  if (path.rfind("/eMMC/applog", 0) != 0) throw MkpError("clean_dir is restricted to /eMMC/applog");
  return send_parsed_raw("clean_dir " + path, timeout_ms);
}

std::string SerialPort::delete_file(const std::string &path, std::optional<int> timeout_ms) {
  if (path.rfind("/eMMC/applog", 0) != 0) throw MkpError("delete_file is restricted to /eMMC/applog");
  return send_parsed_raw("delete_file " + path, timeout_ms);
}

std::string SerialPort::join(const JoinOption &opt, std::optional<int> timeout_ms) {
  return send_parsed_raw("join " + join_args(opt.cli_args()), timeout_ms);
}

std::string SerialPort::wifi_auto(const WifiAutoOption &opt, std::optional<int> timeout_ms) {
  const auto suffix = join_args(opt.cli_args());
  return send_parsed_raw(suffix.empty() ? "wifi_auto" : "wifi_auto " + suffix, timeout_ms);
}

AHTTPBase SerialPort::ahttpbase(const AHTTPBaseOption &opt, std::optional<int> timeout_ms) {
  const auto suffix = join_args(opt.cli_args());
  const auto directive = suffix.empty() ? "ahttpbase" : "ahttpbase " + suffix;
  return from_directive_json<AHTTPBase>(directive, send_directive(directive, timeout_ms));
}

std::string SerialPort::aget(const AGetOption &opt, std::optional<int> timeout_ms) { return send_parsed_raw("aget " + join_args(opt.cli_args()), timeout_ms); }
std::string SerialPort::aput(const APutOption &opt, std::optional<int> timeout_ms) { return send_parsed_raw("aput " + join_args(opt.cli_args()), timeout_ms); }
ActionDump SerialPort::adumj(const std::string &path, std::optional<int> timeout_ms) { return from_directive_json<ActionDump>("adumj " + compose_log_fullpath(path), send_directive("adumj " + compose_log_fullpath(path), timeout_ms)); }
std::string SerialPort::ajson2log(const AJSON2LogOption &opt, std::optional<int> timeout_ms) { return send_parsed_raw("ajson2log " + join_args(opt.cli_args()), timeout_ms); }

SerialPortStatus SerialPort::snapshot_status() const {
  return SerialPortStatus{name, transport_ ? transport_->is_open() : false, sync_output_timeout_ms, transport_ != nullptr};
}

SFSerialPort new_sf_serial_port(const SerialPortOptions &options) { return SFSerialPort(options); }

std::string check_sf_serial_port() {
  const auto env = read_env_port();
  if (!env.empty()) return env;
#if defined(_WIN32)
  if (const auto detected = detect_mkp_port_windows()) {
    return *detected;
  }
  const auto candidates = list_openable_ports_windows();
  if (candidates.size() == 1) {
    return candidates.front();
  }
  if (!candidates.empty()) {
    std::ostringstream out;
    out << "failed to auto-detect MKP serial port by USB VID/PID; open COM ports:";
    for (const auto &port : candidates) out << ' ' << port;
    out << "; pass --port COMx or set MKP_SFPORT/MKP_SF_PORT explicitly";
    throw MkpError(out.str());
  }
#endif
  throw MkpError("failed to auto-detect SF serial port; pass --port COMx or set MKP_SFPORT/MKP_SF_PORT explicitly");
}

std::string compose_log_directory(const std::string &log_dir) {
  return log_dir.rfind("/eMMC/applog", 0) == 0 ? log_dir : "/eMMC/applog/" + log_dir;
}

std::string compose_log_fullpath(const std::string &log_path) {
  const auto normalized = log_path.size() >= 4 && log_path.substr(log_path.size() - 4) == ".log" ? log_path : log_path + ".log";
  return normalized.rfind("/eMMC/applog/", 0) == 0 ? normalized : "/eMMC/applog/" + normalized;
}

void start_record(SFSerialPort &sfport, const std::string &log_name, const LogOption &opt) {
  auto directive = build_alog_directive(log_name, opt);
  sfport.start_recording(directive.rfind("alog ", 0) == 0 ? directive.substr(5) : directive);
}

std::string stop_record(SFSerialPort &sfport) { return sfport.stop_recording(); }
std::string alog(SFSerialPort &sfport, const std::string &log_name, const LogOption &opt, std::optional<int> timeout_ms) { return sfport.alog(log_name, opt, timeout_ms); }
std::string astop(SFSerialPort &sfport, std::optional<int>) { return sfport.stop_recording(); }
nlohmann::json cancel(SFSerialPort &sfport, std::optional<int>) { return sfport.cancel_replay(); }
std::string join(SFSerialPort &sfport, const JoinOption &opt, std::optional<int> timeout_ms) { return sfport.join(opt, timeout_ms); }
std::string wifi_auto(SFSerialPort &sfport, const WifiAutoOption &opt, std::optional<int> timeout_ms) { return sfport.wifi_auto(opt, timeout_ms); }
SN device_sn(SFSerialPort &sfport, std::optional<int> timeout_ms) { return sfport.sn(timeout_ms); }
FileSystem list_dir(SFSerialPort &sfport, const std::string &path, std::optional<int> timeout_ms) { return sfport.list_dir(path, timeout_ms); }
std::string clean_dir(SFSerialPort &sfport, const std::string &path, std::optional<int> timeout_ms) { return sfport.clean_dir(path, timeout_ms); }
std::string delete_file(SFSerialPort &sfport, const std::string &path, std::optional<int> timeout_ms) { return sfport.delete_file(path, timeout_ms); }
Heartbeat alive(SFSerialPort &sfport, std::optional<int> timeout_ms) { return sfport.alive(timeout_ms); }
LogLength atime(SFSerialPort &sfport, const std::string &path, std::optional<int> timeout_ms) { return sfport.atime(path, timeout_ms); }
MKPVersion aversion(SFSerialPort &sfport, std::optional<int> timeout_ms) { return sfport.aversion(timeout_ms); }
std::string aupload_to_mkp(SFSerialPort &sfport, const AGetOption &opt, std::optional<int> timeout_ms) { return sfport.aget(opt, timeout_ms); }
std::string adownload_from_mkp(SFSerialPort &sfport, const APutOption &opt, std::optional<int> timeout_ms) { return sfport.aput(opt, timeout_ms); }
std::string ajson2log(SFSerialPort &sfport, const AJSON2LogOption &opt, std::optional<int> timeout_ms) { return sfport.ajson2log(opt, timeout_ms); }
AHTTPBase ahttpbase(SFSerialPort &sfport, const AHTTPBaseOption &opt, std::optional<int> timeout_ms) { return sfport.ahttpbase(opt, timeout_ms); }
ActionDump adumj(SFSerialPort &sfport, const std::string &log_path, std::optional<int> timeout_ms) { return sfport.adumj(log_path, timeout_ms); }
LogInfo ainspect(SFSerialPort &sfport, const std::string &path, std::optional<int> timeout_ms) { return sfport.ainsp(path, timeout_ms); }

void key_down(SFSerialPort &sfport, const std::string &key, const std::optional<KpadOption> &opt) {
  auto option = opt.value_or(KpadOption{});
  sfport.keypad(option.key_down(key));
}

void key_up(SFSerialPort &sfport, const std::string &key, const std::optional<KpadOption> &opt) {
  const auto option = opt.value_or(KpadOption{});
  const auto [release_opt, remain_opt] = option.key_up(key);
  if (release_opt) sfport.keypad(*release_opt);
  if (remain_opt) sfport.keypad(*remain_opt);
}

void key_tap(SFSerialPort &sfport, const std::string &key, const std::optional<KpadOption> &opt) {
  auto option = opt.value_or(KpadOption{});
  option.key_down(key).with_auto_release();
  sfport.keypad(option);
}

void key_presses(SFSerialPort &sfport, const std::vector<std::string> &keys, int sleep_ms, const std::optional<KpadOption> &opt) {
  for (std::size_t index = 0; index < keys.size(); ++index) {
    key_tap(sfport, keys[index], opt);
    if (sleep_ms > 0 && index + 1 < keys.size()) {
      std::this_thread::sleep_for(std::chrono::milliseconds(sleep_ms));
    }
  }
}

void keypad_release(SFSerialPort &sfport, const std::optional<KpadOption> &opt) {
  auto option = opt.value_or(KpadOption{});
  sfport.keypad(option.with_delay(0).with_key("NONE"));
}

void keypad_release_all(SFSerialPort &sfport, const std::optional<KpadOption> &opt) {
  auto option = opt.value_or(KpadOption{});
  sfport.keypad(option.with_delay(0).with_release(0));
  reset_kpad_pressed_caches();
}

void mouse_release_all(SFSerialPort &sfport, const std::optional<M10Option> &opt) {
  auto release = M10Option{}.with_async(true).set_button(0).set_x(0).set_y(0);
  if (opt) {
    release.async_mode = opt->async_mode;
    release.sync_ignore_output = opt->sync_ignore_output;
  }
  sfport.mouse10(release);
}

} // namespace mkp
