"""add on delete set null to ai_extraction_logs deviation_id fk

Revision ID: cf28e2c50028
Revises: 2a3984c8fcaf
Create Date: 2026-09-27 02:28:09.737632

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cf28e2c50028'
down_revision: Union[str, Sequence[str], None] = '2a3984c8fcaf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint(
        "ai_extraction_logs_deviation_id_fkey", "ai_extraction_logs", type_="foreignkey"
    )
    op.create_foreign_key(
        "ai_extraction_logs_deviation_id_fkey",
        "ai_extraction_logs",
        "deviations",
        ["deviation_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "ai_extraction_logs_deviation_id_fkey", "ai_extraction_logs", type_="foreignkey"
    )
    op.create_foreign_key(
        "ai_extraction_logs_deviation_id_fkey",
        "ai_extraction_logs",
        "deviations",
        ["deviation_id"],
        ["id"],
    )
