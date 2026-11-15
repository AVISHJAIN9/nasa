"""AstroCare v2 - Token Bucket Rate Limiting (F136).

Protects API from telemetry floods and misconfigured clients.
Returns 429 Too Many Requests with standard Retry-After header.
"""

import time

from backend.app.core.errors import RateLimitExceededException
from fastapi import Request


class TokenBucketLimiter:
    """In-memory sliding window / token bucket rate limiter."""

    def __init__(self, requests_per_minute: int = 120):
        self.capacity = requests_per_minute
        self.fill_rate = requests_per_minute / 60.0  # tokens per second
        self.storage: dict[str, tuple[float, float]] = {}  # key -> (tokens, last_time)

    def check(self, key: str, cost: float = 1.0) -> tuple[bool, int]:
        """Check if request is allowed. Returns (allowed, retry_after_seconds)."""
        now = time.monotonic()
        tokens, last_time = self.storage.get(key, (float(self.capacity), now))

        # Add regenerated tokens
        elapsed = now - last_time
        tokens = min(float(self.capacity), tokens + elapsed * self.fill_rate)

        if tokens >= cost:
            tokens -= cost
            self.storage[key] = (tokens, now)
            return True, 0
        else:
            # Calculate wait time until at least 1 token is available
            deficit = cost - tokens
            retry_after = max(1, int(deficit / self.fill_rate) + 1)
            self.storage[key] = (tokens, now)
            return False, retry_after

    def reset(self) -> None:
        self.storage.clear()


limiter = TokenBucketLimiter(requests_per_minute=120)


async def check_rate_limit(request: Request) -> None:
    """Dependency that applies rate limiting per client IP or token."""
    client_ip = request.client.host if request.client else "unknown"
    client_key = request.headers.get("Authorization", client_ip)

    allowed, retry_after = limiter.check(client_key)
    if not allowed:
        raise RateLimitExceededException(
            message=f"Rate limit exceeded. Try again in {retry_after} seconds.",
            retry_after=retry_after,
        )
