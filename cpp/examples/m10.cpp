#include "common/common.hpp"

int main(int argc, char **argv) {
  if (mkp::examples::wants_help(argc, argv)) {
    return mkp::examples::print_usage(argv, "[--port COM3]");
  }
  auto sfport = mkp::examples::make_port(argc, argv);
  sfport.open();
  mkp::Controller controller(std::move(sfport));
  controller.mouse_move_smooth(-400, 0, 220);
  controller.mouse_move_smooth(0, -400, 220);
  return 0;
}
