#include "../common/common.hpp"

int main(int argc, char **argv) {
  if (mkp::examples::wants_help(argc, argv)) {
    return mkp::examples::print_usage(argv, "[--port COM3] [http-base-url]");
  }
  auto args = mkp::examples::positional_args(argc, argv);
  auto sfport = mkp::examples::make_port(argc, argv);
  sfport.open();
  mkp::examples::log_json(sfport.ahttpbase(args.empty() ? mkp::AHTTPBaseOption{} : mkp::AHTTPBaseOption{args[0]}));
  return 0;
}
