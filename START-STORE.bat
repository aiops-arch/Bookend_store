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

REM --- Start the frontend (the screens) on port 5173, open to the network ---
echo Starting the app screens...
start "FG Inventory - App" cmd /k "cd /d "%~dp0frontend" && npx vite --host 0.0.0.0 --port 5173"

REM --- Give the app a moment, then open it in the browser ---
timeout /t 5 /nobreak >nul
start "" "http://localhost:5173"

echo.
echo ============================================
echo  Store system is starting.
echo  On THIS computer:      http://localhost:5173
echo  On phones/tablets:     http://172.16.36.160:5173
echo.
echo  Two black windows opened (Backend + App).
echo  Keep them open while using the system.
echo  To stop: close those two windows.
echo ============================================
echo.
pause
