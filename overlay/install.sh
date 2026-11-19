#!/bin/bash
# Builds Plip Overlay, puts it in ~/Applications and starts it at every login.
# Run it again after updating the overlay; overlay/uninstall.sh removes it.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HOME/Applications/Plip Overlay.app"
LABEL="com.omprabhu31.plip-overlay"
AGENT="$HOME/Library/LaunchAgents/$LABEL.plist"
BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Plip Overlay runs on macOS only." >&2
  exit 1
fi
if ! command -v swiftc >/dev/null; then
  echo "swiftc not found. Install the Xcode command line tools: xcode-select --install" >&2
  exit 1
fi

echo "Building Plip Overlay…"
swiftc -O -swift-version 5 -o "$BUILD/PlipOverlay" "$HERE/PlipOverlay.swift" \
  -framework AppKit -framework WebKit

mkdir -p "$BUILD/Plip Overlay.app/Contents/MacOS"
mv "$BUILD/PlipOverlay" "$BUILD/Plip Overlay.app/Contents/MacOS/PlipOverlay"
cat > "$BUILD/Plip Overlay.app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>$LABEL</string>
  <key>CFBundleName</key><string>Plip Overlay</string>
  <key>CFBundleExecutable</key><string>PlipOverlay</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>0.5.0</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
codesign --force --sign - "$BUILD/Plip Overlay.app" >/dev/null

# Stop a running copy before replacing it.
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
pkill -x PlipOverlay 2>/dev/null || true

mkdir -p "$HOME/Applications"
rm -rf "$APP"
mv "$BUILD/Plip Overlay.app" "$APP"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" 2>/dev/null || true

# Tells the plugin to leave the desktop app's corner widget closed.
mkdir -p "$HOME/.plip"
touch "$HOME/.plip/overlay-installed"

# Starts at login; restarts after a crash, but stays closed after Quit.
mkdir -p "$(dirname "$AGENT")"
cat > "$AGENT" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$APP/Contents/MacOS/PlipOverlay</string></array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>LimitLoadToSessionType</key><string>Aqua</string>
  <key>ProcessType</key><string>Interactive</string>
</dict></plist>
PLIST
launchctl bootstrap "gui/$(id -u)" "$AGENT"

echo "Plip Overlay is installed and running; it starts at every login."
echo "Drag Plip to move it, click to open Claude, Option-click to pet, right-click for more."
