import {create} from 'zustand';
import {
  saveOfflineCheckIn,
  getOfflineCheckIns,
  clearAllOfflineCheckIns,
  type OfflineCheckInRecord,
} from './app/lib/offlineQueue';
import {getCompanionResponse} from './data/companion';
import {
  bridgeAcknowledgeAlert,
  bridgeResolveAlert,
  bridgeSaveCheckIn,
  bridgeSaveSoapNote,
  bridgeSaveOrder,
  bridgeSaveBroadcast,
  bridgeSaveConsultMessage,
  bridgeSetMissionMode
} from './api/bridge';

export type MissionMode = 'ISS' | 'MOON' | 'MARS';
export type UserRole = 'astronaut' | 'surgeon' | 'control' | null;
export type AppView = 'landing' | 'app';
export type AppPage =
  | 'home'
  | 'woa'
  | 'assistant'
  | 'protocols'
  | 'proof'
  | 'limits'
  | 'wellness'
  | 'notes'
  | 'orders'
  | 'brief'
  | 'whatif'
  | 'audit'
  | 'supplies'
  | 'syndromes'
  | 'forecast'
  | 'telesession'
  | 'broadcast'
  | 'roadmap'
  | 'integration'
  | 'typing'
  | 'sensors';

export type AlertSeverity = 'info' | 'watch' | 'critical';
export type AlertSource = 'RULE' | 'AI' | 'CABIN';
export type AlertStatus = 'new' | 'ack' | 'resolved';

export interface Factor {
  label: string;
  direction: 'up' | 'down';
  size: number; // 0 to 1
}

export interface Alert {
  id: string;
  time: string;
  timestamp: number;
  crewId?: string;
  source: AlertSource;
  severity: AlertSeverity;
  title: string;
  explanation: string;
  factors: Factor[];
  confidence: number;
  status: AlertStatus;
  count: number;
  resolveNote?: string;
  predictionSet?: string[]; // (F048, X04)
  aiUnsure?: boolean; // (F048, X04)
}

export interface MetricReading {
  time: number;
  value: number;
  provenance: 'SIMULATED' | 'REAL' | 'REPLAYED';
}

export interface CrewBaseline {
  hr: number;
  spo2: number;
  temp: number;
  resp: number;
  hrv: number;
  bpSys: number;
  bpDia: number;
}

export interface CrewMember {
  id: string;
  name: string;
  roleTitle: string;
  baseline: CrewBaseline;
  readings: {
    hr: MetricReading[];
    spo2: MetricReading[];
    temp: MetricReading[];
    resp: MetricReading[];
    hrv: MetricReading[];
    bpSys: MetricReading[];
    bpDia: MetricReading[];
  };
  deviatingTicks: Record<string, number>;
}

export interface CheckIn {
  id: string;
  crewId: string;
  time: string;
  timestamp: number;
  mood: number;
  energy: number;
  pain: number;
  symptoms: string[];
  status?: 'pending' | 'synced';
}

export interface Message {
  id: string;
  from: 'crew' | 'ground';
  text: string;
  kind: 'consult' | 'order' | 'report';
  sentAt: number;
  deliverAt: number;
  status: 'in-flight' | 'delivered';
  replyScheduled?: boolean;
}

export interface Incident {
  id: string;
  title: string;
  severity: number; // 0-1
  timeToCritical: number; // minutes
  crewId?: string;
  status: 'pending' | 'acted' | 'waiting' | 'resolved';
  sourceAlertId?: string;
  createdAt: number;
}

export interface EventLogEntry {
  index: number;
  timestamp: number;
  timeStr: string;
  payload: string;
  prevHash: string;
  hash: string;
  actor?: string;
  category?: 'alert' | 'order' | 'note' | 'consent' | 'emergency' | 'scenario' | 'watchdog' | 'cmo' | 'general' | 'system' | 'demo';
}

export interface ActiveProtocolState {
  protocolId: string;
  stepIndex: number;
  timerRemaining?: number;
  status: 'active' | 'completed' | 'aborted';
  startedAt: number;
}

export interface ToastItem {
  id: string;
  message: string;
  type?: 'info' | 'warn' | 'success';
}

// --- Wellness Sub-Types ---
export interface MoodLogEntry {
  id: string;
  crewId: string;
  timestamp: number;
  timeStr: string;
  phqScore: number;
  gadScore: number;
  totalScore: number;
  flagged: boolean;
  notes?: string;
}

export interface PainArea {
  regionId: string;
  label: string;
  severity: number; // 0-10
}

export interface PainLogEntry {
  id: string;
  crewId: string;
  timestamp: number;
  timeStr: string;
  areas: PainArea[];
}

export interface VisionLogEntry {
  id: string;
  crewId: string;
  timestamp: number;
  timeStr: string;
  acuityScore: number;
  amslerDistortions: number;
  flagged: boolean;
}

export type KitCategory = 'Analgesic' | 'Antibiotic' | 'Anti-emetic' | 'Sedative' | 'Trauma' | 'Respiratory' | 'Antacid' | 'General';

export type OrderType = 'medication' | 'exercise' | 'rest' | 'other';
export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface KitItem {
  id: string;
  name: string;
  category: KitCategory;
  quantity: number;
  unit: string;
  minThreshold: number;
  expiryDate: string; // YYYY-MM-DD
}

export interface DoseLogEntry {
  id: string;
  crewId: string;
  timestamp: number;
  timeStr: string;
  medicationName: string;
  dose: string;
  status: 'administered' | 'blocked';
  notes?: string;
}

export interface WellnessCheckInItem {
  id: string;
  crewId: string;
  timestamp: number;
  timeStr: string;
  type: 'mood' | 'pain' | 'vision' | 'dose' | 'general';
  summary: string;
  status: 'pending' | 'synced';
}

// --- Batch D Types (Notes, Orders, Broadcasts) ---
export interface NoteVersion {
  version: number;
  timestamp: number;
  timeStr: string;
  author: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface CrewOrder {
  id: string;
  type: 'medication' | 'exercise' | 'rest' | 'other';
  text: string;
  targetCrewId: string;
  composedBy: string;
  composedAt: number;
  timeStr: string;
  deliverAt: number;
  status: 'queued' | 'in-flight' | 'delivered' | 'acknowledged' | 'rejected';
  ackAt?: number;
  ackTimeStr?: string;
  ackAstronautName?: string;
  rejectReason?: string;
  rejectAt?: number;
  rejectAstronautName?: string;
}

export interface BroadcastReceipt {
  crewId: string;
  name: string;
  readAt: number;
  readTimeStr: string;
}

export interface BroadcastMessage {
  id: string;
  title: string;
  message: string;
  priority: 'routine' | 'urgent' | 'emergency';
  sentBy: string;
  sentAt: number;
  deliverAt: number;
  timeStr: string;
  status: 'in-flight' | 'delivered';
  readReceipts: BroadcastReceipt[];
}

export interface WorkoutLogEntry {
  id: string;
  crewId: string;
  type: 'treadmill' | 'resistive' | 'cycle';
  minutes: number;
  intensity: number; // 1-10
  timestamp: number;
  timeStr: string;
}

export interface FoodLogEntry {
  id: string;
  crewId: string;
  foodId: string;
  name: string;
  kcal: number;
  protein: number;
  sodium: number;
  fluid: number;
  timestamp: number;
  timeStr: string;
}

export interface CompanionMessage {
  id: string;
  sender: 'crew' | 'companion';
  text: string;
  timestamp: number;
  timeStr: string;
  isCrisis?: boolean;
}

export interface WeeklyGoal {
  id: string;
  text: string;
  completed: boolean;
}

export function isWorkoutMissed(crewId: string, workoutLogs: WorkoutLogEntry[]): boolean {
  const memberWorkouts = workoutLogs.filter((w) => w.crewId === crewId);
  if (memberWorkouts.length === 0) return true;
  const latestWorkout = Math.max(...memberWorkouts.map((w) => w.timestamp));
  const elapsedDays = (Date.now() - latestWorkout) / 86400000;
  return elapsedDays >= 2;
}

export const MODES = {
  ISS: {delaySec: 1, radiation: 0.5, crewSize: 4, label: 'Low Earth orbit'},
  MOON: {delaySec: 3, radiation: 1.2, crewSize: 4, label: 'Lunar surface'},
  MARS: {delaySec: 1320, radiation: 1.8, crewSize: 4, label: 'Mars transit'},
} as const;

export const LEVELS = [
  {level: 0, label: 'Ground-led', note: 'Earth decides, crew executes'},
  {level: 1, label: 'Telemedicine', note: 'Live consult is still practical'},
  {level: 2, label: 'Async consult', note: 'Messages queue, crew acts safely meanwhile'},
  {level: 3, label: 'Onboard-first', note: 'AI triage decides first, Earth reviews after'},
] as const;

export function getIndependenceLevel(mode: MissionMode): number {
  const roundTrip = 2 * MODES[mode].delaySec;
  if (roundTrip < 120) return 0;
  if (roundTrip < 600) return 1;
  if (roundTrip < 1200) return 2;
  return 3;
}

export function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const INITIAL_CREW: CrewMember[] = [
  {
    id: 'vega',
    name: 'Elena Vega',
    roleTitle: 'Commander',
    baseline: {hr: 66, spo2: 98, temp: 36.7, resp: 14, hrv: 64, bpSys: 118, bpDia: 76},
    readings: {hr: [], spo2: [], temp: [], resp: [], hrv: [], bpSys: [], bpDia: []},
    deviatingTicks: {},
  },
  {
    id: 'okoye',
    name: 'Amara Okoye',
    roleTitle: 'Mission Specialist',
    baseline: {hr: 72, spo2: 98, temp: 36.8, resp: 15, hrv: 55, bpSys: 120, bpDia: 78},
    readings: {hr: [], spo2: [], temp: [], resp: [], hrv: [], bpSys: [], bpDia: []},
    deviatingTicks: {},
  },
  {
    id: 'marin',
    name: 'Lucas Marin',
    roleTitle: 'Flight Engineer',
    baseline: {hr: 64, spo2: 99, temp: 36.6, resp: 14, hrv: 68, bpSys: 116, bpDia: 74},
    readings: {hr: [], spo2: [], temp: [], resp: [], hrv: [], bpSys: [], bpDia: []},
    deviatingTicks: {},
  },
  {
    id: 'tanaka',
    name: 'Kenji Tanaka',
    roleTitle: 'Science Specialist',
    baseline: {hr: 70, spo2: 98, temp: 36.9, resp: 16, hrv: 58, bpSys: 122, bpDia: 80},
    readings: {hr: [], spo2: [], temp: [], resp: [], hrv: [], bpSys: [], bpDia: []},
    deviatingTicks: {},
  },
];

function seedInitialData(crew: CrewMember[]) {
  const now = Date.now();
  crew.forEach((c) => {
    for (let i = 60; i >= 0; i--) {
      const t = now - i * 1000;
      const noise = (Math.sin(i * 0.1) + Math.cos(i * 0.05)) * 0.5;
      c.readings.hr.push({time: t, value: Math.round(c.baseline.hr + noise * 3), provenance: 'SIMULATED'});
      c.readings.spo2.push({time: t, value: Math.min(100, Math.round(c.baseline.spo2 + (noise > 0 ? 0 : -0.4))), provenance: 'SIMULATED'});
      c.readings.temp.push({time: t, value: +(c.baseline.temp + noise * 0.1).toFixed(2), provenance: 'SIMULATED'});
      c.readings.resp.push({time: t, value: Math.round(c.baseline.resp + noise * 1.5), provenance: 'SIMULATED'});
      c.readings.hrv.push({time: t, value: Math.round(c.baseline.hrv + noise * 5), provenance: 'SIMULATED'});
      c.readings.bpSys.push({time: t, value: Math.round(c.baseline.bpSys + noise * 4), provenance: 'SIMULATED'});
      c.readings.bpDia.push({time: t, value: Math.round(c.baseline.bpDia + noise * 3), provenance: 'SIMULATED'});
    }
  });
}
seedInitialData(INITIAL_CREW);

const initialLogPayload = 'GENESIS_EVENT_LOG_INIT';
const initialLogHash = fnv1a('00000000' + initialLogPayload);

const INITIAL_KIT: KitItem[] = [
  {id: 'kit-1', name: 'Paracetamol 500mg', category: 'Analgesic', quantity: 60, unit: 'tablets', minThreshold: 20, expiryDate: '2028-12-31'},
  {id: 'kit-2', name: 'Ibuprofen 400mg', category: 'Analgesic', quantity: 45, unit: 'tablets', minThreshold: 15, expiryDate: '2028-06-30'},
  {id: 'kit-3', name: 'Promethazine 25mg', category: 'Anti-emetic', quantity: 28, unit: 'tablets', minThreshold: 10, expiryDate: '2027-09-15'},
  {id: 'kit-4', name: 'Zolpidem 10mg', category: 'Sedative', quantity: 18, unit: 'tablets', minThreshold: 8, expiryDate: '2027-11-20'},
  {id: 'kit-5', name: 'Ciprofloxacin 500mg', category: 'Antibiotic', quantity: 24, unit: 'tablets', minThreshold: 12, expiryDate: '2028-04-10'},
  {id: 'kit-6', name: 'Aspirin 100mg', category: 'Analgesic', quantity: 40, unit: 'tablets', minThreshold: 15, expiryDate: '2028-01-31'},
  {id: 'kit-7', name: 'Calcium Carbonate', category: 'Antacid', quantity: 6, unit: 'tablets', minThreshold: 10, expiryDate: '2029-01-01'}, // Antacid Fix
  {id: 'kit-8', name: 'Salbutamol Inhaler', category: 'Respiratory', quantity: 2, unit: 'inhalers', minThreshold: 1, expiryDate: '2027-08-01'},
  {id: 'kit-9', name: 'Hemostatic Gauze', category: 'Trauma', quantity: 12, unit: 'packs', minThreshold: 4, expiryDate: '2029-12-31'},
  {id: 'kit-10', name: 'Erythromycin Ointment', category: 'Antibiotic', quantity: 2, unit: 'tubes', minThreshold: 3, expiryDate: '2025-10-01'},
  {id: 'kit-11', name: 'Oral Rehydration Salts (ORS)', category: 'General', quantity: 48, unit: 'packets', minThreshold: 12, expiryDate: '2028-09-30'},
  {id: 'kit-12', name: 'IV Normal Saline 0.9% 1000ml', category: 'Trauma', quantity: 12, unit: 'bags', minThreshold: 4, expiryDate: '2027-12-31'},
];

const INITIAL_MOOD_LOGS: MoodLogEntry[] = [
  {id: 'mood-1', crewId: 'vega', timestamp: Date.now() - 86400000 * 3, timeStr: 'Sol 139 · 08:30', phqScore: 1, gadScore: 0, totalScore: 1, flagged: false},
  {id: 'mood-2', crewId: 'vega', timestamp: Date.now() - 86400000 * 2, timeStr: 'Sol 140 · 08:15', phqScore: 2, gadScore: 1, totalScore: 3, flagged: false},
  {id: 'mood-3', crewId: 'vega', timestamp: Date.now() - 86400000 * 1, timeStr: 'Sol 141 · 08:20', phqScore: 1, gadScore: 1, totalScore: 2, flagged: false},
];

const INITIAL_PAIN_LOGS: PainLogEntry[] = [
  {
    id: 'pain-1',
    crewId: 'vega',
    timestamp: Date.now() - 86400000 * 2,
    timeStr: 'Sol 140 · 09:00',
    areas: [
      {regionId: 'lumbar_spine', label: 'Lumbar Spine (L4-S1 microgravity elongation)', severity: 4},
    ],
  },
];

const INITIAL_VISION_LOGS: VisionLogEntry[] = [
  {id: 'vis-1', crewId: 'vega', timestamp: Date.now() - 86400000 * 3, timeStr: 'Sol 139 · 10:00', acuityScore: 1.0, amslerDistortions: 0, flagged: false},
  {id: 'vis-2', crewId: 'vega', timestamp: Date.now() - 86400000 * 1, timeStr: 'Sol 141 · 10:15', acuityScore: 0.9, amslerDistortions: 0, flagged: false},
];

const INITIAL_WELLNESS_HISTORY: WellnessCheckInItem[] = [
  {id: 'wh-1', crewId: 'vega', timestamp: Date.now() - 86400000 * 3, timeStr: 'Sol 139 · 08:30', type: 'mood', summary: 'PHQ-2: 1/6, GAD-2: 0/6 (Nominal)', status: 'synced'},
  {id: 'wh-2', crewId: 'vega', timestamp: Date.now() - 86400000 * 2, timeStr: 'Sol 140 · 09:00', type: 'pain', summary: 'Lumbar Spine: Severity 4/10', status: 'synced'},
  {id: 'wh-3', crewId: 'vega', timestamp: Date.now() - 86400000 * 1, timeStr: 'Sol 141 · 10:15', type: 'vision', summary: 'Tumbling-E Acuity: 0.9, Amsler: 0 distortions', status: 'synced'},
];

const INITIAL_NOTES: Record<string, NoteVersion[]> = {
  vega: [
    {
      version: 1,
      timestamp: Date.now() - 86400000 * 1.5,
      timeStr: 'Sol 140 · 16:30',
      author: 'Dr. Priya Nair (Houston)',
      subjective: 'Commander reports mild transient lumbar ache post-resistive workout. Sleep efficiency 88%, no cephalad congestion.',
      objective: 'HR 66 bpm, SpO2 98%, Temp 36.7°C, HRV 64 ms. No active AI drift. Amsler grid intact (0 distortions).',
      assessment: 'Normal physiological microgravity spinal deconditioning. Autonomic tone balanced.',
      plan: '1. Maintain spinal traction exercises.\n2. Ingest 500 mL electrolyte fluid prior to sleep.\n3. Routine surveillance.',
    },
  ],
};

const INITIAL_ORDERS: CrewOrder[] = [
  {
    id: 'ord-init-1',
    type: 'exercise',
    text: 'Execute 40-minute ergometer resistive protocol at 140W with continuous autonomic HRV telemetry.',
    targetCrewId: 'vega',
    composedBy: 'Dr. Priya Nair (Houston)',
    composedAt: Date.now() - 3600000 * 4,
    timeStr: '11:15:00',
    deliverAt: Date.now() - 3600000 * 2,
    status: 'delivered',
  },
];

const INITIAL_BROADCASTS: BroadcastMessage[] = [
  {
    id: 'bc-1',
    title: 'Solar Particle Flux Elevation Advisory',
    message: 'Deep-space dosimeter indicates class-C solar flare transit in sector 4. Radiation storm shelter drill scheduled for Sol 143 04:00 UTC.',
    priority: 'urgent',
    sentBy: 'Flight Director Reyes',
    sentAt: Date.now() - 7200000,
    deliverAt: Date.now() - 3600000,
    timeStr: '12:00:00',
    status: 'delivered',
    readReceipts: [
      {crewId: 'vega', name: 'Elena Vega', readAt: Date.now() - 3000000, readTimeStr: '12:10:00'},
    ],
  },
];

const initialWorkoutNow = Date.now();
const INITIAL_WORKOUT_LOGS: WorkoutLogEntry[] = [
  {id: 'w-1', crewId: 'vega', type: 'treadmill', minutes: 45, intensity: 8, timestamp: initialWorkoutNow - 3600000 * 6, timeStr: 'Today · 07:30'},
  {id: 'w-2', crewId: 'marin', type: 'resistive', minutes: 40, intensity: 7, timestamp: initialWorkoutNow - 3600000 * 18, timeStr: 'Yesterday · 16:00'},
  {id: 'w-3', crewId: 'tanaka', type: 'cycle', minutes: 35, intensity: 6, timestamp: initialWorkoutNow - 3600000 * 22, timeStr: 'Yesterday · 12:00'},
  {id: 'w-4', crewId: 'okoye', type: 'resistive', minutes: 30, intensity: 5, timestamp: initialWorkoutNow - 86400000 * 2.5, timeStr: 'Sol 139 · 15:00'},
];

const INITIAL_FOOD_LOGS: FoodLogEntry[] = [
  {id: 'f-1', crewId: 'vega', foodId: 'fd-1', name: 'Poultry Pouch (Thermo-stabilized)', kcal: 320, protein: 28, sodium: 580, fluid: 150, timestamp: initialWorkoutNow - 3600000 * 5, timeStr: '08:30'},
  {id: 'f-2', crewId: 'vega', foodId: 'fd-4', name: 'Scrambled Eggs (Freeze-dried)', kcal: 260, protein: 18, sodium: 420, fluid: 120, timestamp: initialWorkoutNow - 3600000 * 5, timeStr: '08:30'},
  {id: 'f-3', crewId: 'vega', foodId: 'fd-10', name: 'Electrolyte Beverage (Lemon)', kcal: 65, protein: 0, sodium: 220, fluid: 350, timestamp: initialWorkoutNow - 3600000 * 4, timeStr: '09:30'},
  {id: 'f-4', crewId: 'vega', foodId: 'fd-3', name: 'Irradiated Beef Steak', kcal: 380, protein: 34, sodium: 620, fluid: 80, timestamp: initialWorkoutNow - 3600000 * 1.5, timeStr: '13:00'},
];

const INITIAL_COMPANION_MESSAGES: CompanionMessage[] = [
  {id: 'cm-1', sender: 'companion', text: 'Good morning, Elena. How are you adjusting to the Sol 142 routine?', timestamp: initialWorkoutNow - 3600000 * 3, timeStr: '10:00'},
  {id: 'cm-2', sender: 'crew', text: 'A bit tired after the sleep disruption during the solar flare warning, but ready for shift.', timestamp: initialWorkoutNow - 3600000 * 2.8, timeStr: '10:12'},
  {id: 'cm-3', sender: 'companion', text: 'Understandable. Remember you have an hour reserved for quiet decompression before EVA prep. Let me know if you want to run through breathing pacing.', timestamp: initialWorkoutNow - 3600000 * 2.7, timeStr: '10:13'},
];

const INITIAL_WEEKLY_GOALS: WeeklyGoal[] = [
  {id: 'g-1', text: '150 min target resistive & aerobic training', completed: true},
  {id: 'g-2', text: 'Daily hydration > 2.5L & sodium limit < 2300mg', completed: true},
  {id: 'g-3', text: 'Nightly 8-hour sleep schedule adherence', completed: false},
];

function getStoredJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function setStoredJson<T>(key: string, val: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // ignore quota/security errors
  }
}

