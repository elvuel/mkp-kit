#include "../common/common.hpp"

int main(int argc, char **argv) {
  if (mkp::examples::wants_help(argc, argv)) {
    return mkp::examples::print_usage(argv, "[--port COM3]");
  }
  auto sfport = mkp::examples::make_port(argc, argv);
  sfport.open();
  std::cout << sfport.cancel_replay().dump(2) << "\n";
  return 0;
}
