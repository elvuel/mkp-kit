#include <catch2/catch_test_macros.hpp>

#include <filesystem>
#include <fstream>

#include "mkp/file_server.hpp"

TEST_CASE("safe_join rejects traversal", "[file-server]") {
  const auto root = std::filesystem::temp_directory_path().string();
  REQUIRE(mkp::safe_join(root, {"nested/file.txt"}).has_value());
  REQUIRE_FALSE(mkp::safe_join(root, {"../escape.txt"}).has_value());
}

TEST_CASE("sanitize_filename normalizes unsafe chars", "[file-server]") {
  REQUIRE(mkp::sanitize_filename("demo:name?.txt") == "demo_name_.txt");
}

TEST_CASE("list_directory returns sorted entries", "[file-server]") {
  const auto root = std::filesystem::temp_directory_path() / "mkp-cpp-file-server";
  std::filesystem::create_directories(root / "dir");
  std::ofstream(root / "dir" / "b.txt") << "b";
  std::ofstream(root / "dir" / "a.txt") << "aa";
  const auto items = mkp::list_directory((root / "dir").string(), root.string());
  REQUIRE(items.size() == 2);
  REQUIRE(items[0].name == "a.txt");
  REQUIRE(items[1].name == "b.txt");
}

