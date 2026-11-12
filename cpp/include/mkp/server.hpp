#pragma once

#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "mkp/models.hpp"
#include "mkp/sdk.hpp"

namespace mkp {

struct ServerSettings {
  std::string mode = "release";
  std::string sf_port = "COM3";
  int port = 3000;
  std::string user = "admin";
  std::string password = "admin123";
  std::string jwt_secret = "mkp-kit-dev-secret";
  std::string issuer = "mkp-cpp";
  int token_ttl_seconds = 3600;
  bool mute_auth_in_debug = false;
  int sync_directive_timeout_ms = 10000;
  std::vector<std::string> cors_allow_origins{"*"};
};

struct MacroRecord {
  int id = 0;
  std::string name;
  std::string unique_id;
  std::string mkp_path;
  int start_point_x = 0;
  int start_point_y = 0;
  int screen_width = 0;
  int screen_height = 0;
  std::string os = "win32";
  int seconds = 0;
  int milliseconds = 0;
  std::string created_at;
  std::string updated_at;
};

class RecordStore {
public:
  explicit RecordStore(std::string path = {});
  MacroRecord insert(const MacroRecord &record);
  std::vector<MacroRecord> list(int limits, const std::string &name = {}) const;
  std::optional<MacroRecord> get(const std::string &unique_id) const;
  bool erase(const std::string &unique_id);
  void persist() const;

private:
  std::string path_;
  std::vector<MacroRecord> records_;
  int next_id_ = 1;
  void load();
};

int run_server(const std::vector<std::string> &argv);

} // namespace mkp
