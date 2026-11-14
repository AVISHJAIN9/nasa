"""AstroCare Knowledge Base Vector Store and Retrieval Engine.

Implements lightweight, fast, reproducible vector retrieval using TF-IDF feature space
and cosine similarity over the 240+ F056 knowledge base chunks.
Provides top-k chunk retrieval and threshold calibration against validation queries.
"""
from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


@dataclass
class RetrievedChunk:
    chunk_id: str
    doc_id: str
    title: str
    organization: str
    source_url: str
    section: str
    page: Optional[int]
    content: str
    licence_terms: str
    similarity_score: float

    def to_citation(self) -> Dict[str, Any]:
        return {
            "chunk_id": self.chunk_id,
            "doc_id": self.doc_id,
            "title": self.title,
            "organization": self.organization,
            "source_url": self.source_url,
            "section": self.section,
            "page": self.page,
            "licence_terms": self.licence_terms,
            "similarity_score": round(self.similarity_score, 4),
        }


class MedicalKnowledgeStore:
    """Vector store and index for F056 medical chunks."""

    def __init__(self, kb_path: Optional[Path] = None):
        self.kb_path = kb_path or Path(__file__).resolve().parent.parent.parent / "data" / "knowledge_base" / "knowledge_base_chunks.json"
        self.chunks: List[Dict[str, Any]] = []
        self.vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            stop_words="english",
            max_features=5000,
            sublinear_tf=True,
        )
        self.tfidf_matrix: Optional[np.ndarray] = None
        self.similarity_threshold: float = 0.18  # Calibrated validation default
        self._load_and_index()

    def _load_and_index(self):
        if not self.kb_path.exists():
            from astrocare.knowledge.ingestion import build_and_save_knowledge_base
            build_and_save_knowledge_base(self.kb_path)

        with open(self.kb_path, "r", encoding="utf-8") as f:
            self.chunks = json.load(f)

        corpus_texts = [
            f"{c['title']} {c['section']} {c['content']} {' '.join(c.get('keywords', []))}"
            for c in self.chunks
        ]
        self.tfidf_matrix = self.vectorizer.fit_transform(corpus_texts)

    def retrieve(self, query: str, top_k: int = 3) -> List[RetrievedChunk]:
        """Retrieves top_k relevant chunks ranked by cosine similarity."""
        if self.tfidf_matrix is None or len(self.chunks) == 0:
            return []

        q_vec = self.vectorizer.transform([query])
        sims = cosine_similarity(q_vec, self.tfidf_matrix).flatten()

        # Top k indices
        top_indices = np.argsort(sims)[::-1][:top_k]
        results: List[RetrievedChunk] = []

        for idx in top_indices:
            score = float(sims[idx])
            c = self.chunks[idx]
            results.append(
                RetrievedChunk(
                    chunk_id=c["chunk_id"],
                    doc_id=c["doc_id"],
                    title=c["title"],
                    organization=c["organization"],
                    source_url=c["source_url"],
                    section=c["section"],
                    page=c.get("page"),
                    content=c["content"],
                    licence_terms=c["licence_terms"],
                    similarity_score=score,
                )
            )
        return results

    def calibrate_threshold_on_validation(
        self,
        in_domain_queries: List[str],
        out_of_domain_queries: List[str],
    ) -> float:
        """Selects similarity threshold maximizing separation on held-out validation set."""
        pos_scores = [self.retrieve(q, top_k=1)[0].similarity_score for q in in_domain_queries]
        neg_scores = [self.retrieve(q, top_k=1)[0].similarity_score for q in out_of_domain_queries]

        min_pos = min(pos_scores) if pos_scores else 0.20
        max_neg = max(neg_scores) if neg_scores else 0.10

        # Choose midway threshold with small safety margin
        calibrated = float(np.clip(0.5 * (min_pos + max_neg), 0.12, 0.35))
        self.similarity_threshold = round(calibrated, 4)
        return self.similarity_threshold
