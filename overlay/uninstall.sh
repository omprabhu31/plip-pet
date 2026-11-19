#!/bin/bash
# Removes Plip Overlay and its login item. The plugin goes back to showing
# Plip in the desktop app's corner from the next session.
set -uo pipefail

LABEL="com.omprabhu31.plip-overlay"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
pkill -x PlipOverlay 2>/dev/null
rm -f "$HOME/Library/LaunchAgents/$LABEL.plist"
rm -rf "$HOME/Applications/Plip Overlay.app"
rm -f "$HOME/.plip/overlay-installed"
rm -f "$HOME/.plip/overlay-disabled"
launchctl enable "gui/$(id -u)/$LABEL" 2>/dev/null
echo "Plip Overlay removed."
