#!/bin/bash

# =====================================================
#  OffSec: AI-Powered Penetration Testing Platform
#  Setup Script for Linux / macOS
#  University of Agriculture Faisalabad - 2026
# =====================================================

set -e  # Exit on any error

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ""
echo "====================================================="
echo "  OffSec: AI-Powered Penetration Testing Platform"
echo "  Setup Script — Linux / macOS"
echo "====================================================="
echo ""

# ── CHECK: Python ─────────────────────────────────────────
echo "[1/8] Checking Python..."
if ! command -v python3 &>/dev/null; then
    echo -e "${RED} ERROR: Python3 not found!${NC}"
    echo " Install with:"
    echo "   Ubuntu:  sudo apt install python3.11 python3.11-venv python3-pip"
    echo "   macOS:   brew install python@3.11"
    exit 1
fi
python3 --version
echo -e "${GREEN} Python OK${NC}"

# ── CHECK: Node.js ────────────────────────────────────────
echo ""
echo "[2/8] Checking Node.js..."
if ! command -v node &>/dev/null; then
    echo -e "${RED} ERROR: Node.js not found!${NC}"
    echo " Install with:"
    echo "   Ubuntu:  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt install nodejs"
    echo "   macOS:   brew install node"
    exit 1
fi
node --version
echo -e "${GREEN} Node.js OK${NC}"

# ── CHECK: Docker ─────────────────────────────────────────
echo ""
echo "[3/8] Checking Docker..."
if ! command -v docker &>/dev/null; then
    echo -e "${YELLOW} WARNING: Docker not found.${NC}"
    echo " Security tools (Nmap, Nuclei, ZAP) need Docker."
    echo " Install with:"
    echo "   Ubuntu:  sudo apt install docker.io && sudo usermod -aG docker \$USER"
    echo "   macOS:   Download Docker Desktop from https://docker.com"
    DOCKER_MISSING=1
else
    docker --version
    echo -e "${GREEN} Docker OK${NC}"
    DOCKER_MISSING=0
fi

# ── BACKEND: Virtual environment ──────────────────────────
echo ""
echo "[4/8] Setting up Python backend..."
cd backend

if [ ! -d "venv" ]; then
    echo " Creating Python virtual environment..."
    python3 -m venv venv
    echo " Virtual environment created."
else
    echo " Virtual environment already exists, skipping."
fi

echo " Activating virtual environment..."
source venv/bin/activate

echo " Installing Python dependencies..."
pip install --quiet fastapi uvicorn httpx python-dotenv pydantic \
            reportlab pillow python-jose passlib requests

echo -e "${GREEN} Python dependencies installed.${NC}"

# ── BACKEND: .env file ────────────────────────────────────
echo ""
echo "[5/8] Checking backend .env file..."
if [ ! -f ".env" ]; then
    echo " .env not found. Creating template..."
    cat > .env << 'EOF'
# OffSec Backend Configuration
# Fill in your actual API keys below

# Get free key at: https://console.groq.com
GROQ_API_KEY=your_groq_api_key_here

# Ollama local server (leave as default)
OLLAMA_URL=http://localhost:11434

# OWASP ZAP Docker settings
ZAP_URL=http://localhost:8080
ZAP_API_KEY=offsec-zap-key

# Optional
HF_TOKEN=your_huggingface_token_here
MSF_PASSWORD=your_msf_password_here
EOF

    echo ""
    echo -e "${YELLOW} ============================================================${NC}"
    echo -e "${YELLOW}  ACTION REQUIRED:${NC}"
    echo -e "${YELLOW}  Open  backend/.env  and fill in your GROQ_API_KEY${NC}"
    echo -e "${YELLOW}  Get a free key at https://console.groq.com${NC}"
    echo -e "${YELLOW} ============================================================${NC}"
    echo ""
    read -p " Press Enter to continue after you have noted this..."
else
    echo -e "${GREEN} .env file found. OK.${NC}"
fi

# Create reports folder
mkdir -p reports
echo " reports/ folder ready."

deactivate
cd ..

# ── FRONTEND: npm install ─────────────────────────────────
echo ""
echo "[6/8] Installing frontend dependencies..."
npm install --silent
echo -e "${GREEN} Frontend dependencies installed.${NC}"

# ── DOCKER: Pull images ───────────────────────────────────
echo ""
echo "[7/8] Pulling Docker security tool images..."
if [ "$DOCKER_MISSING" -eq 0 ]; then
    echo " Pulling Nmap..."
    docker pull instrumentisto/nmap --quiet 2>/dev/null || echo " Nmap: skipped"

    echo " Pulling Gobuster..."
    docker pull ghcr.io/oj/gobuster:latest --quiet 2>/dev/null || echo " Gobuster: skipped"

    echo " Pulling Nuclei..."
    docker pull projectdiscovery/nuclei:latest --quiet 2>/dev/null || echo " Nuclei: skipped"

    echo " Pulling OWASP ZAP..."
    docker pull ghcr.io/zaproxy/zaproxy:stable --quiet 2>/dev/null || echo " ZAP: skipped"

    echo -e "${GREEN} Docker images ready.${NC}"
else
    echo " Skipping Docker images (Docker not installed)."
fi

# ── DONE ──────────────────────────────────────────────────
echo ""
echo "[8/8] Setup complete!"
echo ""
echo "====================================================="
echo "  NEXT STEPS:"
echo ""
echo "  1. Edit backend/.env  → add your GROQ_API_KEY"
echo "  2. Edit src/firebase.ts → add your Firebase config"
echo "     (see README.md Section 9 for Firebase setup)"
echo "  3. Install Ollama: https://ollama.ai/install.sh"
echo "     then run:  ollama pull lily-cyber"
echo ""
echo "  TO START THE APP — run:  ./start_offsec.sh"
echo "====================================================="
echo ""
