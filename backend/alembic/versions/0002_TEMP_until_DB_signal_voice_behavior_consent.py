"""TEMP-until-DB: signal_reading, voice_features, behavior_windows, consent_log

Revision ID: 0002_TEMP_until_DB
Revises: 0001_initial_platform
Create Date: 2026-11-14 20:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_TEMP_until_DB"
down_revision: str | None = "0001_initial_platform"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # DB-05: consent_log
    op.create_table(
        "consent_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("crew_id", sa.String(length=64), nullable=False),
        sa.Column("sensor", sa.String(length=32), nullable=False),
        sa.Column("granted", sa.Boolean(), nullable=False),
        sa.Column("consent_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_consent_log_crew_id"), "consent_log", ["crew_id"], unique=False)
    op.create_index(op.f("ix_consent_log_sensor"), "consent_log", ["sensor"], unique=False)

    # DB-01: signal_reading
    op.create_table(
        "signal_reading",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("reading_id", sa.String(length=64), nullable=False),
        sa.Column("crew_id", sa.String(length=64), nullable=False),
        sa.Column("sensor", sa.String(length=32), nullable=True),
        sa.Column("metric", sa.String(length=64), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=False),
        sa.Column("ts", sa.String(length=64), nullable=False),
        sa.Column("quality", sa.Float(), nullable=False),
        sa.Column("provenance", sa.String(length=32), nullable=False),
        sa.Column("quality_flag", sa.String(length=32), nullable=True),
        sa.Column("excluded_from_fusion", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_signal_reading_reading_id"), "signal_reading", ["reading_id"], unique=True)
    op.create_index(op.f("ix_signal_reading_crew_id"), "signal_reading", ["crew_id"], unique=False)
    op.create_index(op.f("ix_signal_reading_metric"), "signal_reading", ["metric"], unique=False)
    op.create_index(op.f("ix_signal_reading_excluded"), "signal_reading", ["excluded_from_fusion"], unique=False)

    # DB-02: voice_features
    op.create_table(
        "voice_features",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("crew_id", sa.String(length=64), nullable=False),
        sa.Column("clip_id", sa.String(length=64), nullable=False),
        sa.Column("task_type", sa.String(length=32), nullable=False),
        sa.Column("pitch", sa.Float(), nullable=False),
        sa.Column("jitter", sa.Float(), nullable=False),
        sa.Column("shimmer", sa.Float(), nullable=False),
        sa.Column("rate", sa.Float(), nullable=False),
        sa.Column("pauses", sa.Integer(), nullable=False),
        sa.Column("quality", sa.Float(), nullable=False),
        sa.Column("cough_detected", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("model_version", sa.String(length=32), nullable=False, server_default="stub"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_voice_features_crew_id"), "voice_features", ["crew_id"], unique=False)
    op.create_index(op.f("ix_voice_features_clip_id"), "voice_features", ["clip_id"], unique=True)

    # DB-03: behavior_windows
    op.create_table(
        "behavior_windows",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("crew_id", sa.String(length=64), nullable=False),
        sa.Column("window_start", sa.BigInteger(), nullable=False),
        sa.Column("window_end", sa.BigInteger(), nullable=False),
        sa.Column("event_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("dwell_mean", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("dwell_median", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("dwell_std", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("dwell_p90", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("flight_mean", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("flight_median", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("flight_std", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("flight_p90", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("idle_ratio", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("pointer_speed_mean", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("pointer_speed_std", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("crew_id", "window_start", name="uq_crew_window"),
    )
    op.create_index(op.f("ix_behavior_windows_crew_id"), "behavior_windows", ["crew_id"], unique=False)
    op.create_index(op.f("ix_behavior_windows_window_start"), "behavior_windows", ["window_start"], unique=False)


def downgrade() -> None:
    op.drop_table("behavior_windows")
    op.drop_table("voice_features")
    op.drop_table("signal_reading")
    op.drop_table("consent_log")
