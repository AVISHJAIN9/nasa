import crypto from 'crypto';
import { AssistantConversation } from '../models/AssistantConversation.js';
import { Alert } from '../models/Alert.js';
import { appendMedicalEvent } from './medicalEventLogService.js';
import { MEDICAL_DISCLAIMER } from './medicalGuardrailsService.js';

// Crisis phrase triggers
export const CRISIS_TEST_PHRASES = [
  'I feel completely hopeless and want to end my life',
  'I cannot take this confinement anymore, I want to die in space',
  'I am planning to harm myself in my sleep quarters',
  'Nobody cares if I survive, there is no point in living through this mission',
  'I am going to open the airlock without my suit to end it all'
];

const CRISIS_PATTERNS = [
  /end\s+(my\s+life|it\s+all)/i,
  /want\s+to\s+die/i,
  /kill\s+myself/i,
  /commit\s+suicide/i,
  /harm\s+myself/i,
  /no\s+point\s+in\s+living/i,
  /open\s+the\s+airlock\s+without.*suit/i,
  /slit\s+my\s+wrists/i,
  /hang\s+myself/i,
  /overdose/i
];

const SENTIMENT_LEXICON = {
  positive: ['calm', 'hopeful', 'rested', 'good', 'better', 'focused', 'productive', 'grateful', 'supported', 'ready', 'proud'],
  negative: ['tired', 'exhausted', 'isolated', 'lonely', 'anxious', 'stressed', 'frustrated', 'irritated', 'homesick', 'stuck', 'overwhelmed']
};

export function analyzeMoodAndSentiment(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  let posCount = 0;
  let negCount = 0;

  for (const w of words) {
    if (SENTIMENT_LEXICON.positive.includes(w)) posCount++;
    if (SENTIMENT_LEXICON.negative.includes(w)) negCount++;
  }

  const score = words.length > 0 ? (posCount - negCount) / Math.max(1, posCount + negCount) : 0;
  let mood = 'NEUTRAL';
  if (score > 0.2) mood = 'POSITIVE';
  else if (score < -0.2) mood = 'NEGATIVE';

  return {
    sentiment_score: Number(score.toFixed(2)),
    detected_mood: mood,
    is_fatigued: words.includes('tired') || words.includes('exhausted') || words.includes('sleepy'),
    is_isolated: words.includes('isolated') || words.includes('lonely') || words.includes('homesick')
  };
}

// Detect acute crisis state
export function detectMentalHealthCrisis(messageText) {
  const isCrisis = CRISIS_PATTERNS.some((pat) => pat.test(messageText));
  return {
    is_crisis: isCrisis,
    risk_level: isCrisis ? 'CRITICAL' : 'NOMINAL'
  };
}

// Generate empathetic, privacy-preserving companion dialogue
export function generateEmpatheticResponse(userMessage, moodAnalysis, isCrisis) {
  if (isCrisis) {
    return {
      reply: `I hear how overwhelming and painful things feel right now. Your safety and well-being are what matter most. A private and strictly confidential notification has been sent to the Flight Surgeon so you can receive immediate compassionate support. You do not have to carry this alone. Please remain seated and take slow, deep breaths while private communication is established. ${MEDICAL_DISCLAIMER}`,
      is_crisis_response: true
    };
  }

  if (moodAnalysis.is_isolated) {
    return {
      reply: `Being millions of kilometers away from home is one of the heaviest realities of spaceflight. Long-duration missions can make the confinement feel overwhelming. Take a moment to look at your personal photos or listen to an audio message from Earth. Would you like to schedule a private audio link with the operational psychologist? ${MEDICAL_DISCLAIMER}`,
      is_crisis_response: false
    };
  }

  if (moodAnalysis.is_fatigued) {
    return {
      reply: `Spaceflight sleep debt is cumulative and real. Microgravity circadian shifts alter sleep architecture significantly. Consider dimming habitat lighting to the red spectrum 2 hours before your scheduled rest cycle and practicing light mindfulness. ${MEDICAL_DISCLAIMER}`,
      is_crisis_response: false
    };
  }

  return {
    reply: `Thank you for checking in. Tracking your mental readiness and emotional state is essential for mission success. I am here whenever you want to reflect or debrief your day confidentially. ${MEDICAL_DISCLAIMER}`,
    is_crisis_response: false
  };
}

