@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Agents HQ - Launch Guide

call :checkNode
if errorlevel 1 exit /b 1

:menu
cls
echo.
echo ============================================================
echo                    AGENTS HQ LAUNCHER
echo ============================================================
echo.
echo   [1] Start Agents HQ ^(Windows controller^)
echo   [2] Start this computer's Agent Node dashboard
echo   [3] Start this computer's Staff Portal
echo   [4] Edit Hub connection settings
echo   [5] Edit this computer's Node settings
echo   [6] Edit this computer's Staff Portal settings
echo   [7] Open README / deployment guide
echo   [8] Check / download GitHub update, then start
echo   [Q] Exit
echo.
choice /C 12345678Q /N /M "Choose"
if errorlevel 9 goto :eof
if errorlevel 8 goto update
if errorlevel 7 goto docs
if errorlevel 6 goto staffConfig
if errorlevel 5 goto nodeConfig
if errorlevel 4 goto hubConfig
if errorlevel 3 goto staff
if errorlevel 2 goto node
if errorlevel 1 goto hub

:hub
if not exist "packages\hub\config\hub.local.json" copy /Y "packages\hub\config\hub.example.json" "packages\hub\config\hub.local.json" >nul
echo Starting Agents HQ in a separate window...
start "Agents HQ" cmd /k "call ""%CD%\scripts\start-hub.bat"""
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

:staff
if not exist "packages\staff\config\staff.local.json" copy /Y "packages\staff\config\staff.example.json" "packages\staff\config\staff.local.json" >nul
echo Starting this computer's Staff Portal in a separate window...
start "Staff Portal" cmd /k "call ""%CD%\scripts\start-staff.bat"""
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:3200"
goto done

:hubConfig
if not exist "packages\hub\config\hub.local.json" copy /Y "packages\hub\config\hub.example.json" "packages\hub\config\hub.local.json" >nul
notepad "packages\hub\config\hub.local.json"
goto menu

:nodeConfig
if not exist "packages\node\config\node.local.json" copy /Y "packages\node\config\node.example.json" "packages\node\config\node.local.json" >nul
notepad "packages\node\config\node.local.json"
goto menu

:staffConfig
if not exist "packages\staff\config\staff.local.json" copy /Y "packages\staff\config\staff.example.json" "packages\staff\config\staff.local.json" >nul
notepad "packages\staff\config\staff.local.json"
goto menu

:docs
start "" "README.md"
goto menu

:update
where git >nul 2>nul
if errorlevel 1 (
  echo Git is required for one-click updates but was not found.
  where winget >nul 2>nul
  if errorlevel 1 goto gitDownload
  echo.
  echo [Y] Install Git now using Windows Package Manager
  echo [N] Do not install; open the official download page instead
  echo Press Y or N (no Enter required).
  choice /C YN /N /M "Selection"
  if errorlevel 2 goto gitDownload
  winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
  set "PATH=%PATH%;%ProgramFiles%\Git\cmd"
  where git >nul 2>nul
  if not errorlevel 1 goto update
  echo Git was installed, but this window cannot see it yet. Close this window and run START-DASHBOARD.bat again.
  pause
  goto menu
)
if not exist ".git" (
  echo.
  echo This looks like a ZIP copy. It can be enrolled for one-click updates.
  echo Local *.local.json configuration files are preserved. Edited program files will be replaced.
  echo [Y] Enroll this ZIP copy and download the current release
  echo [N] Cancel and return to the launcher
  echo Press Y or N (no Enter required).
  choice /C YN /N /M "Selection"
  if errorlevel 2 goto menu
  git init >nul || goto updateFailed
  git remote add origin https://github.com/jilajial/Agent-DashBoard.git 2>nul
  git remote set-url origin https://github.com/jilajial/Agent-DashBoard.git || goto updateFailed
  git fetch --quiet origin main || goto updateFailed
  git reset --hard origin/main || goto updateFailed
  goto restartAfterUpdate
)
for /f "delims=" %%S in ('git status --porcelain --untracked-files=no') do set "DIRTY=1"
if defined DIRTY (
  echo.
  echo Update stopped: program files have local edits.
  echo Commit or discard those edits first. Your *.local.json settings are not the problem.
  set "DIRTY="
  pause
  goto menu
)
git fetch --quiet origin main || goto updateFailed
for /f %%A in ('git rev-list --count HEAD..origin/main') do set "UPDATE_COUNT=%%A"
if "%UPDATE_COUNT%"=="0" (
  echo.
  echo This copy is already up to date.
  goto chooseAfterUpdate
)
echo.
echo %UPDATE_COUNT% update commit^(s^) are available.
echo [Y] Download and apply the update now
echo [N] Cancel and return to the launcher
echo Press Y or N (no Enter required).
choice /C YN /N /M "Selection"
if errorlevel 2 goto menu
git pull --ff-only origin main || goto updateFailed
goto restartAfterUpdate

:restartAfterUpdate
echo.
echo Update complete. Restarting the updated launcher now...
timeout /t 2 /nobreak >nul
call "%~f0"
goto :eof

:chooseAfterUpdate
choice /C 123M /N /M "Start [1] Hub, [2] Agent Node, [3] Staff Portal, or [M] return to menu"
if errorlevel 4 goto menu
if errorlevel 3 goto staff
if errorlevel 2 goto node
goto hub

:updateFailed
echo.
echo Update could not be completed. Check Internet access and try again.
echo This window will stay open so you can read the error above.
pause
goto menu

:gitDownload
echo.
echo [Y] Open the official Git for Windows download page
echo [N] Cancel and return to the launcher
echo Press Y or N (no Enter required).
choice /C YN /N /M "Selection"
if errorlevel 2 goto menu
start "" "https://git-scm.com/download/win"
echo Install Git, close this window, then run START-DASHBOARD.bat again.
pause
goto menu

:done
echo.
echo Browser launch requested. Keep the new server window open while using the dashboard.
echo Press any key to return to the menu.
pause >nul
goto menu

:checkNode
where node >nul 2>nul
if errorlevel 1 goto installNode
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 goto nodeOld
exit /b 0

:installNode
echo Node.js 22.13+ was not found.
where winget >nul 2>nul
if errorlevel 1 goto nodeDownload
  echo.
  echo [Y] Install Node.js LTS now using Windows Package Manager
  echo [N] Do not install; open the official download page instead
  echo Press Y or N (no Enter required).
  choice /C YN /N /M "Selection"
if errorlevel 2 goto nodeDownload
winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
set "PATH=%PATH%;%ProgramFiles%\nodejs"
where node >nul 2>nul && goto checkNode
echo Node.js was installed, but this window cannot see it yet. Close this window and run START-DASHBOARD.bat again.
pause
exit /b 1

:nodeDownload
echo.
echo [Y] Open the official Node.js LTS download page
echo [N] Cancel and return to the launcher
echo Press Y or N (no Enter required).
choice /C YN /N /M "Selection"
if errorlevel 2 exit /b 1
start "" "https://nodejs.org/en/download"
echo Install Node.js LTS, close this window, then run START-DASHBOARD.bat again.
pause
exit /b 1

:nodeOld
echo Node.js 22.13+ is required. Your installed Node.js is too old.
where winget >nul 2>nul
if not errorlevel 1 (
  choice /C YN /N /M "Upgrade Node.js LTS now using Windows Package Manager"
  if not errorlevel 2 winget upgrade --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
)
start "" "https://nodejs.org/en/download"
pause
exit /b 1
