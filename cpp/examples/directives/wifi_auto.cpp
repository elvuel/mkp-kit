#include "../common/common.hpp"

int main(int argc, char **argv) {
  if (mkp::examples::wants_help(argc, argv)) {
    return mkp::examples::print_usage(argv, "[--port COM3] [0|1]");
  }
  auto args = mkp::examples::positional_args(argc, argv);
  auto sfport = mkp::examples::make_port(argc, argv);
  sfport.open();
  mkp::examples::log_text(sfport.wifi_auto(args.empty() ? mkp::WifiAutoOption{} : mkp::WifiAutoOption{args[0]}));
  return 0;
}
