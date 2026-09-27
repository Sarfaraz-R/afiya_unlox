from datetime import date

from pydantic import BaseModel

from app.schemas.enums import ConfidenceLevel, Impact, Severity


class ExtractTextRequest(BaseModel):
    text: str


class ExtractedFields(BaseModel):
    site_plant: str | None = None
    date_of_occurrence: date | None = None
    title: str | None = None
    source: str | None = None
    related_product: str | None = None
    batch_lot_number: str | None = None
    detailed_description: str | None = None


class ExtractResponse(BaseModel):
    extraction_log_id: str
    fields: ExtractedFields
    confidence: dict[str, ConfidenceLevel]
    impact: Impact | None = None
    severity: Severity | None = None
    reasoning: str | None = None
    missing_fields: list[str] = []
    model_used: str | None = None
    error: str | None = None
    duplicate_warnings: list[dict] = []
