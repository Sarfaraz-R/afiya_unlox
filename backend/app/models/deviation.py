import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Deviation(Base):
    __tablename__ = "deviations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )
    site_plant: Mapped[str | None] = mapped_column(Text, nullable=True)
    date_of_occurrence: Mapped[date | None] = mapped_column(Date, nullable=True)
    title: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(Text, nullable=True)
    related_product: Mapped[str | None] = mapped_column(Text, nullable=True)
    batch_lot_number: Mapped[str | None] = mapped_column(Text, nullable=True)
    detailed_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    initial_impact: Mapped[str | None] = mapped_column(Text, nullable=True)
    initial_severity: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_reasoning: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String, default="draft", server_default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
