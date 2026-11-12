#pragma once

#include <optional>
#include <string>
#include <vector>

#include "mkp/models.hpp"
#include "mkp/sdk.hpp"

namespace mkp {

void m10(SFSerialPort &sfport, const M10Option &opt);
double pixels_to_m10_units(double distance_pixels, double pixels_per_m10_unit);
int auto_m10_duration(double distance_m10_units, double m10_units_per_second);
std::vector<KpadOption> build_text_tap_options(const std::string &text, const std::optional<KpadOption> &base = std::nullopt);
void type_text(SFSerialPort &sfport, const std::string &text, const std::optional<KpadOption> &base = std::nullopt);

} // namespace mkp
