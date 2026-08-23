@echo off
rem Double-click launcher: junction every skill in this repo into %USERPROFILE%\.agents\skills
rem Paths resolve from this file's location (%~dp0), so it works from any cwd
rem and on any machine this repo is cloned to. Args pass through (--dry-run).
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: node was not found on PATH. Install Node.js first.
  pause
  exit /b 1
)
node "%~dp0scripts\install-skills-agents.mjs" %*
if errorlevel 1 (
  echo.
  echo Install FAILED - see errors above.
) else (
  echo.
  echo Install OK.
)
pause
