#include "mkp/helper.hpp"

#include <chrono>
#include <cmath>
#include <thread>

#include "mkp/keycodes.hpp"

namespace mkp {

namespace {
constexpr int AUTO_M10_DURATION_MIN_MS = 60;
constexpr int AUTO_M10_DURATION_MAX_MS = 360;
}

void m10(SFSerialPort &sfport, const M10Option &opt) { sfport.mouse10(opt); }

double pixels_to_m10_units(double distance_pixels, double pixels_per_m10_unit) {
  if (pixels_per_m10_unit <= 0) return 0;
  return distance_pixels / pixels_per_m10_unit;
}

int auto_m10_duration(double distance_m10_units, double m10_units_per_second) {
  const auto distance = std::abs(distance_m10_units);
  if (distance <= 0 || m10_units_per_second <= 0) return 0;
  const auto duration = static_cast<int>((distance / m10_units_per_second) * 1000.0);
  return std::max(AUTO_M10_DURATION_MIN_MS, std::min(AUTO_M10_DURATION_MAX_MS, duration));
}

std::vector<KpadOption> build_text_tap_options(const std::string &text, const std::optional<KpadOption> &base) {
  std::vector<KpadOption> options;
  for (char ch : text) {
    auto option = base.value_or(KpadOption{});
    option.with_keys(expand_kpad_input_key(std::string(1, ch))).with_auto_release();
    options.push_back(option);
  }
  return options;
}

void type_text(SFSerialPort &sfport, const std::string &text, const std::optional<KpadOption> &base) {
  for (auto option : build_text_tap_options(text, base)) {
    sfport.keypad(option);
  }
}

} // namespace mkp
