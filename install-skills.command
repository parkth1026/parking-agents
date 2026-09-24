#!/bin/bash
# Double-click launcher (macOS): link this repo's skills into your user skill
# directories (interactive menu). Paths resolve from this file's location, so
# it works from any cwd and on any machine this repo is cloned to. Args pass
# through (--target/--set/--only/--skills/--dry-run/--list). No sudo needed.

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

node "$DIR/scripts/install-skills.mjs" "$@"
status=$?

if [ "$status" -ne 0 ]; then
  echo
  echo "Install FAILED - see errors above."
else
  echo
  echo "Install OK."
fi

# Keep the Terminal window open after a double-click launch; a terminal call
# with args is its own UI, no pause wanted there.
if [ $# -eq 0 ]; then
  echo "Press any key to close..."
  read -n 1
fi
exit "$status"
