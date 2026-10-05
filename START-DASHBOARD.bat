@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Pitt Meeting Hub - Launch Guide

call :checkNode
if errorlevel 1 exit /b 1

:menu
cls
echo.
echo ============================================================
echo                  PITT MEETING HUB LAUNCHER
echo ============================================================
echo.
echo   [1] Start Pitt Meeting Hub ^(Windows controller^)
echo   [2] Start this computer's Agent Node dashboard
echo   [3] Edit Hub connection settings
echo   [4] Edit this computer's Node settings
echo   [5] Open README / deployment guide
echo   [Q] Exit
echo.
choice /C 12345Q /N /M "Choose"
if errorlevel 6 goto :eof
if errorlevel 5 goto docs
if errorlevel 4 goto nodeConfig
if errorlevel 3 goto hubConfig
if errorlevel 2 goto node
if errorlevel 1 goto hub

:hub
if not exist "packages\hub\config\hub.local.json" copy /Y "packages\hub\config\hub.example.json" "packages\hub\config\hub.local.json" >nul
echo Starting Pitt Meeting Hub in a separate window...
start "Pitt Meeting Hub" cmd /k "call ""%CD%\scripts\start-hub.bat"""
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:3000"
goto done

:node
if not exist "packages\node\config\node.local.json" copy /Y "packages\node\config\node.example.json" "packages\node\config\node.local.json" >nul
echo Starting this computer's Agent Node dashboard in a separate window...
start "Agent Node Dashboard" cmd /k "call ""%CD%\scripts\start-node.bat"""
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:3100"
goto done

:hubConfig
if not exist "packages\hub\config\hub.local.json" copy /Y "packages\hub\config\hub.example.json" "packages\hub\config\hub.local.json" >nul
notepad "packages\hub\config\hub.local.json"
goto menu

:nodeConfig
if not exist "packages\node\config\node.local.json" copy /Y "packages\node\config\node.example.json" "packages\node\config\node.local.json" >nul
notepad "packages\node\config\node.local.json"
goto menu

:docs
start "" "README.md"
goto menu

:done
echo.
echo Browser launch requested. Keep the new server window open while using the dashboard.
echo Press any key to return to the menu.
pause >nul
goto menu

:checkNode
where node >nul 2>nul
if errorlevel 1 goto nodeMissing
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 goto nodeOld
exit /b 0

:nodeMissing
echo Node.js 22.13+ was not found.
choice /C YN /N /M "Open the official Node.js download page now"
if errorlevel 2 exit /b 1
start "" "https://nodejs.org/en/download"
echo Install Node.js LTS, close this window, then run START-DASHBOARD.bat again.
pause
exit /b 1

:nodeOld
echo Node.js 22.13+ is required. Your installed Node.js is too old.
start "" "https://nodejs.org/en/download"
pause
exit /b 1
