#!/bin/bash
set -euo pipefail
runtime=$(xcrun simctl list runtimes -j | python3 -c 'import json,sys; r=[v for v in json.load(sys.stdin)["runtimes"] if v.get("isAvailable") and v["name"].startswith("iOS 18.2")]; print(r[0]["identifier"] if r else "")')
if [ -z "$runtime" ]; then
  xcrun simctl list runtimes
  echo 'iOS 18.2 simulator runtime is required for the Xcode 16.2 smoke test.' >&2
  exit 1
fi
device=$(xcrun simctl create 'LX Music CI' com.apple.CoreSimulator.SimDeviceType.iPhone-16 "$runtime")
trap 'xcrun simctl shutdown "$device" >/dev/null 2>&1 || true' EXIT
xcrun simctl boot "$device"
xcrun simctl bootstatus "$device" -b
xcodebuild -workspace ios/LxMusicMobile.xcworkspace -scheme LxMusicMobile \
  -configuration Release -sdk iphonesimulator -destination "id=$device" \
  -derivedDataPath build/SimulatorData ARCHS="$(uname -m)" IPHONEOS_DEPLOYMENT_TARGET=15.0 \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY='' \
  build 2>&1 | tee build/simulator-build.log
app=build/SimulatorData/Build/Products/Release-iphonesimulator/LxMusicMobile.app
ditto -c -k --keepParent "$app" build/simulator-app.zip
xcrun simctl install "$device" "$app"
SIMCTL_CHILD_LX_IOS_SMOKE=1 xcrun simctl launch --console "$device" com.wowsylvanas.lxmusic.ios > build/simulator-console.log 2>&1 &
launch_pid=$!
container=$(xcrun simctl get_app_container "$device" com.wowsylvanas.lxmusic.ios data)
report="$container/Library/Caches/lx-ios-smoke.json"
for attempt in $(seq 1 60); do
  if [ -f "$report" ]; then break; fi
  if ! kill -0 "$launch_pid" 2>/dev/null; then break; fi
  sleep 2
done
sleep 2
xcrun simctl io "$device" screenshot build/ios-simulator.png
xcrun simctl spawn "$device" log show --last 3m --style compact --predicate 'process == "LxMusicMobile"' > build/simulator-runtime.log
python3 - <<'PY'
import pathlib, shutil
target = pathlib.Path('build/crashes')
target.mkdir(exist_ok=True)
for directory in [pathlib.Path.home() / 'Library/Logs/DiagnosticReports', pathlib.Path.home() / 'Library/Developer/CoreSimulator/Devices']:
    pattern = 'LxMusicMobile*.ips' if directory.name == 'DiagnosticReports' else '**/LxMusicMobile*.ips'
    for report in directory.glob(pattern):
        shutil.copy2(report, target / report.name)
PY
test -f "$report"
cp "$report" build/lx-ios-smoke.json
python3 -c 'import json; r=json.load(open("build/lx-ios-smoke.json")); print(json.dumps(r,ensure_ascii=False,indent=2)); assert r["status"]=="passed",r'
