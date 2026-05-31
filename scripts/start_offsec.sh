#!/bin/bash

# =====================================================
#  OffSec: Start All Services
#  Linux / macOS
# =====================================================

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo ""
echo "====================================================="
echo "  OffSec: Starting All Services"
echo "====================================================="
echo ""

# ── Checks ────────────────────────────────────────────────
if [ ! -f "backend/.env" ]; then
    echo -e "${RED} ERROR: backend/.env not found! Run ./setup.sh first.${NC}"
    exit 1
fi
if [ ! -d "backend/venv" ]; then
    echo -e "${RED} ERROR: Python venv not found! Run ./setup.sh first.${NC}"
    exit 1
fi
if [ ! -d "node_modules" ]; then
    echo -e "${RED} ERROR: node_modules not found! Run ./setup.sh first.${NC}"
    exit 1
fi

# ── Backend ───────────────────────────────────────────────
echo -e "${CYAN} Starting Backend (FastAPI on port 9000)...${NC}"
cd backend
source venv/bin/activate
python main.py &
BACKEND_PID=$!
cd ..
sleep 2
echo -e "${GREEN} Backend started (PID $BACKEND_PID)${NC}"

# ── Ollama ────────────────────────────────────────────────
echo -e "${CYAN} Starting Ollama (AI on port 11434)...${NC}"
if command -v ollama &>/dev/null; then
    ollama serve &>/dev/null &
    OLLAMA_PID=$!
    sleep 2
    echo -e "${GREEN} Ollama started (PID $OLLAMA_PID)${NC}"
else
    echo -e "${YELLOW} WARNING: Ollama not installed. Install from https://ollama.ai${NC}"
fi

# ── Frontend ──────────────────────────────────────────────
echo -e "${CYAN} Starting Frontend (React on port 3000)...${NC}"
npm start &
FRONTEND_PID=$!
sleep 3
echo -e "${GREEN} Frontend started (PID $FRONTEND_PID)${NC}"

echo ""
echo "====================================================="
echo "  Backend   ->  http://localhost:9000"
echo "  API Docs  ->  http://localhost:9000/docs"
echo "  Frontend  ->  http://localhost:3000"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "====================================================="
echo ""

# Open browser
sleep 4
if command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:3000
elif command -v open &>/dev/null; then
    open http://localhost:3000
fi

# Wait — kill all on Ctrl+C
trap "echo ''; echo 'Stopping all services...'; kill $BACKEND_PID $FRONTEND_PID $OLLAMA_PID 2>/dev/null; exit 0" INT
wait
