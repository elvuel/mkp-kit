#include "mkp/converter.hpp"

#include "mkp/fs.hpp"
#include <fstream>
#include <iterator>
#include <sstream>

namespace mkp {

Direction direction_from_path(const std::string &path) {
  const auto ext = fs::path(path).extension().string();
  if (ext == ".log") return Direction::LogToJson;
  if (ext == ".json") return Direction::JsonToLog;
  return Direction::Unknown;
}

nlohmann::json read_json_file(const std::string &path) {
  std::ifstream file(path, std::ios::binary);
  if (!file) throw std::runtime_error("failed to open json file: " + path);
  return nlohmann::json::parse(file);
}

void write_json_file(const std::string &path, const nlohmann::json &json) {
  std::ofstream file(path, std::ios::binary);
  if (!file) throw std::runtime_error("failed to write json file: " + path);
  file << json.dump(2) << "\n";
}

std::vector<std::uint8_t> read_binary_file(const std::string &path) {
  std::ifstream file(path, std::ios::binary);
  if (!file) throw std::runtime_error("failed to open binary file: " + path);
  return std::vector<std::uint8_t>(std::istreambuf_iterator<char>(file), {});
}

void write_binary_file(const std::string &path, const std::vector<std::uint8_t> &data) {
  std::ofstream file(path, std::ios::binary);
  if (!file) throw std::runtime_error("failed to write binary file: " + path);
  file.write(reinterpret_cast<const char *>(data.data()), static_cast<std::streamsize>(data.size()));
}

JsonToLogResult json_to_log(const nlohmann::json &envelope) {
  JsonToLogResult result;
  result.header.version = envelope.value("version", std::string(MAGIC_V1));
  const auto meta = envelope.value("meta", nlohmann::json::object());
  result.header.meta.width = meta.value("width", 0);
  result.header.meta.height = meta.value("height", 0);
  result.header.meta.start_x = meta.value("startX", 0);
  result.header.meta.start_y = meta.value("startY", 0);
  if (envelope.contains("events") && envelope["events"].is_array()) {
    for (const auto &event : envelope["events"]) {
      LogRecord record;
      record.port = event.contains("mouseMove") || event.contains("mouseDown") || event.contains("mouseUp") || event.contains("wheel") ? 1 : 2;
      const auto ts = event.value("mouseMove", nlohmann::json::object()).value("ts", 0) +
                      event.value("mouseDown", nlohmann::json::object()).value("ts", 0) +
                      event.value("mouseUp", nlohmann::json::object()).value("ts", 0) +
                      event.value("wheel", nlohmann::json::object()).value("ts", 0) +
                      event.value("keyDown", nlohmann::json::object()).value("ts", 0) +
                      event.value("keyUp", nlohmann::json::object()).value("ts", 0);
      record.delta = ts;
      const auto text = event.dump();
      record.length = static_cast<int>(text.size());
      record.payload.assign(text.begin(), text.end());
      result.has_mouse = result.has_mouse || record.port == 1;
      result.has_keyboard = result.has_keyboard || record.port == 2;
      result.records.push_back(std::move(record));
    }
  }
  return result;
}

nlohmann::json log_to_json(const std::vector<std::uint8_t> &data) {
  const std::string text(data.begin(), data.end());
  if (text.rfind("MKPJSON\n", 0) == 0) {
    return nlohmann::json::parse(text.substr(8));
  }
  return nlohmann::json::parse(text);
}

void convert_json_file_to_log_file(const std::string &input_json, const std::string &output_log) {
  const auto json = read_json_file(input_json);
  const auto payload = std::string("MKPJSON\n") + json.dump(2) + "\n";
  write_binary_file(output_log, std::vector<std::uint8_t>(payload.begin(), payload.end()));
}

void convert_log_file_to_json_file(const std::string &input_log, const std::string &output_json) {
  write_json_file(output_json, log_to_json(read_binary_file(input_log)));
}

int run_converter(const std::vector<std::string> &argv) {
  std::string input;
  std::string output;
  for (std::size_t i = 0; i < argv.size(); ++i) {
    if ((argv[i] == "-f" || argv[i] == "--from") && i + 1 < argv.size()) {
      input = argv[++i];
    } else if ((argv[i] == "-o" || argv[i] == "--output") && i + 1 < argv.size()) {
      output = argv[++i];
    }
  }
  if (input.empty()) {
    throw std::runtime_error("converter requires -f/--from");
  }
  const auto direction = direction_from_path(input);
  if (direction == Direction::Unknown) {
    throw std::runtime_error("failed to infer converter direction from input extension");
  }
  if (output.empty()) {
    output = fs::path(input).replace_extension(direction == Direction::LogToJson ? ".json" : ".log").string();
  }
  if (direction == Direction::LogToJson) {
    if (fs::path(output).extension().empty()) output += ".json";
    convert_log_file_to_json_file(input, output);
  } else {
    if (fs::path(output).extension().empty()) output += ".log";
    convert_json_file_to_log_file(input, output);
  }
  return 0;
}

} // namespace mkp
