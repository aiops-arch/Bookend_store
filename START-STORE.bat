@echo off
title FG Inventory - Store System Launcher
echo ============================================
echo    FG Inventory - Starting the store system
echo ============================================
echo.

REM --- Start the backend (database + scanning engine) on port 4000 ---
echo Starting backend server...
start "FG Inventory - Backend" cmd /k "cd /d "%~dp0backend" && node src\server.js"

REM --- Give the backend a moment to come up ---
timeout /t 4 /nobreak >nul

REM --- Backend serves the built app screens too ---
echo Opening the app screens...
timeout /t 3 /nobreak >nul
start "" "http://localhost:4000"

echo.
echo ============================================
echo  Store system is starting.
echo  On THIS computer:      http://localhost:4000
echo  Backend health:        http://localhost:4000/api/health
echo.
echo  One black Backend window opened.
echo  Keep it open while using the system.
echo  To stop: close that Backend window.
echo ============================================
echo.
pause
