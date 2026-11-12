#include "mkp/server.hpp"

#include <chrono>
#include <fstream>
#include <iomanip>
#include <random>
#include <sstream>

#include <httplib.h>

#include "mkp/error.hpp"
#include "mkp/fs.hpp"

#if defined(_WIN32)
#include <windows.h>
#include <bcrypt.h>
#pragma comment(lib, "bcrypt.lib")
#endif

namespace mkp {

namespace {

std::string iso8601_now() {
  const auto now = std::chrono::system_clock::now();
  const auto tt = std::chrono::system_clock::to_time_t(now);
  std::tm tm{};
#if defined(_WIN32)
  gmtime_s(&tm, &tt);
#else
  gmtime_r(&tt, &tm);
#endif
  std::ostringstream out;
  out << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
  return out.str();
}

std::string base64url_encode(const std::string &input) {
  static constexpr char alphabet[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  std::string out;
  int val = 0;
  int valb = -6;
  for (unsigned char ch : input) {
    val = (val << 8) + ch;
    valb += 8;
    while (valb >= 0) {
      out.push_back(alphabet[(val >> valb) & 0x3F]);
      valb -= 6;
    }
  }
  if (valb > -6) out.push_back(alphabet[((val << 8) >> (valb + 8)) & 0x3F]);
  return out;
}

#if defined(_WIN32)
std::string hmac_sha256(const std::string &secret, const std::string &message) {
  BCRYPT_ALG_HANDLE alg = nullptr;
  BCRYPT_HASH_HANDLE hash = nullptr;
  DWORD object_len = 0;
  DWORD result = 0;
  DWORD hash_len = 0;
  if (BCryptOpenAlgorithmProvider(&alg, BCRYPT_SHA256_ALGORITHM, nullptr, BCRYPT_ALG_HANDLE_HMAC_FLAG) != 0) {
    throw MkpError("failed to open bcrypt sha256 provider");
  }
  BCryptGetProperty(alg, BCRYPT_OBJECT_LENGTH, reinterpret_cast<PUCHAR>(&object_len), sizeof(object_len), &result, 0);
  BCryptGetProperty(alg, BCRYPT_HASH_LENGTH, reinterpret_cast<PUCHAR>(&hash_len), sizeof(hash_len), &result, 0);
  std::vector<unsigned char> object_buffer(object_len);
  std::vector<unsigned char> output(hash_len);
  if (BCryptCreateHash(alg, &hash, object_buffer.data(), object_len, reinterpret_cast<PUCHAR>(const_cast<char *>(secret.data())),
                       static_cast<ULONG>(secret.size()), 0) != 0) {
    BCryptCloseAlgorithmProvider(alg, 0);
    throw MkpError("failed to create bcrypt hash");
  }
  BCryptHashData(hash, reinterpret_cast<PUCHAR>(const_cast<char *>(message.data())), static_cast<ULONG>(message.size()), 0);
  BCryptFinishHash(hash, output.data(), hash_len, 0);
  BCryptDestroyHash(hash);
  BCryptCloseAlgorithmProvider(alg, 0);
  return std::string(reinterpret_cast<const char *>(output.data()), output.size());
}
#else
std::string hmac_sha256(const std::string &, const std::string &) { return {}; }
#endif

std::string issue_token(const ServerSettings &settings, const std::string &subject) {
  const auto now = std::chrono::system_clock::to_time_t(std::chrono::system_clock::now());
  const nlohmann::json header = { {"alg", "HS256"}, {"typ", "JWT"} };
  const nlohmann::json claims = { {"iss", settings.issuer}, {"sub", subject}, {"iat", now}, {"exp", now + settings.token_ttl_seconds} };
  const auto part0 = base64url_encode(header.dump());
  const auto part1 = base64url_encode(claims.dump());
  const auto body = part0 + "." + part1;
  const auto signature = base64url_encode(hmac_sha256(settings.jwt_secret, body));
  return body + "." + signature;
}

bool token_valid(const ServerSettings &settings, const std::string &token) {
  const auto p1 = token.find('.');
  const auto p2 = token.find('.', p1 == std::string::npos ? p1 : p1 + 1);
  if (p1 == std::string::npos || p2 == std::string::npos) return false;
  const auto body = token.substr(0, p2);
  const auto signature = token.substr(p2 + 1);
  return base64url_encode(hmac_sha256(settings.jwt_secret, body)) == signature;
}

std::string random_id() {
  std::mt19937_64 rng(std::random_device{}());
  std::uniform_int_distribution<unsigned long long> dist;
  std::ostringstream out;
  out << std::hex << dist(rng);
  return out.str();
}

bool auth_ok(const ServerSettings &settings, const httplib::Request &req) {
  if (settings.mode == "debug" && settings.mute_auth_in_debug) return true;
  const auto auth = req.get_header_value("Authorization");
  if (auth.rfind("Bearer ", 0) != 0) return false;
  return token_valid(settings, auth.substr(7));
}

nlohmann::json status_json(const SerialPortStatus &status) {
  return {
      {"name", status.name},
      {"port_open", status.port_open},
      {"sync_output_timeout_ms", status.sync_output_timeout_ms},
      {"transport_configured", status.transport_configured},
  };
}

} // namespace

RecordStore::RecordStore(std::string path) : path_(std::move(path)) { load(); }

void RecordStore::load() {
  if (path_.empty() || !fs::exists(path_)) return;
  std::ifstream file(path_);
  nlohmann::json data = nlohmann::json::parse(file, nullptr, false);
  if (!data.is_array()) return;
  for (const auto &row : data) {
    MacroRecord record;
    record.id = row.value("id", next_id_++);
    record.name = row.value("name", "");
    record.unique_id = row.value("unique_id", "");
    record.mkp_path = row.value("mkp_path", "");
    record.start_point_x = row.value("start_point_x", 0);
    record.start_point_y = row.value("start_point_y", 0);
    record.screen_width = row.value("screen_width", 0);
    record.screen_height = row.value("screen_height", 0);
    record.os = row.value("os", "win32");
    record.seconds = row.value("seconds", 0);
    record.milliseconds = row.value("milliseconds", 0);
    record.created_at = row.value("created_at", iso8601_now());
    record.updated_at = row.value("updated_at", record.created_at);
    next_id_ = std::max(next_id_, record.id + 1);
    records_.push_back(std::move(record));
  }
}

void RecordStore::persist() const {
  if (path_.empty()) return;
  fs::create_directories(fs::path(path_).parent_path());
  nlohmann::json data = nlohmann::json::array();
  for (const auto &record : records_) {
    data.push_back({
        {"id", record.id},
        {"name", record.name},
        {"unique_id", record.unique_id},
        {"mkp_path", record.mkp_path},
        {"start_point_x", record.start_point_x},
        {"start_point_y", record.start_point_y},
        {"screen_width", record.screen_width},
        {"screen_height", record.screen_height},
        {"os", record.os},
        {"seconds", record.seconds},
        {"milliseconds", record.milliseconds},
        {"created_at", record.created_at},
        {"updated_at", record.updated_at},
    });
  }
  std::ofstream file(path_, std::ios::binary);
  file << data.dump(2) << "\n";
}

MacroRecord RecordStore::insert(const MacroRecord &input) {
  auto record = input;
  record.id = next_id_++;
  record.created_at = iso8601_now();
  record.updated_at = record.created_at;
  records_.push_back(record);
  persist();
  return record;
}

std::vector<MacroRecord> RecordStore::list(int limits, const std::string &name) const {
  std::vector<MacroRecord> out;
  for (const auto &record : records_) {
    if (!name.empty() && record.name.find(name) == std::string::npos) continue;
    out.push_back(record);
    if (limits > 0 && static_cast<int>(out.size()) >= limits) break;
  }
  return out;
}

std::optional<MacroRecord> RecordStore::get(const std::string &unique_id) const {
  for (const auto &record : records_) {
    if (record.unique_id == unique_id) return record;
  }
  return std::nullopt;
}

bool RecordStore::erase(const std::string &unique_id) {
  const auto before = records_.size();
  records_.erase(std::remove_if(records_.begin(), records_.end(), [&](const auto &record) { return record.unique_id == unique_id; }), records_.end());
  const auto changed = before != records_.size();
  if (changed) persist();
  return changed;
}

int run_server(const std::vector<std::string> &argv) {
  ServerSettings settings;
  std::string db_path = ".mkp-server-records.json";
  for (std::size_t i = 0; i < argv.size(); ++i) {
    if ((argv[i] == "-p" || argv[i] == "--port") && i + 1 < argv.size()) settings.port = std::stoi(argv[++i]);
    else if ((argv[i] == "--sf-port") && i + 1 < argv.size()) settings.sf_port = argv[++i];
    else if ((argv[i] == "--db") && i + 1 < argv.size()) db_path = argv[++i];
    else if ((argv[i] == "--mode") && i + 1 < argv.size()) settings.mode = argv[++i];
  }

  auto sfport = new_sf_serial_port({settings.sf_port});
  RecordStore store(db_path);
  httplib::Server server;

  server.Options(R"(.*)", [&](const httplib::Request &, httplib::Response &res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.status = 204;
  });

  server.Get("/health", [&](const httplib::Request &, httplib::Response &res) {
    res.set_content(nlohmann::json{{"ok", true}, {"ready", true}, {"sfport", status_json(sfport.snapshot_status())}}.dump(), "application/json");
  });

  server.Post("/api/v1/auth/token", [&](const httplib::Request &req, httplib::Response &res) {
    const auto body = nlohmann::json::parse(req.body, nullptr, false);
    const auto user = body.value("username", "");
    const auto password = body.value("password", "");
    if (user != settings.user || password != settings.password) {
      res.status = 401;
      res.set_content(nlohmann::json{{"ok", false}, {"error", "invalid credentials"}}.dump(), "application/json");
      return;
    }
    res.set_content(nlohmann::json{{"ok", true}, {"token", issue_token(settings, user)}}.dump(), "application/json");
  });

  server.Get("/api/v1/version", [&](const httplib::Request &, httplib::Response &res) {
    res.set_content(nlohmann::json{{"ok", true}, {"directive", "version"}, {"mkp_server", "0.1.0"}, {"mkp_device", nlohmann::json{{"port", settings.sf_port}}}}.dump(), "application/json");
  });

  server.Get("/api/v1/directives/replay/status", [&](const httplib::Request &req, httplib::Response &res) {
    if (!auth_ok(settings, req)) {
      res.status = 401;
      res.set_content(nlohmann::json{{"ok", false}, {"error", "missing or invalid Authorization header"}}.dump(), "application/json");
      return;
    }
    res.set_content(nlohmann::json{{"ok", true}, {"directive", "replay_status"}, {"replay", nlohmann::json{{"running", false}, {"active", false}, {"current_id", ""}}}}.dump(), "application/json");
  });

  server.Post("/api/v1/directives/alog", [&](const httplib::Request &req, httplib::Response &res) {
    if (!auth_ok(settings, req)) {
      res.status = 401;
      res.set_content(nlohmann::json{{"ok", false}, {"error", "missing or invalid Authorization header"}}.dump(), "application/json");
      return;
    }
    const auto body = nlohmann::json::parse(req.body, nullptr, false);
    const auto log_name = body.value("log_name", std::string{"alog"});
    start_record(sfport, log_name, {});
    res.set_content(nlohmann::json{{"ok", true}, {"directive", "alog"}, {"log_name", log_name}}.dump(), "application/json");
  });

  server.Post("/api/v1/directives/astop", [&](const httplib::Request &req, httplib::Response &res) {
    if (!auth_ok(settings, req)) {
      res.status = 401;
      res.set_content(nlohmann::json{{"ok", false}, {"error", "missing or invalid Authorization header"}}.dump(), "application/json");
      return;
    }
    (void)req;
    stop_record(sfport);
    MacroRecord record;
    record.name = "alog";
    record.unique_id = random_id();
    record.mkp_path = compose_log_fullpath(record.unique_id);
    record.os = "win32";
    record.seconds = 0;
    record.milliseconds = 0;
    const auto persisted = store.insert(record);
    res.set_content(nlohmann::json{{"ok", true}, {"directive", "astop"}, {"persisted", true}, {"macro_record_id", persisted.id}, {"record", { {"unique_id", persisted.unique_id} }}}.dump(), "application/json");
  });

  server.Get("/api/v1/directives/list", [&](const httplib::Request &req, httplib::Response &res) {
    if (!auth_ok(settings, req)) {
      res.status = 401;
      res.set_content(nlohmann::json{{"ok", false}, {"error", "missing or invalid Authorization header"}}.dump(), "application/json");
      return;
    }
    const auto limits = req.has_param("limits") ? std::stoi(req.get_param_value("limits")) : 10;
    const auto records = store.list(limits);
    nlohmann::json rows = nlohmann::json::array();
    for (const auto &record : records) rows.push_back({{"id", record.id}, {"name", record.name}, {"unique_id", record.unique_id}, {"mkp_path", record.mkp_path}});
    res.set_content(nlohmann::json{{"ok", true}, {"directive", "list"}, {"count", rows.size()}, {"records", rows}}.dump(), "application/json");
  });

  server.Get(R"(/api/v1/directives/records/(.*))", [&](const httplib::Request &req, httplib::Response &res) {
    if (!auth_ok(settings, req)) {
      res.status = 401;
      res.set_content(nlohmann::json{{"ok", false}, {"error", "missing or invalid Authorization header"}}.dump(), "application/json");
      return;
    }
    const auto record = store.get(req.matches[1]);
    if (!record) {
      res.status = 404;
      res.set_content(nlohmann::json{{"ok", false}, {"error", "record not found"}}.dump(), "application/json");
      return;
    }
    res.set_content(nlohmann::json{{"ok", true}, {"record", {{"id", record->id}, {"name", record->name}, {"unique_id", record->unique_id}, {"mkp_path", record->mkp_path}}}}.dump(), "application/json");
  });

  server.Delete(R"(/api/v1/directives/records/(.*))", [&](const httplib::Request &req, httplib::Response &res) {
    if (!auth_ok(settings, req)) {
      res.status = 401;
      res.set_content(nlohmann::json{{"ok", false}, {"error", "missing or invalid Authorization header"}}.dump(), "application/json");
      return;
    }
    store.erase(req.matches[1]);
    res.set_content(nlohmann::json{{"ok", true}, {"deleted", true}}.dump(), "application/json");
  });

  server.listen("0.0.0.0", settings.port);
  return 0;
}

} // namespace mkp
