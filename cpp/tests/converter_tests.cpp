#include <catch2/catch_test_macros.hpp>

#include <filesystem>

#include "mkp/converter.hpp"

TEST_CASE("converter direction infers from extension", "[converter]") {
  REQUIRE(mkp::direction_from_path("demo.log") == mkp::Direction::LogToJson);
  REQUIRE(mkp::direction_from_path("demo.json") == mkp::Direction::JsonToLog);
  REQUIRE(mkp::direction_from_path("demo.txt") == mkp::Direction::Unknown);
}

TEST_CASE("converter roundtrip preserves envelope", "[converter]") {
  const auto root = std::filesystem::temp_directory_path() / "mkp-cpp-converter";
  std::filesystem::create_directories(root);
  const auto json_path = (root / "demo.json").string();
  const auto log_path = (root / "demo.log").string();
  const auto out_json = (root / "demo-out.json").string();
  const nlohmann::json seed = {
      {"format", "mkp-action-v1"},
      {"version", "MKv1"},
      {"meta", {{"width", 0}, {"height", 0}, {"startX", 0}, {"startY", 0}}},
      {"events", nlohmann::json::array({{{"typeName", "KeyDown"}, {"keyDown", {{"keys", {"a"}}, {"ts", 1}}}}})},
  };
  mkp::write_json_file(json_path, seed);
  mkp::convert_json_file_to_log_file(json_path, log_path);
  mkp::convert_log_file_to_json_file(log_path, out_json);
  REQUIRE(mkp::read_json_file(out_json) == seed);
}

