"""AstroCare v2 - Encryption, Secrets & Field-Level Security (F135).

Implements AES-256-GCM authenticated encryption for sensitive clinical and astronaut
fields at rest, secret masking, and repository secret scanning.
"""

import base64
import os
import re

from backend.app.core.config import get_settings
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _get_encryption_key() -> bytes:
    """Retrieve and decode the 32-byte field encryption key."""
    settings = get_settings()
    key_b64 = settings.FIELD_ENCRYPTION_KEY.get_secret_value()
    try:
        raw_key = base64.b64decode(key_b64)
        if len(raw_key) != 32:
            # Fallback to key derivation padding for dev
            raw_key = raw_key.ljust(32, b"0")[:32]
        return raw_key
    except Exception:
        # Fallback 32-byte key
        return b"AstroCare32ByteEncryptionKey2026"


def encrypt_field(plaintext: str) -> str:
    """Encrypt sensitive string using AES-256-GCM with a random 96-bit nonce.

    Returns base64 encoded string: nonce (12 bytes) + ciphertext + tag (16 bytes).
    """
    if not plaintext:
        return ""
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    combined = nonce + ciphertext
    return base64.b64encode(combined).decode("utf-8")


def decrypt_field(encoded_ciphertext: str) -> str:
    """Decrypt base64 encoded AES-256-GCM ciphertext.

    Extracts nonce (first 12 bytes) and decrypts the remainder.
    """
    if not encoded_ciphertext:
        return ""
    key = _get_encryption_key()
    aesgcm = AESGCM(key)
    raw = base64.b64decode(encoded_ciphertext.encode("utf-8"))
    nonce = raw[:12]
    ciphertext = raw[12:]
    decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, None)
    return decrypted_bytes.decode("utf-8")


def mask_secret(secret: str, unmasked_start: int = 2, unmasked_end: int = 2) -> str:
    """Mask a secret value for safe logging or output display."""
    if not secret:
        return ""
    if len(secret) <= (unmasked_start + unmasked_end):
        return "***"
    return f"{secret[:unmasked_start]}***{secret[-unmasked_end:]}"


# Patterns to scan for accidental secret leakage
SECRET_PATTERNS = [
    re.compile(
        r"(?i)(password|passwd|pwd|secret|api_key|token)\s*[:=]\s*['\"][A-Za-z0-9+/=]{16,}['\"]"
    ),
    re.compile(r"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"(?i)bearer\s+[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}"),
]


def scan_file_for_secrets(filepath: str) -> list[tuple[int, str]]:
    """Scan a source file for suspected committed secrets or hardcoded credentials."""
    findings = []
    if not os.path.exists(filepath):
        return findings

    with open(filepath, encoding="utf-8", errors="ignore") as f:
        for line_num, line in enumerate(f, start=1):
            # Ignore lines in .env.example or test files with mock tokens
            if "change_this" in line or "dummy" in line or "example" in line:
                continue
            for pattern in SECRET_PATTERNS:
                if pattern.search(line):
                    findings.append((line_num, line.strip()))
    return findings


# --- Unified JWT Authentication & Role-Based Access Control ---
import jwt
from fastapi import Header, HTTPException, status, Depends
from pydantic import BaseModel

class TokenClaims(BaseModel):
    sub: str
    role: str
    crew_id: str | None = None
    username: str | None = None


def verify_jwt_token(authorization: str | None = Header(None)) -> TokenClaims:
    """Verify bearer JWT token issued by Node auth service (F001)."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
        )
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format; must be Bearer <token>",
        )
    token = parts[1]
    settings = get_settings()
    secret = settings.JWT_SECRET.get_secret_value()
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        return TokenClaims(
            sub=str(payload.get("sub") or payload.get("userId") or ""),
            role=str(payload.get("role", "astronaut")),
            crew_id=payload.get("crew_id"),
            username=payload.get("username"),
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired; please re-login",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
        )


def require_role(allowed_roles: list[str]):
    """FastAPI dependency to enforce role policy."""
    def role_checker(claims: TokenClaims = Depends(verify_jwt_token)) -> TokenClaims:
        if allowed_roles and claims.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{claims.role}' lacks permission for this resource. Required: {allowed_roles}",
            )
        return claims
    return role_checker

