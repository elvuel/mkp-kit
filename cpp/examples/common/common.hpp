#pragma once

#include <iostream>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

#include "mkp/controller.hpp"
#include "mkp/helper.hpp"
#include "mkp/sdk.hpp"

namespace mkp::examples {

inline std::string resolve_port(int argc, char **argv, int value_index = 1) {
  for (int i = 1; i < argc; ++i) {
    const std::string arg = argv[i];
    if (arg == "--port" && i + 1 < argc) {
      return argv[i + 1];
    }
  }
  return check_sf_serial_port();
}

inline SFSerialPort make_port(int argc, char **argv) {
  return new_sf_serial_port({resolve_port(argc, argv)});
}

inline std::string program_name(char **argv) {
  const std::string raw = argv && argv[0] ? argv[0] : "example";
  const auto pos = raw.find_last_of("\\/");
  return pos == std::string::npos ? raw : raw.substr(pos + 1);
}

inline bool wants_help(int argc, char **argv) {
  for (int i = 1; i < argc; ++i) {
    const std::string arg = argv[i];
    if (arg == "-h" || arg == "--help" || arg == "help") {
      return true;
    }
  }
  return false;
}

inline int print_usage(char **argv, const std::string &syntax) {
  std::cout << "usage: " << program_name(argv) << " " << syntax << "\n";
  return 0;
}

inline int usage_error(char **argv, const std::string &syntax) {
  std::cerr << "usage: " << program_name(argv) << " " << syntax << "\n";
  return 1;
}

inline std::vector<std::string> positional_args(int argc, char **argv) {
  std::vector<std::string> args;
  for (int i = 1; i < argc; ++i) {
    const std::string arg = argv[i];
    if (arg == "--port") {
      if (i + 1 < argc) {
        ++i;
      }
      continue;
    }
    args.push_back(arg);
  }
  return args;
}

template <typename T>
inline void log_json(const T &value) {
  std::cout << nlohmann::json(value).dump(2) << "\n";
}

inline void log_text(const std::string &value) {
  std::cout << value << "\n";
}

} // namespace mkp::examples
