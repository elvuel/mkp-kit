#pragma once

#include <functional>
#include <memory>
#include <string>
#include <unordered_map>

#include <nlohmann/json.hpp>

namespace mkp {

inline constexpr const char *EOF_DEFAULT = "<EOF>";
inline constexpr const char *EOF_CLI = "cli>";

class RawDirectiveParser {
public:
  RawDirectiveParser(std::string name, bool json_output = false, std::string eof_flag = EOF_CLI);
  virtual ~RawDirectiveParser() = default;

  std::string name;
  bool json_output = false;
  std::string eof_flag;

  virtual std::string sanitize_r(const std::string &data) const;
  virtual std::string preflight(const std::string &data) const;
  virtual bool is_execution_failed(const std::string &data) const;
  virtual std::string parse(const std::string &cli, const std::string &data) const;
};

std::string directive_name(const std::string &directive);
std::string extract_json_blob(const std::string &data);
std::string trim_cli_output(const std::string &data, const std::string &cli = {}, bool trim_default_eof = true);
const RawDirectiveParser &get_raw_directive_output_parser(const std::string &directive);
std::string parse_directive_output_raw(const std::string &directive, const std::string &raw);
nlohmann::json parse_directive_output_json(const std::string &directive, const std::string &raw);

} // namespace mkp
