"""AstroCare v2 - Security & Secrets Verification Endpoints (F135)."""

import os
from typing import Any

from backend.app.core.security import (
    decrypt_field,
    encrypt_field,
    mask_secret,
    scan_file_for_secrets,
)
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/security", tags=["Security & Encryption"])


class EncryptRequest(BaseModel):
    plaintext: str = Field(..., min_length=1, description="Sensitive plaintext to encrypt")


class EncryptResponse(BaseModel):
    ciphertext: str
    algorithm: str = "AES-256-GCM"


class DecryptRequest(BaseModel):
    ciphertext: str = Field(..., min_length=1, description="Base64 encoded ciphertext to decrypt")


class DecryptResponse(BaseModel):
    plaintext: str
    algorithm: str = "AES-256-GCM"


class SecretScanResult(BaseModel):
    files_scanned: int
    findings_count: int
    findings: list[dict[str, Any]]
    clean: bool


@router.post(
    "/encrypt", response_model=EncryptResponse, summary="Encrypt sensitive field (AES-256-GCM)"
)
async def encrypt_data(payload: EncryptRequest) -> EncryptResponse:
    """Encrypt sensitive string using AES-256-GCM authenticated encryption."""
    encrypted = encrypt_field(payload.plaintext)
    return EncryptResponse(ciphertext=encrypted)


@router.post("/decrypt", response_model=DecryptResponse, summary="Decrypt sensitive field")
async def decrypt_data(payload: DecryptRequest) -> DecryptResponse:
    """Decrypt base64 ciphertext using AES-256-GCM."""
    decrypted = decrypt_field(payload.ciphertext)
    return DecryptResponse(plaintext=decrypted)


@router.get(
    "/scan", response_model=SecretScanResult, summary="Scan repo for accidental secrets (F135)"
)
async def run_secret_scan() -> SecretScanResult:
    """Scan tracked repository files for uncommitted credentials or accidental secrets."""
    # Detect repository root
    current = os.path.dirname(os.path.abspath(__file__))
    repo_root = os.getcwd()
    while current and current != os.path.dirname(current):
        if os.path.exists(os.path.join(current, ".git")):
            repo_root = current
            break
        current = os.path.dirname(current)

    scanned_files = 0
    all_findings = []

    scan_dirs = ["backend", "tests", "scripts"]
    for d in scan_dirs:
        dir_path = os.path.join(repo_root, d)
        if not os.path.exists(dir_path):
            continue
        for root, _, files in os.walk(dir_path):
            for file in files:
                if file.endswith((".py", ".yml", ".yaml", ".json", ".md")):
                    scanned_files += 1
                    fp = os.path.join(root, file)
                    issues = scan_file_for_secrets(fp)
                    for line_num, line_content in issues:
                        all_findings.append(
                            {
                                "file": os.path.relpath(fp, repo_root),
                                "line": line_num,
                                "match": mask_secret(line_content),
                            }
                        )

    return SecretScanResult(
        files_scanned=scanned_files,
        findings_count=len(all_findings),
        findings=all_findings,
        clean=len(all_findings) == 0,
    )
