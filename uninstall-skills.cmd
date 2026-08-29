@echo off
rem Double-click launcher: remove every link in your user skill directories
rem that points into this repo's skills/ tree (interactive menu). Foreign
rem entries (lark-*) are never touched. Args pass through (--target/--dry-run).
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: node was not found on PATH. Install Node.js first.
  pause
  exit /b 1
)
node "%~dp0scripts\uninstall-skills.mjs" %*
if errorlevel 1 (
  echo.
  echo Uninstall FAILED - see errors above.
) else (
  echo.
  echo Uninstall OK.
)
pause
