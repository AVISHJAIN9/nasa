"""AstroCare v2 - Redis Event Bus & Event Schemas (Contract 4).

Provides standard async event publication and subscription over Redis Pub/Sub.
"""

import datetime
import logging
import uuid
from typing import Any

import redis.asyncio as aioredis
from backend.app.core.config import get_settings
from pydantic import BaseModel, Field

logger = logging.getLogger("astrocare.events")


class EventEnvelope(BaseModel):
    event_id: str = Field(default_factory=lambda: f"evt-{uuid.uuid4().hex[:12]}")
    event_type: str = Field(..., description="Format: <domain>.<entity>.<action>")
    timestamp: str = Field(default_factory=lambda: datetime.datetime.now(datetime.UTC).isoformat())
    source: str = Field(default="SIMULATED", description="SIMULATED | REPLAY | REAL")
    correlation_id: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class EventBus:
    """Async Redis Pub/Sub Event Bus."""

    def __init__(self) -> None:
        self._redis: aioredis.Redis | None = None

    async def get_client(self) -> aioredis.Redis:
        if self._redis is None:
            settings = get_settings()
            self._redis = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_timeout=5,
                socket_connect_timeout=5,
            )
        return self._redis

    async def publish(self, event: EventEnvelope) -> bool:
        """Publish an event envelope to a Redis channel named by its event_type."""
        try:
            client = await self.get_client()
            channel = event.event_type
            payload_str = event.model_dump_json()
            await client.publish(channel, payload_str)
            logger.info(f"Published event {event.event_id} ({channel})")
            return True
        except Exception as exc:
            logger.warning(f"Failed to publish event {event.event_type} to Redis: {exc}")
            return False

    async def close(self) -> None:
        if self._redis is not None:
            await self._redis.close()
            self._redis = None


# Global event bus singleton
event_bus = EventBus()
