"""AstroCare v2 - Audio Endpoint and Voice Feature Extraction (BE-03 / A01)."""

from backend.app.core.errors import AppException
from backend.app.db.session import get_db
from backend.app.models.voice import VoiceFeaturesResponse
from backend.app.services.consent_service import require_consent
from backend.app.services.voice_service import process_audio_clip_in_memory
from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["voice"])


@router.post("/audio/clip", response_model=VoiceFeaturesResponse)
async def upload_audio_clip(
    request: Request,
    crew_id: str = Query(..., description="Crew member ID (Excel person_id)"),
    clip_id: str = Query(..., description="Unique audio clip identifier"),
    task_type: str = Query(default="guided_read", description="Task type: guided_read or ambient"),
    content_type: str = Header(default="audio/wav", alias="content-type"),
    db: AsyncSession = Depends(get_db),
    _consent: bool = Depends(require_consent("mic")),
):
    """Receive audio strictly in RAM, extract acoustic features via ML stub, and store features only.

    Do NOT use UploadFile: request body is read into memory buffer.
    Zero raw audio is written to disk or database.
    """
    audio_bytes = await request.body()
    if not audio_bytes:
        raise AppException(
            code="BAD_REQUEST",
            message="Audio request body cannot be empty",
            status_code=400,
        )

    return await process_audio_clip_in_memory(
        audio_bytes=audio_bytes,
        crew_id=crew_id,
        clip_id=clip_id,
        task_type=task_type,
        content_type=content_type,
        session=db,
    )
