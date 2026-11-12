#pragma once

#include <stdexcept>
#include <string>

namespace mkp {

class MkpError : public std::runtime_error {
public:
  using std::runtime_error::runtime_error;
};

class DirectiveParserMissingError : public MkpError {
public:
  explicit DirectiveParserMissingError(const std::string &directive)
      : MkpError("directive parser missing: " + directive) {}
};

class RawDirectiveParseFailedError : public MkpError {
public:
  explicit RawDirectiveParseFailedError(const std::string &kind)
      : MkpError(kind) {}
};

class RawDirectiveExecutionFailedError : public MkpError {
public:
  explicit RawDirectiveExecutionFailedError(const std::string &directive)
      : MkpError("directive execution failed: " + directive) {}
};

class DirectiveTimeoutError : public MkpError {
public:
  DirectiveTimeoutError(const std::string &directive, int timeout_ms, const std::string &port = {})
      : MkpError("directive timeout: " + directive + (port.empty() ? std::string{} : (" on " + port)) +
                 " after " + std::to_string(timeout_ms) +
                 "ms; try --port COMx or set MKP_SFPORT/MKP_SF_PORT explicitly") {}
};

class TransportNotConfiguredError : public MkpError {
public:
  TransportNotConfiguredError() : MkpError("transport not configured") {}
};

} // namespace mkp
