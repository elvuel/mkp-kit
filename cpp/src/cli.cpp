#include <iostream>
#include <vector>

#include "mkp/helper.hpp"

namespace mkp {

int run_cli(const std::vector<std::string> &argv) {
  if (argv.empty()) {
    std::cout << "Usage: mkp [--port COM3] <command> [args...]\n";
    std::cout << "Commands: sn, alive, aversion, atime <path>, list_dir <path>, m10 <x> <y>, kpad <text>\n";
    return 0;
  }

  std::string port = check_sf_serial_port();
  std::vector<std::string> args;
  for (std::size_t i = 0; i < argv.size(); ++i) {
    if (argv[i] == "--port" && i + 1 < argv.size()) {
      port = argv[++i];
    } else {
      args.push_back(argv[i]);
    }
  }
  if (args.empty()) return 0;

  auto sfport = new_sf_serial_port({port});
  sfport.open();
  const auto &command = args[0];
  if (command == "sn") {
    std::cout << sfport.sn().sn << "\n";
  } else if (command == "alive") {
    std::cout << sfport.alive().timetamp << "\n";
  } else if (command == "aversion") {
    std::cout << sfport.aversion().raw.dump(2) << "\n";
  } else if (command == "atime" && args.size() > 1) {
    std::cout << nlohmann::json(sfport.atime(args[1])).dump(2) << "\n";
  } else if (command == "list_dir" && args.size() > 1) {
    std::cout << sfport.list_dir(args[1]).raw.dump(2) << "\n";
  } else if (command == "m10" && args.size() > 2) {
    sfport.mouse10(M10Option{}.set_x(std::stoi(args[1])).set_y(std::stoi(args[2])));
  } else if (command == "kpad" && args.size() > 1) {
    type_text(sfport, args[1]);
  } else {
    throw std::runtime_error("unsupported command");
  }
  return 0;
}

} // namespace mkp
