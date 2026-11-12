#include "mkp/parser.hpp"

#include <algorithm>
#include <cctype>
#include <cstring>
#include <memory>
#include <sstream>

#include "mkp/error.hpp"

namespace mkp {

RawDirectiveParser::RawDirectiveParser(std::string parser_name, bool parser_json_output, std::string parser_eof_flag)
    : name(std::move(parser_name)), json_output(parser_json_output), eof_flag(std::move(parser_eof_flag)) {}

std::string RawDirectiveParser::sanitize_r(const std::string &data) const {
  auto current = data;
  current.erase(std::remove(current.begin(), current.end(), '\r'), current.end());
  return current;
}

bool RawDirectiveParser::is_execution_failed(const std::string &data) const {
  auto lowered = data;
  std::transform(lowered.begin(), lowered.end(), lowered.begin(), [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
  return lowered.find("command returned non-zero error code") != std::string::npos ||
         lowered.find("server returned status 404") != std::string::npos;
}

std::string RawDirectiveParser::preflight(const std::string &data) const {
  auto current = sanitize_r(data);
  if (is_execution_failed(current)) {
    throw RawDirectiveExecutionFailedError(name);
  }
  return current;
}

std::string RawDirectiveParser::parse(const std::string &cli, const std::string &data) const {
  auto current = preflight(data);
  current = trim_cli_output(current, cli, eof_flag != EOF_CLI);
  if (current.empty()) {
    throw RawDirectiveParseFailedError(name);
  }
  return current;
}

namespace {

class JsonParser : public RawDirectiveParser {
public:
  explicit JsonParser(const std::string &name, const std::string &eof = EOF_DEFAULT)
      : RawDirectiveParser(name, true, eof) {}

  std::string parse(const std::string &cli, const std::string &data) const override {
    return extract_json_blob(trim_cli_output(preflight(data), cli));
  }
};

class RawJsonTextParser final : public JsonParser {
public:
  RawJsonTextParser(const std::string &name, const std::string &eof = EOF_DEFAULT, bool allow_empty = false)
      : JsonParser(name, eof), allow_empty_(allow_empty) {}

  std::string parse(const std::string &cli, const std::string &data) const override {
    const auto normalized = trim_cli_output(preflight(data), cli);
    if (normalized.empty()) {
      if (allow_empty_) return {};
      throw RawDirectiveParseFailedError(name);
    }
    try {
      return extract_json_blob(normalized);
    } catch (const RawDirectiveParseFailedError &) {
      return normalized;
    }
  }

private:
  bool allow_empty_ = false;
};

class LineJsonParser final : public JsonParser {
public:
  LineJsonParser(const std::string &name, std::vector<std::string> required_fragments, const std::string &eof = EOF_DEFAULT)
      : JsonParser(name, eof), required_fragments_(std::move(required_fragments)) {}

  std::string parse(const std::string &cli, const std::string &data) const override {
    const auto normalized = trim_cli_output(preflight(data), cli);
    if (normalized.empty()) {
      return {};
    }
    std::istringstream input(normalized);
    std::string line;
    while (std::getline(input, line)) {
      const auto start = line.find_first_not_of(" \t\r\n");
      if (start == std::string::npos) continue;
      const auto candidate = line.substr(start);
      if (candidate.empty() || (candidate[0] != '{' && candidate[0] != '[')) {
        continue;
      }
      bool okay = true;
      for (const auto &fragment : required_fragments_) {
        if (candidate.find(fragment) == std::string::npos) {
          okay = false;
          break;
        }
      }
      if (okay) return candidate;
    }
    return extract_json_blob(normalized);
  }

private:
  std::vector<std::string> required_fragments_;
};

class AHTTPBaseParser final : public JsonParser {
public:
  AHTTPBaseParser() : JsonParser("ahttpbase", EOF_CLI) {}

  std::string parse(const std::string &cli, const std::string &data) const override {
    const auto current = preflight(data);
    try {
      return extract_json_blob(current);
    } catch (const RawDirectiveParseFailedError &) {
      const auto normalized = trim_cli_output(sanitize_r(current), cli, false);
      if (normalized == "OK") {
        std::string url = cli;
        if (url.rfind(name, 0) == 0) {
          url = url.substr(name.size());
        }
        const auto start = url.find_first_not_of(' ');
        url = start == std::string::npos ? std::string{} : url.substr(start);
        return nlohmann::json{{"ahttpbase", url}}.dump();
      }
      for (std::istringstream input(normalized); input.good();) {
        std::string line;
        std::getline(input, line);
        if (line.rfind("http://", 0) == 0 || line.rfind("https://", 0) == 0) {
          return nlohmann::json{{"ahttpbase", line}}.dump();
        }
      }
      throw;
    }
  }
};

class AGetParser final : public RawDirectiveParser {
public:
  AGetParser() : RawDirectiveParser("aget", false, EOF_CLI) {}

  std::string parse(const std::string &cli, const std::string &data) const override {
    const auto normalized = trim_cli_output(preflight(data), cli, false);
    auto lowered = normalized;
    std::transform(lowered.begin(), lowered.end(), lowered.begin(), [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    if (lowered.find("error code") != std::string::npos || lowered.find("server returned status") != std::string::npos) {
      throw RawDirectiveExecutionFailedError(name);
    }
    if (normalized.find("GET status=200") != std::string::npos) return normalized;
    throw RawDirectiveParseFailedError(name);
  }
};

class APutParser final : public RawDirectiveParser {
public:
  APutParser() : RawDirectiveParser("aput", false, EOF_CLI) {}

  std::string parse(const std::string &cli, const std::string &data) const override {
    const auto normalized = trim_cli_output(preflight(data), cli, false);
    auto lowered = normalized;
    std::transform(lowered.begin(), lowered.end(), lowered.begin(), [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    if (lowered.find("upload failed") != std::string::npos || lowered.find("failed to open file") != std::string::npos ||
        lowered.find("error code") != std::string::npos) {
      throw RawDirectiveExecutionFailedError(name);
    }
    if (normalized.find("Upload OK") != std::string::npos) return normalized;
    throw RawDirectiveParseFailedError(name);
  }
};

class AJson2LogParser final : public RawDirectiveParser {
public:
  AJson2LogParser() : RawDirectiveParser("ajson2log", false, EOF_CLI) {}

  std::string parse(const std::string &cli, const std::string &data) const override {
    const auto normalized = trim_cli_output(preflight(data), cli, false);
    auto lowered = normalized;
    std::transform(lowered.begin(), lowered.end(), lowered.begin(), [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    if (lowered.find("error code") != std::string::npos) throw RawDirectiveExecutionFailedError(name);
    if (normalized.empty()) throw RawDirectiveParseFailedError(name);
    return normalized;
  }
};

class AdumjParser final : public JsonParser {
public:
  AdumjParser() : JsonParser("adumj", EOF_CLI) {}

  std::string parse(const std::string &cli, const std::string &data) const override {
    const auto normalized = trim_cli_output(preflight(data), cli);
    if (normalized.empty()) return {};
    return extract_json_blob(normalized);
  }
};

class AstopParser final : public RawDirectiveParser {
public:
  AstopParser() : RawDirectiveParser("astop", false, EOF_CLI) {}
};

class JoinParser final : public RawDirectiveParser {
public:
  JoinParser() : RawDirectiveParser("join", false, EOF_CLI) {}

  std::string parse(const std::string &cli, const std::string &data) const override {
    auto lowered = preflight(data);
    std::transform(lowered.begin(), lowered.end(), lowered.begin(), [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    if (lowered.find("connected") != std::string::npos) return "connected";
    if (lowered.find("connecting to") != std::string::npos) return "connecting";
    throw RawDirectiveParseFailedError(name);
  }
};

class WifiAutoParser final : public RawDirectiveParser {
public:
  WifiAutoParser() : RawDirectiveParser("wifi_auto", false, EOF_CLI) {}

  std::string parse(const std::string &cli, const std::string &data) const override {
    auto current = preflight(data);
    if (current.rfind(cli, 0) == 0) current = current.substr(cli.size());
    std::transform(current.begin(), current.end(), current.begin(), [](unsigned char ch) { return static_cast<char>(std::tolower(ch)); });
    if (current.find("auto: on") != std::string::npos) return "on";
    if (current.find("auto: off") != std::string::npos) return "off";
    return {};
  }
};

class PlainSuccessParser final : public RawDirectiveParser {
public:
  PlainSuccessParser(std::string name, std::string eof = EOF_CLI) : RawDirectiveParser(std::move(name), false, std::move(eof)) {}
};

const std::unordered_map<std::string, std::shared_ptr<RawDirectiveParser>> &registry() {
  static const std::unordered_map<std::string, std::shared_ptr<RawDirectiveParser>> parsers = {
      {"astop", std::make_shared<AstopParser>()},
      {"acancel", std::make_shared<RawJsonTextParser>("acancel", EOF_DEFAULT, true)},
      {"sn", std::make_shared<RawJsonTextParser>("sn", EOF_DEFAULT, false)},
      {"list_dir", std::make_shared<RawJsonTextParser>("list_dir", EOF_DEFAULT, true)},
      {"clean_dir", std::make_shared<PlainSuccessParser>("clean_dir", EOF_CLI)},
      {"delete_file", std::make_shared<PlainSuccessParser>("delete_file", EOF_CLI)},
      {"alive", std::make_shared<RawJsonTextParser>("alive", EOF_DEFAULT, true)},
      {"atime", std::make_shared<LineJsonParser>("atime", std::vector<std::string>{"\"seconds\":"}, EOF_DEFAULT)},
      {"aversion", std::make_shared<RawJsonTextParser>("aversion", EOF_DEFAULT, true)},
      {"ainsp", std::make_shared<LineJsonParser>("ainsp", std::vector<std::string>{"\"seconds\":", "\"width\":"}, EOF_DEFAULT)},
      {"join", std::make_shared<JoinParser>()},
      {"wifi_auto", std::make_shared<WifiAutoParser>()},
      {"adumj", std::make_shared<AdumjParser>()},
      {"ahttpbase", std::make_shared<AHTTPBaseParser>()},
      {"aget", std::make_shared<AGetParser>()},
      {"aput", std::make_shared<APutParser>()},
      {"ajson2log", std::make_shared<AJson2LogParser>()},
      {"alog", std::make_shared<PlainSuccessParser>("alog", EOF_CLI)},
  };
  return parsers;
}

} // namespace

std::string directive_name(const std::string &directive) {
  std::istringstream input(directive);
  std::string raw;
  input >> raw;
  return raw.empty() ? directive : raw;
}

std::string extract_json_blob(const std::string &data) {
  auto extract_balanced = [&](char open_ch, char close_ch) -> std::optional<std::string> {
    const auto start = data.find(open_ch);
    if (start == std::string::npos) return std::nullopt;
    int depth = 0;
    bool in_string = false;
    bool escaped = false;
    for (std::size_t index = start; index < data.size(); ++index) {
      const char ch = data[index];
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch == '\\' && in_string) {
        escaped = true;
        continue;
      }
      if (ch == '"') {
        in_string = !in_string;
        continue;
      }
      if (in_string) {
        continue;
      }
      if (ch == open_ch) {
        ++depth;
      } else if (ch == close_ch) {
        --depth;
        if (depth == 0) {
          return data.substr(start, index - start + 1);
        }
      }
    }
    return std::nullopt;
  };

  if (const auto object = extract_balanced('{', '}')) {
    return *object;
  }
  if (const auto array = extract_balanced('[', ']')) {
    return *array;
  }
  throw RawDirectiveParseFailedError("json");
}

std::string trim_cli_output(const std::string &data, const std::string &cli, bool trim_default_eof) {
  auto current = data;
  auto trim = [](std::string &value) {
    const auto start = value.find_first_not_of(" \t\r\n");
    if (start == std::string::npos) {
      value.clear();
      return;
    }
    const auto end = value.find_last_not_of(" \t\r\n");
    value = value.substr(start, end - start + 1);
  };
  trim(current);
  if (!cli.empty() && current.rfind(cli, 0) == 0) {
    current = current.substr(cli.size());
  }
  trim(current);
  if (current.size() >= std::strlen(EOF_CLI) && current.rfind(EOF_CLI) == current.size() - std::strlen(EOF_CLI)) {
    current.erase(current.size() - std::strlen(EOF_CLI));
  }
  trim(current);
  if (trim_default_eof && current.size() >= std::strlen(EOF_DEFAULT) && current.rfind(EOF_DEFAULT) == current.size() - std::strlen(EOF_DEFAULT)) {
    current.erase(current.size() - std::strlen(EOF_DEFAULT));
  }
  trim(current);
  return current;
}

const RawDirectiveParser &get_raw_directive_output_parser(const std::string &directive) {
  const auto raw = directive_name(directive);
  const auto &parsers = registry();
  const auto it = parsers.find(raw);
  if (it == parsers.end()) {
    throw DirectiveParserMissingError(raw);
  }
  return *it->second;
}

std::string parse_directive_output_raw(const std::string &directive, const std::string &raw) {
  const auto &parser = get_raw_directive_output_parser(directive);
  return parser.parse(directive, raw);
}

nlohmann::json parse_directive_output_json(const std::string &directive, const std::string &raw) {
  const auto parsed = parse_directive_output_raw(directive, raw);
  if (parsed.empty()) {
    return nlohmann::json();
  }
  return nlohmann::json::parse(parsed);
}

} // namespace mkp
