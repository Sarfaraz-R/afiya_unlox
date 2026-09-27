import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AiExtractionLog(Base):
    __tablename__ = "ai_extraction_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    deviation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("deviations.id", ondelete="SET NULL"), nullable=True
    )
    raw_input_type: Mapped[str | None] = mapped_column(Text, nullable=True)
    raw_input_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_extracted_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    final_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    model_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidence_flags: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
