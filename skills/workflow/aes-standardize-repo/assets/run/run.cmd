@echo off
rem run-wrapper-version: 1.3.0
rem Node missing is the first fresh-clone blocker (gates/preflight also run on Node): fail fast
rem with install guidance instead of a bare "node is not recognized" (run-standard 9.5).
rem This file must stay pure ASCII: cmd parses bytes in the active code page, and CJK
rem double-byte sequences can collide with cmd metacharacters, splitting rem/echo lines.
where node >nul 2>nul
if errorlevel 1 (
  echo [run] Node.js not found - every command in this repo needs it.
  echo [run] Install Node.js from https://nodejs.org - the default LTS download is enough.
  echo [run] Reopen your terminal after install, then try again.
  exit /b 69
)
node "%~dp0scripts\run.mjs" %*
exit /b %errorlevel%
