"""Initial platform schema and feature flags

Revision ID: 0001_initial_platform
Revises:
Create Date: 2026-11-14 12:00:00.000000

"""

import datetime
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_initial_platform"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Attempt to enable PostgreSQL extensions (pgcrypto and timescaledb)
    try:
        op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")
    except Exception:
        pass

    try:
        op.execute("CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;")
    except Exception:
        pass

    # Create feature_flags table (F141)
    feature_flags_table = op.create_table(
        "feature_flags",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("updated_by", sa.String(length=64), nullable=False, server_default="system"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_feature_flags_id"), "feature_flags", ["id"], unique=False)
    op.create_index(op.f("ix_feature_flags_name"), "feature_flags", ["name"], unique=True)

    # Seed default feature flags
    now = datetime.datetime.now(datetime.UTC)
    op.bulk_insert(
        feature_flags_table,
        [
            {
                "name": "enable_ml",
                "is_enabled": True,
                "description": "Master toggle for Machine Learning inference and risk scoring pipelines",
                "updated_at": now,
                "updated_by": "system",
            },
            {
                "name": "enable_local_llm",
                "is_enabled": False,
                "description": "Toggle onboard Ollama / llama.cpp local LLM inference",
                "updated_at": now,
                "updated_by": "system",
            },
            {
                "name": "enable_high_rate_telemetry",
                "is_enabled": True,
                "description": "Toggle 1 Hz high-frequency vitals telemetry stream",
                "updated_at": now,
                "updated_by": "system",
            },
        ],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_feature_flags_name"), table_name="feature_flags")
    op.drop_index(op.f("ix_feature_flags_id"), table_name="feature_flags")
    op.drop_table("feature_flags")
