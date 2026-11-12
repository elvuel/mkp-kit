#pragma once

#if defined(_WIN32) && defined(__GNUC__) && !defined(__clang__) && __GNUC__ < 9

#include <algorithm>
#include <cctype>
#include <cstdint>
#include <string>
#include <utility>
#include <vector>

#include <windows.h>

namespace mkp {
namespace fs {

namespace detail {

inline bool is_sep(char ch) { return ch == '\\' || ch == '/'; }

inline std::string normalize_separators(std::string value, char sep = '\\') {
  std::replace(value.begin(), value.end(), '/', sep);
  std::replace(value.begin(), value.end(), '\\', sep);
  return value;
}

inline std::string trim_trailing_separators(std::string value) {
  while (value.size() > 1 && is_sep(value.back())) {
    if (value.size() == 3 && std::isalpha(static_cast<unsigned char>(value[0])) && value[1] == ':' && is_sep(value[2])) {
      break;
    }
    value.pop_back();
  }
  return value;
}

inline bool is_absolute_path(const std::string &value) {
  if (value.size() >= 2 && std::isalpha(static_cast<unsigned char>(value[0])) && value[1] == ':') return true;
  if (value.size() >= 2 && is_sep(value[0]) && is_sep(value[1])) return true;
  if (!value.empty() && is_sep(value[0])) return true;
  return false;
}

inline std::string dirname_of(const std::string &value) {
  auto normalized = trim_trailing_separators(normalize_separators(value));
  const auto pos = normalized.find_last_of('\\');
  if (pos == std::string::npos) return {};
  if (pos == 2 && normalized.size() >= 3 && normalized[1] == ':') return normalized.substr(0, 3);
  return normalized.substr(0, pos);
}

inline std::string basename_of(const std::string &value) {
  auto normalized = trim_trailing_separators(normalize_separators(value));
  const auto pos = normalized.find_last_of('\\');
  if (pos == std::string::npos) return normalized;
  return normalized.substr(pos + 1);
}

inline std::string extension_of(const std::string &value) {
  const auto base = basename_of(value);
  const auto pos = base.find_last_of('.');
  if (pos == std::string::npos || pos == 0) return {};
  return base.substr(pos);
}

inline std::string replace_extension_of(const std::string &value, const std::string &ext) {
  auto normalized = trim_trailing_separators(normalize_separators(value));
  const auto slash = normalized.find_last_of('\\');
  const auto dot = normalized.find_last_of('.');
  if (dot == std::string::npos || (slash != std::string::npos && dot < slash)) {
    return normalized + ext;
  }
  return normalized.substr(0, dot) + ext;
}

inline std::string absolute_path(const std::string &value) {
  if (value.empty()) return {};
  const auto normalized = normalize_separators(value);
  DWORD length = GetFullPathNameA(normalized.c_str(), 0, nullptr, nullptr);
  if (length == 0) return trim_trailing_separators(normalized);
  std::string out(length, '\0');
  const DWORD written = GetFullPathNameA(normalized.c_str(), length, &out[0], nullptr);
  if (written == 0) return trim_trailing_separators(normalized);
  out.resize(written);
  return trim_trailing_separators(normalize_separators(out));
}

inline std::string lowercase(std::string value) {
  std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) {
    return static_cast<char>(std::tolower(ch));
  });
  return value;
}

inline std::vector<std::string> split_components(const std::string &value) {
  std::vector<std::string> parts;
  auto normalized = normalize_separators(value);
  std::size_t start = 0;
  if (normalized.size() >= 3 && std::isalpha(static_cast<unsigned char>(normalized[0])) && normalized[1] == ':' && normalized[2] == '\\') {
    start = 3;
  }
  std::size_t pos = start;
  while (pos <= normalized.size()) {
    auto next = normalized.find('\\', pos);
    if (next == std::string::npos) next = normalized.size();
    if (next > pos) parts.push_back(normalized.substr(pos, next - pos));
    pos = next + 1;
  }
  return parts;
}

inline std::string root_prefix_of(const std::string &value) {
  auto normalized = normalize_separators(value);
  if (normalized.size() >= 3 && std::isalpha(static_cast<unsigned char>(normalized[0])) && normalized[1] == ':' && normalized[2] == '\\') {
    return lowercase(normalized.substr(0, 3));
  }
  if (normalized.size() >= 2 && normalized[0] == '\\' && normalized[1] == '\\') {
    return "\\\\";
  }
  return {};
}

} // namespace detail

class path {
public:
  path() = default;
  path(const char *value) : value_(value ? value : "") {}
  path(std::string value) : value_(std::move(value)) {}

  bool empty() const { return value_.empty(); }
  bool is_absolute() const { return detail::is_absolute_path(value_); }

  std::string string() const { return value_; }

  std::string generic_string() const {
    auto out = value_;
    std::replace(out.begin(), out.end(), '\\', '/');
    return out;
  }

  path filename() const { return path(detail::basename_of(value_)); }
  path parent_path() const { return path(detail::dirname_of(value_)); }
  path extension() const { return path(detail::extension_of(value_)); }

  path &replace_extension(const std::string &ext) {
    value_ = detail::replace_extension_of(value_, ext);
    return *this;
  }

