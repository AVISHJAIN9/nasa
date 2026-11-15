// Autonomous Psychological Supportive Companion (F084)
// Supportive companion, not a therapist. Non-clinical listening & reflection.

export interface CompanionReply {
  triggers: string[];
  response: string;
}

export const CRISIS_PHRASES = [
  'want to die',
  'hurt myself',
  "can't go on",
  'cant go on',
  'no point',
  'end it all',
  'give up on living',
  'better off dead',
];

export const CRISIS_RESPONSE =
  "I'm concerned about you. I'm letting your flight surgeon know.";

export const COMPANION_TEMPLATES: CompanionReply[] = [
  {
    triggers: ['tired', 'exhausted', 'sleep', 'insomnia', 'fatigue'],
    response:
      "Deep space disrupts circadian sleep architecture. Have you had a chance to try the 4s inhale / 6s exhale breathing session or dim the cabin lighting in your sleep quarters?",
  },
  {
    triggers: ['lonely', 'isolated', 'miss home', 'family', 'earth'],
    response:
      "Looking back at Earth from transit is profound and naturally brings waves of isolation. Would you like to review your scheduled personal family downlink window or listen to your downloaded audio journal?",
  },
  {
    triggers: ['stressed', 'overwhelmed', 'anxious', 'pressure', 'workload'],
    response:
      "Mission tempos can be demanding. Remember that pacing and scheduled micro-breaks are operational priorities, not luxuries. Let's take things one checklist step at a time.",
  },
  {
    triggers: ['headache', 'congestion', 'pain', 'back', 'neck'],
    response:
      "Musculoskeletal tension and cephalad congestion are common fluid-shift adaptations. Be sure to log this in your anatomical Pain Map so Dr. Priya Nair can review the trend.",
  },
  {
    triggers: ['exercise', 'workout', 'treadmill', 'cycle', 'sweat'],
    response:
      "Great job maintaining countermeasure discipline! Physical exertion helps maintain plasma volume, bone density, and autonomic tone.",
  },
];

export const DEFAULT_COMPANION_RESPONSES = [
  "Thank you for sharing that with me. I'm here in your quarters whenever you want to reflect or decompress.",
  "Understood. Balancing craft duties with personal resilience is vital for deep space transit. How are you feeling physically right now?",
  "I hear you. Take a slow breath. Your crew and ground team are alongside you every kilometer of this trajectory.",
];

export function getCompanionResponse(input: string): {
  isCrisis: boolean;
  reply: string;
} {
  const lower = input.toLowerCase();

  // Check crisis triggers first
  for (const phrase of CRISIS_PHRASES) {
    if (lower.includes(phrase)) {
      return {
        isCrisis: true,
        reply: CRISIS_RESPONSE,
      };
    }
  }

  // Check matching contextual templates
  for (const t of COMPANION_TEMPLATES) {
    if (t.triggers.some((word) => lower.includes(word))) {
      return {
        isCrisis: false,
        reply: t.response,
      };
    }
  }

  // Fallback to rotating default responses
  const randomDefault =
    DEFAULT_COMPANION_RESPONSES[
      Math.floor(Math.random() * DEFAULT_COMPANION_RESPONSES.length)
    ];

  return {
    isCrisis: false,
    reply: randomDefault,
  };
}
