@echo off
setlocal
cd /d "%~dp0web"
if not exist node_modules (
  echo Instalando dependencias por primera vez...
  call npm install
  if errorlevel 1 pause & exit /b 1
)
echo.
echo Iniciando UNI Bocchi Monitor...
call npm run dev
pause
