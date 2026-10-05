@echo off
setlocal
where node >nul 2>nul || (echo Node.js 22.13+ is required. Install Node.js LTS from https://nodejs.org/ then run this file again.& pause & exit /b 1)
node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||a===22&&b>=13?0:1)" || (echo Node.js 22.13+ is required.& pause & exit /b 1)
cd /d "%~dp0.."
node packages\hub\server\index.js
pause
