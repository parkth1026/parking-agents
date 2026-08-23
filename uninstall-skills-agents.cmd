@echo off
rem Double-click launcher: remove the junctions this repo installed into
rem %USERPROFILE%\.agents\skills. Only links pointing into this repo are
rem removed - other content (lark-*, backups) stays. Args pass through.
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: node was not found on PATH. Install Node.js first.
  pause
  exit /b 1
)
node "%~dp0scripts\uninstall-skills-agents.mjs" %*
if errorlevel 1 (
  echo.
  echo Uninstall FAILED - see errors above.
) else (
  echo.
  echo Uninstall OK.
)
pause
