@echo off
title OffSec - Starting All Services
color 0A

echo.
echo  =====================================================
echo   OffSec: Starting All Services
echo  =====================================================
echo.

:: Check .env exists
if not exist backend\.env (
    echo  ERROR: backend\.env not found!
    echo  Run setup.bat first.
    pause
    exit /b 1
)

:: Check venv exists
if not exist backend\venv (
    echo  ERROR: Python venv not found!
    echo  Run setup.bat first.
    pause
    exit /b 1
)

:: Check node_modules exists
if not exist node_modules (
    echo  ERROR: node_modules not found!
    echo  Run setup.bat first.
    pause
    exit /b 1
)

echo  Starting Backend (FastAPI on port 9000)...
start "OffSec Backend" cmd /k "cd backend && venv\Scripts\activate && python main.py"

timeout /t 3 /nobreak >nul

echo  Starting Frontend (React on port 3000)...
start "OffSec Frontend" cmd /k "npm start"

timeout /t 3 /nobreak >nul

echo  Starting Ollama (AI model on port 11434)...
where ollama >nul 2>&1
if not errorlevel 1 (
    start "Ollama AI" cmd /k "ollama serve"
    echo  Ollama started.
) else (
    echo  WARNING: Ollama not installed. AI planning may not work.
    echo  Install from: https://ollama.ai/download
    echo  Then run:     ollama pull lily-cyber
)

echo.
echo  =====================================================
echo   All services launched in separate windows!
echo.
echo   Backend  ->  http://localhost:9000
echo   Frontend ->  http://localhost:3000
echo   API Docs ->  http://localhost:9000/docs
echo.
echo   Opening browser in 5 seconds...
echo  =====================================================
echo.

timeout /t 5 /nobreak >nul
start http://localhost:3000

echo  Done! Close this window anytime.
pause
