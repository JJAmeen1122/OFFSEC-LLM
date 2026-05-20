import os
import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# ── Config ──────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API     = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL   = "llama-3.3-70b-versatile"  # cybersecurity capable, free on Groq

SYSTEM_PROMPT = (
    "You are an expert cybersecurity assistant specialized in "
    "penetration testing, vulnerability analysis, and security research. "
    "Give clear, structured, technical answers."
)

# ── Request model ────────────────────────────────
class AIQuery(BaseModel):
    context: str
    task: str

# ── Core function ────────────────────────────────
async def query_lily(prompt: str) -> tuple[str, str]:
    if not GROQ_API_KEY:
        return (
            "GROQ_API_KEY not set. Add your Groq API key to the .env file.",
            "no_token"
        )

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            response = await client.post(
                GROQ_API,
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user",   "content": prompt}
                    ],
                    "max_tokens": 2048,
                    "temperature": 0.2,
                    "stream": False
                }
            )

            if response.status_code == 401:
                return (
                    "Invalid GROQ_API_KEY. Check your key in the .env file.",
                    "auth_error"
                )

            if response.status_code != 200:
                return (
                    f"API error {response.status_code}: {response.text[:200]}",
                    "api_error"
                )

            data = response.json()

            if "choices" in data:
                return data["choices"][0]["message"]["content"], "groq-mixtral"

            return str(data), "groq"

        except httpx.ConnectError:
            return "Cannot reach Groq API. Check your internet.", "connection_error"

        except httpx.TimeoutException:
            return "Request timed out. Try again.", "timeout"

        except Exception as e:
            return f"Unexpected error: {str(e)}", "error"


# ── Endpoints ────────────────────────────────────
@router.post("/analyze")
async def analyze(query: AIQuery):
    # Build a strong security analysis prompt
    prompt = f"""You are an expert penetration tester and security analyst.

TASK: {query.task}

REAL SCAN DATA:
{query.context}

Provide a detailed security analysis based ONLY on the real scan data provided above.
Format your response clearly with sections for:
- Risk Level
- Key Findings  
- Attack Vectors
- Recommendations
"""
    result, provider = await query_lily(prompt)
    return {
        "analysis": result,
        "provider": provider,
        "model": GROQ_MODEL
    }


@router.get("/status")
async def status():
    if not GROQ_API_KEY:
        return {"status": "error", "message": "GROQ_API_KEY not set in .env"}
    return {"status": "ok", "model": GROQ_MODEL, "provider": "groq", "message": "Ready"}


@router.post("/test")
async def test_lily():
    result, provider = await query_lily(
        "List 3 common vulnerabilities found in web applications."
    )
    return {"response": result, "provider": provider}