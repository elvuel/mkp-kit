#include "mkp/keycodes.hpp"

#include <algorithm>
#include <cctype>
#include <iomanip>
#include <sstream>

namespace mkp {

const std::vector<std::string> MOD_KEY_NAMES = {
    "MOD_LCTRL", "MOD_LSHIFT", "MOD_LALT", "MOD_LMETA", "MOD_RCTRL", "MOD_RSHIFT", "MOD_RALT", "MOD_RMETA"};

const std::vector<std::string> MOD_KEY_SHORT_NAMES = {
    "LCTRL", "LSHIFT", "LALT", "LMETA", "RCTRL", "RSHIFT", "RALT", "RMETA"};

const std::map<std::string, int> KEY_NAME_TO_NCODE = {
    {"MOD_LCTRL", 0x01},   {"MOD_LSHIFT", 0x02}, {"MOD_LALT", 0x04},      {"MOD_LMETA", 0x08},
    {"MOD_RCTRL", 0x10},   {"MOD_RSHIFT", 0x20}, {"MOD_RALT", 0x40},      {"MOD_RMETA", 0x80},
    {"NONE", 0x00},        {"A", 0x04},          {"B", 0x05},             {"C", 0x06},
    {"D", 0x07},           {"E", 0x08},          {"F", 0x09},             {"G", 0x0A},
    {"H", 0x0B},           {"I", 0x0C},          {"J", 0x0D},             {"K", 0x0E},
    {"L", 0x0F},           {"M", 0x10},          {"N", 0x11},             {"O", 0x12},
    {"P", 0x13},           {"Q", 0x14},          {"R", 0x15},             {"S", 0x16},
    {"T", 0x17},           {"U", 0x18},          {"V", 0x19},             {"W", 0x1A},
    {"X", 0x1B},           {"Y", 0x1C},          {"Z", 0x1D},             {"1", 0x1E},
    {"2", 0x1F},           {"3", 0x20},          {"4", 0x21},             {"5", 0x22},
    {"6", 0x23},           {"7", 0x24},          {"8", 0x25},             {"9", 0x26},
    {"0", 0x27},           {"ENTER", 0x28},      {"ESC", 0x29},           {"BACKSPACE", 0x2A},
    {"TAB", 0x2B},         {"SPACE", 0x2C},      {"MINUS", 0x2D},         {"EQUAL", 0x2E},
    {"LEFTBRACE", 0x2F},   {"RIGHTBRACE", 0x30}, {"BACKSLASH", 0x31},     {"SEMICOLON", 0x33},
    {"APOSTROPHE", 0x34},  {"GRAVE", 0x35},      {"COMMA", 0x36},         {"DOT", 0x37},
    {"SLASH", 0x38},       {"RIGHT", 0x4F},      {"LEFT", 0x50},          {"DOWN", 0x51},
    {"UP", 0x52},
};

const std::map<std::string, std::string> KEY_NAME_TO_HEXCODE = [] {
  std::map<std::string, std::string> output;
  for (const auto &[name, code] : KEY_NAME_TO_NCODE) {
    std::ostringstream text;
    text << "0x" << std::hex << std::nouppercase << std::setw(2) << std::setfill('0') << code;
    output.emplace(name, text.str());
  }
  return output;
}();

const std::map<std::string, std::vector<std::string>> SYMBOL_EXPANSIONS = {
    {"!", {"MOD_LSHIFT", "1"}},        {"@", {"MOD_LSHIFT", "2"}},
    {"#", {"MOD_LSHIFT", "3"}},        {"$", {"MOD_LSHIFT", "4"}},
    {"%", {"MOD_LSHIFT", "5"}},        {"^", {"MOD_LSHIFT", "6"}},
    {"&", {"MOD_LSHIFT", "7"}},        {"*", {"MOD_LSHIFT", "8"}},
    {"(", {"MOD_LSHIFT", "9"}},        {")", {"MOD_LSHIFT", "0"}},
    {" ", {"SPACE"}},                   {"-", {"MINUS"}},
    {"_", {"MOD_LSHIFT", "MINUS"}},   {"=", {"EQUAL"}},
    {"+", {"MOD_LSHIFT", "EQUAL"}},   {"[", {"LEFTBRACE"}},
    {"{", {"MOD_LSHIFT", "LEFTBRACE"}}, {"]", {"RIGHTBRACE"}},
    {"}", {"MOD_LSHIFT", "RIGHTBRACE"}}, {"\\", {"BACKSLASH"}},
    {"|", {"MOD_LSHIFT", "BACKSLASH"}},  {";", {"SEMICOLON"}},
    {":", {"MOD_LSHIFT", "SEMICOLON"}},  {"'", {"APOSTROPHE"}},
    {"\"", {"MOD_LSHIFT", "APOSTROPHE"}}, {"`", {"GRAVE"}},
    {"~", {"MOD_LSHIFT", "GRAVE"}},    {",", {"COMMA"}},
    {"<", {"MOD_LSHIFT", "COMMA"}},    {".", {"DOT"}},
    {">", {"MOD_LSHIFT", "DOT"}},      {"/", {"SLASH"}},
    {"?", {"MOD_LSHIFT", "SLASH"}},
};

bool is_mod_key(const std::string &key) {
  return std::find(MOD_KEY_NAMES.begin(), MOD_KEY_NAMES.end(), key) != MOD_KEY_NAMES.end();
}

std::string key_name_to_hexcode(const std::string &key) {
  const auto it = KEY_NAME_TO_HEXCODE.find(key);
  return it == KEY_NAME_TO_HEXCODE.end() ? std::string{} : it->second;
}

std::string normalize_kpad_key(const std::string &key) {
  std::string normalized;
  normalized.reserve(key.size());
  for (char ch : key) {
    normalized.push_back(static_cast<char>(std::toupper(static_cast<unsigned char>(ch))));
  }
  if (normalized.empty()) {
    return {};
  }
  if (normalized == "CTRL") {
    return "MOD_LCTRL";
  }
  if (normalized == "SHIFT") {
    return "MOD_LSHIFT";
  }
  if (normalized == "ALT") {
    return "MOD_LALT";
  }
  if (normalized == "META") {
    return "MOD_LMETA";
  }
  if (normalized == "LEFTBRACKET") {
    return "LEFTBRACE";
  }
  if (normalized == "RIGHTBRACKET") {
    return "RIGHTBRACE";
  }
  if (std::find(MOD_KEY_SHORT_NAMES.begin(), MOD_KEY_SHORT_NAMES.end(), normalized) != MOD_KEY_SHORT_NAMES.end()) {
    return "MOD_" + normalized;
  }
  return normalized;
}

std::vector<std::string> expand_kpad_input_key(const std::string &key) {
  const auto symbol_it = SYMBOL_EXPANSIONS.find(key);
  if (symbol_it != SYMBOL_EXPANSIONS.end()) {
    return symbol_it->second;
  }
  if (key.size() == 1 && key[0] >= 'a' && key[0] <= 'z') {
    return {std::string(1, static_cast<char>(std::toupper(static_cast<unsigned char>(key[0]))))};
  }
  if (key.size() == 1 && key[0] >= 'A' && key[0] <= 'Z') {
    return {"MOD_LSHIFT", std::string(1, key[0])};
  }
  const auto normalized = normalize_kpad_key(key);
  if (normalized.empty()) {
    return {};
  }
  return {normalized};
}

std::string mod_status(const std::vector<std::string> &mod_keys) {
  int code = 0;
  for (const auto &key : mod_keys) {
    const auto it = KEY_NAME_TO_NCODE.find(key);
    if (it != KEY_NAME_TO_NCODE.end()) {
      code |= it->second;
    }
  }
  if (code == 0) {
    return {};
  }
  std::ostringstream text;
  text << "0x" << std::hex << std::nouppercase << std::setw(2) << std::setfill('0') << code;
  return text.str();
}

std::pair<std::vector<std::string>, std::vector<std::string>> split_keys(const std::vector<std::string> &keys) {
  std::vector<std::string> mod_keys;
  std::vector<std::string> normal_keys;
  for (const auto &key : keys) {
    if (is_mod_key(key)) {
      mod_keys.push_back(key);
    } else {
      normal_keys.push_back(key);
    }
  }
  return {mod_keys, normal_keys};
}

} // namespace mkp
