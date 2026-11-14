"""AstroCare F057: Cloud/Local LLM Dual-Mode Router & Health Check.

Features:
- Single shared assistant prompt template ensuring identical safety and answer contracts.
- Explicit network health check.
- Automatic routing: routes to Cloud API when online; falls back cleanly to Local runtime
  (Ollama / edge model) on health check failure or network timeout.
- Visible execution mode logging ('cloud' vs 'local') and request metrics.
- Strict security: Never logs API keys, secrets, or raw personal health data.
"""
from dataclasses import dataclass
import json
import logging
import socket
import time
from typing import Any, Callable, Dict, List, Optional
import urllib.request

logger = logging.getLogger("astrocare.router")


SHARED_ASSISTANT_PROMPT_TEMPLATE = """You are AstroCare Assistant, an onboard decision-support prototype for spaceflight missions.
Answer the user question using ONLY the retrieved authoritative space medicine evidence below.

Operational Directives:
1. Ground every claim directly in the provided evidence.
2. If the evidence does not directly support an answer, reply exactly: "I do not know."
3. Do NOT provide autonomous clinical diagnoses or prescribe unauthorized prescription therapies.
4. Always attribute information to the cited document IDs.
5. Emphasize crew safety and flight surgeon consultation.

Retrieved Authoritative Evidence:
{evidence}

User Question:
{question}

Answer:"""


@dataclass
class RouterDecision:
    mode: str  # 'cloud' or 'local'
    health_check_passed: bool
    fallback_triggered: bool
    reason: str


class NetworkHealthChecker:
    """Explicit network ping and health check with configurable timeout."""

    def __init__(self, check_host: str = "8.8.8.8", check_port: int = 53, timeout_sec: float = 0.8):
        self.check_host = check_host
        self.check_port = check_port
        self.timeout_sec = timeout_sec
        self.force_offline = False  # Used for cable-pull / offline demonstration

    def is_healthy(self) -> bool:
        if self.force_offline:
            return False
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout_sec)
            sock.connect((self.check_host, self.check_port))
            sock.close()
            return True
        except Exception:
            return False


class DualModeLLMRouter:
    """Routes generation requests between Cloud API and Local runtime."""

    def __init__(
        self,
        health_checker: Optional[NetworkHealthChecker] = None,
        cloud_caller: Optional[Callable[[str], str]] = None,
        local_caller: Optional[Callable[[str], str]] = None,
        cloud_enabled: bool = True,
    ):
        self.health_checker = health_checker or NetworkHealthChecker()
        self.cloud_caller = cloud_caller or self._default_cloud_caller
        self.local_caller = local_caller or self._default_local_caller
        self.cloud_enabled = cloud_enabled
        self.last_decision: Optional[RouterDecision] = None

    def route_and_generate(
        self,
        question: str,
        evidence_text: str,
    ) -> Dict[str, Any]:
        """Executes prompt on selected backend, logging mode and metrics."""
        prompt = SHARED_ASSISTANT_PROMPT_TEMPLATE.format(
            evidence=evidence_text,
            question=question,
        )

        t0 = time.perf_counter()
        health_ok = self.health_checker.is_healthy()
        mode = "local"
        fallback = False
        reason = "Normal local execution"
        output_text = ""

        if self.cloud_enabled and health_ok:
            try:
                mode = "cloud"
                reason = "Cloud link active and healthy"
                output_text = self.cloud_caller(prompt)
            except Exception as e:
                # Cloud call failed or timed out: execute strict fallback
                logger.warning(f"Cloud call failed ({e}); falling back immediately to local runtime.")
                mode = "local"
                fallback = True
                reason = f"Cloud failure fallback: {str(e)[:50]}"
                output_text = self.local_caller(prompt)
        else:
            mode = "local"
            reason = "Offline mode or health check unreachable"
            output_text = self.local_caller(prompt)

        latency_ms = (time.perf_counter() - t0) * 1000.0
        self.last_decision = RouterDecision(
            mode=mode,
            health_check_passed=health_ok,
            fallback_triggered=fallback,
            reason=reason,
        )

        return {
            "answer": output_text.strip(),
            "mode": mode,
            "fallback_triggered": fallback,
            "reason": reason,
            "latency_ms": round(latency_ms, 2),
            "prompt_length": len(prompt),
        }

    def _default_cloud_caller(self, prompt: str) -> str:
        """Default cloud caller placeholder (throws if API key unconfigured)."""
        raise ConnectionError("Cloud API endpoint unconfigured or rate-limited.")

    def _default_local_caller(self, prompt: str) -> str:
        """Lightweight local deterministic edge model answering strictly from evidence."""
        # Extracts directly from evidence if question keywords align
        if "Retrieved Authoritative Evidence:" in prompt:
            evidence_part = prompt.split("Retrieved Authoritative Evidence:")[1].split("User Question:")[0].strip()
            q_part = prompt.split("User Question:")[1].split("Answer:")[0].strip().lower()

            lines = [line.strip() for line in evidence_part.split("\n") if line.strip()]
            relevant_lines: List[str] = []
            for line in lines:
                words = [w for w in q_part.split() if len(w) > 3]
                if any(w in line.lower() for w in words):
                    relevant_lines.append(line)

            if relevant_lines:
                return f"Based on retrieved onboard medical records: {relevant_lines[0]}"
        return "I do not know."
