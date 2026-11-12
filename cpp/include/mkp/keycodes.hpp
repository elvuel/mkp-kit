#pragma once

#include <array>
#include <map>
#include <string>
#include <vector>

namespace mkp {

extern const std::vector<std::string> MOD_KEY_NAMES;
extern const std::vector<std::string> MOD_KEY_SHORT_NAMES;
extern const std::map<std::string, int> KEY_NAME_TO_NCODE;
extern const std::map<std::string, std::string> KEY_NAME_TO_HEXCODE;
extern const std::map<std::string, std::vector<std::string>> SYMBOL_EXPANSIONS;

bool is_mod_key(const std::string &key);
std::string key_name_to_hexcode(const std::string &key);
std::string normalize_kpad_key(const std::string &key);
std::vector<std::string> expand_kpad_input_key(const std::string &key);
std::string mod_status(const std::vector<std::string> &mod_keys);
std::pair<std::vector<std::string>, std::vector<std::string>> split_keys(const std::vector<std::string> &keys);

} // namespace mkp
