cmake_minimum_required(VERSION 3.24)

project(mkp_cpp VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(MKP_CPP_BUILD_TESTS "Build mkp-cpp tests" OFF)
option(MKP_CPP_BUILD_EXAMPLES "Build mkp-cpp examples" ON)
option(MKP_CPP_BUILD_HTTP_TOOLS "Build mkp-cpp server/file-server tools" ON)

include(FetchContent)

if(MKP_CPP_BUILD_TESTS)
  FetchContent_Declare(
    Catch2
    GIT_REPOSITORY https://github.com/catchorg/Catch2.git
    GIT_TAG v3.7.1
  )
  FetchContent_MakeAvailable(Catch2)
endif()

find_package(Threads REQUIRED)

set(MKP_CPP_SOURCES
  src/debug.cpp
  src/keycodes.cpp
  src/models.cpp
  src/parser.cpp
  src/sdk.cpp
  src/helper.cpp
  src/controller.cpp
  src/converter.cpp
  src/cli.cpp
)

if(MKP_CPP_BUILD_HTTP_TOOLS)
  list(APPEND MKP_CPP_SOURCES
    src/file_server.cpp
    src/server.cpp
  )
endif()

add_library(mkp_cpp ${MKP_CPP_SOURCES})

target_include_directories(mkp_cpp PUBLIC include)
target_link_libraries(mkp_cpp PUBLIC Threads::Threads)

if(WIN32)
  target_link_libraries(mkp_cpp PUBLIC bcrypt)
  target_link_libraries(mkp_cpp PUBLIC ws2_32)
  target_link_libraries(mkp_cpp PUBLIC setupapi)
  target_link_libraries(mkp_cpp PUBLIC advapi32)
endif()

target_compile_definitions(mkp_cpp PUBLIC NOMINMAX)

add_executable(mkp src/bin/mkp.cpp)
target_link_libraries(mkp PRIVATE mkp_cpp)

add_executable(mkp-converter src/bin/converter.cpp)
target_link_libraries(mkp-converter PRIVATE mkp_cpp)

add_executable(mkp-json2log src/bin/json2log.cpp)
target_link_libraries(mkp-json2log PRIVATE mkp_cpp)

add_executable(mkp-log2json src/bin/log2json.cpp)
target_link_libraries(mkp-log2json PRIVATE mkp_cpp)

if(MKP_CPP_BUILD_HTTP_TOOLS)
  add_executable(mkp-file-server src/bin/file_server.cpp)
  target_link_libraries(mkp-file-server PRIVATE mkp_cpp)

  add_executable(mkp-server src/bin/server.cpp)
  target_link_libraries(mkp-server PRIVATE mkp_cpp)
endif()

if(MKP_CPP_BUILD_EXAMPLES)
  file(GLOB MKP_CPP_EXAMPLE_SOURCES CONFIGURE_DEPENDS
    examples/*.cpp
    examples/directives/*.cpp
  )
  foreach(example_source IN LISTS MKP_CPP_EXAMPLE_SOURCES)
    get_filename_component(example_name "${example_source}" NAME_WE)
    get_filename_component(example_dir "${example_source}" DIRECTORY)
    if(example_dir MATCHES "/directives$")
      set(target_name "example-directive-${example_name}")
    else()
      set(target_name "example-${example_name}")
    endif()
    add_executable(${target_name} ${example_source})
    target_link_libraries(${target_name} PRIVATE mkp_cpp)
    target_include_directories(${target_name} PRIVATE examples/common)
  endforeach()
endif()

if(MKP_CPP_BUILD_TESTS)
  enable_testing()
  add_executable(mkp_cpp_tests
    tests/parser_tests.cpp
    tests/sdk_tests.cpp
    tests/helper_tests.cpp
    tests/converter_tests.cpp
    tests/file_server_tests.cpp
  )
  target_link_libraries(mkp_cpp_tests PRIVATE mkp_cpp Catch2::Catch2WithMain)
  include(CTest)
  include(Catch)
  catch_discover_tests(mkp_cpp_tests)
endif()

