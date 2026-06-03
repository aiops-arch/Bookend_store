@echo off
title Book Ends - Invoice Auto-Entry Watcher
echo ===================================================
echo   Invoice auto-entry is running.
echo   Drop structured invoice .json files into:
echo      %~dp0invoices\inbox
echo   They will be entered automatically (confirmed + locked).
echo   Processed -> invoices\done   Failed -> invoices\failed
echo   Keep this window open. Close it to stop.
echo ===================================================
echo.
cd /d "%~dp0backend"
node src\jobs\invoiceWatcher.js
pause
