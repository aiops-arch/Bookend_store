@echo off
REM Daily FG Inventory database backup. Double-click to run, or schedule it.
cd /d "%~dp0backend"
node src\db\backup.js
echo.
echo Backups are kept in:  %~dp0backend\backups
