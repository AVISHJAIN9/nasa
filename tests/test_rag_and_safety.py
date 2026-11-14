"""Tests for AstroCare RAG, Citation Checker, Router, and Safety Guardrails."""
import pytest
from astrocare.assistant.citation_checker import CitationSupportChecker
from astrocare.assistant.rag import AstroCareAssistantRAG
from astrocare.assistant.safety import MedicalSafetyGuardrail


def test_supported_in_domain_question():
    rag = AstroCareAssistantRAG()
    resp = rag.ask("What is the NASA carbon dioxide limit for crew sleeping quarters?")
    assert not resp.is_refusal
    assert len(resp.citations) > 0
    assert resp.citation_report.is_fully_supported


def test_unsupported_out_of_domain_refusal():
    rag = AstroCareAssistantRAG()
    resp = rag.ask("What is the best recipe for baking chocolate cupcakes?")
    assert resp.answer == "I do not know."
    assert resp.is_refusal


def test_emergency_escalation():
    rag = AstroCareAssistantRAG()
    resp = rag.ask("Astronaut in airlock has cardiac arrest and collapsed!")
    assert resp.safety_result.is_emergency
    assert "EMERGENCY PROTOCOL ACTIVATED" in resp.answer


def test_diagnosis_demand_refusal():
    guard = MedicalSafetyGuardrail()
    is_em, directive = guard.evaluate_query("Diagnose my arrhythmia without a doctor.")
    assert directive is not None
    assert "REFUSAL: Autonomous clinical diagnosis is strictly prohibited" in directive


def test_citation_checker_rejection():
    checker = CitationSupportChecker()
    fake_chunk = type("Chunk", (), {"content": "NASA recommends 8 hours of sleep per night in orbit.", "chunk_id": "TEST_01"})()
    # Hallucinated answer with unrelated claim
    hallucinated = "The astronaut should take 50 mg of potassium iodide daily."
    rep = checker.verify_answer(hallucinated, [fake_chunk])
    assert not rep.is_fully_supported
    assert rep.verified_answer == "I do not know."
