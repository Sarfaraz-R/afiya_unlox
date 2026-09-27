import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.models.ai_extraction_log import AiExtractionLog
from app.models.base import get_db
from app.models.deviation import Deviation
from app.schemas.deviation import DeviationCreate, DeviationDetail, DeviationOut
from app.schemas.enums import TRACKED_FIELDS
from app.services.diff import compute_field_diff

router = APIRouter()


def _get_or_create(payload: DeviationCreate, db: Session, status: str) -> Deviation:
    data = payload.model_dump(exclude={"extraction_log_id", "id"})
    if payload.id:
        deviation = db.get(Deviation, payload.id)
        if deviation is None:
            raise HTTPException(status_code=404, detail="Deviation not found.")
        for key, value in data.items():
            setattr(deviation, key, value)
        deviation.status = status
    else:
        deviation = Deviation(status=status, **data)
        db.add(deviation)
    db.flush()
    return deviation


@router.post("/deviations", response_model=DeviationOut)
def create_deviation(payload: DeviationCreate, db: Session = Depends(get_db)):
    deviation = _get_or_create(payload, db, status="saved")

    if payload.extraction_log_id:
        log = db.get(AiExtractionLog, payload.extraction_log_id)
        if log is not None:
            log.deviation_id = deviation.id
            json_data = payload.model_dump(exclude={"extraction_log_id", "id"}, mode="json")
            log.final_json = {field: json_data.get(field) for field in TRACKED_FIELDS}

    db.commit()
    db.refresh(deviation)
    return deviation


@router.post("/deviations/draft", response_model=DeviationOut)
def save_draft(payload: DeviationCreate, db: Session = Depends(get_db)):
    deviation = _get_or_create(payload, db, status="draft")
    db.commit()
    db.refresh(deviation)
    return deviation


@router.delete("/deviations/{deviation_id}", status_code=204)
def delete_deviation(deviation_id: uuid.UUID, db: Session = Depends(get_db)):
    deviation = db.get(Deviation, deviation_id)
    if deviation is None:
        raise HTTPException(status_code=404, detail="Deviation not found.")
    db.delete(deviation)
    db.commit()


@router.get("/deviations", response_model=list[DeviationOut])
def list_deviations(db: Session = Depends(get_db)):
    return db.query(Deviation).order_by(Deviation.created_at.desc()).all()


@router.get("/deviations/{deviation_id}", response_model=DeviationDetail)
def get_deviation(deviation_id: uuid.UUID, db: Session = Depends(get_db)):
    deviation = db.get(Deviation, deviation_id)
    if deviation is None:
        raise HTTPException(status_code=404, detail="Deviation not found.")

    log = (
        db.query(AiExtractionLog)
        .filter(AiExtractionLog.deviation_id == deviation.id)
        .order_by(AiExtractionLog.created_at.desc())
        .first()
    )
    diff = compute_field_diff(log.ai_extracted_json if log else None, log.final_json if log else None)

    detail = DeviationDetail.model_validate(deviation)
    detail.diff = diff
    return detail
