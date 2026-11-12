#include "../common/common.hpp"

int main(int argc, char **argv) {
  if (mkp::examples::wants_help(argc, argv)) {
    return mkp::examples::print_usage(argv, "[--port COM3]");
  }
  auto sfport = mkp::examples::make_port(argc, argv);
  sfport.open();
  mkp::examples::log_text(sfport.stop_recording());
  return 0;
}
