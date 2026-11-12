#include <iostream>

#include "mkp/server.hpp"

int main(int argc, char **argv) {
  try {
    return mkp::run_server(std::vector<std::string>(argv + 1, argv + argc));
  } catch (const std::exception &error) {
    std::cerr << error.what() << "\n";
    return 1;
  }
}
