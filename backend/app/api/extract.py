import json

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.graph.pipeline import run_pipeline
from app.models.ai_extraction_log import AiExtractionLog
from app.models.base import get_db
from app.schemas.extraction import ExtractedFields, ExtractResponse
from app.services.fuzzy_match import find_similar_deviations
from app.services.text_extraction import extract_text_from_upload

router = APIRouter()


@router.post("/extract", response_model=ExtractResponse)
def extract(
    file: UploadFile | None = None,
    text: str | None = Form(None),
    current_fields: str | None = Form(None),
    db: Session = Depends(get_db),
):
    try:
        known_fields = json.loads(current_fields) if current_fields else {}
    except (TypeError, ValueError):
        known_fields = {}

    if file is not None:
        content = file.file.read()
        raw_text, error = extract_text_from_upload(file.filename or "", content)
        if error:
            raise HTTPException(status_code=422, detail=error)
        raw_input_type, raw_input_ref = "file", file.filename
    elif text is not None and text.strip():
        raw_text, raw_input_type, raw_input_ref = text, "text", None
    else:
        raise HTTPException(status_code=422, detail="Provide either a file upload or non-empty text.")

    result = run_pipeline(raw_text, known_fields)

    log = AiExtractionLog(
        raw_input_type=raw_input_type,
        raw_input_ref=raw_input_ref,
        ai_extracted_json={**result.get("fields", {}), "initial_impact": result.get("impact"),
                            "initial_severity": result.get("severity")},
        model_used=result.get("model_used"),
        confidence_flags=result.get("confidence", {}),
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    fields_out = {k: v for k, v in result.get("fields", {}).items()}
    duplicate_warnings = find_similar_deviations(
        db, fields_out.get("title"), fields_out.get("detailed_description")
    )

    return ExtractResponse(
        extraction_log_id=str(log.id),
        fields=ExtractedFields(**fields_out),
        confidence=result.get("confidence", {}),
        impact=result.get("impact"),
        severity=result.get("severity"),
        reasoning=result.get("reasoning"),
        missing_fields=result.get("missing_fields", []),
        model_used=result.get("model_used"),
        error=result.get("extract_error"),
        duplicate_warnings=duplicate_warnings,
    )