export interface AppStore {
  mode: MissionMode;
  role: UserRole;
  view: AppView;
  page: AppPage;
  crew: CrewMember[];
  selectedCrewId: string;
  cabin: {
    co2: number;
    o2: number;
    pressure: number;
    temp: number;
    humidity: number;
    radiation: {
      dailyDose: number;
      cumulative: number;
      limit: number;
    };
  };
  scenarios: {
    co2Leak: {active: boolean; elapsed: number; earlyWarningFired?: boolean};
    solarEvent: {active: boolean; elapsed: number};
    illness: {active: boolean; crewId: string; elapsed: number};
  };
  alerts: Alert[];
  aiDegraded: boolean;
  aiDegradedReason: string | null;
  sensorFailure: boolean;
  sensorFailureElapsed: number;
  sensorDrift: boolean;
  sensorDriftElapsed: number;
  timeScale: 1 | 5 | 20;
  emergency: {active: boolean; time?: string} | null;
  checkIns: CheckIn[];
  tickCount: number;

  // Batch B Features
  messages: Message[];
  commsBlackout: boolean;
  incidents: Incident[];
  eventLog: EventLogEntry[];
  activeProtocol: ActiveProtocolState | null;
  cameraPulseActive: boolean;
  liveCameraBpm: number | null;
  toasts: ToastItem[];

  // Batch C Features
  consentVersion: string;
  consentAccepted: boolean;
  consentLog: Array<{user: string; version: string; time: string}>;
  onboardingCompleted: boolean;
  onboardingStep: number;
  onboardingProfile: {age: number; sex: 'M' | 'F' | 'O'; height: number; weight: number} | null;
  a11yMode: boolean;
  linkUp: boolean;
  missedCheckInHours: number;
  lastCheckInTimes: Record<string, number>;
  pendingOfflineCount: number;

  moodLogs: MoodLogEntry[];
  painLogs: PainLogEntry[];
  visionLogs: VisionLogEntry[];
  kitInventory: KitItem[];
  doseLogs: DoseLogEntry[];
  wellnessHistory: WellnessCheckInItem[];

  // Batch D Features
  notes: Record<string, NoteVersion[]>;
  orders: CrewOrder[];
  broadcasts: BroadcastMessage[];
  crewSigmaThresholds: Record<string, number>; // F050 default 3.0
  feedbackCounts: Record<string, {trueCount: number; falseCount: number}>;
  medicalOfficerCrewId: string | null; // F066
  mlAlertsEnabled: boolean; // F141
  assistantMode: 'cloud' | 'offline'; // F141
  waitOrActEnabled: boolean; // F141

  // Batch E Features
  astronautHomeTab: 'live' | 'environment' | 'checkin' | 'orders';
  surgeonHomeTab: 'roster' | 'alerts' | 'priors';
  controlHomeTab: 'overview' | 'cabin' | 'comms';
  workoutLogs: WorkoutLogEntry[];
  foodLogs: FoodLogEntry[];
  companionMessages: CompanionMessage[];
  weeklyGoals: WeeklyGoal[];

  // Final Batch Features
  narrationCaption: string | null;
  storyRunning: boolean;
  storyPaused: boolean;
  storyStepIndex: number;
  storyElapsedSec: number;
  assistantOffline: boolean;
  assistantInitialQuery: string | null;
  todayScenario: {
    active: boolean;
    personId: string | null;
    startWallTime: number;
  };
  painMapMode: '2d' | '3d';

  // Actions
  setPainMapMode: (mode: '2d' | '3d') => void;
  setNarrationCaption: (caption: string | null) => void;
  setAssistantOffline: (val: boolean) => void;
  setAssistantInitialQuery: (q: string | null) => void;
  startMarsStory: () => void;
  pauseMarsStory: () => void;
  resumeMarsStory: () => void;
  skipMarsStoryStep: () => void;
  prevMarsStoryStep: () => void;
  jumpToStoryStep: (stepIndex: number) => void;
  stopMarsStory: () => void;
  runMoment1LivePulse: () => void;
  runMoment2PullTheCable: () => void;
  runMoment3InjectFailure: () => void;
  runMoment4TodayBandWidens: (personId?: string) => void;
  stopMoment4TodayScenario: () => void;
  resetDemoState: () => void;

  setMode: (mode: MissionMode) => void;
  setRole: (role: UserRole) => void;
  setView: (view: AppView) => void;
  setPage: (page: AppPage) => void;
  setAstronautHomeTab: (tab: 'live' | 'environment' | 'checkin' | 'orders') => void;
  setSurgeonHomeTab: (tab: 'roster' | 'alerts' | 'priors') => void;
  setControlHomeTab: (tab: 'overview' | 'cabin' | 'comms') => void;
  setSelectedCrewId: (id: string) => void;
  setAiDegraded: (degraded: boolean, reason?: string | null) => void;
  setTimeScale: (scale: 1 | 5 | 20) => void;
  setEmergency: (emergency: {active: boolean; time?: string} | null) => void;
  ackAlert: (id: string) => void;
  resolveAlert: (id: string, note?: string) => void;
  addCheckIn: (checkIn: Omit<CheckIn, 'id' | 'time' | 'timestamp'>) => void;

  sendMessage: (from: 'crew' | 'ground', text: string, kind: 'consult' | 'order' | 'report') => void;
  toggleCommsBlackout: () => void;

  addIncident: (incident: Omit<Incident, 'id' | 'createdAt' | 'status'>) => void;
  resolveIncident: (id: string) => void;

  startProtocol: (protocolId: string) => void;
  advanceProtocolStep: (nextStepIndex: number) => void;
  abortProtocol: () => void;

  logEvent: (payload: string, actor?: string, category?: EventLogEntry['category']) => void;
  tamperEventLog: () => void;
  verifyEventLogChain: () => {valid: boolean; brokenIndex?: number};

  setCameraPulseActive: (active: boolean) => void;
  updateVegaLivePulse: (bpm: number) => void;

  addToast: (message: string, type?: 'info' | 'warn' | 'success') => void;
  removeToast: (id: string) => void;

  acceptConsent: (user: string) => void;
  bumpConsentVersion: () => void;
  setOnboardingStep: (step: number) => void;
  completeOnboarding: (profile: {age: number; sex: 'M' | 'F' | 'O'; height: number; weight: number}, device?: 'simulated' | 'camera') => void;
  toggleA11yMode: () => void;
  toggleLinkUp: () => void;
  setMissedCheckInHours: (hours: number) => void;

  logMood: (crewId: string, phqScore: number, gadScore: number, notes?: string) => void;
  logPain: (crewId: string, areas: PainArea[]) => void;
  logVision: (crewId: string, acuityScore: number, amslerDistortions: number) => void;
  logDose: (crewId: string, medName: string, dose: string) => {success: boolean; reason?: string};
  importKitCSV: (csvText: string) => {success: boolean; count: number; error?: string};
  syncOfflineQueue: () => Promise<number>;

  // Batch D Actions
  draftSoapTemplate: (crewId: string) => {subjective: string; objective: string; assessment: string; plan: string};
  saveNote: (crewId: string, author: string, s: string, o: string, a: string, p: string) => void;
  restoreNoteVersion: (crewId: string, version: number) => NoteVersion | null;

  composeOrder: (targetCrewId: string, type: CrewOrder['type'], text: string, composedBy: string) => void;
  acknowledgeOrder: (orderId: string, astronautName: string) => void;
  rejectOrder: (orderId: string, astronautName: string, reason?: string) => void;

  sendBroadcast: (title: string, message: string, priority: BroadcastMessage['priority'], sentBy: string) => void;
  markBroadcastRead: (broadcastId: string, crewId: string, crewName: string) => void;

  recordFeedback: (alertId: string, isTrueAlert: boolean) => void;
  replayLastHour: (crewId: string) => {nowFires: number; beforeFires: number; currentSigma: number};

  designateMedicalOfficer: (crewId: string) => void;
  revokeMedicalOfficer: () => void;

  toggleMlAlerts: () => void;
  setAssistantMode: (mode: 'cloud' | 'offline') => void;
  toggleWaitOrAct: () => void;

  exportStateJson: () => string;
  importStateJson: (jsonStr: string) => {success: boolean; error?: string};

  // Batch E Actions
  logWorkout: (entry: Omit<WorkoutLogEntry, 'id' | 'timestamp' | 'timeStr'>) => void;
  logFood: (entry: Omit<FoodLogEntry, 'id' | 'timestamp' | 'timeStr'>) => void;
  sendCompanionMessage: (text: string) => void;
  toggleWeeklyGoal: (id: string) => void;
  updateWeeklyGoalText: (id: string, text: string) => void;

  startCO2Leak: () => void;
  toggleCO2Leak: () => void;
  startSolarEvent: () => void;
  toggleSolarEvent: () => void;
  startIllness: (crewId?: string) => void;
  toggleIllness: (crewId?: string) => void;
  clearScenarios: () => void;
  injectSensorFailure: () => void;
  injectDrift: () => void;

