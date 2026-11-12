#include "../common/common.hpp"

int main(int argc, char **argv) {
  if (mkp::examples::wants_help(argc, argv)) {
    return mkp::examples::print_usage(argv, "[--port COM3] <ssid> <password>");
  }
  auto args = mkp::examples::positional_args(argc, argv);
  if (args.size() < 2) {
    return mkp::examples::usage_error(argv, "[--port COM3] <ssid> <password>");
  }
  auto sfport = mkp::examples::make_port(argc, argv);
  sfport.open();
  mkp::examples::log_text(sfport.join(mkp::JoinOption{args[0], args[1]}));
  return 0;
}
