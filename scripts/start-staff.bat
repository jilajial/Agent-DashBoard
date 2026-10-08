@echo off
setlocal
cd /d "%~dp0.."
node packages\staff\server\index.js
pause
