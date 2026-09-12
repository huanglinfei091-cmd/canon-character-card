@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules" (
  echo First run: installing the local application...
  call npm install
  if errorlevel 1 (
    echo Installation failed. Please check the network and try again.
    pause
    exit /b 1
  )
)
npm start
