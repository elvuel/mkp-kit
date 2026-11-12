#include <iostream>

#include "mkp/converter.hpp"
#include "mkp/fs.hpp"

int main(int argc, char **argv) {
  try {
    if (argc < 2) throw std::runtime_error("usage: mkp-log2json <input.log> [output.json]");
    const std::string input = argv[1];
    const std::string output = argc > 2 ? argv[2] : std::string{};
    mkp::convert_log_file_to_json_file(input, output.empty() ? mkp::fs::path(input).replace_extension(".json").string() : output);
    return 0;
  } catch (const std::exception &error) {
    std::cerr << error.what() << "\n";
    return 1;
  }
}
