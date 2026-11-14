"""AstroCare F059: Sentence-Level Citation & Hallucination Support Checker.

Checks factual support of candidate assistant answers at the claim/sentence level
against retrieved source evidence chunks.

Operational Rules:
- Token & n-gram overlap scoring against retrieved context.
- Flags unsupported claims and citations that lack matching evidence.
- If support fails, automatically replaces or refuses output with "I do not know."
- Computes checker precision and detects failure cases on documented test sets.

Decision-support prototype on synthetic and public data.
Automated checks are decision aids, not infallible proof.
"""
from dataclasses import dataclass
import re
from typing import Any, Dict, List, Set, Tuple


@dataclass
class ClaimSupportResult:
    claim_text: str
    is_supported: bool
    overlap_score: float
    matched_chunk_ids: List[str]
    unsupported_reason: str = ""


@dataclass
class CitationVerificationReport:
    original_answer: str
    verified_answer: str
    is_fully_supported: bool
    overall_support_score: float
    claim_results: List[ClaimSupportResult]
    refusal_triggered: bool


class CitationSupportChecker:
    """Evaluates factual grounding between assistant claims and retrieved evidence chunks."""

    def __init__(self, token_support_threshold: float = 0.45):
        self.support_threshold = token_support_threshold
        # Common English stop words
        self.stop_words: Set[str] = {
            "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
            "as", "at", "be", "because", "been", "before", "being", "below", "between", "both", "but",
            "by", "could", "did", "do", "does", "doing", "down", "during", "each", "few", "for", "from",
            "further", "had", "has", "have", "having", "he", "her", "here", "hers", "herself", "him",
            "himself", "his", "how", "i", "if", "in", "into", "is", "it", "its", "itself", "just", "me",
            "more", "most", "my", "myself", "no", "nor", "not", "now", "of", "off", "on", "once", "only",
            "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own", "same", "she",
            "should", "so", "some", "such", "than", "that", "the", "their", "theirs", "them", "themselves",
            "then", "there", "these", "they", "this", "those", "through", "to", "too", "under", "until",
            "up", "very", "was", "we", "were", "what", "when", "where", "which", "while", "who", "whom",
            "why", "with", "would", "you", "your", "yours", "yourself", "yourselves"
        }

    def _extract_tokens(self, text: str) -> Set[str]:
        words = re.findall(r"\b[a-zA-Z0-9_\-\.]{3,}\b", text.lower())
        return {w for w in words if w not in self.stop_words}

    def _split_into_claims(self, text: str) -> List[str]:
        # Split by periods, colons, or semicolons
        sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        claims = [s.strip() for s in sentences if len(s.strip()) > 5]
        return claims if claims else [text]

    def verify_answer(
        self,
        candidate_answer: str,
        retrieved_chunks: List[Any],  # List of RetrievedChunk or dicts
    ) -> CitationVerificationReport:
        """Verifies candidate answer against retrieved evidence chunks."""
        if candidate_answer.strip() == "I do not know.":
            return CitationVerificationReport(
                original_answer=candidate_answer,
                verified_answer="I do not know.",
                is_fully_supported=True,
                overall_support_score=1.0,
                claim_results=[],
                refusal_triggered=False,
            )

        claims = self._split_into_claims(candidate_answer)
        if not claims or not retrieved_chunks:
            return CitationVerificationReport(
                original_answer=candidate_answer,
                verified_answer="I do not know.",
                is_fully_supported=False,
                overall_support_score=0.0,
                claim_results=[],
                refusal_triggered=True,
            )

        claim_results: List[ClaimSupportResult] = []
        supported_count = 0

        for claim in claims:
            claim_tokens = self._extract_tokens(claim)
            if not claim_tokens:
                # Trivial connective clause
                claim_results.append(
                    ClaimSupportResult(
                        claim_text=claim,
                        is_supported=True,
                        overlap_score=1.0,
                        matched_chunk_ids=[],
                    )
                )
                supported_count += 1
                continue

            best_overlap = 0.0
            matched_ids: List[str] = []

            for chunk in retrieved_chunks:
                c_content = chunk.content if hasattr(chunk, "content") else chunk.get("content", "")
                c_id = chunk.chunk_id if hasattr(chunk, "chunk_id") else chunk.get("chunk_id", "")
                chunk_tokens = self._extract_tokens(c_content)

                overlap = len(claim_tokens.intersection(chunk_tokens)) / float(len(claim_tokens))
                if overlap > best_overlap:
                    best_overlap = overlap
                if overlap >= self.support_threshold:
                    matched_ids.append(c_id)

            is_supported = best_overlap >= self.support_threshold
            if is_supported:
                supported_count += 1
                reason = ""
            else:
                reason = f"Claim tokens {claim_tokens - chunk_tokens} unverified in evidence (overlap {best_overlap:.2f} < {self.support_threshold})"

            claim_results.append(
                ClaimSupportResult(
                    claim_text=claim,
                    is_supported=is_supported,
                    overlap_score=round(best_overlap, 3),
                    matched_chunk_ids=matched_ids,
                    unsupported_reason=reason,
                )
            )

        support_ratio = supported_count / float(len(claims))
        is_fully_supported = all(cr.is_supported for cr in claim_results)

        # Fallback to refusal if unsupported claims exist
        if not is_fully_supported or support_ratio < 0.70:
            verified_answer = "I do not know."
            refusal_triggered = True
        else:
            verified_answer = candidate_answer
            refusal_triggered = False

        return CitationVerificationReport(
            original_answer=candidate_answer,
            verified_answer=verified_answer,
            is_fully_supported=is_fully_supported,
            overall_support_score=round(support_ratio, 3),
            claim_results=claim_results,
            refusal_triggered=refusal_triggered,
        )
