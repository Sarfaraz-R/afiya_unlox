from groq import Groq, APITimeoutError

from app.config import settings

_client = Groq(api_key=settings.GROQ_API_KEY, timeout=15.0)


class GroqCallError(Exception):
    """Raised when a Groq call fails after retry. Caller should degrade gracefully, never 500."""


def call_groq_json(system_prompt: str, user_prompt: str, model: str | None = None) -> tuple[str, str]:
    """Calls Groq chat completion, forcing JSON output. Retries once on timeout with the fallback
    model. Returns (content, model_actually_used)."""
    chosen_model = model or settings.MODEL_PRIMARY
    try:
        return _complete(chosen_model, system_prompt, user_prompt), chosen_model
    except APITimeoutError:
        try:
            return _complete(settings.MODEL_FALLBACK, system_prompt, user_prompt), settings.MODEL_FALLBACK
        except Exception as exc:
            raise GroqCallError(f"Groq timed out on both {chosen_model} and fallback: {exc}") from exc
    except Exception as exc:
        raise GroqCallError(f"Groq call failed: {exc}") from exc


def _complete(model: str, system_prompt: str, user_prompt: str) -> str:
    response = _client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.1,
    )
    return response.choices[0].message.content
