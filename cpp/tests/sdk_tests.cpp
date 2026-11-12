#include <catch2/catch_test_macros.hpp>

#include "mkp/sdk.hpp"

TEST_CASE("compose_log_fullpath adds applog prefix and suffix", "[sdk]") {
  REQUIRE(mkp::compose_log_fullpath("demo") == "/eMMC/applog/demo.log");
  REQUIRE(mkp::compose_log_fullpath("/eMMC/applog/demo.log") == "/eMMC/applog/demo.log");
}

TEST_CASE("dry run transport records directives", "[sdk]") {
  auto transport = std::make_shared<mkp::DryRunTransport>();
  mkp::SFSerialPort port({"COM_TEST", "1", "2", 1000, 115200, transport});
  port.send_directive_async("sn");
  REQUIRE(transport->sent_directives().size() == 1);
  REQUIRE(transport->sent_directives()[0] == "sn");
}

TEST_CASE("dry run mouse10 and keypad emit commands", "[sdk]") {
  auto transport = std::make_shared<mkp::DryRunTransport>();
  mkp::SFSerialPort port({"COM_TEST", "1", "2", 1000, 115200, transport});
  port.mouse10(mkp::M10Option{}.set_x(10).set_y(-5));
  port.keypad(mkp::KpadOption{}.with_keys({"A"}).with_auto_release());
  REQUIRE(transport->sent_directives().size() == 2);
  REQUIRE(transport->sent_directives()[0].find("m10 --port 1") == 0);
  REQUIRE(transport->sent_directives()[1].find("kpad --port 2") == 0);
}

