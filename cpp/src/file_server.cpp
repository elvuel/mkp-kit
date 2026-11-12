#include "mkp/file_server.hpp"

#include <algorithm>
#include <fstream>
#include <stdexcept>

#include <httplib.h>
#include <nlohmann/json.hpp>

#include "mkp/fs.hpp"

namespace mkp {

namespace {

std::optional<std::string> normalize_user_path(const std::string &input) {
  std::string normalized = input;
  std::replace(normalized.begin(), normalized.end(), '\\', '/');
  while (!normalized.empty() && normalized.front() == '/') normalized.erase(normalized.begin());
  if (normalized.size() >= 2 && std::isalpha(static_cast<unsigned char>(normalized[0])) && normalized[1] == ':') return std::nullopt;
  return normalized;
}

std::string relative_posix_path(const fs::path &root, const fs::path &target) {
  return fs::relative(target, root).generic_string();
}

} // namespace

void to_json(nlohmann::json &j, const DirEntry &value) {
  j = nlohmann::json{{"name", value.name}, {"type", value.type}, {"size", value.size}, {"path", value.path}};
}

std::optional<std::string> safe_join(const std::string &file_root, const std::vector<std::string> &parts) {
  fs::path root = fs::weakly_canonical(fs::path(file_root));
  auto combined = root;
  for (const auto &raw : parts) {
    const auto normalized = normalize_user_path(raw);
    if (!normalized.has_value()) return std::nullopt;
    if (normalized->empty()) continue;
    fs::path piece(*normalized);
    if (piece.is_absolute()) return std::nullopt;
    combined /= piece;
  }
  combined = fs::weakly_canonical(combined);
  const auto relative = fs::relative(combined, root);
  if (relative.empty() || relative.string() == ".") return combined.string();
  if (relative.string().rfind("..", 0) == 0) return std::nullopt;
  return combined.string();
}

std::string sanitize_filename(const std::string &filename) {
  auto base = fs::path(filename).filename().string();
  for (auto &ch : base) {
    if (std::string("<>:\"|?*").find(ch) != std::string::npos) ch = '_';
  }
  if (base.empty() || base == ".") return "unnamed_file";
  return base;
}

std::vector<DirEntry> list_directory(const std::string &dir_path, const std::string &file_root) {
  std::vector<DirEntry> entries;
  for (const auto &item : fs::directory_iterator(dir_path)) {
    DirEntry entry;
    entry.name = item.path().filename().string();
    entry.type = item.is_directory() ? "dir" : "file";
    entry.size = item.is_directory() ? 0 : item.file_size();
    entry.path = relative_posix_path(file_root, item.path());
    entries.push_back(std::move(entry));
  }
  std::sort(entries.begin(), entries.end(), [](const auto &left, const auto &right) { return left.name < right.name; });
  return entries;
}

int run_file_server(const std::vector<std::string> &argv) {
  FileServerSettings settings;
  for (std::size_t i = 0; i < argv.size(); ++i) {
    if ((argv[i] == "-p" || argv[i] == "--port") && i + 1 < argv.size()) settings.port = std::stoi(argv[++i]);
    else if ((argv[i] == "-b" || argv[i] == "--bind") && i + 1 < argv.size()) settings.bind = argv[++i];
    else if ((argv[i] == "-r" || argv[i] == "--root") && i + 1 < argv.size()) settings.file_root = argv[++i];
  }

  fs::create_directories(settings.file_root);
  httplib::Server server;

  server.Get("/list", [&](const httplib::Request &req, httplib::Response &res) {
    const auto path = req.has_param("path") ? req.get_param_value("path") : std::string{};
    const auto joined = safe_join(settings.file_root, {path});
    if (!joined) {
      res.status = 400;
      res.set_content(nlohmann::json{{"error", "Path traversal rejected"}}.dump(), "application/json");
      return;
    }
    if (!fs::exists(*joined) || !fs::is_directory(*joined)) {
      res.status = 404;
      res.set_content(nlohmann::json{{"error", "Directory not found: " + path}}.dump(), "application/json");
      return;
    }
    res.set_content(nlohmann::json(list_directory(*joined, settings.file_root)).dump(), "application/json");
  });

  server.Put(R"(/(.*))", [&](const httplib::Request &req, httplib::Response &res) {
    const auto target = safe_join(settings.file_root, {req.matches[1]});
    if (!target) {
      res.status = 400;
      res.set_content(nlohmann::json{{"error", "Path traversal rejected"}}.dump(), "application/json");
      return;
    }
    if (req.body.empty()) {
      res.status = 400;
      res.set_content(nlohmann::json{{"error", "Empty request body"}}.dump(), "application/json");
      return;
    }
    fs::create_directories(fs::path(*target).parent_path());
    std::ofstream file(*target, std::ios::binary);
    file.write(req.body.data(), static_cast<std::streamsize>(req.body.size()));
    res.set_content(nlohmann::json{{"status", "ok"}, {"path", req.matches[1].str()}, {"size", req.body.size()}}.dump(), "application/json");
  });

  server.Get(R"(/(.*))", [&](const httplib::Request &req, httplib::Response &res) {
    const auto path = req.matches[1].str();
    const auto target = safe_join(settings.file_root, {path});
    if (!target) {
      res.status = 400;
      res.set_content(nlohmann::json{{"error", "Path traversal rejected"}}.dump(), "application/json");
      return;
    }
    if (!fs::exists(*target) || fs::is_directory(*target)) {
      res.status = 404;
      res.set_content(nlohmann::json{{"error", "File not found: " + path}}.dump(), "application/json");
      return;
    }
    std::ifstream file(*target, std::ios::binary);
    std::ostringstream out;
    out << file.rdbuf();
    res.set_content(out.str(), "application/octet-stream");
    res.set_header("content-disposition", "attachment; filename=\"" + fs::path(*target).filename().string() + "\"");
  });

  server.listen(settings.bind, settings.port);
  return 0;
}

} // namespace mkp
