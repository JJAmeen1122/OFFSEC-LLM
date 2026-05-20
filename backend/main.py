from dotenv import load_dotenv
load_dotenv()

import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── 1. Create app FIRST ───────────────────────────────────
app = FastAPI(title="OffSec API", version="1.0.0")

# ── 2. Middleware ─────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 3. Import routers AFTER app created ───────────────────
from routers import ai_engine
from routers import tools
from routers import cve_hunter
from routers import agent
from routers import report_generator
from routers import chatbot

# ── 4. Register routers ───────────────────────────────────
app.include_router(ai_engine.router,        prefix="/api/ai",     tags=["ai"])
app.include_router(tools.router,            prefix="/api/tools",  tags=["tools"])
app.include_router(cve_hunter.router,       prefix="/api/cve",    tags=["cve"])
app.include_router(agent.router,            prefix="/api/agent",  tags=["agent"])
app.include_router(report_generator.router, prefix="/api/report", tags=["report"])
app.include_router(chatbot.router, prefix="/api/chat", tags=["chat"])
# ── 5. Routes ─────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "OffSec API Running"}

@app.get("/health")
async def health():
    return {"status": "online"}

@app.get("/api/health")
async def api_health():
    return {"status": "online"}

# ── 6. Run ────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=9000, reload=True)