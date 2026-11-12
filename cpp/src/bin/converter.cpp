#include <iostream>
#include <vector>

#include "mkp/converter.hpp"

int main(int argc, char **argv) {
  try {
    std::vector<std::string> args(argv + 1, argv + argc);
    return mkp::run_converter(args);
  } catch (const std::exception &error) {
    std::cerr << error.what() << "\n";
    return 1;
  }
}
