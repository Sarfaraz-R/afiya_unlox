from app.schemas.enums import TRACKED_FIELDS


def compute_field_diff(ai_json: dict | None, final_json: dict | None) -> dict:
    """Field-by-field comparison of AI-suggested vs. human-final values, for the audit view."""
    ai_json = ai_json or {}
    final_json = final_json or {}
    diff = {}
    for field in TRACKED_FIELDS:
        ai_val = ai_json.get(field)
        final_val = final_json.get(field)
        diff[field] = {"ai": ai_val, "final": final_val, "changed": ai_val != final_val}
    return diff
