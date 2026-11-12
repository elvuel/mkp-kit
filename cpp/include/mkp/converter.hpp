#pragma once

#include <cstdint>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

namespace mkp {

inline constexpr const char *MAGIC_V1 = "MKv1";
inline constexpr const char *MAGIC_V2 = "MKv2";

struct Meta {
  int width = 0;
  int height = 0;
  int start_x = 0;
  int start_y = 0;
};

struct LogHeader {
  std::string version = MAGIC_V1;
  Meta meta;
};

struct LogRecord {
  int port = 0;
  int delta = 0;
  int length = 0;
  std::vector<std::uint8_t> payload;
};

enum class Direction { Unknown, LogToJson, JsonToLog };

struct JsonToLogResult {
  LogHeader header;
  std::vector<LogRecord> records;
  bool has_mouse = false;
  bool has_keyboard = false;
};

Direction direction_from_path(const std::string &path);
nlohmann::json read_json_file(const std::string &path);
void write_json_file(const std::string &path, const nlohmann::json &json);
std::vector<std::uint8_t> read_binary_file(const std::string &path);
void write_binary_file(const std::string &path, const std::vector<std::uint8_t> &data);
JsonToLogResult json_to_log(const nlohmann::json &envelope);
nlohmann::json log_to_json(const std::vector<std::uint8_t> &data);
void convert_json_file_to_log_file(const std::string &input_json, const std::string &output_log);
void convert_log_file_to_json_file(const std::string &input_log, const std::string &output_json);
int run_converter(const std::vector<std::string> &argv);

} // namespace mkp
