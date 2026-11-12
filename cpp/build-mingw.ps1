param(
  [string]$BuildDir = "build",
  [int]$Parallel = 4
)

$ErrorActionPreference = "Stop"

$CppRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BuildPath = Join-Path $CppRoot $BuildDir

cmake -S $CppRoot -B $BuildPath -G "MinGW Makefiles"
cmake --build $BuildPath --parallel $Parallel
