@echo off
rem run-wrapper-version: 1.1.0
node "%~dp0scripts\run.mjs" %*
exit /b %errorlevel%