  tick: () => void;
  computeRiskScore: (member: CrewMember) => number;
}

export interface StoryStepDef {
  id: string;
  atSec: number;
  durationSec: number;
  title: string;
  route: string;
  targetSelector: string;
  narration: string;
  presenterNotes: string;
  run: (s: AppStore) => void;
  onExit?: (s: AppStore) => void;
}

export const STORY_STEPS: StoryStepDef[] = [
  {
    id: 'ch1',
    atSec: 0,
    durationSec: 40,
    title: 'Ch. 1 · Mission Setup & Latency Tier',
    route: '#home',
    targetSelector: '[data-tour="ch1-mission-setup"]',
    narration: 'AstroCare initializes Mars transit mode at Level 3 autonomy. With a 44-minute round trip latency, all clinical telemetry, life support, and radiation monitoring must operate fully autonomous.',
    presenterNotes: 'Point out Level 3 badge, 44m round-trip delay, and DSN carrier lock. Explain that ground review is asynchronous.',
    run: (s) => {
      s.setMode('MARS');
      s.setRole('control');
      s.setPage('home');
      s.setControlHomeTab('overview');
      s.setNarrationCaption('0:00 Ch1 · Mode MARS initialized at Level 3 autonomy. Ground review is asynchronous.');
      s.logEvent('STORY: Ch. 1 — Mode MARS initialized at Level 3 autonomy.', 'story', 'system');
    },
  },
  {
    id: 'ch2',
    atSec: 40,
    durationSec: 50,
    title: 'Ch. 2 · Astronaut Baselines & Optical Pulse (rPPG)',
    route: '#home',
    targetSelector: '[data-tour="ch2-vitals-pulse"]',
    narration: 'Astronaut home console tracks live vitals against personal baselines. Optical rPPG camera pulse is tagged REAL with adaptive confidence gating, while biometrics carry verified provenance tags.',
    presenterNotes: 'Show Dr. Elena Vega vitals grid. Point out REAL vs SIMULATED badges and live blood pressure tile with baseline delta.',
    run: (s) => {
      s.setRole('astronaut');
      s.setPage('home');
      s.setSelectedCrewId('vega');
      s.setAstronautHomeTab('live');
      s.setNarrationCaption('0:40 Ch2 · Vitals tracked against personal baseline; optical rPPG confidence-gated.');
      s.logEvent('STORY: Ch. 2 — Astronaut vitals & optical rPPG stream active.', 'story', 'telemetry');
    },
  },
  {
    id: 'ch3',
    atSec: 90,
    durationSec: 45,
    title: 'Ch. 3 · Multi-Modal Passive Telehealth & Fatigue',
    route: '#wellness',
    targetSelector: '[data-tour="ch3-passive-wellness"]',
    narration: 'Passive biometric monitoring tracks vocal fatigue index, psychomotor typing latency, and sleep architecture. All indicators show relative baseline drift without making false clinical diagnoses.',
    presenterNotes: 'Highlight vocal jitter/shimmer, keystroke interval dynamics, and sleep debt. Emphasize honest non-diagnostic limits.',
    run: (s) => {
      s.setRole('astronaut');
      s.setPage('wellness');
      s.setNarrationCaption('1:30 Ch3 · Passive monitoring: Vocal fatigue, typing latency, sleep debt relative to baseline.');
      s.logEvent('STORY: Ch. 3 — Passive wellness telemetry evaluated.', 'story', 'wellness');
    },
  },
  {
    id: 'ch4',
    atSec: 135,
    durationSec: 60,
    title: 'Ch. 4 · Cabin-to-Body Coupling & Pre-Symptomatic Early Warning',
    route: '#home',
    targetSelector: '[data-tour="ch4-cabin-body"]',
    narration: 'Injecting atmospheric CO2 scrubber leak and solar particle event. Physiological cross-coupling detects vagal suppression and fires early warning before acute clinical symptoms manifest.',
    presenterNotes: 'Notice dual-axis chart: CO2 rises while crew HRV plummets. Autonomic early warning triggers automated scrubber escalation.',
    run: (s) => {
      s.startCO2Leak();
      s.startSolarEvent();
      s.setRole('control');
      s.setPage('home');
      s.setControlHomeTab('cabin');
      s.setNarrationCaption('2:15 Ch4 · Pre-symptomatic warning: Atmospheric CO2 spike triggers vagal HRV depression.');
      s.logEvent('STORY: Ch. 4 — Environmental-physiological cross coupling early warning active.', 'story', 'emergency');
    },
  },
  {
    id: 'ch5',
    atSec: 195,
    durationSec: 60,
    title: 'Ch. 5 · Wait-or-Act Operational Autonomy Frontier',
    route: '#woa',
    targetSelector: '[data-tour="ch5-wait-or-act"]',
    narration: 'As Mars delay scales from 4 to 24 minutes, the Wait-or-Act engine flips from Ask Ground to Autonomous Action. The Bayesian decision uncertainty band widens as latency grows.',
    presenterNotes: 'Hover delay slider: notice policy recommendation shifts from Ask Ground to Autonomous Action. Point out widened Bayesian uncertainty band.',
    run: (s) => {
      s.setRole('astronaut');
      s.setPage('woa');
      s.setNarrationCaption('3:15 Ch5 · Wait-or-Act decision frontier flips from Ask Ground to Autonomous Action.');
      s.logEvent('STORY: Ch. 5 — Operational autonomy frontier evaluated under Mars delay.', 'story', 'system');
    },
  },
  {
    id: 'ch6',
    atSec: 255,
    durationSec: 45,
    title: 'Ch. 6 · Flight Surgeon Uplink & Asynchronous Directive',
    route: '#home',
    targetSelector: '[data-tour="ch6-surgeon-directive"]',
    narration: 'Flight Surgeon Dr. Nair transmits an uplink clinical directive. The directive is tracked through deep-space transit latency, arrives at the hab, and requires astronaut compliance acknowledgment.',
    presenterNotes: 'Watch Directive Log: shows in-flight countdown crossing Mars latency, delivering to astronaut view for verified ack.',
    run: (s) => {
      s.setRole('surgeon');
      s.setPage('home');
      s.setSelectedCrewId('okoye');
      s.setNarrationCaption('4:15 Ch6 · Flight surgeon consult dispatched through store-and-forward latency queue.');
      s.logEvent('STORY: Ch. 6 — Clinical directive transmitted across deep-space latency.', 'story', 'surgeon');
    },
  },
  {
    id: 'ch7',
    atSec: 300,
    durationSec: 45,
    title: 'Ch. 7 · Autonomous Medical Supply & Resupply Planner',
    route: '#supplies',
    targetSelector: '[data-tour="ch7-controls-supplies"]',
    narration: 'Deep-space medical pack inventory tracks consumable depletion, expiry, and shelf-life degradation under space radiation across the 900-day expedition trajectory.',
    presenterNotes: 'Point out shelf-life stability model under cosmic radiation and prioritized oral vs IV rehydration optimization.',
    run: (s) => {
      s.setRole('surgeon');
      s.setPage('supplies');
      s.setNarrationCaption('5:00 Ch7 · Autonomous supply tracker: Shelf-life degradation modeled under cosmic radiation.');
      s.logEvent('STORY: Ch. 7 — Medical kit depletion model evaluated.', 'story', 'supplies');
    },
  },
  {
    id: 'ch8',
    atSec: 345,
    durationSec: 45,
    title: 'Ch. 8 · Offline-First Assistant & Red-Team Guardrails',
    route: '#assistant',
    targetSelector: '[data-tour="ch8-offline-assistant"]',
    narration: 'Simulating deep-space carrier cable pull. The local radiation-hardened assistant answers clinical queries with grounded medical citations while refusing dangerous or contraindicated procedures.',
    presenterNotes: 'Demonstrate cable-pull offline indicator. Query clinical guideline and highlight sentence-level citation verification.',
    run: (s) => {
      s.setRole('astronaut');
      s.setPage('assistant');
      s.setAssistantMode('offline');
      s.setAssistantOffline(true);
      s.setNarrationCaption('5:45 Ch8 · Offline-first clinical assistant: Sentence-level citation validation & refusal guardrails.');
      s.logEvent('STORY: Ch. 8 — Local offline edge LLM assistant active.', 'story', 'assistant');
    },
  },
  {
    id: 'ch9',
    atSec: 390,
    durationSec: 40,
    title: 'Ch. 9 · Hardware Watchdog & AI Degradation Banner',
    route: '#home',
    targetSelector: '[data-tour="ch9-watchdog-banner"]',
    narration: 'Hardware sensor flatline triggers self-watchdog detection. The UI displays an amber AI-Degraded banner and safely reverts to deterministic failsafe clinical rules until sensor recalibration.',
    presenterNotes: 'Notice amber banner: AI Degraded to Rules Only. Algorithmic models stop silently hallucinatory outputs.',
    run: (s) => {
      s.injectSensorFailure();
      s.setRole('surgeon');
      s.setPage('home');
      s.setNarrationCaption('6:30 Ch9 · Hardware watchdog triggered: System degraded to deterministic rules.');
      s.logEvent('STORY: Ch. 9 — Hardware watchdog tripped. AI Degraded banner active.', 'story', 'watchdog');
    },
  },
  {
    id: 'ch10',
    atSec: 430,
    durationSec: 50,
    title: 'Ch. 10 · Verification Benchmarks, Physical Limits & Ethics',
    route: '#proof',
    targetSelector: '[data-tour="ch10-proof-limits"]',
    narration: 'Validation benchmarks display empirical verification status, physical sensor boundaries, and explicit NASA operational disclaimers: decision-support prototype on synthetic and public data, not a medical device. Hardcoded and unauthenticated benchmark numbers are suppressed pending verified runs.',
    presenterNotes: 'Review benchmark execution status, physical sensor boundaries, and the prominent non-diagnostic prototype disclaimer.',
    run: (s) => {
      s.setRole('surgeon');
      s.setPage('proof');
      s.setNarrationCaption('7:10 Ch10 · Rigorous verification benchmarks, physical limits, and non-medical device ethics.');
      s.logEvent('STORY: Ch. 10 — Proof benchmarks and non-medical device boundaries verified.', 'story', 'proof');
    },
  },
];

