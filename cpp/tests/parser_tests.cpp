#include <catch2/catch_test_macros.hpp>

#include "mkp/parser.hpp"

TEST_CASE("join parser handles connected", "[parser]") {
  const auto &parser = mkp::get_raw_directive_output_parser("join ssid password1234");
  const std::string out = "join ssid password1234\nI (29664) connect: Connecting to 'ssid'\nI (31648) connect: Connected\n";
  REQUIRE(parser.parse("join ssid password1234", out) == "connected");
}

TEST_CASE("wifi_auto parser handles on", "[parser]") {
  const auto &parser = mkp::get_raw_directive_output_parser("wifi_auto");
  const std::string out = "wifi_auto\nauto: on\ncli>";
  REQUIRE(parser.parse("wifi_auto", out) == "on");
}

TEST_CASE("acancel parser keeps raw json", "[parser]") {
  const auto parsed = mkp::parse_directive_output_raw("acancel", "acancel\n{\"ok\":true}\n<EOF>\ncli>");
  REQUIRE(parsed == "{\"ok\":true}");
}

TEST_CASE("list_dir parser extracts json blob", "[parser]") {
  const auto json = mkp::parse_directive_output_json("list_dir /eMMC/applog",
                                                     "list_dir /eMMC/applog\n{\"rootDir\":{\"name\":\"applog\",\"path\":\"/eMMC/applog\",\"type\":\"directory\",\"size\":0,\"contents\":[]},\"error\":\"\"}\n<EOF>\ncli>");
  REQUIRE(json["rootDir"]["path"] == "/eMMC/applog");
}

TEST_CASE("atime parser extracts line json", "[parser]") {
  const auto json = mkp::parse_directive_output_json("atime demo/record1",
                                                     "atime demo/record1\nI (123) alog: logfile /eMMC/applog/demo/record1.log\n{\"seconds\": 1, \"milsec\": 230}\n<EOF>\ncli>");
  REQUIRE(json["seconds"] == 1);
  REQUIRE(json["milsec"] == 230);
}

TEST_CASE("ahttpbase parser handles set ok", "[parser]") {
  const auto json = mkp::parse_directive_output_json("ahttpbase http://localhost:3000", "ahttpbase http://localhost:3000\nOK\n\ncli>");
  REQUIRE(json["ahttpbase"] == "http://localhost:3000");
}