  path &operator/=(const path &other) {
    if (other.value_.empty()) return *this;
    if (value_.empty()) {
      value_ = other.value_;
      return *this;
    }
    value_ = detail::normalize_separators(value_);
    auto rhs = detail::normalize_separators(other.value_);
    while (!rhs.empty() && detail::is_sep(rhs.front())) rhs.erase(rhs.begin());
    if (!value_.empty() && !detail::is_sep(value_.back())) value_.push_back('\\');
    value_ += rhs;
    return *this;
  }

  friend path operator/(path lhs, const path &rhs) {
    lhs /= rhs;
    return lhs;
  }

private:
  std::string value_;
};

inline bool exists(const path &value) {
  const auto attrs = GetFileAttributesA(detail::normalize_separators(value.string()).c_str());
  return attrs != INVALID_FILE_ATTRIBUTES;
}

inline bool exists(const std::string &value) { return exists(path(value)); }

inline bool is_directory(const path &value) {
  const auto attrs = GetFileAttributesA(detail::normalize_separators(value.string()).c_str());
  return attrs != INVALID_FILE_ATTRIBUTES && (attrs & FILE_ATTRIBUTE_DIRECTORY) != 0;
}

inline bool is_directory(const std::string &value) { return is_directory(path(value)); }

inline bool create_directories(const path &value) {
  auto normalized = detail::trim_trailing_separators(detail::normalize_separators(value.string()));
  if (normalized.empty()) return false;
  if (exists(normalized)) return false;

  std::size_t start = 0;
  if (normalized.size() >= 3 && std::isalpha(static_cast<unsigned char>(normalized[0])) && normalized[1] == ':' && normalized[2] == '\\') {
    start = 3;
  }

  bool created = false;
  for (std::size_t i = start; i < normalized.size(); ++i) {
    if (!detail::is_sep(normalized[i])) continue;
    const auto partial = normalized.substr(0, i);
    if (partial.empty()) continue;
    if (!exists(partial) && CreateDirectoryA(partial.c_str(), nullptr) != 0) created = true;
  }
  if (!exists(normalized) && CreateDirectoryA(normalized.c_str(), nullptr) != 0) created = true;
  return created || exists(normalized);
}

inline bool create_directories(const std::string &value) { return create_directories(path(value)); }

inline path weakly_canonical(const path &value) { return path(detail::absolute_path(value.string())); }

inline path relative(const path &target, const path &root) {
  const auto target_abs = detail::absolute_path(target.string());
  const auto root_abs = detail::absolute_path(root.string());
  if (detail::root_prefix_of(target_abs) != detail::root_prefix_of(root_abs)) {
    return path(target_abs);
  }

  const auto target_parts = detail::split_components(target_abs);
  const auto root_parts = detail::split_components(root_abs);
  std::size_t common = 0;
  while (common < target_parts.size() && common < root_parts.size() &&
         detail::lowercase(target_parts[common]) == detail::lowercase(root_parts[common])) {
    ++common;
  }

  std::vector<std::string> parts;
  for (std::size_t i = common; i < root_parts.size(); ++i) parts.push_back("..");
  for (std::size_t i = common; i < target_parts.size(); ++i) parts.push_back(target_parts[i]);
  if (parts.empty()) return path(".");

  std::string joined;
  for (std::size_t i = 0; i < parts.size(); ++i) {
    if (i > 0) joined += '\\';
    joined += parts[i];
  }
  return path(joined);
}

class directory_entry {
public:
  directory_entry(mkp::fs::path entry_path, bool directory, std::uintmax_t size)
      : path_value_(std::move(entry_path)), directory_(directory), size_(size) {}

  const mkp::fs::path &path() const { return path_value_; }
  bool is_directory() const { return directory_; }
  std::uintmax_t file_size() const { return size_; }

private:
  mkp::fs::path path_value_;
  bool directory_ = false;
  std::uintmax_t size_ = 0;
};

class directory_iterator {
public:
  using iterator = std::vector<directory_entry>::const_iterator;

  explicit directory_iterator(const std::string &root) {
    const auto normalized_root = detail::trim_trailing_separators(detail::normalize_separators(root));
    const auto pattern = normalized_root.empty() ? std::string("*") : normalized_root + "\\*";
    WIN32_FIND_DATAA data{};
    HANDLE handle = FindFirstFileA(pattern.c_str(), &data);
    if (handle == INVALID_HANDLE_VALUE) return;
    do {
      const std::string name = data.cFileName;
      if (name == "." || name == "..") continue;
      const bool is_dir = (data.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
      const auto size = (static_cast<std::uintmax_t>(data.nFileSizeHigh) << 32) | data.nFileSizeLow;
      entries_.emplace_back(path(normalized_root) / path(name), is_dir, size);
    } while (FindNextFileA(handle, &data) != 0);
    FindClose(handle);
  }

  iterator begin() const { return entries_.begin(); }
  iterator end() const { return entries_.end(); }

private:
  std::vector<directory_entry> entries_;
};

} // namespace fs
} // namespace mkp

#else

#include <filesystem>

namespace mkp {
namespace fs = std::filesystem;
}

#endif



