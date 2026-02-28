@echo off
title VoiceFlow Marketing AI

echo.
echo ===================================================
echo   VoiceFlow Marketing AI - Development Server
echo ===================================================
echo.

SET ROOT=%~dp0
SET VENV=%ROOT%venv\Scripts

echo [1/3] Checking virtual environment...
if not exist "%VENV%\python.exe" (
    echo ERROR: venv not found. Run: python -m venv venv
    pause
    exit /b 1
)

echo [2/3] Starting Backend API (port 8000)...
start "VoiceFlow Backend" cmd /k "cd /d %ROOT% && %VENV%\python.exe -m uvicorn src.api.server:app --reload --host 127.0.0.1 --port 8000"

echo Waiting for backend to start...
timeout /t 4 /nobreak >nul

echo [3/3] Starting Frontend Dev Server (port 3000)...
start "VoiceFlow Frontend" cmd /k "cd /d %ROOT%frontend && npm run dev"

echo.
echo ===================================================
echo   RUNNING!
echo   Backend  : http://localhost:8000
echo   Frontend : http://localhost:3000
echo   API Docs : http://localhost:8000/docs
echo.
echo   Login    : admin@shadowmarket.ai / admin123
echo             or use "Try Demo Dashboard"
echo ===================================================
echo.

timeout /t 3 /nobreak >nul
start "" "http://localhost:3000"

echo Press any key to stop all servers...
pause >nul

taskkill /FI "WINDOWTITLE eq VoiceFlow Backend" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq VoiceFlow Frontend" /F >nul 2>&1
echo Servers stopped.
