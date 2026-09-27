import uuid
from datetime import date, datetime

from pydantic import BaseModel

from app.schemas.enums import Impact, Severity


class DeviationCreate(BaseModel):
    id: uuid.UUID | None = None
    extraction_log_id: uuid.UUID | None = None
    site_plant: str | None = None
    date_of_occurrence: date | None = None
    title: str | None = None
    source: str | None = None
    related_product: str | None = None
    batch_lot_number: str | None = None
    detailed_description: str | None = None
    initial_impact: Impact | None = None
    initial_severity: Severity | None = None
    ai_reasoning: str | None = None


class DeviationOut(BaseModel):
    id: uuid.UUID
    site_plant: str | None
    date_of_occurrence: date | None
    title: str | None
    source: str | None
    related_product: str | None
    batch_lot_number: str | None
    detailed_description: str | None
    initial_impact: str | None
    initial_severity: str | None
    ai_reasoning: str | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DeviationDetail(DeviationOut):
    diff: dict | None = None
