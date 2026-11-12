#include "mkp/debug.hpp"

#include <chrono>
#include <cstdlib>
#include <fstream>
#include <iomanip>
#include <sstream>

#include "mkp/fs.hpp"

namespace mkp {

namespace {

std::string utc_stamp() {
  const auto now = std::chrono::system_clock::now();
  const auto tt = std::chrono::system_clock::to_time_t(now);
  std::tm tm{};
#if defined(_WIN32)
  gmtime_s(&tm, &tt);
#else
  gmtime_r(&tt, &tm);
#endif
  std::ostringstream out;
  out << std::put_time(&tm, "%Y%m%dT%H%M%SZ");
  return out.str();
}

std::string summarize_stage(const std::string &kind,
                            const std::string &directive,
                            const std::string &raw_output,
                            const std::string &pending_buffer) {
  const auto &combined = raw_output.empty() ? pending_buffer : raw_output;
  const bool saw_echo = combined.find(directive) != std::string::npos;
  const bool saw_eof = combined.find("<EOF>") != std::string::npos || combined.find("cli>") != std::string::npos;
  if (kind == "timeout") {
    if (!saw_echo) {
      return "timed out before current directive echo appeared";
    }
    if (!saw_eof) {
      return "timed out after directive echo but before EOF marker";
    }
    return "timed out even though output looked partially complete";
  }
  return kind;
}

} // namespace

std::string directive_slug(const std::string &directive) {
  std::string slug;
  slug.reserve(directive.size());
  for (char ch : directive) {
    slug.push_back(std::isalnum(static_cast<unsigned char>(ch)) ? ch : '_');
  }
  while (!slug.empty() && slug.front() == '_') {
    slug.erase(slug.begin());
  }
  while (!slug.empty() && slug.back() == '_') {
    slug.pop_back();
  }
  if (slug.empty()) {
    slug = "directive";
  }
  if (slug.size() > 64) {
    slug.resize(64);
  }
  return slug;
}

std::string preview_text(const std::string &data, std::size_t max_lines, std::size_t max_chars) {
  std::istringstream input(data);
  std::string line;
  std::vector<std::string> parts;
  while (std::getline(input, line) && parts.size() < max_lines) {
    if (!line.empty() && line.back() == '\r') {
      line.pop_back();
    }
    const auto start = line.find_first_not_of(" \t\n\r");
    if (start == std::string::npos) {
      continue;
    }
    const auto end = line.find_last_not_of(" \t\n\r");
    parts.push_back(line.substr(start, end - start + 1));
  }
  std::ostringstream out;
  for (std::size_t i = 0; i < parts.size(); ++i) {
    if (i > 0) {
      out << " | ";
    }
    out << parts[i];
  }
  auto preview = out.str();
  if (preview.size() > max_chars && max_chars > 3) {
    preview = preview.substr(0, max_chars - 3) + "...";
  }
  return preview;
}

std::optional<std::string> write_debug_capture(const std::string &kind,
                                               const std::string &directive,
                                               const std::string &raw_output,
                                               const std::string &pending_buffer,
                                               const std::string &last_sync_directive,
                                               const std::string &last_sync_output,
                                               const std::string &parsed_output,
                                               const std::string &error_text) {
  try {
    const char *env = std::getenv("MKP_DEBUG_SERIAL_DIR");
    const fs::path root = env && *env ? env : ".mkp-debug";
    fs::create_directories(root);
    const auto path = root / (utc_stamp() + "_" + kind + "_" + directive_slug(directive) + ".log");
    std::ofstream file(path.string(), std::ios::binary);
    file << "time: " << utc_stamp() << "\n";
    file << "kind: " << kind << "\n";
    file << "directive: " << directive << "\n\n";
    file << "[summary]\n";
    file << "- stage: " << summarize_stage(kind, directive, raw_output, pending_buffer) << "\n";
    const auto preview = preview_text(raw_output.empty() ? pending_buffer : raw_output);
    if (!preview.empty()) {
      file << "- device_reply: " << preview << "\n";
    }
    if (!last_sync_directive.empty() && !last_sync_output.empty()) {
      file << "- previous_sync: " << last_sync_directive << " -> " << preview_text(last_sync_output) << "\n";
    }
    file << "\n[raw_output]\n" << raw_output << "\n";
    if (!parsed_output.empty()) {
      file << "\n[parsed_output]\n" << parsed_output << "\n";
    }
    if (!pending_buffer.empty()) {
      file << "\n[pending_read_buffer]\n" << pending_buffer << "\n";
    }
    if (!error_text.empty()) {
      file << "\n[error]\n" << error_text << "\n";
    }
    return path.string();
  } catch (...) {
    return std::nullopt;
  }
}

} // namespace mkp
