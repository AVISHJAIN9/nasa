"""AstroCare F055: Minimal Retrieval-Augmented Assistant (RAG Version 0).

Retrieves top-3 relevant chunks from F056 knowledge base.
Enforces:
1. Grounding strictly in retrieved, licensed source material with full metadata citations.
2. Below-threshold or unsupported questions reply EXACTLY: 'I do not know.'
3. F057 Cloud/Local dual mode router execution.
4. F059 claim-level citation verification.
5. F058 & N17 medical safety guardrails & emergency escalation.

Decision-support prototype on synthetic and public data.
"""
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from astrocare.assistant.citation_checker import CitationSupportChecker, CitationVerificationReport
from astrocare.assistant.router import DualModeLLMRouter, NetworkHealthChecker
from astrocare.assistant.safety import MedicalSafetyGuardrail, SafetyCheckResult
from astrocare.knowledge.store import MedicalKnowledgeStore, RetrievedChunk


@dataclass
class RAGResponse:
    query: str
    answer: str
    citations: List[Dict[str, Any]]
    mode: str  # 'cloud' or 'local'
    top_similarity: float
    is_refusal: bool
    citation_report: CitationVerificationReport
    safety_result: SafetyCheckResult
    latency_ms: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "answer": self.answer,
            "citations": self.citations,
            "mode": self.mode,
            "top_similarity": round(self.top_similarity, 4),
            "is_refusal": self.is_refusal,
            "is_fully_supported": self.citation_report.is_fully_supported,
            "safety_passed": self.safety_result.passed,
            "is_emergency": self.safety_result.is_emergency,
            "latency_ms": round(self.latency_ms, 2),
        }


class AstroCareAssistantRAG:
    """End-to-end RAG assistant with verified citations and safety guardrails."""

    def __init__(
        self,
        store: Optional[MedicalKnowledgeStore] = None,
        router: Optional[DualModeLLMRouter] = None,
        checker: Optional[CitationSupportChecker] = None,
        guardrail: Optional[MedicalSafetyGuardrail] = None,
    ):
        self.store = store or MedicalKnowledgeStore()
        self.router = router or DualModeLLMRouter()
        self.checker = checker or CitationSupportChecker()
        self.guardrail = guardrail or MedicalSafetyGuardrail()

    def ask(self, query: str, top_k: int = 3) -> RAGResponse:
        """Processes user medical query with full safety and verification pipeline."""
        # 1. Emergency and safety check on input query
        is_emergency, em_directive = self.guardrail.evaluate_query(query)
        if em_directive is not None:
            return RAGResponse(
                query=query,
                answer=em_directive,
                citations=[],
                mode="local",
                top_similarity=1.0 if is_emergency else 0.0,
                is_refusal=True,
                citation_report=CitationVerificationReport(
                    original_answer=em_directive,
                    verified_answer=em_directive,
                    is_fully_supported=True,
                    overall_support_score=1.0,
                    claim_results=[],
                    refusal_triggered=True,
                ),
                safety_result=SafetyCheckResult(
                    passed=False,
                    is_emergency=is_emergency,
                    refusal_triggered=True,
                    violations=["Critical condition or unsafe request detected in user query"],
                    escalation_directive=em_directive,
                    safe_output=em_directive,
                ),
                latency_ms=1.5,
            )

        # 2. Retrieve top-k chunks from F056 store
        retrieved: List[RetrievedChunk] = self.store.retrieve(query, top_k=top_k)
        top_sim = retrieved[0].similarity_score if retrieved else 0.0

        # 3. Similarity threshold check: If below threshold, reply exactly: 'I do not know.'
        if not retrieved or top_sim < self.store.similarity_threshold:
            refusal_text = "I do not know."
            return RAGResponse(
                query=query,
                answer=refusal_text,
                citations=[],
                mode="local",
                top_similarity=top_sim,
                is_refusal=True,
                citation_report=CitationVerificationReport(
                    original_answer=refusal_text,
                    verified_answer=refusal_text,
                    is_fully_supported=True,
                    overall_support_score=1.0,
                    claim_results=[],
                    refusal_triggered=False,
                ),
                safety_result=SafetyCheckResult(
                    passed=True,
                    is_emergency=False,
                    refusal_triggered=False,
                    violations=[],
                    escalation_directive=None,
                    safe_output=refusal_text,
                ),
                latency_ms=2.0,
            )

        # 4. Format evidence with provenance citations
        evidence_blocks: List[str] = []
        citations: List[Dict[str, Any]] = []
        for c in retrieved:
            evidence_blocks.append(f"[{c.doc_id}] ({c.section}): {c.content}")
            citations.append(c.to_citation())

        combined_evidence = "\n\n".join(evidence_blocks)

        # 5. Dual-mode routing (cloud API or local runtime fallback)
        routed = self.router.route_and_generate(
            question=query,
            evidence_text=combined_evidence,
        )
        candidate_answer = routed["answer"]
        mode = routed["mode"]
        latency_ms = routed["latency_ms"]

        # 6. F059 Citation verification
        cit_report = self.checker.verify_answer(candidate_answer, retrieved)
        verified_text = cit_report.verified_answer

        # 7. F058 Medical safety guardrail check
        safety_res = self.guardrail.evaluate_response(verified_text)
        final_answer = safety_res.safe_output
        is_refusal = (final_answer.strip() == "I do not know.") or safety_res.refusal_triggered

        return RAGResponse(
            query=query,
            answer=final_answer,
            citations=citations if not is_refusal else [],
            mode=mode,
            top_similarity=top_sim,
            is_refusal=is_refusal,
            citation_report=cit_report,
            safety_result=safety_res,
            latency_ms=latency_ms,
        )
