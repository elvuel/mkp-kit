#include <catch2/catch_test_macros.hpp>

#include "mkp/helper.hpp"

TEST_CASE("auto_m10_duration clamps", "[helper]") {
  REQUIRE(mkp::auto_m10_duration(0, 100) == 0);
  REQUIRE(mkp::auto_m10_duration(1000, 100000) >= 60);
  REQUIRE(mkp::auto_m10_duration(100000, 1) <= 360);
}

TEST_CASE("build_text_tap_options preserves text length", "[helper]") {
  const auto options = mkp::build_text_tap_options("Hello MKP!");
  REQUIRE(options.size() == 10);
}

