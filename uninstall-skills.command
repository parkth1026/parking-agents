#!/bin/bash
# Double-click launcher (macOS): remove every link in your user skill
# directories that points into this repo's skills/ tree (interactive menu).
# Foreign entries (lark-*) are never touched. Args pass through
# (--target/--dry-run). No sudo needed.

# A double-clicked .command starts in $HOME, not in the repo — resolve via $0.
DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node was not found on PATH. Install Node.js first."
  if [ $# -eq 0 ]; then
    echo "Press any key to close..."
    read -n 1
  fi
  exit 1
fi

node "$DIR/scripts/uninstall-skills.mjs" "$@"
status=$?

if [ "$status" -ne 0 ]; then
  echo
  echo "Uninstall FAILED - see errors above."
else
  echo
  echo "Uninstall OK."
fi

# Keep the Terminal window open after a double-click launch; a terminal call
# with args is its own UI, no pause wanted there.
if [ $# -eq 0 ]; then
  echo "Press any key to close..."
  read -n 1
fi
exit "$status"
