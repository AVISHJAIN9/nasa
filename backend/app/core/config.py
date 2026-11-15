"""AstroCare v2 - Core Settings and Configuration.

Loads configuration from environment variables and .env file using pydantic-settings.
NOTE: Mission parameters (delay, blackout, radiation, thresholds, supplies) are NOT
configured here. They are strictly governed by mission_config (F003, Part 2).
"""

from functools import lru_cache

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=True,
    )

    PROJECT_NAME: str = "AstroCare v2 Backend"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # PostgreSQL & TimescaleDB
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "astrocare"
    POSTGRES_PASSWORD: str = "astrocare_dev_password"
    POSTGRES_DB: str = "astrocare_db"
    DATABASE_URL: str | None = None

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: str | None, info) -> str:
        if isinstance(v, str) and v.strip():
            return v
        data = info.data
        user = data.get("POSTGRES_USER", "astrocare")
        pwd = data.get("POSTGRES_PASSWORD", "astrocare_dev_password")
        host = data.get("POSTGRES_HOST", "localhost")
        port = data.get("POSTGRES_PORT", 5432)
        db = data.get("POSTGRES_DB", "astrocare_db")
        return f"postgresql+asyncpg://{user}:{pwd}@{host}:{port}/{db}"

    # Redis (Event Bus & Caching)
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str = ""
    REDIS_URL: str | None = None

    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def assemble_redis_connection(cls, v: str | None, info) -> str:
        if isinstance(v, str) and v.strip():
            return v
        data = info.data
        host = data.get("REDIS_HOST", "localhost")
        port = data.get("REDIS_PORT", 6379)
        pwd = data.get("REDIS_PASSWORD", "")
        if pwd:
            return f"redis://:{pwd}@{host}:{port}/0"
        return f"redis://{host}:{port}/0"

    # Security & Encryption (F135)
    SECRET_KEY: SecretStr = Field(
        default=SecretStr("insecure_dev_secret_key_minimum_32_bytes_long_change_in_production")
    )
    JWT_SECRET: SecretStr = Field(
        default=SecretStr("super_secret_jwt_key_astrocare_2026_min_32_bytes")
    )
    FIELD_ENCRYPTION_KEY: SecretStr = Field(
        default=SecretStr("MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=")
    )

    # CORS
    CORS_ORIGINS: str | list[str] = (
        "http://localhost:3000,http://localhost:5173,http://localhost:8000"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # Rate Limiting (F136)
    RATE_LIMIT_REQUESTS_PER_MINUTE: int = 120

    # Default Feature Flag States (F141)
    FLAG_ENABLE_ML: bool = True
    FLAG_ENABLE_LOCAL_LLM: bool = False
    FLAG_MISSION_MODE: str = "ISS"

    # Mission Phases (BE-14 / M05)
    MISSION_PHASE: str = "transit"
    VALID_MISSION_PHASES: list[str] = ["launch", "transit", "landing", "return"]

    # Gesture Action Mapping (BE-11 / C04 - Placeholders)
    GESTURE_ACTION_MAPPING: dict[str, str] = {
        "open_palm": "acknowledge_alert",
        "thumbs_up": "confirm_checkin",
        "wave": "ping_cmo",
        "fist": "mute_nudge",
    }

    # Consent and Sensors (BE-06 / M01)
    CONSENT_VERSION: int = 1
    VALID_SENSORS: list[str] = ["camera", "mic", "keyboard", "pointer", "motion"]
    PASSIVE_SENSORS: list[str] = ["camera", "mic", "motion"]
    ACTIVE_SENSORS: list[str] = ["keyboard", "pointer"]

    # Plausibility Bounds (BE-01 / C01 - PLACEHOLDERS until physiological calibration)
    PLAUSIBILITY_BOUNDS: dict[str, tuple[float, float]] = {
        "pulse_bpm": (30.0, 240.0),      # Placeholder physiological limits
        "resp_rpm": (4.0, 60.0),         # Placeholder physiological limits
        "spo2": (50.0, 100.0),           # Placeholder physiological limits
        "heart_rate": (30.0, 240.0),     # Placeholder physiological limits
        "temperature": (30.0, 45.0),     # Placeholder physiological limits
    }

    # Sensor Quality Thresholds (BE-02 / C05 - PLACEHOLDERS until ML-02 calibration)
    SENSOR_QUALITY_THRESHOLDS: dict[str, float] = {
        "camera": 0.70,   # Placeholder threshold
        "mic": 0.65,      # Placeholder threshold
        "keyboard": 0.60, # Placeholder threshold
        "pointer": 0.60,  # Placeholder threshold
        "motion": 0.50,   # Placeholder threshold
        "default": 0.50,  # Fallback default
    }
    N_CONSECUTIVE_LOW_QUALITY: int = 3

    # Audio Limits (BE-03 / A01)
    AUDIO_MAX_SIZE_BYTES: int = 5 * 1024 * 1024  # 5 MB maximum
    AUDIO_MAX_DURATION_SECONDS: int = 60
    AUDIO_ALLOWED_CONTENT_TYPES: list[str] = [
        "audio/wav",
        "audio/x-wav",
        "audio/webm",
        "audio/ogg",
        "audio/mpeg",
        "application/octet-stream",
    ]


@lru_cache
def get_settings() -> Settings:
    """Return cached application settings singleton."""
    return Settings()
