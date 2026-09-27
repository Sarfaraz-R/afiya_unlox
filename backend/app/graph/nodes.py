import json
import re

from app.graph.prompts import EXTRACT_SYSTEM_PROMPT, SEVERITY_IMPACT_SYSTEM_PROMPT
from app.graph.state import PipelineState
from app.schemas.enums import EXTRACTED_FIELDS, REQUIRED_FIELDS, Impact, Severity
from app.services.groq_client import GroqCallError, call_groq_json


def _strip_fences(raw: str) -> str:
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", raw, re.DOTALL)
    return match.group(1) if match else raw


def _all_low_confidence() -> dict:
    return {field: "low" for field in EXTRACTED_FIELDS}


def _carry_forward(current_fields: dict) -> tuple[dict, dict]:
    """When the AI found nothing new for a field, fall back to the value already captured in this
    conversation (from an earlier turn or a manual edit) instead of nulling it out."""
    fields = {field: current_fields.get(field) for field in EXTRACTED_FIELDS}
    confidence = {field: ("high" if current_fields.get(field) else "low") for field in EXTRACTED_FIELDS}
    return fields, confidence


def extract_node(state: PipelineState) -> dict:
    raw_text = state["raw_text"]
    current_fields = state.get("current_fields") or {}
    known = {k: v for k, v in current_fields.items() if k in EXTRACTED_FIELDS and v}

    if known:
        user_prompt = (
            f"Already captured for this deviation:\n{json.dumps(known)}\n\n"
            f"The user just added this new message — use it only to fill gaps or correct the "
            f"fields above:\n{raw_text}"
        )
    else:
        user_prompt = raw_text

    try:
        raw_response, model_used = call_groq_json(EXTRACT_SYSTEM_PROMPT, user_prompt)
    except GroqCallError as exc:
        fields, confidence = _carry_forward(current_fields)
        return {"fields": fields, "confidence": confidence, "model_used": None, "extract_error": str(exc)}

    try:
        parsed = json.loads(_strip_fences(raw_response))
        fields = {}
        confidence = {}
        for field in EXTRACTED_FIELDS:
            value = parsed.get("fields", {}).get(field)
            if value:
                fields[field] = value
                confidence[field] = parsed.get("confidence", {}).get(field, "low")
            else:
                fields[field] = current_fields.get(field)
                confidence[field] = "high" if current_fields.get(field) else "low"
        return {"fields": fields, "confidence": confidence, "model_used": model_used, "extract_error": None}
    except (json.JSONDecodeError, AttributeError, TypeError):
        fields, confidence = _carry_forward(current_fields)
        return {
            "fields": fields,
            "confidence": confidence,
            "model_used": None,
            "extract_error": "AI response could not be parsed as JSON; all fields flagged low-confidence.",
        }


def severity_impact_node(state: PipelineState) -> dict:
    fields = state.get("fields", {})
    user_prompt = json.dumps({"fields": fields, "latest_message": state.get("raw_text", "")})

    try:
        raw_response, _ = call_groq_json(SEVERITY_IMPACT_SYSTEM_PROMPT, user_prompt)
        parsed = json.loads(_strip_fences(raw_response))
        impact = parsed.get("impact")
        severity = parsed.get("severity")
        reasoning = parsed.get("reasoning")

        if impact not in [i.value for i in Impact]:
            impact = None
        if severity not in [s.value for s in Severity]:
            severity = None

        return {"impact": impact, "severity": severity, "reasoning": reasoning}
    except (GroqCallError, json.JSONDecodeError, AttributeError, TypeError):
        return {
            "impact": None,
            "severity": None,
            "reasoning": "Severity/impact assessment failed; please assess manually.",
        }


def validate_node(state: PipelineState) -> dict:
    fields = state.get("fields", {})
    missing = [f for f in REQUIRED_FIELDS if not fields.get(f)]
    return {"missing_fields": missing}
