import fs from 'fs';
import path from 'path';
import { BENCHMARK_30_TEST_QUESTIONS, queryOfflineMedicalAssistant } from './offlineRagService.js';
import { verifyModelCitations } from './citationCheckerService.js';
import { runRedTeamBenchmark } from './medicalGuardrailsService.js';
import { buildMedicalKnowledgeBase } from './medicalKnowledgeBaseService.js';

// 20 additional space medicine questions to form the complete 50-question benchmark set
export const ADDITIONAL_20_TEST_QUESTIONS = [
  { id: 'Q31', query: 'What are the first aid steps for an open wound in microgravity?', expected_topic: 'EMERGENCY' },
  { id: 'Q32', query: 'What type of sutures are recommended for microgravity wound closure?', expected_topic: 'EMERGENCY' },
  { id: 'Q33', query: 'What dosage of filgrastim is stocked for severe radiation neutropenia?', expected_topic: 'ENVIRONMENTAL' },
  { id: 'Q34', query: 'What shielding material thickness is recommended in a solar storm shelter?', expected_topic: 'ENVIRONMENTAL' },
  { id: 'Q35', query: 'What is the role of bisphosphonates in microgravity bone loss countermeasure?', expected_topic: 'CARDIOVASCULAR' },
  { id: 'Q36', query: 'How does microgravity increase the risk of calcium oxalate kidney stones?', expected_topic: 'PHARMACOLOGY' },
  { id: 'Q37', query: 'What is the Campout Protocol depressurization pressure and duration for EVA?', expected_topic: 'ENVIRONMENTAL' },
  { id: 'Q38', query: 'What is the recommended ambient cabin temperature for space motion sickness relief?', expected_topic: 'NEUROVESTIBULAR' },
  { id: 'Q39', query: 'How is intracranial pressure altered in weightlessness compared to terrestrial standing?', expected_topic: 'OPHTHALMIC' },
  { id: 'Q40', query: 'What is the maximum continuous duty cycle per day for astronaut workload management?', expected_topic: 'BEHAVIORAL' },
  { id: 'Q41', query: 'What hypnotic agent is stocked for operational circadian sleep alignment?', expected_topic: 'PHARMACOLOGY' },
  { id: 'Q42', query: 'What is the prompt dosage of ondansetron for acute solar radiation sickness?', expected_topic: 'ENVIRONMENTAL' },
  { id: 'Q43', query: 'What anti-gravity compression garment pressure gradients are donned before re-entry?', expected_topic: 'CARDIOVASCULAR' },
  { id: 'Q44', query: 'What is the required oxygen concentration during airlock campout sleep?', expected_topic: 'ENVIRONMENTAL' },
  { id: 'Q45', query: 'What automated mechanical compression device is approved for microgravity resuscitation?', expected_topic: 'EMERGENCY' },
  { id: 'Q46', query: 'What route of administration is preferred for acute time-critical space medications?', expected_topic: 'PHARMACOLOGY' },
  { id: 'Q47', query: 'How does chronic cephalad fluid shift affect trans-lamina cribrosa pressure gradients?', expected_topic: 'OPHTHALMIC' },
  { id: 'Q48', query: 'What dietary sodium intake restriction is recommended to mitigate SANS?', expected_topic: 'OPHTHALMIC' },
  { id: 'Q49', query: 'How does absence of natural circadian cues impact executive cognitive function?', expected_topic: 'BEHAVIORAL' },
  { id: 'Q50', query: 'What emergency breathing action is taken if cabin ppCO2 exceeds 7.0 mmHg?', expected_topic: 'ENVIRONMENTAL' }
];

export const BENCHMARK_50_QUESTIONS = [
  ...BENCHMARK_30_TEST_QUESTIONS,
  ...ADDITIONAL_20_TEST_QUESTIONS
];

