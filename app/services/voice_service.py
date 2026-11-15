"""AstroCare v2 - Voice Features Ingestion & Extraction Service (BE-03 / A01).

Guarantees:
- Zero raw audio written to disk (in-memory processing only)
- Raw audio never logged or echoed
- Features stored in DB-02 voice_features
- Stub ML interface with model_version="stub"
"""

import datetime
import logging
from typing import Any

from backend.app.core.config import get_settings
from backend.app.core.errors import AppException
from backend.app.db.models.voice import VoiceFeatures
from backend.app.models.voice import VoiceFeaturesResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger("astrocare.voice")


def extract_voice_features(audio: bytes, sample_rate: int = 16000) -> dict[str, Any]:
    """ML Interface Stub: Extracts acoustic biomarker features from audio in-memory.

    Returns:
        {pitch, jitter, shimmer, rate, pauses, quality, cough_detected, model_version}
    """
    if len(audio) == 0:
        raise ValueError("Audio buffer cannot be empty")

    # In a full deployment, this runs ONNX / DSP feature extraction in RAM.
    # Stub implementation with deterministic pseudo-features derived from bytes:
    byte_sum = sum(audio[:100]) if len(audio) >= 100 else sum(audio)
    pitch = 120.0 + (byte_sum % 80)
    jitter = 0.005 + ((byte_sum % 20) / 1000.0)
    shimmer = 0.02 + ((byte_sum % 30) / 1000.0)
    rate = 3.5 + ((byte_sum % 15) / 10.0)
    pauses = (byte_sum % 5) + 1
    quality = min(1.0, max(0.0, 0.75 + ((byte_sum % 25) / 100.0)))
    cough_detected = (byte_sum % 7 == 0)

    return {
        "pitch": round(pitch, 2),
        "jitter": round(jitter, 4),
        "shimmer": round(shimmer, 4),
        "rate": round(rate, 2),
        "pauses": pauses,
        "quality": round(quality, 2),
        "cough_detected": cough_detected,
        "model_version": "stub",
    }


async def process_audio_clip_in_memory(
    audio_bytes: bytes,
    crew_id: str,
    clip_id: str,
    task_type: str,
    content_type: str,
    session: AsyncSession,
) -> VoiceFeaturesResponse:
    """Process incoming audio strictly in RAM and persist extracted features only."""
    settings = get_settings()

    # 1. Size cap validation
    if len(audio_bytes) > settings.AUDIO_MAX_SIZE_BYTES:
        raise AppException(
            code="PAYLOAD_TOO_LARGE",
            message=f"Audio clip size ({len(audio_bytes)} bytes) exceeds maximum limit ({settings.AUDIO_MAX_SIZE_BYTES} bytes)",
            status_code=413,
            details={"size_bytes": len(audio_bytes), "max_bytes": settings.AUDIO_MAX_SIZE_BYTES},
        )

    # 2. Content-type validation
    clean_content_type = content_type.split(";")[0].strip().lower()
    if clean_content_type not in settings.AUDIO_ALLOWED_CONTENT_TYPES:
        raise AppException(
            code="UNSUPPORTED_MEDIA_TYPE",
            message=f"Content-type '{content_type}' is not allowed. Allowed types: {settings.AUDIO_ALLOWED_CONTENT_TYPES}",
            status_code=415,
            details={"content_type": content_type, "allowed": settings.AUDIO_ALLOWED_CONTENT_TYPES},
        )

    # 3. Task type validation
    if task_type not in ("guided_read", "ambient"):
        raise AppException(
            code="VALIDATION_ERROR",
            message="task_type must be either 'guided_read' or 'ambient'",
            status_code=422,
            details={"task_type": task_type},
        )

    # 4. Check idempotency: if clip_id already processed, return stored features
    stmt = select(VoiceFeatures).where(VoiceFeatures.clip_id == clip_id)
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        return VoiceFeaturesResponse(
            clip_id=existing.clip_id,
            crew_id=existing.crew_id,
            task_type=existing.task_type,  # type: ignore[arg-type]
            pitch=existing.pitch,
            jitter=existing.jitter,
            shimmer=existing.shimmer,
            rate=existing.rate,
            pauses=existing.pauses,
            quality=existing.quality,
            cough_detected=existing.cough_detected,
            model_version=existing.model_version,
            status="stored",
        )

    # 5. Extract features strictly in-memory (RAM) via ML stub
    try:
        features = extract_voice_features(audio_bytes)
    except Exception as exc:
        raise AppException(
            code="ML_EXTRACTION_ERROR",
            message=f"Failed to extract voice features: {exc}",
            status_code=422,
            details={"error": str(exc)},
        )

    # 6. Persist features ONLY (never audio) into DB-02 voice_features
    # Calculate TTL expires_at (e.g. 30 days)
    now = datetime.datetime.now(datetime.UTC)
    expires = now + datetime.timedelta(days=30)

    record = VoiceFeatures(
        crew_id=crew_id,
        clip_id=clip_id,
        task_type=task_type,
        pitch=features["pitch"],
        jitter=features["jitter"],
        shimmer=features["shimmer"],
        rate=features["rate"],
        pauses=features["pauses"],
        quality=features["quality"],
        cough_detected=features["cough_detected"],
        model_version=features["model_version"],
        expires_at=expires,
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)

    logger.info(f"Processed audio clip {clip_id} for {crew_id}: quality={features['quality']} (0 raw audio saved)")

    return VoiceFeaturesResponse(
        clip_id=record.clip_id,
        crew_id=record.crew_id,
        task_type=record.task_type,  # type: ignore[arg-type]
        pitch=record.pitch,
        jitter=record.jitter,
        shimmer=record.shimmer,
        rate=record.rate,
        pauses=record.pauses,
        quality=record.quality,
        cough_detected=record.cough_detected,
        model_version=record.model_version,
        status="stored",
    )
