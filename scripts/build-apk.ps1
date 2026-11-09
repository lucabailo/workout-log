# Builds an installable Android APK on Windows, without Expo services.
# Usage (from the project folder):  powershell -ExecutionPolicy Bypass -File scripts\build-apk.ps1
#
# Why the copy: the C++ parts of some libraries (react-native-worklets) create paths longer than
# Windows' 260-character limit when the project lives in a deep folder such as Desktop\Progetti.
# Building from C:\wl keeps every path short. The APK is copied back to this folder.

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$build   = 'C:\wl'
$sdk     = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { "$env:LOCALAPPDATA\Android\Sdk" }

if (-not (Test-Path $sdk)) { throw "Android SDK not found at $sdk. Install it with Android Studio first." }

Write-Host "1/4 Copying the project to $build ..."
# /MIR mirrors the folder; generated and installed folders are skipped
robocopy $project $build /MIR /NFL /NDL /NJH /NJS /NP /XD node_modules android ios .expo dist .git /XF '*.apk' 'build-log.txt' | Out-Null
if ($LASTEXITCODE -ge 8) { throw "Copy failed (robocopy exit code $LASTEXITCODE)" }

Set-Location $build
Write-Host "2/4 Installing dependencies (npm ci) ..."
npm ci --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }

Write-Host "3/4 Generating the native Android project ..."
npx expo prebuild --platform android --clean --no-install
if ($LASTEXITCODE -ne 0) { throw 'expo prebuild failed' }
$escape = { param($path) ($path -replace '\\', '\\' -replace ':', '\:') }
$props = @("sdk.dir=" + (& $escape $sdk))
# Use the newest CMake installed in the SDK: its ninja supports paths longer than 260 characters
# (the default 3.22 does not, and some generated C++ paths are longer than that).
$cmake = Get-ChildItem "$sdk\cmake" -Directory -ErrorAction SilentlyContinue |
  Sort-Object { [version]($_.Name -replace '[^0-9.].*$', '') } -Descending | Select-Object -First 1
if (-not $cmake -or [version]($cmake.Name -replace '[^0-9.].*$', '') -lt [version]'3.31') {
  throw "Install CMake 3.31 or newer: Android Studio > SDK Manager > SDK Tools > Show Package Details > CMake."
}
Write-Host "    using CMake $($cmake.Name)"
$props += "cmake.dir=" + (& $escape $cmake.FullName)
Set-Content -Path "$build\android\local.properties" -Value $props
$long = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -ErrorAction SilentlyContinue).LongPathsEnabled
if ($long -ne 1) { throw 'Windows long paths are off. Enable them (see README) and restart the PC.' }

Write-Host "4/4 Compiling the APK (the first time takes 10-20 minutes) ..."
Set-Location "$build\android"
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
if ($LASTEXITCODE -ne 0) { throw 'Gradle build failed' }

$version = (Get-Content "$project\app.json" -Raw | ConvertFrom-Json).expo.version
$apk = Join-Path $project "WorkoutLog-$version.apk"
Copy-Item "$build\android\app\build\outputs\apk\release\app-release.apk" $apk -Force
Set-Location $project
Write-Host ""
Write-Host "Done: $apk" -ForegroundColor Green
