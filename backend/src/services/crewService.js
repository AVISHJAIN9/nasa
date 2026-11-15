import { CrewProfile } from '../models/CrewProfile.js';
import { NotFoundException } from '../middleware/errors.js';

// Mulberry32 deterministic 32-bit PRNG
export function createPrng(seed = 1) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getRandomInRange(rand, min, max, decimals = 0) {
  const val = min + rand() * (max - min);
  if (decimals === 0) return Math.round(val);
  return parseFloat(val.toFixed(decimals));
}

export async function createCrewProfile(data) {
  const profile = new CrewProfile(data);
  await profile.save();
  return profile;
}

export async function listCrewProfiles() {
  return CrewProfile.find().sort({ crew_id: 1 });
}

export async function getCrewProfile(crewId) {
  const profile = await CrewProfile.findOne({ crew_id: crewId });
  if (!profile) {
    throw new NotFoundException(`Crew profile '${crewId}' not found`);
  }
  return profile;
}

export async function updateCrewProfile(crewId, updates) {
  const profile = await CrewProfile.findOneAndUpdate(
    { crew_id: crewId },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!profile) {
    throw new NotFoundException(`Crew profile '${crewId}' not found`);
  }
  return profile;
}

export async function deleteCrewProfile(crewId) {
  const deleted = await CrewProfile.findOneAndDelete({ crew_id: crewId });
  if (!deleted) {
    throw new NotFoundException(`Crew profile '${crewId}' not found`);
  }
  return deleted;
}

/**
 * Simulates passage of days and establishes baseline when days >= 3 (F002).
 */
export async function simulateBaseline(crewId, daysToAdd = 3) {
  const profile = await getCrewProfile(crewId);

  const currentDays = (profile.baseline_vitals?.days_monitored || 0) + daysToAdd;
  const baselineEstablished = currentDays >= 3;

  let baselineVitals = profile.baseline_vitals || {};
  baselineVitals.days_monitored = currentDays;
  baselineVitals.baseline_established = baselineEstablished;

  if (baselineEstablished) {
    // Fill baseline fields after 3 simulated days based on astronaut physiology
    const baseHr = 60 + (profile.age % 15) - (profile.sex === 'female' ? -3 : 2);
    const baseSys = 115 + (profile.age % 12);
    const baseDia = 75 + (profile.age % 8);

    baselineVitals.heart_rate_bpm = {
      resting: baseHr,
      min: baseHr - 8,
      max: baseHr + 45,
      mean: baseHr + 6
    };
    baselineVitals.blood_pressure_systolic = {
      min: baseSys - 10,
      max: baseSys + 18,
      mean: baseSys
    };
    baselineVitals.blood_pressure_diastolic = {
      min: baseDia - 6,
      max: baseDia + 12,
      mean: baseDia
    };
    baselineVitals.spo2_percent = { min: 96, max: 99, mean: 98 };
    baselineVitals.respiratory_rate_bpm = { min: 12, max: 18, mean: 14 };
    baselineVitals.core_temp_celsius = { min: 36.4, max: 37.1, mean: 36.7 };
    baselineVitals.hrv_rmssd_ms = { min: 35, max: 75, mean: 52 };
  }

  profile.baseline_vitals = baselineVitals;
  await profile.save();
  return profile;
}

const FIRST_NAMES = ['Elena', 'Marcus', 'Aoi', 'David', 'Svetlana', 'Tariq', 'Chloe', 'Rajesh', 'Astrid', 'Mateo'];
const LAST_NAMES = ['Vance', 'Chen', 'Lindqvist', 'Okafor', 'Dubois', 'Novak', 'Gomez', 'Kim', 'Patel', 'Al-Mansoor'];
const ROLES = ['Commander', 'Flight Engineer', 'Medical Officer', 'Science Specialist', 'Payload Specialist'];

/**
 * Seeded Synthetic Crew Generator (F004).
 * Creates N fake astronauts with published physiological ranges.
 */
export async function generateSyntheticCrews(count = 100, seed = 42) {
  const rand = createPrng(seed);
  const crews = [];

  for (let i = 1; i <= count; i++) {
    const fn = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const ln = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const role = ROLES[Math.floor(rand() * ROLES.length)];
    const sex = rand() > 0.5 ? 'female' : 'male';

    // Published astronaut physiological ranges
    const age = getRandomInRange(rand, 28, 60);
    const heightCm = getRandomInRange(rand, 158, 192);
    const weightKg = getRandomInRange(rand, 55, 92);
    const restingHr = getRandomInRange(rand, 52, 82);
    const systolicBp = getRandomInRange(rand, 108, 132);
    const diastolicBp = getRandomInRange(rand, 68, 86);
    const spo2 = getRandomInRange(rand, 96, 99);
    const temp = getRandomInRange(rand, 36.4, 37.2, 1);

    const crewId = `ASTRO-${String(i).padStart(3, '0')}`;

    const profileData = {
      crew_id: crewId,
      name: `${fn} ${ln}`,
      role,
      age,
      sex,
      height_cm: heightCm,
      weight_kg: weightKg,
      medical_history: 'Synthetic health history; no unmanaged contraindications',
      allergies: rand() > 0.8 ? ['Penicillin'] : [],
      provenance: 'SIMULATED',
      seed_used: seed,
      baseline_vitals: {
        days_monitored: 3,
        baseline_established: true,
        heart_rate_bpm: { resting: restingHr, min: restingHr - 6, max: restingHr + 40, mean: restingHr + 4 },
        blood_pressure_systolic: { min: systolicBp - 10, max: systolicBp + 15, mean: systolicBp },
        blood_pressure_diastolic: { min: diastolicBp - 6, max: diastolicBp + 10, mean: diastolicBp },
        spo2_percent: { min: spo2 - 2, max: 99, mean: spo2 },
        respiratory_rate_bpm: { min: 12, max: 18, mean: 14 },
        core_temp_celsius: { min: 36.4, max: 37.2, mean: temp },
        hrv_rmssd_ms: { min: 30, max: 70, mean: 48 }
      }
    };

    crews.push(profileData);
  }

  // Idempotently upsert all generated crews
  const operations = crews.map((c) => ({
    updateOne: {
      filter: { crew_id: c.crew_id },
      update: { $set: c },
      upsert: true
    }
  }));

  await CrewProfile.bulkWrite(operations);
  return { count: crews.length, seed, sample: crews.slice(0, 5) };
}
