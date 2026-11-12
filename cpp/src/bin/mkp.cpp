#include <iostream>
#include <string>
#include <vector>

namespace mkp { int run_cli(const std::vector<std::string> &argv); }

int main(int argc, char **argv) {
  try {
    std::vector<std::string> args(argv + 1, argv + argc);
    return mkp::run_cli(args);
  } catch (const std::exception &error) {
    std::cerr << error.what() << "\n";
    return 1;
  }
}