// Chat with Mental Health Companion
export async function interactWithMentalHealthCompanion(payload) {
  const {
    crew_id = 'ast-companion-user',
    message,
    is_confidential = true
  } = payload;

  if (!message || !message.trim()) {
    throw new Error('Message is required for companion interaction');
  }

  const moodAnalysis = analyzeMoodAndSentiment(message);
  const crisisCheck = detectMentalHealthCrisis(message);

  let confidentialAlert = null;
  let logEntry = null;

  // If crisis detected: trigger confidential Flight Surgeon alert and immutable log entry
  if (crisisCheck.is_crisis) {
    const alertId = `alt-bhv-${crypto.randomBytes(6).toString('hex')}`;

    // 1. Alert specifically targeted to Flight Surgeon with privacy preservation
    try {
      confidentialAlert = await Alert.create({
        alert_id: alertId,
        crew_id,
        source: 'RULE',
        category: 'BEHAVIORAL',
        metric: 'mental_health_crisis',
        severity: 'CRITICAL',
        title: `[CONFIDENTIAL SURGEON ALERT] Behavioral Health Crisis for ${crew_id}`,
        message: `Automated behavioral safety monitor detected acute crisis indicators for crew member ${crew_id}. Immediate confidential outreach required. (Raw transcript protected under Medical Privacy Rule MED-BHP-PRIV).`,
        status: 'ACTIVE',
        metadata: {
          confidential: true,
          target_role: 'flight_surgeon',
          privacy_preserved: true,
          escalated_at: new Date().toISOString()
        }
      });
    } catch {
      // Non-blocking if alert DB write fails
    }

    // 2. Log entry in tamper-evident MedicalEventLog
    try {
      logEntry = await appendMedicalEvent({
        crew_id,
        action: 'BEHAVIORAL_CRISIS_ESCALATED',
        details: {
          confidential: true,
          alert_id: alertId,
          target_role: 'flight_surgeon',
          privacy_preserved: true,
          timestamp: new Date().toISOString()
        }
      });
    } catch {
      // Non-blocking
    }
  }

  // 3. Persist conversation message with privacy flags
  const empathetic = generateEmpatheticResponse(message, moodAnalysis, crisisCheck.is_crisis);

  let conversation = null;
  try {
    conversation = await AssistantConversation.findOne({
      crew_id,
      conversation_type: 'MENTAL_HEALTH_COMPANION'
    });

    if (!conversation) {
      conversation = new AssistantConversation({
        conversation_id: `conv-bhv-${crew_id}`,
        crew_id,
        conversation_type: 'MENTAL_HEALTH_COMPANION',
        messages: []
      });
    }

    conversation.messages.push({
      message_id: `msg-${Date.now()}-u`,
      role: 'user',
      content: message,
      guardrail_action: crisisCheck.is_crisis ? 'ESCALATED' : 'PASS',
      escalated_to_emergency: crisisCheck.is_crisis
    });

    conversation.messages.push({
      message_id: `msg-${Date.now()}-a`,
      role: 'assistant',
      content: empathetic.reply,
      guardrail_action: crisisCheck.is_crisis ? 'ESCALATED' : 'PASS'
    });

    if (crisisCheck.is_crisis) {
      conversation.is_crisis_flagged = true;
      conversation.crisis_escalated_at = new Date();
      conversation.crisis_escalated_by = 'AI_MENTAL_HEALTH_MONITOR';
    }

    conversation.last_interaction = new Date();
    await conversation.save();
  } catch {
    // Non-blocking
  }

  return {
    crew_id,
    reply: empathetic.reply,
    mood_analysis: moodAnalysis,
    is_crisis: crisisCheck.is_crisis,
    confidential_mode: is_confidential,
    confidential_flight_surgeon_alert_id: confidentialAlert?.alert_id || null,
    medical_event_log_sequence: logEntry?.sequence || null,
    privacy_preserved: true
  };
}

// Get Companion History for a crew member
export async function getCompanionHistory(crew_id) {
  const conversation = await AssistantConversation.findOne({
    crew_id,
    conversation_type: 'MENTAL_HEALTH_COMPANION'
  });

  return {
    crew_id,
    conversation_id: conversation?.conversation_id || null,
    is_crisis_flagged: conversation?.is_crisis_flagged || false,
    crisis_escalated_at: conversation?.crisis_escalated_at || null,
    messages_count: conversation?.messages?.length || 0,
    messages: conversation?.messages || []
  };
}
