"""TEMP-until-DB: phase_thresholds, baseline_history, watchdog_events, face_metrics, motion_readings, motion_night, gesture_log, twin_state, panel_votes, fed_rounds

Revision ID: 0003_TEMP_until_DB
Revises: 0002_TEMP_until_DB
Create Date: 2026-11-14 20:45:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_TEMP_until_DB"
down_revision: str | None = "0002_TEMP_until_DB"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # DB-10: phase_thresholds
    op.create_table(
        "phase_thresholds",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("phase", sa.String(length=32), nullable=False),
        sa.Column("metric", sa.String(length=64), nullable=False),
        sa.Column("low", sa.Float(), nullable=False),
        sa.Column("high", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=False),
        sa.Column("citation", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("length(trim(citation)) > 0", name="ck_phase_citation_nonempty"),
    )
    op.create_index(op.f("ix_phase_thresholds_phase"), "phase_thresholds", ["phase"], unique=False)
    op.create_index(op.f("ix_phase_thresholds_metric"), "phase_thresholds", ["metric"], unique=False)

    # DB-09: baseline_history
    op.create_table(
        "baseline_history",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("crew_id", sa.String(length=64), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("metric", sa.String(length=64), nullable=False),
        sa.Column("baseline_value", sa.Float(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.95"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("restored_from_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_baseline_history_crew_id"), "baseline_history", ["crew_id"], unique=False)
    op.create_index(op.f("ix_baseline_history_metric"), "baseline_history", ["metric"], unique=False)

    op.create_table(
        "watchdog_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("crew_id", sa.String(length=64), nullable=False),
        sa.Column("metric", sa.String(length=64), nullable=False),
        sa.Column("statistic", sa.String(length=64), nullable=False),
        sa.Column("ts", sa.String(length=64), nullable=False),
        sa.Column("degraded", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("fallback_mode", sa.String(length=32), nullable=False, server_default="rules"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # DB-07: face_metrics
    op.create_table(
        "face_metrics",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("crew_id", sa.String(length=64), nullable=False),
        sa.Column("date", sa.String(length=10), nullable=False),
        sa.Column("metric", sa.String(length=64), nullable=False, server_default="relative_change_index"),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("landmark_quality", sa.Float(), nullable=False),
        sa.Column("provenance", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("crew_id", "date", "metric", name="uq_face_crew_date_metric"),
    )

    # DB-08: motion_readings & motion_night
    op.create_table(
        "motion_readings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("crew_id", sa.String(length=64), nullable=False),
        sa.Column("ts", sa.String(length=64), nullable=False),
        sa.Column("movement_magnitude_mean", sa.Float(), nullable=False),
        sa.Column("movement_magnitude_std", sa.Float(), nullable=False),
        sa.Column("stillness_flag", sa.Boolean(), nullable=False),
        sa.Column("provenance", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "motion_night",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("crew_id", sa.String(length=64), nullable=False),
        sa.Column("date", sa.String(length=10), nullable=False),
        sa.Column("sleep_window_estimate", sa.String(length=32), nullable=False),
        sa.Column("restlessness_index", sa.Float(), nullable=False),
        sa.Column("n_movements", sa.Integer(), nullable=False),
        sa.Column("quality", sa.Float(), nullable=False),
        sa.Column("provenance", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("crew_id", "date", name="uq_motion_night_crew_date"),
    )

    # gesture_log (TEMP table)
    op.create_table(
        "gesture_log",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("crew_id", sa.String(length=64), nullable=False),
        sa.Column("gesture", sa.String(length=32), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("ts", sa.String(length=64), nullable=False),
        sa.Column("action_permitted", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # DB-11: twin_state
    op.create_table(
        "twin_state",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("crew_id", sa.String(length=64), nullable=False),
        sa.Column("day", sa.Integer(), nullable=False),
        sa.Column("metric", sa.String(length=64), nullable=False),
        sa.Column("mean", sa.Float(), nullable=False),
        sa.Column("lo90", sa.Float(), nullable=False),
        sa.Column("hi90", sa.Float(), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # DB-12: panel_votes
    op.create_table(
        "panel_votes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("consultation_id", sa.String(length=64), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("specialist", sa.String(length=64), nullable=False),
        sa.Column("vote", sa.String(length=64), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("citations", sa.String(length=255), nullable=False),
        sa.Column("disagreement", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # DB-13: fed_rounds
    op.create_table(
        "fed_rounds",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("round_id", sa.Integer(), nullable=False),
        sa.Column("client_id", sa.String(length=64), nullable=False),
        sa.Column("n_samples", sa.Integer(), nullable=False),
        sa.Column("bytes_received", sa.Integer(), nullable=False),
        sa.Column("model_version", sa.String(length=32), nullable=False, server_default="stub"),
        sa.Column("global_weights", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="completed"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("fed_rounds")
    op.drop_table("panel_votes")
    op.drop_table("twin_state")
    op.drop_table("gesture_log")
    op.drop_table("motion_night")
    op.drop_table("motion_readings")
    op.drop_table("face_metrics")
    op.drop_table("watchdog_events")
    op.drop_table("baseline_history")
    op.drop_table("phase_thresholds")