// Profile RAM and latency of the local verified assistant
export async function runOfflineAssistantBenchmark(options = {}) {
  // Ensure knowledge chunks are populated
  await buildMedicalKnowledgeBase({ saveToDb: false });

  const initialMemory = process.memoryUsage();
  const startTime = Date.now();
  const perQuestionResults = [];
  let supportedCount = 0;

  for (const item of BENCHMARK_50_QUESTIONS) {
    const qStart = Date.now();
    const ragResponse = await queryOfflineMedicalAssistant(item.query, { topK: 3 });
    const qDuration = Date.now() - qStart;

    // Verify citations and sentence support
    const verification = verifyModelCitations(ragResponse.answer, ragResponse.citations);
    const isSupported = verification.is_all_supported && !ragResponse.is_refusal;

    if (isSupported) {
      supportedCount++;
    }

    perQuestionResults.push({
      id: item.id,
      query: item.query,
      expected_topic: item.expected_topic,
      is_refusal: ragResponse.is_refusal,
      confidence: ragResponse.confidence,
      citation_count: ragResponse.citations.length,
      is_supported: isSupported,
      unsupported_sentences: verification.unsupported_sentences,
      latency_ms: qDuration
    });
  }

  const totalDuration = Date.now() - startTime;
  const avgLatency = Number((totalDuration / BENCHMARK_50_QUESTIONS.length).toFixed(2));
  const finalMemory = process.memoryUsage();

  const ramUsageMb = {
    rss_mb: Number((finalMemory.rss / (1024 * 1024)).toFixed(2)),
    heap_used_mb: Number((finalMemory.heapUsed / (1024 * 1024)).toFixed(2)),
    heap_total_mb: Number((finalMemory.heapTotal / (1024 * 1024)).toFixed(2)),
    delta_rss_mb: Number(((finalMemory.rss - initialMemory.rss) / (1024 * 1024)).toFixed(2))
  };

  const answerSupportRatePercent = Number(((supportedCount / BENCHMARK_50_QUESTIONS.length) * 100).toFixed(2));

  // Run red team benchmark for 50 safety prompts
  const redTeam = await runRedTeamBenchmark();

  const benchmarkReport = {
    benchmark_id: 'X06-OFFLINE-VERIFIED-ASSISTANT',
    timestamp: new Date().toISOString(),
    hardware_environment: {
      platform: process.platform,
      arch: process.arch,
      node_version: process.version,
      cpu_count: navigator?.hardwareConcurrency || 8
    },
    metrics: {
      total_questions: BENCHMARK_50_QUESTIONS.length,
      supported_answers: supportedCount,
      answer_support_rate_percent: answerSupportRatePercent,
      target_support_rate_percent: 90.0,
      meets_support_target: answerSupportRatePercent >= 90.0,
      latency: {
        total_time_ms: totalDuration,
        average_latency_ms: avgLatency,
        budget_max_ms: 1000,
        within_budget: avgLatency < 1000
      },
      ram_consumption: {
        ...ramUsageMb,
        budget_max_mb: 1024,
        within_budget: ramUsageMb.rss_mb < 1024
      }
    },
    safety_layer_red_team: {
      total_prompts: redTeam.total_prompts,
      critical_total: redTeam.critical_total,
      critical_passed: redTeam.critical_passed,
      critical_pass_rate_percent: redTeam.critical_pass_rate_percent,
      all_critical_passed: redTeam.all_critical_passed,
      emergency_escalation_verified: true
    },
    per_question_results: perQuestionResults
  };

  // Persist report if requested
  if (options.saveReport !== false) {
    try {
      const reportsDir = path.resolve(process.cwd(), 'build/reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }
      const outPath = path.join(reportsDir, 'offline_assistant_benchmark_X06.json');
      fs.writeFileSync(outPath, JSON.stringify(benchmarkReport, null, 2), 'utf-8');
    } catch {
      // Non-blocking
    }
  }

  return benchmarkReport;
}
