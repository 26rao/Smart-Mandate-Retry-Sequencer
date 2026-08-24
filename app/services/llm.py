import json
import httpx
from typing import Optional
from app.config import settings
from app.models import ActionType, DeclineCategory, Diagnosis


FEW_SHOT_PROMPT = """You are a Razorpay Mandate Retry Sequencer expert.
Given a failed mandate error payload, classify it into one of the standard decline categories and choose the safest recovery action.

Categories:
- insufficient_funds: Balance low (recoverable with smart timing)
- temporary_bank_issue: Issuing bank temporary glitch/downtime
- network_glitch: Timeout or socket error (retry now)
- consent_withdrawn: Customer revoked mandate (HARD STOP, 0 retries allowed by RBI)
- card_expired: Card invalid (suggest method switch)
- account_closed: Account terminated/frozen (HARD STOP)
- limit_exceeded: Exceeded recurring debit cap (soft notify)
- authentication_failed: MPIN or OTP error
- mandate_inactive: Paused or inactive mandate
- gateway_timeout: Gateway handshake drop
- fraud_suspected: Risk flag
- unknown: Unknown error

Valid Actions: retry_now, schedule_retry, suggest_method_switch, soft_notify, escalate, hard_stop.

Return strictly valid JSON matching this schema:
{
  "category": "string",
  "recoverability": float (0.0 to 1.0),
  "recommended_action": "string",
  "reason": "string",
  "confidence": float (0.0 to 1.0),
  "suggested_delay_hours": int or null
}
"""


async def classify_with_llm(
    error_code: str,
    error_reason: str,
    error_source: str,
    error_step: str,
    error_description: str,
) -> Optional[Diagnosis]:
    """Call configured LLM (Groq / OpenAI / Google) or return None on failure/missing keys."""
    provider = settings.LLM_PROVIDER.lower()
    user_payload = {
        "error_code": error_code,
        "error_reason": error_reason,
        "error_source": error_source,
        "error_step": error_step,
        "error_description": error_description,
    }

    try:
        if provider == "groq" and settings.GROQ_API_KEY:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": [
                            {"role": "system", "content": FEW_SHOT_PROMPT},
                            {"role": "user", "content": json.dumps(user_payload)},
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.1,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()["choices"][0]["message"]["content"]
                    parsed = json.loads(data)
                    return Diagnosis(**parsed)

        elif provider == "openai" and settings.OPENAI_API_KEY:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": FEW_SHOT_PROMPT},
                            {"role": "user", "content": json.dumps(user_payload)},
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.1,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()["choices"][0]["message"]["content"]
                    parsed = json.loads(data)
                    return Diagnosis(**parsed)

        elif provider == "google" and settings.GOOGLE_API_KEY:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={settings.GOOGLE_API_KEY}"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    url,
                    json={
                        "contents": [
                            {
                                "parts": [
                                    {"text": FEW_SHOT_PROMPT},
                                    {"text": json.dumps(user_payload)},
                                ]
                            }
                        ],
                        "generationConfig": {"response_mime_type": "application/json"},
                    },
                )
                if resp.status_code == 200:
                    raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(raw_text)
                    return Diagnosis(**parsed)
    except Exception:
        # Graceful fallback to deterministic taxonomy
        pass

    return None
