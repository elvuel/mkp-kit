#pragma once

#include <optional>
#include <string>

namespace mkp {

std::string directive_slug(const std::string &directive);
std::string preview_text(const std::string &data, std::size_t max_lines = 3, std::size_t max_chars = 180);
std::optional<std::string> write_debug_capture(const std::string &kind,
                                               const std::string &directive,
                                               const std::string &raw_output,
                                               const std::string &pending_buffer = {},
                                               const std::string &last_sync_directive = {},
                                               const std::string &last_sync_output = {},
                                               const std::string &parsed_output = {},
                                               const std::string &error_text = {});

} // namespace mkp