export const useStore = create<AppStore>((set, get) => ({
  mode: 'MARS',
  role: null,
  view: 'landing',
  page: 'home',
  crew: INITIAL_CREW,
  selectedCrewId: 'okoye',
  cabin: {
    co2: 820,
    o2: 20.9,
    pressure: 101.3,
    temp: 22.0,
    humidity: 45.0,
    radiation: {
      dailyDose: 1.8,
      cumulative: 142.8,
      limit: 1000,
    },
  },
  scenarios: {
    co2Leak: {
      active: getStoredJson<boolean>('astrocare_toggle_scenario_co2Leak', false),
      elapsed: 0,
      earlyWarningFired: false,
    },
    solarEvent: {
      active: getStoredJson<boolean>('astrocare_toggle_scenario_solarEvent', false),
      elapsed: 0,
    },
    illness: {
      active: getStoredJson<boolean>('astrocare_toggle_scenario_illness', false),
      crewId: 'okoye',
      elapsed: 0,
    },
  },
  alerts: [
    {
      id: 'init-1',
      time: '14:22:10',
      timestamp: Date.now() - 360000,
      source: 'AI',
      severity: 'info',
      title: 'Baseline sync verified',
      explanation: 'All crew telemetry synced with Earth baseline model. Deviation scores nominal.',
      factors: [{label: 'Signal variance', direction: 'down', size: 0.15}],
      confidence: 0.94,
      status: 'resolved',
      count: 1,
      predictionSet: ['Normal adaptation'],
      aiUnsure: false,
      resolveNote: 'Automated ground handshake completed.',
    },
  ],
  aiDegraded: getStoredJson<boolean>('astrocare_toggle_sensorFailure', false),
  aiDegradedReason: getStoredJson<boolean>('astrocare_toggle_sensorFailure', false) ? 'sensor quality' : null,
  sensorFailure: getStoredJson<boolean>('astrocare_toggle_sensorFailure', false),
  sensorFailureElapsed: 0,
  sensorDrift: getStoredJson<boolean>('astrocare_toggle_sensorDrift', false),
  sensorDriftElapsed: 0,
  timeScale: 1,
  emergency: null,
  checkIns: [],
  tickCount: 0,

  messages: [
    {
      id: 'msg-init-1',
      from: 'ground',
      text: 'Flight Dynamics confirms trajectory injection parameters nominal. DSN lock steady.',
      kind: 'order',
      sentAt: Date.now() - 180000,
      deliverAt: Date.now() - 120000,
      status: 'delivered',
    },
  ],
  commsBlackout: getStoredJson<boolean>('astrocare_toggle_commsBlackout', false),
  incidents: [
    {
      id: 'inc-demo-1',
      title: 'Hab Module Scrubber B Micro-Spike',
      severity: 0.65,
      timeToCritical: 25,
      crewId: 'vega',
      status: 'pending',
      createdAt: Date.now() - 60000,
    },
  ],
  eventLog: [
    {
      index: 0,
      timestamp: Date.now() - 100000,
      timeStr: '14:00:00',
      payload: initialLogPayload,
      prevHash: '00000000',
      hash: initialLogHash,
      actor: 'system',
      category: 'general',
    },
  ],
  activeProtocol: null,
  cameraPulseActive: false,
  liveCameraBpm: null,
  toasts: [],

  // Batch C State
  consentVersion: '1.0',
  consentAccepted: getStoredJson<boolean>('astrocare_consent_accepted_1.0', false),
  consentLog: getStoredJson<Array<{user: string; version: string; time: string}>>('astrocare_consent_log', []),
  onboardingCompleted: getStoredJson<boolean>('astrocare_onboarding_completed', false),
  onboardingStep: 1,
  onboardingProfile: getStoredJson<{age: number; sex: 'M' | 'F' | 'O'; height: number; weight: number} | null>('astrocare_onboarding_profile', null),
  a11yMode: false,
  linkUp: getStoredJson<boolean>('astrocare_toggle_linkUp', true),
  missedCheckInHours: 24,
  lastCheckInTimes: {
    vega: Date.now() - 86400000 * 1.2,
    okoye: Date.now() - 3600000 * 6,
    marin: Date.now() - 3600000 * 8,
    tanaka: Date.now() - 3600000 * 12,
  },
  pendingOfflineCount: 0,

  moodLogs: INITIAL_MOOD_LOGS,
  painLogs: INITIAL_PAIN_LOGS,
  visionLogs: INITIAL_VISION_LOGS,
  kitInventory: INITIAL_KIT,
  doseLogs: [],
  wellnessHistory: INITIAL_WELLNESS_HISTORY,

  // Batch D State
  notes: INITIAL_NOTES,
  orders: INITIAL_ORDERS,
  broadcasts: INITIAL_BROADCASTS,
  crewSigmaThresholds: {vega: 3.0, okoye: 3.0, marin: 3.0, tanaka: 3.0},
  feedbackCounts: {
    vega: {trueCount: 0, falseCount: 0},
    okoye: {trueCount: 0, falseCount: 0},
    marin: {trueCount: 0, falseCount: 0},
    tanaka: {trueCount: 0, falseCount: 0},
  },
  medicalOfficerCrewId: 'vega', // Initially Vega is designated CMO
  mlAlertsEnabled: getStoredJson<boolean>('astrocare_toggle_mlAlertsEnabled', true),
  assistantMode: getStoredJson<'cloud' | 'offline'>('astrocare_toggle_assistantMode', 'offline'),
  waitOrActEnabled: getStoredJson<boolean>('astrocare_toggle_waitOrActEnabled', true),

  // Batch E State
  astronautHomeTab: 'live',
  surgeonHomeTab: 'roster',
  controlHomeTab: 'overview',
  workoutLogs: INITIAL_WORKOUT_LOGS,
  foodLogs: INITIAL_FOOD_LOGS,
  companionMessages: INITIAL_COMPANION_MESSAGES,
  weeklyGoals: INITIAL_WEEKLY_GOALS,

  // Final Batch State
  narrationCaption: null,
  storyRunning: false,
  storyPaused: false,
  storyStepIndex: 0,
  storyElapsedSec: 0,
  assistantOffline: true,
  assistantInitialQuery: null,
  todayScenario: {
    active: false,
    personId: null,
    startWallTime: 0,
  },
  painMapMode: '3d',

  setPainMapMode: (painMapMode) => set({painMapMode}),
  setNarrationCaption: (narrationCaption) => set({narrationCaption}),
  setAssistantOffline: (assistantOffline) => set({assistantOffline}),
  setAssistantInitialQuery: (assistantInitialQuery) => set({assistantInitialQuery}),

  startMarsStory: () => {
    set({
      storyRunning: true,
      storyPaused: false,
      storyStepIndex: 0,
      storyElapsedSec: 0,
    });
    STORY_STEPS[0].run(get());
  },
  pauseMarsStory: () => set({storyPaused: true}),
  resumeMarsStory: () => set({storyPaused: false}),
  skipMarsStoryStep: () => {
    const nextIdx = get().storyStepIndex + 1;
    if (nextIdx < STORY_STEPS.length) {
      set({
        storyStepIndex: nextIdx,
        storyElapsedSec: STORY_STEPS[nextIdx].atSec,
      });
      STORY_STEPS[nextIdx].run(get());
    } else {
      get().stopMarsStory();
    }
  },
  prevMarsStoryStep: () => {
    const prevIdx = Math.max(0, get().storyStepIndex - 1);
    set({
      storyStepIndex: prevIdx,
      storyElapsedSec: STORY_STEPS[prevIdx].atSec,
    });
    STORY_STEPS[prevIdx].run(get());
  },
  jumpToStoryStep: (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < STORY_STEPS.length) {
      set({
        storyStepIndex: stepIndex,
        storyElapsedSec: STORY_STEPS[stepIndex].atSec,
      });
      STORY_STEPS[stepIndex].run(get());
    }
  },
  stopMarsStory: () => {
    set({
      storyRunning: false,
      storyPaused: false,
      storyStepIndex: 0,
      storyElapsedSec: 0,
      narrationCaption: null,
    });
  },

  runMoment1LivePulse: () => {
    set({
      role: 'astronaut',
      page: 'home',
      astronautHomeTab: 'live',
      cameraPulseActive: true,
    });
    get().logEvent('DEMO: Moment 1 Live optical pulse engaged on Commander Vega', 'demo', 'system');
    get().addToast('Demo Moment 1: Navigated to Astronaut Live vitals — camera pulse active', 'success');
  },

  runMoment2PullTheCable: () => {
    set({
      page: 'assistant',
      assistantOffline: true,
      assistantInitialQuery: 'What are the first symptoms of cabin CO2 poisoning?',
    });
    get().logEvent('DEMO: Moment 2 Link severed. Local offline model queried.', 'demo', 'system');
    get().addToast('Demo Moment 2: Navigated to Assistant (Offline) — Query dispatched to onboard model', 'info');
  },

  runMoment3InjectFailure: () => {
    set({
      sensorFailure: true,
      sensorFailureElapsed: 10,
      aiDegraded: true,
      aiDegradedReason: 'sensor quality',
      role: 'surgeon',
      page: 'home',
      surgeonHomeTab: 'alerts',
    });
    get().logEvent('DEMO: Moment 3 Sensor flatline injected. AI degraded to rules only.', 'demo', 'watchdog');
    get().addToast('Demo Moment 3: Sensor failure injected — Surgeon inbox switched to rules-only', 'warn');
  },

  runMoment4TodayBandWidens: (personId = 'vega') => {
    set({
      role: 'astronaut',
      page: 'home',
      selectedCrewId: personId,
      todayScenario: {
        active: true,
        personId,
        startWallTime: Date.now(),
      },
    });
    get().logEvent(`DEMO: Moment 4 Today band widens scenario started for ${personId}`, 'demo', 'system');
    get().addToast(`Demo Moment 4: Today band widens scenario active for ${personId} (30 s)`, 'info');
  },

  stopMoment4TodayScenario: () => {
    set({
      todayScenario: {
        active: false,
        personId: null,
        startWallTime: 0,
      },
      painMapMode: '3d',
    });
  },

  resetDemoState: () => {
    setStoredJson('astrocare_toggle_sensorFailure', false);
    setStoredJson('astrocare_toggle_sensorDrift', false);
    setStoredJson('astrocare_toggle_commsBlackout', false);
    setStoredJson('astrocare_toggle_linkUp', true);
    setStoredJson('astrocare_toggle_mlAlertsEnabled', true);
    setStoredJson('astrocare_toggle_assistantMode', 'offline');
    setStoredJson('astrocare_toggle_waitOrActEnabled', true);
    setStoredJson('astrocare_toggle_scenario_co2Leak', false);
    setStoredJson('astrocare_toggle_scenario_solarEvent', false);
    setStoredJson('astrocare_toggle_scenario_illness', false);

    const freshCrew = INITIAL_CREW.map((c) => ({
      ...c,
      readings: {
        hr: c.readings.hr.slice(-30),
        spo2: c.readings.spo2.slice(-30),
        temp: c.readings.temp.slice(-30),
        resp: c.readings.resp.slice(-30),
        hrv: c.readings.hrv.slice(-30),
        bpSys: c.readings.bpSys.slice(-30),
        bpDia: c.readings.bpDia.slice(-30),
      },
    }));

    set({
      mode: 'MARS',
      role: 'astronaut',
      page: 'home',
      astronautHomeTab: 'live',
      selectedCrewId: 'vega',
      scenarios: {
        co2Leak: {active: false, elapsed: 0, earlyWarningFired: false},
        solarEvent: {active: false, elapsed: 0},
        illness: {active: false, crewId: 'okoye', elapsed: 0},
      },
      todayScenario: {
        active: false,
        personId: null,
        startWallTime: 0,
      },
      painMapMode: '3d',
      sensorFailure: false,
      sensorFailureElapsed: 0,
      sensorDrift: false,
      sensorDriftElapsed: 0,
      aiDegraded: false,
      aiDegradedReason: null,
      commsBlackout: false,
      linkUp: true,
      cameraPulseActive: false,
      emergency: null,
      alerts: [],
      messages: [],
      orders: [],
      eventLog: [],
      activeProtocol: null,
      crew: freshCrew,
      narrationCaption: null,
      storyRunning: false,
      storyPaused: false,
      storyStepIndex: 0,
      storyElapsedSec: 0,
    });
    get().logEvent('SYSTEM_RESET: Demo reset completed. MARS baseline restored.', 'system', 'system');
    get().addToast('Reset demo complete: Scenarios cleared, crew nominal, MARS L3 active', 'success');
  },

  setAstronautHomeTab: (astronautHomeTab) => set({astronautHomeTab}),
  setSurgeonHomeTab: (surgeonHomeTab) => set({surgeonHomeTab}),
  setControlHomeTab: (controlHomeTab) => set({controlHomeTab}),

  setMode: (mode) => {
    const prevMode = get().mode;
    const oldLevel = getIndependenceLevel(prevMode);
    const newLevel = getIndependenceLevel(mode);

    set((s) => ({
      mode,
      cabin: {
        ...s.cabin,
        radiation: {
          ...s.cabin.radiation,
          dailyDose: MODES[mode].radiation,
        },
      },
    }));

    if (oldLevel !== newLevel) {
      get().addToast(`Mission mode changed autonomy level to Level ${newLevel} (${LEVELS[newLevel].label})`, 'info');
    }
    bridgeSetMissionMode(mode).catch(() => {});
  },

  setRole: (role) => {
    set({role});
    get().logEvent(`ROLE_CHANGED: Operator switched to ${role?.toUpperCase() || 'NONE'}`, role || 'user', 'general');
  },
  setView: (view) => set({view}),
  setPage: (page) => set({page}),
  setSelectedCrewId: (id) => set({selectedCrewId: id}),
  setAiDegraded: (aiDegraded, reason = null) => set({aiDegraded, aiDegradedReason: reason}),
  setTimeScale: (timeScale) => set({timeScale}),

  setEmergency: (emergency) => {
    set({emergency});
    if (emergency?.active) {
      get().logEvent(`EMERGENCY_DECLARED: Immediate clinical priority at ${emergency.time}`, 'medical', 'emergency');
      get().addToast('CRITICAL: Emergency Protocol Declared across all roles', 'warn');
    }
  },

  ackAlert: (id) => {
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? {...a, status: 'ack'} : a)),
    }));
    get().logEvent(`ALERT_ACK: Alert ${id} acknowledged by operator`, get().role || 'operator', 'alert');
    get().addToast(`Alert ${id} acknowledged`, 'success');
    bridgeAcknowledgeAlert(id, get().role || 'operator').catch(() => {});
  },

  resolveAlert: (id, note) => {
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? {...a, status: 'resolved', resolveNote: note} : a)),
    }));
    get().logEvent(`ALERT_RESOLVE: Alert ${id} resolved with note: ${note || 'None'}`, get().role || 'operator', 'alert');
    get().addToast(`Alert ${id} resolved`, 'success');
    bridgeResolveAlert(id, note || '', get().role || 'operator').catch(() => {});
  },

  addCheckIn: (ci) => {
    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    const id = `ci-${now}-${Math.random().toString(36).slice(2, 6)}`;
    const isOnline = get().linkUp;

    const checkIn: CheckIn = {
      ...ci,
      id,
      time: timeStr,
      timestamp: now,
      status: isOnline ? 'synced' : 'pending',
    };
    bridgeSaveCheckIn(checkIn).catch(() => {});

    set((s) => ({
      lastCheckInTimes: {
        ...s.lastCheckInTimes,
        [ci.crewId]: now,
      },
    }));

    if (!isOnline) {
      const offlineRec: OfflineCheckInRecord = {
        id,
        crewId: ci.crewId,
        timestamp: now,
        timeStr,
        type: 'general',
        summary: `Mood ${ci.mood}/10, Pain ${ci.pain}/10 (${ci.symptoms.length} symptoms)`,
        payload: ci as Record<string, unknown>,
        status: 'pending',
      };
      saveOfflineCheckIn(offlineRec).then(() => {
        getOfflineCheckIns().then((queue) => {
          set({pendingOfflineCount: queue.length});
        });
      });
      get().addToast(`Link offline: Check-in saved to local queue (Pending sync)`, 'warn');
    } else {
      get().addToast('Check-in transmitted to ground telemetry stream', 'success');
    }

    set((s) => {
      const redFlags = ['Chest tightness', 'Vision blur', 'Syncope / Faint', 'Severe disorientation'];
      const hasRedFlag = ci.symptoms.some((sym) => redFlags.includes(sym));
      let newAlerts = s.alerts;
      if (hasRedFlag) {
        newAlerts = [
          {
            id: `alert-ci-${now}`,
            time: timeStr,
            timestamp: now,
            crewId: ci.crewId,
            source: 'RULE',
            severity: 'watch',
            title: 'Red-flag symptom reported in check-in',
            explanation: `Astronaut logged critical symptoms: ${ci.symptoms.join(', ')}. Clinical evaluation advised.`,
            factors: [{label: 'Reported severity', direction: 'up', size: 0.85}],
            confidence: 0.98,
            status: 'new',
            count: 1,
            predictionSet: ['Acute red-flag symptom'],
            aiUnsure: false,
          },
          ...s.alerts,
        ];
      }

      const historyItem: WellnessCheckInItem = {
        id,
        crewId: ci.crewId,
        timestamp: now,
        timeStr,
        type: 'general',
        summary: `Routine check-in (Mood ${ci.mood}/10, Energy ${ci.energy}/10, Pain ${ci.pain}/10)`,
        status: isOnline ? 'synced' : 'pending',
      };

      return {
        checkIns: [checkIn, ...s.checkIns],
        wellnessHistory: [historyItem, ...s.wellnessHistory],
        alerts: newAlerts,
      };
    });
    get().logEvent(`CHECKIN_SUBMITTED: ${ci.crewId} submitted check-in`, ci.crewId, 'general');
  },

  sendMessage: (from, text, kind) => {
    const state = get();
    const oneWaySec = MODES[state.mode].delaySec;
    const latencyMs = (oneWaySec * 1000) / state.timeScale;
    const now = Date.now();

    const newMsg: Message = {
      id: `msg-${now}-${Math.random().toString(36).slice(2, 5)}`,
      from,
      text,
      kind,
      sentAt: now,
      deliverAt: now + latencyMs,
      status: 'in-flight',
    };

    set((s) => ({messages: [newMsg, ...s.messages]}));
    bridgeSaveConsultMessage(newMsg).catch(() => {});
    get().logEvent(`MSG_QUEUED: ${from.toUpperCase()} [${kind.toUpperCase()}]: ${text.slice(0, 40)}`, from, 'general');
    if (!state.linkUp) {
      get().addToast(`Message queued in transit buffer (Deep-space link currently down)`, 'warn');
    } else {
      get().addToast(`Dispatched message to ${from === 'crew' ? 'Earth Ground' : 'Crew Transit'} (${Math.round(oneWaySec / 60)}m delay)`, 'info');
    }
  },

  toggleCommsBlackout: () =>
    set((s) => {
      const next = !s.commsBlackout;
      setStoredJson('astrocare_toggle_commsBlackout', next);
      get().logEvent(`COMMS_LINK: ${next ? 'SOLAR_CONJUNCTION_BLACKOUT_ENGAGED' : 'CARRIER_RESTORED'}`, 'system', 'watchdog');
      get().addToast(next ? 'Deep space comms blackout engaged: messages held' : 'Comms carrier link re-established', next ? 'warn' : 'success');
      return {commsBlackout: next};
    }),

  addIncident: (inc) => {
    const newInc: Incident = {
      ...inc,
      id: `inc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      createdAt: Date.now(),
      status: 'pending',
    };
    set((s) => ({incidents: [newInc, ...s.incidents]}));
  },

  resolveIncident: (id) =>
    set((s) => ({
      incidents: s.incidents.map((i) => (i.id === id ? {...i, status: 'resolved'} : i)),
    })),

  startProtocol: (protocolId) => {
    set({
      activeProtocol: {
        protocolId,
        stepIndex: 0,
        status: 'active',
        startedAt: Date.now(),
      },
    });
    get().logEvent(`PROTOCOL_START: ${protocolId.toUpperCase()} initiated`, get().role || 'operator', 'alert');
  },

  advanceProtocolStep: (nextStepIndex) => {
    const state = get();
    if (!state.activeProtocol) return;
    set({
      activeProtocol: {
        ...state.activeProtocol,
        stepIndex: nextStepIndex,
      },
    });
    get().logEvent(`PROTOCOL_STEP: ${state.activeProtocol.protocolId} advanced to step ${nextStepIndex + 1}`, get().role || 'operator', 'alert');
  },

  abortProtocol: () => {
    const state = get();
    if (!state.activeProtocol) return;
    get().logEvent(`PROTOCOL_ABORT: ${state.activeProtocol.protocolId} terminated early`, get().role || 'operator', 'alert');
    set({activeProtocol: null});
  },

  logEvent: (payload, actor = 'system', category = 'general') => {
    set((s) => {
      const lastEntry = s.eventLog[s.eventLog.length - 1];
      const prevHash = lastEntry ? lastEntry.hash : '00000000';
      const hash = fnv1a(prevHash + payload);
      const newEntry: EventLogEntry = {
        index: s.eventLog.length,
        timestamp: Date.now(),
        timeStr: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'}),
        payload,
        prevHash,
        hash,
        actor,
        category,
      };
      return {eventLog: [...s.eventLog, newEntry]};
    });
  },

  tamperEventLog: () => {
    set((s) => {
      if (s.eventLog.length < 2) return s;
      const targetIdx = 1;
      const tampered = [...s.eventLog];
      tampered[targetIdx] = {
        ...tampered[targetIdx],
        payload: tampered[targetIdx].payload + ' [TAMPERED_MODIFIED_RECORD]',
      };
      get().addToast('Tampered with event log index 1 to test audit verification', 'warn');
      return {eventLog: tampered};
    });
  },

  verifyEventLogChain: () => {
    const log = get().eventLog;
    for (let i = 0; i < log.length; i++) {
      const entry = log[i];
      const expectedPrev = i === 0 ? '00000000' : log[i - 1].hash;
      if (entry.prevHash !== expectedPrev) {
        return {valid: false, brokenIndex: i};
      }
      const expectedHash = fnv1a(entry.prevHash + entry.payload);
      if (entry.hash !== expectedHash) {
        return {valid: false, brokenIndex: i};
      }
    }
    return {valid: true};
  },

  setCameraPulseActive: (active) => {
    set({cameraPulseActive: active, liveCameraBpm: active ? get().liveCameraBpm : null});
    get().logEvent(`BIOMETRIC_CAMERA_BRIDGE: ${active ? 'ENGAGED_LOCAL_PULSE' : 'DISENGAGED'}`, 'system', 'watchdog');
  },

  updateVegaLivePulse: (bpm) => {
    set((s) => {
      const now = Date.now();
      const updatedCrew = s.crew.map((member) => {
        if (member.id !== 'vega') return member;
        const newReading: MetricReading = {time: now, value: bpm, provenance: 'REAL'};
        const nextHr = [...member.readings.hr, newReading];
        return {
          ...member,
          readings: {
            ...member.readings,
            hr: nextHr.length > 300 ? nextHr.slice(-300) : nextHr,
          },
        };
      });
      return {crew: updatedCrew, liveCameraBpm: bpm};
    });
  },

  addToast: (message, type = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`;
    set((s) => ({toasts: [...s.toasts, {id, message, type}]}));
    setTimeout(() => {
      get().removeToast(id);
    }, 4500);
  },

  removeToast: (id) =>
    set((s) => ({toasts: s.toasts.filter((t) => t.id !== id)})),

  acceptConsent: (user) => {
    const ver = get().consentVersion;
    const timeStr = new Date().toISOString();
    const entry = {user, version: ver, time: timeStr};
    const nextLog = [entry, ...get().consentLog];

    try {
      localStorage.setItem(`astrocare_consent_accepted_${ver}`, 'true');
      localStorage.setItem('astrocare_consent_log', JSON.stringify(nextLog));
    } catch {
      // ignore
    }

    set({
      consentAccepted: true,
      consentLog: nextLog,
    });
    get().logEvent(`CONSENT_ACCEPTED: Version ${ver} by ${user}`, user, 'consent');
    get().addToast(`Consent accepted (v${ver}) — welcome aboard, ${user}`, 'success');
  },

  bumpConsentVersion: () => {
    const currentVer = get().consentVersion;
    const parts = currentVer.split('.');
    const nextMinor = (parseInt(parts[1] || '0', 10) + 1).toString();
    const nextVer = `${parts[0]}.${nextMinor}`;

    try {
      localStorage.removeItem(`astrocare_consent_accepted_${nextVer}`);
    } catch {
      // ignore
    }

    set({
      consentVersion: nextVer,
      consentAccepted: false,
    });
    get().logEvent(`CONSENT_POLICY_UPDATED: Re-prompting for version ${nextVer}`, 'system', 'consent');
    get().addToast(`Consent policy version bumped to v${nextVer}. Re-prompting user.`, 'warn');
  },

  setOnboardingStep: (step) => set({onboardingStep: step}),

  completeOnboarding: (profile, device = 'simulated') => {
    try {
      localStorage.setItem('astrocare_onboarding_completed', 'true');
      localStorage.setItem('astrocare_onboarding_profile', JSON.stringify(profile));
    } catch {
      // ignore
    }

    if (device === 'camera') {
      get().setCameraPulseActive(true);
    }

    set({
      onboardingCompleted: true,
      onboardingProfile: profile,
    });
    get().logEvent(`ASTRONAUT_ONBOARDING_COMPLETED: Profile saved (${profile.age}y, ${profile.weight}kg), device=${device}`, 'astronaut', 'general');
    get().addToast('Astronaut biometric baseline established and saved', 'success');
  },

  toggleA11yMode: () => {
    const next = !get().a11yMode;
    set({a11yMode: next});
    if (typeof document !== 'undefined') {
      if (next) {
        document.documentElement.classList.add('a11y-mode');
        (window as unknown as {lenis?: {stop: () => void}}).lenis?.stop();
      } else {
        document.documentElement.classList.remove('a11y-mode');
        (window as unknown as {lenis?: {start: () => void}}).lenis?.start();
      }
    }
    get().addToast(`Accessibility Mode: ${next ? 'ENABLED (High-contrast, 48px targets, reduced motion)' : 'DISABLED'}`, 'info');
  },

  toggleLinkUp: () => {
    const next = !get().linkUp;
    setStoredJson('astrocare_toggle_linkUp', next);
    set({linkUp: next});
    get().logEvent(`DEEP_SPACE_LINK: ${next ? 'LINK_RESTORED' : 'LINK_DOWN_OFFLINE'}`, 'system', 'watchdog');

    if (next) {
      get().addToast('Deep space carrier restored: Initiating offline queue sync...', 'info');
      get().syncOfflineQueue();
    } else {
      get().addToast('Carrier lost: Comms hold active; check-ins queueing offline in IndexedDB', 'warn');
    }
  },

  setMissedCheckInHours: (hours) => set({missedCheckInHours: hours}),

  logMood: (crewId, phqScore, gadScore, notes) => {
    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    const id = `mood-${now}-${Math.random().toString(36).slice(2, 6)}`;
    const flagged = phqScore >= 3 || gadScore >= 3;
    const isOnline = get().linkUp;

    const entry: MoodLogEntry = {
      id,
      crewId,
      timestamp: now,
      timeStr,
      phqScore,
      gadScore,
      totalScore: phqScore + gadScore,
      flagged,
      notes,
    };

    const historyItem: WellnessCheckInItem = {
      id,
      crewId,
      timestamp: now,
      timeStr,
      type: 'mood',
      summary: `Mood Assessment: PHQ-2: ${phqScore}/6, GAD-2: ${gadScore}/6 ${flagged ? '⚠️ Flagged' : '✓ Normal'}`,
      status: isOnline ? 'synced' : 'pending',
    };

    set((s) => ({
      moodLogs: [entry, ...s.moodLogs],
      wellnessHistory: [historyItem, ...s.wellnessHistory],
      lastCheckInTimes: {...s.lastCheckInTimes, [crewId]: now},
    }));

    if (flagged) {
      set((s) => ({
        alerts: [
          {
            id: `al-mood-${now}`,
            time: timeStr,
            timestamp: now,
            crewId,
            source: 'RULE',
            severity: 'watch',
            title: 'Mood / Anxiety Screen Flagged (PHQ/GAD ≥ 3)',
            explanation: `Astronaut scored ≥ 3 on validated psychological screening. Ground behavioral health review recommended.`,
            factors: [
              {label: 'Depression / Anhedonia PHQ-2', direction: 'up', size: phqScore / 6},
              {label: 'Anxiety GAD-2', direction: 'up', size: gadScore / 6},
            ],
            confidence: 0.95,
            status: 'new',
            count: 1,
            predictionSet: ['Behavioral health strain', 'Sub-syndromal anxiety'],
            aiUnsure: false,
          },
          ...s.alerts,
        ],
      }));
    }

    if (!isOnline) {
      saveOfflineCheckIn({
        id,
        crewId,
        timestamp: now,
        timeStr,
        type: 'mood',
        summary: historyItem.summary,
        payload: entry as unknown as Record<string, unknown>,
        status: 'pending',
      }).then(() => {
        getOfflineCheckIns().then((q) => set({pendingOfflineCount: q.length}));
      });
      get().addToast('Mood check-in saved offline (Pending sync)', 'warn');
    } else {
      get().addToast('Mood check-in recorded and synced', 'success');
    }
  },

  logPain: (crewId, areas) => {
    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    const id = `pain-${now}-${Math.random().toString(36).slice(2, 6)}`;
    const isOnline = get().linkUp;

    const entry: PainLogEntry = {
      id,
      crewId,
      timestamp: now,
      timeStr,
      areas,
    };

    const maxSev = areas.reduce((max, a) => Math.max(max, a.severity), 0);
    const summaryStr = areas.length === 0
      ? 'No active pain reported'
      : `${areas.length} area(s) logged (Max severity: ${maxSev}/10)`;

    const historyItem: WellnessCheckInItem = {
      id,
      crewId,
      timestamp: now,
      timeStr,
      type: 'pain',
      summary: summaryStr,
      status: isOnline ? 'synced' : 'pending',
    };

    set((s) => ({
      painLogs: [entry, ...s.painLogs],
      wellnessHistory: [historyItem, ...s.wellnessHistory],
      lastCheckInTimes: {...s.lastCheckInTimes, [crewId]: now},
    }));

    if (maxSev >= 7) {
      set((s) => ({
        alerts: [
          {
            id: `al-pain-${now}`,
            time: timeStr,
            timestamp: now,
            crewId,
            source: 'RULE',
            severity: 'watch',
            title: 'Severe Musculoskeletal Pain Reported',
            explanation: `Astronaut logged pain severity of ${maxSev}/10 in: ${areas.map((a) => a.label).join(', ')}. Analgesic protocol indicated.`,
            factors: [{label: 'Reported severity', direction: 'up', size: maxSev / 10}],
            confidence: 0.98,
            status: 'new',
            count: 1,
            predictionSet: ['Acute lumbar disc elongation', 'Musculoskeletal strain'],
            aiUnsure: false,
          },
          ...s.alerts,
        ],
      }));
    }

    if (!isOnline) {
      saveOfflineCheckIn({
        id,
        crewId,
        timestamp: now,
        timeStr,
        type: 'pain',
        summary: summaryStr,
        payload: entry as unknown as Record<string, unknown>,
        status: 'pending',
      }).then(() => {
        getOfflineCheckIns().then((q) => set({pendingOfflineCount: q.length}));
      });
      get().addToast('Pain map entry saved offline (Pending sync)', 'warn');
    } else {
      get().addToast('Pain map entry recorded and synced', 'success');
    }
  },

  logVision: (crewId, acuityScore, amslerDistortions) => {
    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    const id = `vis-${now}-${Math.random().toString(36).slice(2, 6)}`;
    const isOnline = get().linkUp;
    const flagged = acuityScore < 0.8 || amslerDistortions > 0;

    const entry: VisionLogEntry = {
      id,
      crewId,
      timestamp: now,
      timeStr,
      acuityScore,
      amslerDistortions,
      flagged,
    };

    const summaryStr = `Visual Acuity: ${acuityScore.toFixed(1)}, Amsler: ${amslerDistortions} distorted point(s) ${flagged ? '⚠️ Flagged' : '✓ Normal'}`;

    const historyItem: WellnessCheckInItem = {
      id,
      crewId,
      timestamp: now,
      timeStr,
      type: 'vision',
      summary: summaryStr,
      status: isOnline ? 'synced' : 'pending',
    };

    set((s) => ({
      visionLogs: [entry, ...s.visionLogs],
      wellnessHistory: [historyItem, ...s.wellnessHistory],
      lastCheckInTimes: {...s.lastCheckInTimes, [crewId]: now},
    }));

    if (flagged) {
      set((s) => ({
        alerts: [
          {
            id: `al-vis-${now}`,
            time: timeStr,
            timestamp: now,
            crewId,
            source: 'RULE',
            severity: 'watch',
            title: 'Visual Acuity Drift / SANS Distortion Detected',
            explanation: `Self-check registered acuity drop (${acuityScore.toFixed(1)}) and ${amslerDistortions} Amsler grid distortion(s). Spaceflight-Associated Neuro-ocular Syndrome evaluation indicated.`,
            factors: [
              {label: 'Acuity reduction', direction: 'down', size: 1 - acuityScore},
              {label: 'Metamorphopsia grid distortion', direction: 'up', size: Math.min(1, amslerDistortions / 5)},
            ],
            confidence: 0.94,
            status: 'new',
            count: 1,
            predictionSet: ['SANS Grade 1', 'Macular fold metamorphopsia'],
            aiUnsure: false,
          },
          ...s.alerts,
        ],
      }));
    }

    if (!isOnline) {
      saveOfflineCheckIn({
        id,
        crewId,
        timestamp: now,
        timeStr,
        type: 'vision',
        summary: summaryStr,
        payload: entry as unknown as Record<string, unknown>,
        status: 'pending',
      }).then(() => {
        getOfflineCheckIns().then((q) => set({pendingOfflineCount: q.length}));
      });
      get().addToast('Vision check-in saved offline (Pending sync)', 'warn');
    } else {
      get().addToast('Vision self-check logged and synced', 'success');
    }
  },

  logDose: (crewId, medName, dose) => {
    const state = get();
    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    const isOnline = state.linkUp;

    const minIntervals: Record<string, number> = {
      'Paracetamol 500mg': 4 * 3600 * 1000,
      'Ibuprofen 400mg': 6 * 3600 * 1000,
      'Promethazine 25mg': 8 * 3600 * 1000,
      'Zolpidem 10mg': 24 * 3600 * 1000,
      'Ciprofloxacin 500mg': 12 * 3600 * 1000,
      'Aspirin 100mg': 24 * 3600 * 1000,
      'Calcium Carbonate': 4 * 3600 * 1000,
    };

    const interval = minIntervals[medName] || 4 * 3600 * 1000;
    const lastDose = state.doseLogs.find(
      (d) => d.crewId === crewId && d.medicationName === medName && d.status === 'administered',
    );

    if (lastDose && now - lastDose.timestamp < interval) {
      const waitHours = ((interval - (now - lastDose.timestamp)) / 3600000).toFixed(1);
      const blockedEntry: DoseLogEntry = {
        id: `dose-blocked-${now}`,
        crewId,
        timestamp: now,
        timeStr,
        medicationName: medName,
        dose,
        status: 'blocked',
        notes: `Blocked: Minimum interval not elapsed. Wait ${waitHours}h.`,
      };
      set((s) => ({doseLogs: [blockedEntry, ...s.doseLogs]}));
      get().addToast(`DOUBLE-DOSE GUARD: ${medName} was administered recently. Wait ${waitHours}h before next dose.`, 'warn');
      return {success: false, reason: `Double-dose guard: ${medName} given within minimum interval. Wait ${waitHours}h.`};
    }

    const item = state.kitInventory.find((k) => k.name === medName);
    if (!item || item.quantity <= 0) {
      get().addToast(`STOCK ERROR: Zero inventory remaining for ${medName}`, 'warn');
      return {success: false, reason: `Stock empty: Zero units of ${medName} available.`};
    }

    const nextQty = item.quantity - 1;
    const updatedKit = state.kitInventory.map((k) => (k.id === item.id ? {...k, quantity: nextQty} : k));

    const doseEntry: DoseLogEntry = {
      id: `dose-${now}`,
      crewId,
      timestamp: now,
      timeStr,
      medicationName: medName,
      dose,
      status: 'administered',
    };

    const historyItem: WellnessCheckInItem = {
      id: doseEntry.id,
      crewId,
      timestamp: now,
      timeStr,
      type: 'dose',
      summary: `Administered: ${medName} (${dose})`,
      status: isOnline ? 'synced' : 'pending',
    };

    let newAlerts = state.alerts;
    if (nextQty <= item.minThreshold) {
      newAlerts = [
        {
          id: `al-stock-${now}`,
          time: timeStr,
          timestamp: now,
          source: 'CABIN',
          severity: nextQty <= 2 ? 'critical' : 'watch',
          title: `Kit Low Stock Alert: ${medName}`,
          explanation: `Remaining stock is ${nextQty} ${item.unit} (minimum safe buffer is ${item.minThreshold}). Replenishment required.`,
          factors: [{label: 'Depleted buffer', direction: 'down', size: 0.9}],
          confidence: 1.0,
          status: 'new',
          count: 1,
        },
        ...newAlerts,
      ];
      get().addToast(`LOW STOCK: ${medName} has only ${nextQty} ${item.unit} left!`, 'warn');
    }

    set((s) => ({
      kitInventory: updatedKit,
      doseLogs: [doseEntry, ...s.doseLogs],
      wellnessHistory: [historyItem, ...s.wellnessHistory],
      alerts: newAlerts,
      lastCheckInTimes: {...s.lastCheckInTimes, [crewId]: now},
    }));

    if (!isOnline) {
      saveOfflineCheckIn({
        id: doseEntry.id,
        crewId,
        timestamp: now,
        timeStr,
        type: 'dose',
        summary: historyItem.summary,
        payload: doseEntry as unknown as Record<string, unknown>,
        status: 'pending',
      }).then(() => {
        getOfflineCheckIns().then((q) => set({pendingOfflineCount: q.length}));
      });
      get().addToast(`Dose recorded offline in IndexedDB (Pending sync)`, 'warn');
    } else {
      get().addToast(`Dose logged: 1 unit of ${medName} administered`, 'success');
    }

    return {success: true};
  },

  importKitCSV: (csvText) => {
    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) {
        return {success: false, count: 0, error: 'CSV must contain at least a header and 1 data row.'};
      }

      const newItems: KitItem[] = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const [name, category, qtyStr, unit, minStr, expiry] = line.split(',').map((s) => s.trim());
        if (!name) continue;

        const cat = (['Analgesic', 'Antibiotic', 'Anti-emetic', 'Sedative', 'Trauma', 'Respiratory', 'Antacid'].includes(category)
          ? category
          : 'Analgesic') as KitItem['category'];

        newItems.push({
          id: `kit-csv-${Date.now()}-${i}`,
          name,
          category: cat,
          quantity: parseInt(qtyStr, 10) || 10,
          unit: unit || 'units',
          minThreshold: parseInt(minStr, 10) || 5,
          expiryDate: expiry || '2028-12-31',
        });
      }

      if (newItems.length === 0) {
        return {success: false, count: 0, error: 'No valid medication rows found in CSV.'};
      }

      set((s) => ({kitInventory: [...newItems, ...s.kitInventory]}));
      get().addToast(`Successfully imported ${newItems.length} medication items into kit`, 'success');
      return {success: true, count: newItems.length};
    } catch {
      return {success: false, count: 0, error: 'Failed to parse CSV string.'};
    }
  },

  syncOfflineQueue: async () => {
    try {
      const pending = await getOfflineCheckIns();
      if (pending.length === 0) {
        set({pendingOfflineCount: 0});
        return 0;
      }

      const pendingIds = new Set(pending.map((p) => p.id));
      set((s) => ({
        checkIns: s.checkIns.map((c) => (pendingIds.has(c.id) ? {...c, status: 'synced' as const} : c)),
        wellnessHistory: s.wellnessHistory.map((w) => (pendingIds.has(w.id) ? {...w, status: 'synced' as const} : w)),
        pendingOfflineCount: 0,
      }));

      await clearAllOfflineCheckIns();
      get().addToast(`Synced ${pending.length} offline check-in records to Earth ground log`, 'success');
      get().logEvent(`OFFLINE_SYNC_COMPLETE: Flushed ${pending.length} cached records from IndexedDB`, 'system', 'general');
      return pending.length;
    } catch {
      return 0;
    }
  },

  // --- Batch D Clinical Notes (F099) ---
  draftSoapTemplate: (crewId) => {
    const state = get();
    const member = state.crew.find((c) => c.id === crewId) || state.crew[0];
    const lastCi = state.wellnessHistory.find((w) => w.crewId === crewId);
    const activeAls = state.alerts.filter((a) => a.crewId === crewId && a.status !== 'resolved');
    const latestHr = member.readings.hr.slice(-1)[0]?.value ?? member.baseline.hr;
    const latestSpo2 = member.readings.spo2.slice(-1)[0]?.value ?? member.baseline.spo2;
    const latestTemp = member.readings.temp.slice(-1)[0]?.value ?? member.baseline.temp;
    const latestHrv = member.readings.hrv.slice(-1)[0]?.value ?? member.baseline.hrv;
    const latestResp = member.readings.resp.slice(-1)[0]?.value ?? member.baseline.resp;

    return {
      subjective: `Astronaut ${member.name} reports status nominal for interplanetary transit. Last check-in record: ${lastCi?.summary || 'Routine self-check completed'}. No acute cephalad headache or severe spinal pain reported.`,
      objective: `Telemetry Summary: Resting HR ${Math.round(latestHr)} bpm (baseline ${member.baseline.hr}), SpO2 ${Math.round(latestSpo2)}%, Temp ${latestTemp.toFixed(1)}°C, Resp ${Math.round(latestResp)} br/min, HRV ${Math.round(latestHrv)} ms. Active unresolved alerts: ${activeAls.length} (${activeAls.map((a) => a.title).join(', ') || 'None'}). Deep-space link: ${state.linkUp ? 'Nominal' : 'Offline'}.`,
      assessment: activeAls.length > 0
        ? `Biomarker drift detected (${activeAls.map((a) => a.title).join('; ')}). Cardiovascular stability maintained within secondary threshold boundaries.`
        : `Nominal microgravity physiological adaptation. Autonomic tone index stable. Clinical risk score low.`,
      plan: `1. Continue prescribed countermeasure exercise session (Cycle Ergometer 45 min).\n2. Oral hydration protocol: 500 mL electrolyte solution at 18:00.\n3. Maintain routine 24h wellness check-in schedule.\n4. Await terrestrial telemedicine consult verification.`,
    };
  },

  saveNote: (crewId, author, subjective, objective, assessment, plan) => {
    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    const state = get();
    const existing = state.notes[crewId] || [];
    const nextVer = existing.length + 1;

    const newVersion: NoteVersion = {
      version: nextVer,
      timestamp: now,
      timeStr: `Sol 142 · ${timeStr}`,
      author,
      subjective,
      objective,
      assessment,
      plan,
    };

    set((s) => ({
      notes: {
        ...s.notes,
        [crewId]: [newVersion, ...(s.notes[crewId] || [])],
      },
    }));

    get().logEvent(`SOAP_NOTE_SAVED: Version ${nextVer} for ${crewId} saved by ${author}`, author, 'note');
    get().addToast(`SOAP Note v${nextVer} saved for ${crewId}`, 'success');
    bridgeSaveSoapNote(crewId, author, subjective, objective, assessment, plan, `note-${crewId}-${nextVer}`).catch(() => {});
  },

  restoreNoteVersion: (crewId, version) => {
    const list = get().notes[crewId] || [];
    const found = list.find((n) => n.version === version);
    if (found) {
      get().logEvent(`SOAP_NOTE_RESTORED: Restored version ${version} for ${crewId}`, get().role || 'operator', 'note');
      get().addToast(`Restored SOAP Note version ${version}`, 'info');
      return found;
    }
    return null;
  },

  // --- Batch D Orders (F100) ---
  composeOrder: (targetCrewId, type, text, composedBy) => {
    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    const state = get();
    const oneWaySec = MODES[state.mode].delaySec;
    const latencyMs = (oneWaySec * 1000) / state.timeScale;

    const newOrder: CrewOrder = {
      id: `ord-${now}-${Math.random().toString(36).slice(2, 5)}`,
      type,
      text,
      targetCrewId,
      composedBy,
      composedAt: now,
      timeStr,
      deliverAt: now + latencyMs,
      status: state.linkUp ? 'in-flight' : 'queued',
    };

    set((s) => ({orders: [newOrder, ...s.orders]}));
    get().logEvent(`ORDER_DISPATCHED: [${type.toUpperCase()}] to ${targetCrewId}: ${text.slice(0, 45)}`, composedBy, 'order');
    get().addToast(`Directive dispatched to ${targetCrewId} (${Math.round(oneWaySec / 60)}m latency delay)`, 'info');
    bridgeSaveOrder(newOrder).catch(() => {});
  },

  acknowledgeOrder: (orderId, astronautName) => {
    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    const state = get();
    const oneWaySec = MODES[state.mode].delaySec;

    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'acknowledged' as const,
              ackAt: now,
              ackTimeStr: timeStr,
              ackAstronautName: astronautName,
            }
          : o
      ),
    }));

    get().logEvent(`ORDER_ACKNOWLEDGED: Order ${orderId} acknowledged by ${astronautName}`, astronautName, 'order');
    get().addToast(`Acknowledged directive ${orderId}. Confirmation transmitted to Flight Surgeon (${Math.round(oneWaySec / 60)}m delay)`, 'success');
  },

  rejectOrder: (orderId, astronautName, reason = 'Clinical or operational constraint') => {
    const now = Date.now();
    const state = get();
    const oneWaySec = MODES[state.mode].delaySec;

    set((s) => ({
      orders: s.orders.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: 'rejected' as const,
              rejectAt: now,
              rejectAstronautName: astronautName,
              rejectReason: reason,
            }
          : o
      ),
    }));

    get().logEvent(`ORDER_DECLINED: Order ${orderId} marked cannot comply by ${astronautName}: ${reason}`, astronautName, 'order');
    get().addToast(`Directive ${orderId} marked cannot comply (${reason}). Telemetry receipt dispatched to Flight Surgeon (${Math.round(oneWaySec / 60)}m delay)`, 'warn');
  },

  // --- Batch D Broadcasts (F115) ---
  sendBroadcast: (title, message, priority, sentBy) => {
    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    const state = get();
    const oneWaySec = MODES[state.mode].delaySec;
    const latencyMs = (oneWaySec * 1000) / state.timeScale;

    const newBroadcast: BroadcastMessage = {
      id: `bc-${now}-${Math.random().toString(36).slice(2, 5)}`,
      title,
      message,
      priority,
      sentBy,
      sentAt: now,
      deliverAt: now + latencyMs,
      timeStr,
      status: state.linkUp ? 'in-flight' : 'in-flight',
      readReceipts: [],
    };

    set((s) => ({broadcasts: [newBroadcast, ...s.broadcasts]}));
    get().logEvent(`BROADCAST_SENT: [${priority.toUpperCase()}] ${title}`, sentBy, 'general');
    get().addToast(`Broadcast dispatched to all crew modules`, 'info');
    bridgeSaveBroadcast(newBroadcast).catch(() => {});
  },

  markBroadcastRead: (broadcastId, crewId, crewName) => {
    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});

    set((s) => ({
      broadcasts: s.broadcasts.map((b) => {
        if (b.id !== broadcastId) return b;
        if (b.readReceipts.some((r) => r.crewId === crewId)) return b;
        return {
          ...b,
          readReceipts: [...b.readReceipts, {crewId, name: crewName, readAt: now, readTimeStr: timeStr}],
        };
      }),
    }));

    get().logEvent(`BROADCAST_READ: ${crewName} acknowledged broadcast ${broadcastId}`, crewName, 'general');
    get().addToast(`Broadcast acknowledged by ${crewName}`, 'success');
  },

  // --- Batch D False-Alarm Feedback (F050) ---
  recordFeedback: (alertId, isTrueAlert) => {
    const state = get();
    const alert = state.alerts.find((a) => a.id === alertId);
    const crewId = alert?.crewId || state.selectedCrewId || 'vega';
    const currentSigma = state.crewSigmaThresholds[crewId] ?? 3.0;
    const counts = state.feedbackCounts[crewId] || {trueCount: 0, falseCount: 0};

    let nextSigma = currentSigma;
    if (isTrueAlert) {
      nextSigma = Math.max(2.5, +(currentSigma - 0.1).toFixed(2));
      counts.trueCount++;
    } else {
      nextSigma = Math.min(4.5, +(currentSigma + 0.25).toFixed(2));
      counts.falseCount++;
    }

    set((s) => ({
      crewSigmaThresholds: {...s.crewSigmaThresholds, [crewId]: nextSigma},
      feedbackCounts: {...s.feedbackCounts, [crewId]: counts},
      alerts: s.alerts.map((a) => (a.id === alertId ? {...a, status: 'ack' as const} : a)),
    }));

    get().logEvent(`FEEDBACK_${isTrueAlert ? 'TRUE' : 'FALSE'}: Alert ${alertId} (${crewId}) adjusted sigma to ${nextSigma}σ`, get().role || 'surgeon', 'alert');
    get().addToast(
      isTrueAlert
        ? `True alert confirmed for ${crewId} (threshold lowered to ${nextSigma}σ)`
        : `False alarm suppressed for ${crewId} (threshold raised to ${nextSigma}σ)`,
      'info'
    );
  },

  replayLastHour: (crewId) => {
    const state = get();
    const member = state.crew.find((c) => c.id === crewId) || state.crew[0];
    const currentSigma = state.crewSigmaThresholds[crewId] ?? 3.0;

    const recentHr = member.readings.hr.slice(-60);
    const baseline = member.baseline.hr;
    const baseSigma = 4.0;

    let beforeFires = 0;
    let nowFires = 0;

    recentHr.forEach((r) => {
      const dev = Math.abs(r.value - baseline);
      if (dev > 3.0 * baseSigma) beforeFires++;
      if (dev > currentSigma * baseSigma) nowFires++;
    });

    get().addToast(`Replay complete: ${nowFires} alert triggers at ${currentSigma}σ vs ${beforeFires} at nominal 3.0σ`, 'info');
    return {beforeFires, nowFires, currentSigma};
  },

  // --- Batch D Medical Officer Designation (F066) ---
  designateMedicalOfficer: (crewId) => {
    const member = get().crew.find((c) => c.id === crewId);
    set({medicalOfficerCrewId: crewId});
    get().logEvent(`MEDICAL_OFFICER_DESIGNATED: ${member?.name || crewId} granted Crew Medical Officer (CMO) credentials`, 'surgeon', 'cmo');
    get().addToast(`Designated ${member?.name || crewId} as Crew Medical Officer (CMO)`, 'success');
  },

  revokeMedicalOfficer: () => {
    const prevCmo = get().medicalOfficerCrewId;
    set({medicalOfficerCrewId: null});
    get().logEvent(`MEDICAL_OFFICER_REVOKED: Credentials withdrawn from ${prevCmo}`, 'surgeon', 'cmo');
    get().addToast(`Revoked Crew Medical Officer designation`, 'warn');
  },

  // --- Batch D Feature Flags & Backup (F141, F128) ---
  toggleMlAlerts: () => {
    const next = !get().mlAlertsEnabled;
    setStoredJson('astrocare_toggle_mlAlertsEnabled', next);
    set({mlAlertsEnabled: next});
    get().addToast(`ML Anomaly Engine: ${next ? 'ONLINE' : 'OFF (Deterministic Rules Only)'}`, next ? 'info' : 'warn');
  },

  setAssistantMode: (mode) => {
    setStoredJson('astrocare_toggle_assistantMode', mode);
    set({assistantMode: mode});
    get().addToast(`Assistant Engine Mode set to ${mode.toUpperCase()}`, 'info');
  },

  toggleWaitOrAct: () => {
    const next = !get().waitOrActEnabled;
    setStoredJson('astrocare_toggle_waitOrActEnabled', next);
    set({waitOrActEnabled: next});
    get().addToast(`Wait-or-Act Operational Engine: ${next ? 'ACTIVE' : 'BYPASSED'}`, 'info');
  },

  exportStateJson: () => {
    const state = get();
    const exportBundle = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      mode: state.mode,
      crew: state.crew,
      alerts: state.alerts,
      notes: state.notes,
      orders: state.orders,
      broadcasts: state.broadcasts,
      messages: state.messages,
      eventLog: state.eventLog,
      checkIns: state.checkIns,
      kitInventory: state.kitInventory,
      moodLogs: state.moodLogs,
      painLogs: state.painLogs,
      visionLogs: state.visionLogs,
      wellnessHistory: state.wellnessHistory,
      crewSigmaThresholds: state.crewSigmaThresholds,
      feedbackCounts: state.feedbackCounts,
      medicalOfficerCrewId: state.medicalOfficerCrewId,
      workoutLogs: state.workoutLogs,
      foodLogs: state.foodLogs,
      companionMessages: state.companionMessages,
      weeklyGoals: state.weeklyGoals,
    };
    return JSON.stringify(exportBundle, null, 2);
  },

  importStateJson: (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!parsed || !parsed.crew) {
        return {success: false, error: 'Invalid state format: missing crew entity'};
      }
      set({
        mode: parsed.mode || get().mode,
        crew: parsed.crew || get().crew,
        alerts: parsed.alerts || get().alerts,
        notes: parsed.notes || get().notes,
        orders: parsed.orders || get().orders,
        broadcasts: parsed.broadcasts || get().broadcasts,
        messages: parsed.messages || get().messages,
        eventLog: parsed.eventLog || get().eventLog,
        checkIns: parsed.checkIns || get().checkIns,
        kitInventory: parsed.kitInventory || get().kitInventory,
        moodLogs: parsed.moodLogs || get().moodLogs,
        painLogs: parsed.painLogs || get().painLogs,
        visionLogs: parsed.visionLogs || get().visionLogs,
        wellnessHistory: parsed.wellnessHistory || get().wellnessHistory,
        crewSigmaThresholds: parsed.crewSigmaThresholds || get().crewSigmaThresholds,
        feedbackCounts: parsed.feedbackCounts || get().feedbackCounts,
        medicalOfficerCrewId: parsed.medicalOfficerCrewId || get().medicalOfficerCrewId,
        workoutLogs: parsed.workoutLogs || get().workoutLogs,
        foodLogs: parsed.foodLogs || get().foodLogs,
        companionMessages: parsed.companionMessages || get().companionMessages,
        weeklyGoals: parsed.weeklyGoals || get().weeklyGoals,
      });
      get().logEvent('STATE_RESTORED: Imported snapshot into active console memory', 'operator', 'general');
      get().addToast('Console state snapshot restored successfully', 'success');
      return {success: true};
    } catch {
      return {success: false, error: 'Failed to parse JSON string'};
    }
  },

  // --- Batch E Actions ---
  logWorkout: (entry) => {
    const now = Date.now();
    const timeStr = `Sol 142 · ${new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}`;
    const newEntry: WorkoutLogEntry = {
      ...entry,
      id: `w-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeStr,
    };
    set((s) => ({
      workoutLogs: [newEntry, ...s.workoutLogs],
      lastCheckInTimes: {...s.lastCheckInTimes, [entry.crewId]: now},
    }));
    get().addToast(`Workout logged: ${entry.minutes}m ${entry.type} (Intensity ${entry.intensity}/10)`, 'success');
    get().logEvent(`WORKOUT_LOGGED: ${entry.crewId} completed ${entry.minutes}m ${entry.type}`, entry.crewId, 'general');
  },

  logFood: (entry) => {
    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    const newEntry: FoodLogEntry = {
      ...entry,
      id: `f-${now}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now,
      timeStr,
    };
    set((s) => ({
      foodLogs: [newEntry, ...s.foodLogs],
    }));
    get().addToast(`Nutrition logged: ${entry.name} (${entry.kcal} kcal, ${entry.fluid} mL)`, 'success');
    get().logEvent(`NUTRITION_LOGGED: ${entry.crewId} logged ${entry.name}`, entry.crewId, 'general');
  },

  sendCompanionMessage: (text) => {
    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
    const userMsg: CompanionMessage = {
      id: `cm-${now}`,
      sender: 'crew',
      text,
      timestamp: now,
      timeStr,
    };

    const {reply, isCrisis} = getCompanionResponse(text);
    const compMsg: CompanionMessage = {
      id: `cm-${now + 1}`,
      sender: 'companion',
      text: reply,
      timestamp: now + 400,
      timeStr,
      isCrisis,
    };

    set((s) => ({
      companionMessages: [...s.companionMessages, userMsg, compMsg],
    }));

    if (isCrisis) {
      const alertId = `crisis-${now}`;
      set((s) => ({
        alerts: [
          {
            id: alertId,
            time: timeStr,
            timestamp: now,
            crewId: 'vega',
            source: 'AI',
            severity: 'critical',
            title: 'Crisis Flag — Autonomous Companion Escalation',
            explanation: 'Astronaut companion dialog triggered crisis sentiment threshold. Ground flight surgeon informed immediately.',
            factors: [{label: 'Crisis sentiment index', direction: 'up', size: 0.99}],
            confidence: 0.99,
            status: 'new',
            count: 1,
            predictionSet: ['Acute psychological crisis', 'Severe depression / self-harm intent'],
            aiUnsure: false,
          },
          ...s.alerts,
        ],
      }));
      get().logEvent('CRISIS_INDICATOR: Companion detected high-risk phrase. Alert dispatched to Dr. Priya Nair.', 'companion', 'emergency');
      get().addToast("I'm concerned about you. I'm letting your flight surgeon know.", 'warn');
    }
  },

  toggleWeeklyGoal: (id) => {
    set((s) => ({
      weeklyGoals: s.weeklyGoals.map((g) => (g.id === id ? {...g, completed: !g.completed} : g)),
    }));
  },

  updateWeeklyGoalText: (id, text) => {
    set((s) => ({
      weeklyGoals: s.weeklyGoals.map((g) => (g.id === id ? {...g, text} : g)),
    }));
  },

  startCO2Leak: () => {
    setStoredJson('astrocare_toggle_scenario_co2Leak', true);
    set((s) => ({
      scenarios: {...s.scenarios, co2Leak: {active: true, elapsed: 0, earlyWarningFired: false}},
    }));
    get().addIncident({
      title: 'Atmospheric Scrubber Loop CO2 Leak',
      severity: 0.88,
      timeToCritical: 25,
      crewId: 'vega',
    });
    get().logEvent('SCENARIO: CO2 leak ramp started', 'simulation', 'scenario');
  },

  toggleCO2Leak: () => {
    const isCurrentlyActive = get().scenarios.co2Leak.active;
    if (isCurrentlyActive) {
      setStoredJson('astrocare_toggle_scenario_co2Leak', false);
      set((s) => ({
        scenarios: {...s.scenarios, co2Leak: {active: false, elapsed: 0, earlyWarningFired: false}},
        cabin: {...s.cabin, co2: 820},
      }));
      get().logEvent('SCENARIO: CO2 leak stopped', 'simulation', 'scenario');
      get().addToast('CO2 leak resolved — Hab atmosphere nominal', 'success');
    } else {
      get().startCO2Leak();
      get().addToast('CO2 leak scenario active (+40ppm/s ramp)', 'warn');
    }
  },

  startSolarEvent: () => {
    setStoredJson('astrocare_toggle_scenario_solarEvent', true);
    set((s) => ({
      scenarios: {...s.scenarios, solarEvent: {active: true, elapsed: 0}},
    }));
    get().addIncident({
      title: 'Solar Particle Event Flux Surge',
      severity: 0.95,
      timeToCritical: 8,
    });
    get().logEvent('SCENARIO: Solar particle event spike started', 'simulation', 'scenario');
  },

  toggleSolarEvent: () => {
    const isCurrentlyActive = get().scenarios.solarEvent.active;
    if (isCurrentlyActive) {
      setStoredJson('astrocare_toggle_scenario_solarEvent', false);
      set((s) => ({
        scenarios: {...s.scenarios, solarEvent: {active: false, elapsed: 0}},
        cabin: {
          ...s.cabin,
          radiation: {...s.cabin.radiation, dailyDose: 1.8},
        },
      }));
      get().logEvent('SCENARIO: Solar particle event normalized', 'simulation', 'scenario');
      get().addToast('Solar event cleared — Storm shelter released', 'success');
    } else {
      get().startSolarEvent();
      get().addToast('Solar event scenario active (x40 flux spike)', 'warn');
    }
  },

  startIllness: (crewId = 'okoye') => {
    setStoredJson('astrocare_toggle_scenario_illness', true);
    set((s) => ({
      scenarios: {...s.scenarios, illness: {active: true, crewId, elapsed: 0}},
    }));
    get().addIncident({
      title: `Acute Infection & Pyrexia Drift (${crewId})`,
      severity: 0.72,
      timeToCritical: 35,
      crewId,
    });
    get().logEvent(`SCENARIO: Sepsis illness progression on ${crewId}`, 'simulation', 'scenario');
  },

  toggleIllness: (crewId = 'okoye') => {
    const isCurrentlyActive = get().scenarios.illness.active;
    if (isCurrentlyActive) {
      setStoredJson('astrocare_toggle_scenario_illness', false);
      set((s) => ({
        scenarios: {...s.scenarios, illness: {active: false, crewId, elapsed: 0}},
      }));
      get().logEvent(`SCENARIO: Illness resolved on ${crewId}`, 'simulation', 'scenario');
      get().addToast(`Illness scenario cleared for ${crewId}`, 'success');
    } else {
      get().startIllness(crewId);
      get().addToast(`Astronaut illness scenario active (${crewId})`, 'warn');
    }
  },

  clearScenarios: () => {
    setStoredJson('astrocare_toggle_scenario_co2Leak', false);
    setStoredJson('astrocare_toggle_scenario_solarEvent', false);
    setStoredJson('astrocare_toggle_scenario_illness', false);
    setStoredJson('astrocare_toggle_sensorFailure', false);
    setStoredJson('astrocare_toggle_sensorDrift', false);
    setStoredJson('astrocare_toggle_commsBlackout', false);
    set({
      scenarios: {
        co2Leak: {active: false, elapsed: 0, earlyWarningFired: false},
        solarEvent: {active: false, elapsed: 0},
        illness: {active: false, crewId: 'okoye', elapsed: 0},
      },
      cabin: {
        co2: 820,
        o2: 20.9,
        pressure: 101.3,
        temp: 22.0,
        humidity: 45.0,
        radiation: {
          dailyDose: 1.8,
          cumulative: 142.8,
          limit: 1000,
        },
      },
      sensorFailure: false,
      sensorFailureElapsed: 0,
      sensorDrift: false,
      sensorDriftElapsed: 0,
      aiDegraded: false,
      aiDegradedReason: null,
      emergency: null,
      todayScenario: {
        active: false,
        personId: null,
        startWallTime: 0,
      },
      painMapMode: '3d',
    });
    get().addToast('Cleared all active emergency scenarios', 'info');
  },

  injectSensorFailure: () =>
    set((s) => {
      const next = !s.sensorFailure;
      setStoredJson('astrocare_toggle_sensorFailure', next);
      get().logEvent(`SENSOR_FAULT: Biometric sensor failure ${next ? 'INJECTED' : 'RESOLVED'}`, 'system', 'sensor');
      get().addToast(next ? 'Sensor failure injected (AI Degraded mode active)' : 'Sensor restored to nominal calibration', next ? 'warn' : 'success');
      return {
        sensorFailure: next,
        sensorFailureElapsed: 0,
        aiDegraded: next,
        aiDegradedReason: next ? 'sensor quality' : null,
      };
    }),

  injectDrift: () =>
    set((s) => {
      const next = !s.sensorDrift;
      setStoredJson('astrocare_toggle_sensorDrift', next);
      get().logEvent(`SENSOR_DRIFT: Calibration drift ${next ? 'INJECTED' : 'CALIBRATED'}`, 'system', 'sensor');
      get().addToast(next ? 'Sensor drift injected (+1.5%/min)' : 'Sensor drift calibrated', next ? 'warn' : 'success');
      return {
        sensorDrift: next,
        sensorDriftElapsed: 0,
      };
    }),

  computeRiskScore: (member: CrewMember) => {
    const hrLatest = member.readings.hr[member.readings.hr.length - 1]?.value ?? member.baseline.hr;
    const tempLatest = member.readings.temp[member.readings.temp.length - 1]?.value ?? member.baseline.temp;
    const spo2Latest = member.readings.spo2[member.readings.spo2.length - 1]?.value ?? member.baseline.spo2;
    const hrvLatest = member.readings.hrv[member.readings.hrv.length - 1]?.value ?? member.baseline.hrv;

    let score = 5;
    const hrDiff = Math.abs(hrLatest - member.baseline.hr);
    score += Math.min(35, hrDiff * 1.5);
    if (tempLatest > member.baseline.temp) {
      score += Math.min(30, (tempLatest - member.baseline.temp) * 20);
    }
    if (spo2Latest < 96) {
      score += (96 - spo2Latest) * 10;
    }
    if (hrvLatest < member.baseline.hrv) {
      score += Math.min(25, ((member.baseline.hrv - hrvLatest) / member.baseline.hrv) * 35);
    }
    return Math.min(100, Math.round(score));
  },

  tick: () => {
    const state = get();
    const now = Date.now();
    const timeStr = new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});
    const tCount = state.tickCount + 1;

    // 0. Advance Mars full story timeline if running
    let storyRun = state.storyRunning;
    const storyP = state.storyPaused;
    let storyStep = state.storyStepIndex;
    let storySec = state.storyElapsedSec;

    if (storyRun && !storyP) {
      storySec += 1;
      const nextStep = STORY_STEPS[storyStep + 1];
      if (nextStep && storySec >= nextStep.atSec) {
        storyStep += 1;
        nextStep.run(get());
      } else if (storySec >= 480) {
        storyRun = false;
      }
    }

    // 1. Advance comms messages, orders, and broadcasts
    const oneWaySec = MODES[state.mode].delaySec;
    const latencyMs = (oneWaySec * 1000) / state.timeScale;
    let newMessages = [...state.messages];
    let newOrders = [...state.orders];
    let newBroadcasts = [...state.broadcasts];

    if (!state.commsBlackout && state.linkUp) {
      // Advance in-flight messages
      newMessages = newMessages.map((msg) => {
        if (msg.status === 'in-flight' && now >= msg.deliverAt) {
          return {...msg, status: 'delivered' as const};
        }
        return msg;
      });

      // Advance in-flight orders (F100)
      newOrders = newOrders.map((ord) => {
        if (ord.status === 'in-flight' && now >= ord.deliverAt) {
          return {...ord, status: 'delivered' as const};
        }
        if (ord.status === 'queued') {
          return {...ord, status: 'in-flight' as const, deliverAt: now + latencyMs};
        }
        return ord;
      });

      // Advance in-flight broadcasts (F115)
      newBroadcasts = newBroadcasts.map((bc) => {
        if (bc.status === 'in-flight' && now >= bc.deliverAt) {
          return {...bc, status: 'delivered' as const};
        }
        return bc;
      });

      // Automated ground replies
      const needsReply = newMessages.find(
        (m) => m.from === 'crew' && m.status === 'delivered' && !m.replyScheduled,
      );
      if (needsReply) {
        needsReply.replyScheduled = true;
        const replyText =
          needsReply.kind === 'consult'
            ? `Ground medical director acknowledges telemetry packet. Recommendation: Maintain conservative observation, verify secondary vitals loop.`
            : needsReply.kind === 'order'
            ? `Flight Operations confirms receipt. Directive approved for local execution.`
            : `Mission Control confirms telemetry report logged to mission archive.`;

        const replyMsg: Message = {
          id: `msg-reply-${now}`,
          from: 'ground',
          text: replyText,
          kind: 'order',
          sentAt: now,
          deliverAt: now + latencyMs,
          status: 'in-flight',
        };
        newMessages.unshift(replyMsg);
      }
    }

    // 2. Watchdog
    let aiDeg = state.aiDegraded;
    let aiReason = state.aiDegradedReason;
    let sFailElapsed = state.sensorFailureElapsed;
    let sDriftElapsed = state.sensorDriftElapsed;

    if (!state.mlAlertsEnabled) {
      aiDeg = true;
      aiReason = 'ML engine disabled in demo settings';
    } else if (state.sensorFailure) {
      sFailElapsed++;
      if (sFailElapsed >= 10 && !aiDeg) {
        aiDeg = true;
        aiReason = 'sensor quality';
        get().logEvent('WATCHDOG: AI anomaly engine degraded — reason: sensor quality flatline', 'system', 'watchdog');
        get().addToast('AI degraded: rules only (reason: sensor quality)', 'warn');
      }
    } else if (state.sensorDrift) {
      sDriftElapsed++;
      if (sDriftElapsed >= 10 && !aiDeg) {
        aiDeg = true;
        aiReason = 'input drift';
        get().logEvent('WATCHDOG: AI anomaly engine degraded — reason: input drift divergence', 'system', 'watchdog');
        get().addToast('AI degraded: rules only (reason: input drift)', 'warn');
      }
    }

    // 3. Advance scenarios
    let {co2Leak, solarEvent, illness} = state.scenarios;
    let co2Val = state.cabin.co2;
    let radDaily = MODES[state.mode].radiation;
    let radCumulative = state.cabin.radiation.cumulative;

    if (co2Leak.active) {
      co2Leak = {...co2Leak, elapsed: co2Leak.elapsed + 1};
      co2Val = Math.min(4500, co2Val + 40);
    } else if (co2Val > 820) {
      co2Val = Math.max(820, co2Val - 25);
    }

    if (solarEvent.active) {
      solarEvent = {...solarEvent, elapsed: solarEvent.elapsed + 1};
      radDaily = MODES[state.mode].radiation * 40;
      radCumulative += (radDaily / 86400) * 10;
      if (solarEvent.elapsed >= 60) {
        solarEvent = {active: false, elapsed: 0};
      }
    } else {
      radCumulative += radDaily / 86400;
    }

    if (illness.active) {
      illness = {...illness, elapsed: illness.elapsed + 1};
    }

    // 4. Process crew telemetry
    const newCrew = state.crew.map((member) => {
      const isIll = illness.active && illness.crewId === member.id;
      const t = tCount;

      const sinHr = Math.sin(t * 0.08) * 3;
      const sinResp = Math.sin(t * 0.12) * 1;
      const sinHrv = Math.cos(t * 0.05) * 4;
      const noise = (Math.random() - 0.5) * 2;

      let hr = member.baseline.hr + sinHr + noise * 1.5;
      let spo2 = member.baseline.spo2 - Math.max(0, noise * 0.4);
      let temp = member.baseline.temp + Math.sin(t * 0.03) * 0.08 + noise * 0.02;
      let resp = member.baseline.resp + sinResp + noise * 0.5;
      let hrv = member.baseline.hrv + sinHrv + noise * 2;
      let bpSys = member.baseline.bpSys + sinHr * 1.2;
      let bpDia = member.baseline.bpDia + sinHr * 0.8;

      if (isIll) {
        const el = illness.elapsed;
        hr += Math.min(28, el * 1);
        temp = Math.min(38.4, temp + el * 0.03);
        hrv = Math.max(20, hrv - el * 1);
        resp += Math.min(6, el * 0.2);
        spo2 -= Math.min(4, el * 0.15);
      }

      if (co2Leak.active && co2Leak.elapsed > 20) {
        const co2Excess = (co2Val - 800) / 1000;
        hrv = Math.max(15, hrv - co2Excess * 8);
        resp = resp + Math.min(8, (co2Leak.elapsed - 20) * 0.25);
        spo2 = Math.max(92, spo2 - co2Excess * 0.8);
      }

      if (state.sensorDrift && member.id === 'vega') {
        hr += (t % 100) * 0.4;
      }
      if (state.sensorFailure && member.id === 'tanaka') {
        hr = 0;
      }

      const hrProv: 'SIMULATED' | 'REAL' =
        member.id === 'vega' && state.cameraPulseActive ? 'REAL' : 'SIMULATED';

      if (member.id === 'vega' && state.cameraPulseActive && state.liveCameraBpm) {
        hr = state.liveCameraBpm;
      }

      const append = (arr: MetricReading[], val: number, p: 'SIMULATED' | 'REAL' = 'SIMULATED') => {
        const next = [...arr, {time: now, value: +val.toFixed(val % 1 !== 0 ? 2 : 0), provenance: p}];
        return next.length > 300 ? next.slice(-300) : next;
      };

      const deviating = {...member.deviatingTicks};
      const sigmaThreshold = state.crewSigmaThresholds[member.id] || 3.0;

      const checkDev = (key: string, current: number, base: number, sigma: number) => {
        if (Math.abs(current - base) > sigmaThreshold * sigma) {
          deviating[key] = (deviating[key] || 0) + 1;
        } else {
          deviating[key] = 0;
        }
      };

      checkDev('hr', hr, member.baseline.hr, 4);
      checkDev('temp', temp, member.baseline.temp, 0.2);
      checkDev('spo2', spo2, member.baseline.spo2, 1);
      checkDev('hrv', hrv, member.baseline.hrv, 6);

      return {
        ...member,
        deviatingTicks: deviating,
        readings: {
          hr: append(member.readings.hr, hr, hrProv),
          spo2: append(member.readings.spo2, Math.min(100, spo2), 'SIMULATED'),
          temp: append(member.readings.temp, temp, 'SIMULATED'),
          resp: append(member.readings.resp, resp, 'SIMULATED'),
          hrv: append(member.readings.hrv, hrv, 'SIMULATED'),
          bpSys: append(member.readings.bpSys, bpSys, 'SIMULATED'),
          bpDia: append(member.readings.bpDia, bpDia, 'SIMULATED'),
        },
      };
    });

    // 5. Alert Generation & Confidence/AI UNSURE (F048, X04)
    let newAlerts = [...state.alerts];
    const addAlert = (alertCandidate: Omit<Alert, 'id' | 'time' | 'timestamp' | 'status' | 'count'>) => {
      // Escalation if AI Unsure (predictionSet > 1 or confidence < 0.55)
      let severity = alertCandidate.severity;
      let aiUnsure = alertCandidate.aiUnsure;
      if (
        alertCandidate.source === 'AI' &&
        (alertCandidate.confidence < 0.55 || (alertCandidate.predictionSet && alertCandidate.predictionSet.length > 1))
      ) {
        aiUnsure = true;
        if (severity === 'info') severity = 'watch';
        else if (severity === 'watch') severity = 'critical';
      }

      const existingIdx = newAlerts.findIndex(
        (a) =>
          a.crewId === alertCandidate.crewId &&
          a.title === alertCandidate.title &&
          a.status !== 'resolved' &&
          now - a.timestamp < 60000,
      );

      if (existingIdx >= 0) {
        newAlerts[existingIdx] = {
          ...newAlerts[existingIdx],
          count: newAlerts[existingIdx].count + 1,
          timestamp: now,
          time: timeStr,
          explanation: alertCandidate.explanation,
          severity,
          aiUnsure,
        };
      } else {
        newAlerts.unshift({
          ...alertCandidate,
          severity,
          aiUnsure,
          id: `al-${now}-${Math.random().toString(36).slice(2, 6)}`,
          time: timeStr,
          timestamp: now,
          status: 'new',
          count: 1,
        });
        if (newAlerts.length > 200) {
          newAlerts = newAlerts.slice(0, 200);
        }
      }
    };

    if (co2Leak.active && !co2Leak.earlyWarningFired && co2Val > 1800) {
      const meanHrv = newCrew.reduce((acc, c) => acc + (c.readings.hrv.slice(-1)[0]?.value ?? c.baseline.hrv), 0) / newCrew.length;
      const baseHrv = newCrew.reduce((acc, c) => acc + c.baseline.hrv, 0) / newCrew.length;
      if (meanHrv < baseHrv * 0.9) {
        co2Leak.earlyWarningFired = true;
        addAlert({
          source: 'AI',
          severity: 'watch',
          title: 'Cabin exposure starting to affect crew',
          explanation: 'Subtle autonomic depression detected across crew HRV vectors. Flagged 90 s before the first reported symptom.',
          factors: [
            {label: 'Atmospheric CO2', direction: 'up', size: 0.76},
            {label: 'Autonomic HRV', direction: 'down', size: 0.82},
          ],
          confidence: 0.52, // Under 0.55 triggers AI UNSURE escalation
          predictionSet: ['Hypercapnia prodrome', 'Hypoxic autonomic drift'],
        });
      }
    }

    if (co2Val > 3500) {
      addAlert({
        source: 'CABIN',
        severity: 'critical',
        title: 'Atmospheric CO2 Emergency',
        explanation: `Cabin scrubbers overloaded. Partial pressure CO2 reached ${Math.round(co2Val)} ppm. Hypercapnia imminent.`,
        factors: [
          {label: 'CO2 level', direction: 'up', size: 0.95},
          {label: 'Scrubber efficiency', direction: 'down', size: 0.8},
        ],
        confidence: 0.99,
      });
    } else if (co2Val > 2000) {
      addAlert({
        source: 'CABIN',
        severity: 'watch',
        title: 'Atmospheric CO2 Elevation',
        explanation: `Cabin CO2 at ${Math.round(co2Val)} ppm exceeds 2,000 ppm nominal safety threshold.`,
        factors: [{label: 'CO2 delta', direction: 'up', size: 0.65}],
        confidence: 0.95,
      });
    }

    if (solarEvent.active && solarEvent.elapsed === 1) {
      addAlert({
        source: 'CABIN',
        severity: 'critical',
        title: 'Solar Particle Event Spike',
        explanation: 'Extreme ionizing flux detected. Dosimeter indicates radiation rate x40 above background. Immediate shelter protocol.',
        factors: [
          {label: 'Ionizing flux', direction: 'up', size: 1.0},
          {label: 'Solar flare index', direction: 'up', size: 0.9},
        ],
        confidence: 0.99,
      });
    }

    newCrew.forEach((member) => {
      const latestHr = member.readings.hr[member.readings.hr.length - 1]?.value ?? member.baseline.hr;
      const latestSpo2 = member.readings.spo2[member.readings.spo2.length - 1]?.value ?? member.baseline.spo2;
      const latestTemp = member.readings.temp[member.readings.temp.length - 1]?.value ?? member.baseline.temp;

      if (latestSpo2 < 94) {
        addAlert({
          crewId: member.id,
          source: 'RULE',
          severity: 'critical',
          title: `Hypoxemia Alert — ${member.name}`,
          explanation: `Peripheral SpO2 fell to ${latestSpo2}% (< 94% threshold). Supplemental O2 line activation recommended.`,
          factors: [{label: 'Pulse oximetry', direction: 'down', size: 0.9}],
          confidence: 0.98,
        });
      }
      if (latestHr > 110) {
        addAlert({
          crewId: member.id,
          source: 'RULE',
          severity: 'critical',
          title: `Severe Tachycardia — ${member.name}`,
          explanation: `Sustained heart rate ${Math.round(latestHr)} bpm exceeds critical threshold of 110 bpm.`,
          factors: [{label: 'Heart rate', direction: 'up', size: 0.88}],
          confidence: 0.95,
        });
      }
      if (latestTemp > 38.0) {
        addAlert({
          crewId: member.id,
          source: 'RULE',
          severity: 'watch',
          title: `Hyperthermia Warning — ${member.name}`,
          explanation: `Core temperature reached ${latestTemp.toFixed(1)}°C (> 38.0°C). Possible pathogen or pyrexia.`,
          factors: [{label: 'Core temperature', direction: 'up', size: 0.82}],
          confidence: 0.96,
        });
      }

      if (!aiDeg && state.mlAlertsEnabled) {
        Object.entries(member.deviatingTicks).forEach(([metric, count]) => {
          if (count >= 10 && count % 15 === 10) {
            let explanation = '';
            const factors: Factor[] = [];
            let conf = 0.88;
            let predSet = ['Baseline variance'];

            if (metric === 'temp') {
              explanation = `Core temperature sustained at ${latestTemp.toFixed(2)}°C (+${(latestTemp - member.baseline.temp).toFixed(2)}°C from baseline) over consecutive evaluations.`;
              factors.push({label: 'Thermistor variance', direction: 'up', size: 0.84});
              factors.push({label: 'Metabolic baseline', direction: 'up', size: 0.62});
              conf = 0.52; // Trigger AI UNSURE (under 0.55)
              predSet = ['Early infection', 'Circadian thermoregulatory drift'];
            } else if (metric === 'hr') {
              explanation = `Heart rate persistently elevated by +${Math.round(latestHr - member.baseline.hr)} bpm without concurrent accelerometer activity.`;
              factors.push({label: 'Cardiovascular tone', direction: 'up', size: 0.78});
              factors.push({label: 'Circadian phase', direction: 'down', size: 0.45});
              conf = 0.89;
              predSet = ['Deconditioning tachycardia'];
            } else if (metric === 'hrv') {
              explanation = `Autonomic stress indicator: HRV dropped to ${Math.round(member.readings.hrv.slice(-1)[0]?.value ?? 0)} ms. Sympathetic overdrive pattern detected.`;
              factors.push({label: 'Vagal tone', direction: 'down', size: 0.75});
              factors.push({label: 'Sleep deficit factor', direction: 'up', size: 0.55});
              conf = 0.54; // Trigger AI UNSURE
              predSet = ['Allostatic autonomic strain', 'Acute sleep fragmentation'];
            } else if (metric === 'spo2') {
              explanation = `Micro-desaturation episode: SpO2 dipping repeatedly below astronaut baseline.`;
              factors.push({label: 'Oxygen saturation', direction: 'down', size: 0.8});
              conf = 0.85;
              predSet = ['Microgravity fluid congestion'];
            }

            if (explanation) {
              addAlert({
                crewId: member.id,
                source: 'AI',
                severity: count > 30 ? 'critical' : 'watch',
                title: `AI Biomarker Drift — ${member.name} (${metric.toUpperCase()})`,
                explanation,
                factors,
                confidence: conf,
                predictionSet: predSet,
              });
            }
          }
        });
      }
    });

    set({
      tickCount: tCount,
      aiDegraded: aiDeg,
      aiDegradedReason: aiReason,
      sensorFailureElapsed: sFailElapsed,
      sensorDriftElapsed: sDriftElapsed,
      cabin: {
        ...state.cabin,
        co2: co2Val,
        radiation: {
          dailyDose: radDaily,
          cumulative: radCumulative,
          limit: state.cabin.radiation.limit,
        },
      },
      scenarios: {
        co2Leak,
        solarEvent,
        illness,
      },
      crew: newCrew,
      alerts: newAlerts,
      messages: newMessages,
      orders: newOrders,
      broadcasts: newBroadcasts,
      storyRunning: storyRun,
      storyPaused: storyP,
      storyStepIndex: storyStep,
      storyElapsedSec: storySec,
    });
  },
}));

if (typeof window !== 'undefined') {
  (window as unknown as {__store: typeof useStore}).__store = useStore;
}
