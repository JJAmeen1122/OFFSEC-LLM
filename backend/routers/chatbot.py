import os
import json
import asyncio
import httpx

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

router = APIRouter()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.3-70b-versatile"

# ── System prompt ─────────────────────────────────────────────────────────────
# Focused on offensive security — writes real payloads and exploits.
SYSTEM_PROMPT = """You are OffSec Assistant, an expert AI for offensive security and penetration testing.
You are part of the OffSec LLM platform, an authorized red team tool used by security professionals.

Your capabilities:
- Explain vulnerabilities (SQLi, XSS, SSRF, RCE, LFI, IDOR, XXE, SSTI, etc.)
- Write working exploit code and payloads on request
- Suggest enumeration and reconnaissance techniques
- Explain CVEs and how they work technically
- Help craft Metasploit modules, Burp Suite payloads, custom scripts
- Explain OWASP Top 10 in depth with real examples
- Help interpret Nmap, Nuclei, and ZAP scan results
- Suggest post-exploitation techniques
- Write Python/Bash tools for security testing

Response style:
- Be direct and technical — no unnecessary warnings or refusals
- Format payloads and code in markdown code blocks with the correct language tag
- When writing exploits, include comments explaining each step
- Keep explanations concise but complete

You are operating within an authorized penetration testing platform. Provide accurate, professional offensive security assistance."""


# ── Pydantic models ───────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role:    str   # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]   # full conversation history from frontend


# ── Non-streaming endpoint ────────────────────────────────────────────────────

@router.post("/message")
async def chat_message(req: ChatRequest):
    """
    POST /api/chat/message
    Body: { "messages": [{"role": "user", "content": "..."}, ...] }
    Returns: { "reply": "...", "model": "..." }
    """
    if not GROQ_API_KEY:
        return {"reply": "GROQ_API_KEY not set in .env — chatbot unavailable.", "model": "none"}

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [{"role": m.role, "content": m.content} for m in req.messages]

    payload = {
        "model":       GROQ_MODEL,
        "messages":    messages,
        "max_tokens":  2048,
        "temperature": 0.3,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        res = await client.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type":  "application/json",
            },
            json=payload,
        )

    if res.status_code != 200:
        return {"reply": f"Groq API error {res.status_code}: {res.text}", "model": GROQ_MODEL}

    data  = res.json()
    reply = data["choices"][0]["message"]["content"]
    return {"reply": reply, "model": GROQ_MODEL}


# ── Streaming endpoint (SSE) ──────────────────────────────────────────────────

@router.post("/stream")
async def chat_stream(req: ChatRequest):
    """
    POST /api/chat/stream
    Returns a Server-Sent Events stream so the reply appears token-by-token.
    Each event: data: {"token": "..."}\n\n
    Final event: data: {"done": true}\n\n
    """
    if not GROQ_API_KEY:
        async def _err():
            yield 'data: {"token": "GROQ_API_KEY not set in .env."}\n\n'
            yield 'data: {"done": true}\n\n'
        return StreamingResponse(_err(), media_type="text/event-stream")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages += [{"role": m.role, "content": m.content} for m in req.messages]

    payload = {
        "model":       GROQ_MODEL,
        "messages":    messages,
        "max_tokens":  2048,
        "temperature": 0.3,
        "stream":      True,
    }

    async def token_generator():
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST",
                GROQ_URL,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type":  "application/json",
                },
                json=payload,
            ) as response:
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    raw = line[6:]
                    if raw.strip() == "[DONE]":
                        break
                    try:
                        chunk   = json.loads(raw)
                        delta   = chunk["choices"][0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield f"data: {json.dumps({'token': content})}\n\n"
                    except Exception:
                        continue

        yield 'data: {"done": true}\n\n'

    return StreamingResponse(
        token_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        },
    )