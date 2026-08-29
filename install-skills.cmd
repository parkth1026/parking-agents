@echo off
rem Double-click launcher: junction this repo's skills into your user skill
rem directories (interactive menu). Paths resolve from this file's location
rem (%~dp0), so it works from any cwd and on any machine this repo is cloned
rem to. Args pass through (--target/--set/--only/--skills/--dry-run/--list).
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: node was not found on PATH. Install Node.js first.
  pause
  exit /b 1
)
node "%~dp0scripts\install-skills.mjs" %*
if errorlevel 1 (
  echo.
  echo Install FAILED - see errors above.
) else (
  echo.
  echo Install OK.
)
pause
