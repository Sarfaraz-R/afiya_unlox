from typing import TypedDict


class PipelineState(TypedDict, total=False):
    raw_text: str
    current_fields: dict

    # extract_node output
    fields: dict
    confidence: dict
    model_used: str
    extract_error: str | None

    # severity_impact_node output
    impact: str | None
    severity: str | None
    reasoning: str | None

    # validate_node output
    missing_fields: list[str]
