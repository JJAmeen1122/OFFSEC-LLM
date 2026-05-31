@echo off
title OffSec - AI Penetration Testing Platform Setup
color 0A

echo.
echo  =====================================================
echo   OffSec: AI-Powered Penetration Testing Platform
echo   University of Agriculture Faisalabad - 2026
echo  =====================================================
echo.

:: ── CHECK: Python installed ──────────────────────────────
echo [1/8] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Python not found!
    echo  Please download and install Python 3.11 from:
    echo  https://www.python.org/downloads/
    echo  Make sure to check "Add Python to PATH" during install.
    pause
    exit /b 1
)
python --version
echo  Python OK

:: ── CHECK: Node.js installed ─────────────────────────────
echo.
echo [2/8] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo  ERROR: Node.js not found!
    echo  Please download and install Node.js 18+ from:
    echo  https://nodejs.org/en/download
    pause
    exit /b 1
)
node --version
echo  Node.js OK

:: ── CHECK: Docker installed ──────────────────────────────
echo.
echo [3/8] Checking Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo  WARNING: Docker not found.
    echo  Security tools (Nmap, Nuclei, ZAP) need Docker Desktop.
    echo  Download from: https://www.docker.com/products/docker-desktop
    echo  You can continue setup but scans will not work without Docker.
    pause
) else (
    docker --version
    echo  Docker OK
)

:: ── BACKEND: Create virtual environment ──────────────────
echo.
echo [4/8] Setting up Python backend...
cd backend

if not exist venv (
    echo  Creating Python virtual environment...
    python -m venv venv
    echo  Virtual environment created.
) else (
    echo  Virtual environment already exists, skipping.
)

:: Activate venv and install packages
echo  Installing Python dependencies...
call venv\Scripts\activate.bat

pip install fastapi uvicorn httpx python-dotenv pydantic ^
            reportlab pillow python-jose passlib requests --quiet

echo  Python dependencies installed.

:: ── BACKEND: Create .env if missing ──────────────────────
echo.
echo [5/8] Checking backend .env file...
if not exist .env (
    echo  .env file not found. Creating template...
    (
        echo # OffSec Backend Configuration
        echo # Fill in your actual API keys below
        echo.
        echo # Get free key at: https://console.groq.com
        echo GROQ_API_KEY=your_groq_api_key_here
        echo.
        echo # Ollama local server (leave as default)
        echo OLLAMA_URL=http://localhost:11434
        echo.
        echo # OWASP ZAP Docker settings
        echo ZAP_URL=http://localhost:8080
        echo ZAP_API_KEY=offsec-zap-key
        echo.
        echo # Optional
        echo HF_TOKEN=your_huggingface_token_here
        echo MSF_PASSWORD=your_msf_password_here
    ) > .env
    echo.
    echo  ============================================================
    echo   ACTION REQUIRED:
    echo   Open  backend\.env  and fill in your GROQ_API_KEY.
    echo   Get a free key at https://console.groq.com
    echo  ============================================================
    echo.
    pause
) else (
    echo  .env file found. OK.
)

:: Create reports folder if missing
if not exist reports mkdir reports
echo  reports/ folder ready.

cd ..

:: ── FRONTEND: Install Node packages ──────────────────────
echo.
echo [6/8] Installing frontend dependencies...
if not exist node_modules (
    npm install --silent
    echo  Frontend dependencies installed.
) else (
    echo  node_modules already exists. Running npm install to update...
    npm install --silent
)

:: ── DOCKER: Pull security tool images ────────────────────
echo.
echo [7/8] Pulling Docker security tool images...
docker --version >nul 2>&1
if not errorlevel 1 (
    echo  Pulling Nmap image...
    docker pull instrumentisto/nmap --quiet

    echo  Pulling Gobuster image...
    docker pull ghcr.io/oj/gobuster:latest --quiet

    echo  Pulling Nuclei image...
    docker pull projectdiscovery/nuclei:latest --quiet

    echo  Pulling OWASP ZAP image...
    docker pull ghcr.io/zaproxy/zaproxy:stable --quiet

    echo  All Docker images ready.
) else (
    echo  Skipping Docker images (Docker not installed).
)

:: ── DONE ─────────────────────────────────────────────────
echo.
echo [8/8] Setup complete!
echo.
echo  =====================================================
echo   NEXT STEPS:
echo.
echo   1. Make sure backend\.env has your GROQ_API_KEY
echo   2. Make sure src\firebase.ts has your Firebase config
echo      (see README.md Section 9 for Firebase setup)
echo   3. Install Ollama from https://ollama.ai/download
echo      then run:  ollama pull lily-cyber
echo.
echo   TO START THE APP - run:  start_offsec.bat
echo  =====================================================
echo.
pause
