#pragma once

#include <optional>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

namespace mkp {

struct FileServerSettings {
  std::string bind = "0.0.0.0";
  int port = 8080;
  std::string file_root = "./file_root";
};

struct DirEntry {
  std::string name;
  std::string type;
  std::uintmax_t size = 0;
  std::string path;
};

void to_json(nlohmann::json &j, const DirEntry &value);

std::optional<std::string> safe_join(const std::string &file_root, const std::vector<std::string> &parts);
std::string sanitize_filename(const std::string &filename);
std::vector<DirEntry> list_directory(const std::string &dir_path, const std::string &file_root);
int run_file_server(const std::vector<std::string> &argv);

} // namespace mkp
