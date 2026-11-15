import { initializeDefaultFlags } from './flagService.js';
import { initializeMissionConfig, setMissionMode } from './missionConfigService.js';
import { registerUser, hashPassword } from './authService.js';
import { User } from '../models/User.js';
import { CrewProfile } from '../models/CrewProfile.js';
import { HealthRecord } from '../models/HealthRecord.js';
import { Inventory } from '../models/Inventory.js';
import { VitalsDailyRollup } from '../models/VitalsDailyRollup.js';
import { initializeDatasetRegistry } from './provenanceService.js';

const DEMO_CREW = [
  {
    crew_id: 'okoye',
    name: 'Dr. Amina Okoye',
    role: 'Commander & Geochemist',
    age: 42,
    sex: 'female',
    height_cm: 175,
    weight_kg: 68,
    allergies: [],
    provenance: 'SIMULATED',
    baseline_vitals: {
      heart_rate_bpm: { min: 54, max: 94, mean: 66, resting: 60 },
      blood_pressure_systolic: { min: 106, max: 130, mean: 115, resting: 115 },
      blood_pressure_diastolic: { min: 66, max: 86, mean: 75, resting: 75 },
      spo2_percent: { min: 97, max: 100, mean: 98.9, resting: 98.9 },
      respiratory_rate_bpm: { min: 12, max: 18, mean: 14, resting: 14 },
      core_temp_celsius: { min: 36.3, max: 37.2, mean: 36.7, resting: 36.7 },
      hrv_rmssd_ms: { min: 42, max: 90, mean: 70, resting: 70 },
      days_monitored: 30,
      baseline_established: true
    }
  },
  {
    crew_id: 'vega',
    name: 'Dr. Alex Vega',
    role: 'Chief Medical Officer',
    age: 45,
    sex: 'female',
    height_cm: 168,
    weight_kg: 62,
    allergies: ['Penicillin'],
    provenance: 'SIMULATED',
    baseline_vitals: {
      heart_rate_bpm: { min: 55, max: 95, mean: 68, resting: 62 },
      blood_pressure_systolic: { min: 105, max: 130, mean: 114, resting: 114 },
      blood_pressure_diastolic: { min: 65, max: 85, mean: 74, resting: 74 },
      spo2_percent: { min: 96, max: 100, mean: 98.8, resting: 98.8 },
      respiratory_rate_bpm: { min: 12, max: 18, mean: 14, resting: 14 },
      core_temp_celsius: { min: 36.3, max: 37.2, mean: 36.7, resting: 36.7 },
      hrv_rmssd_ms: { min: 40, max: 90, mean: 68, resting: 68 },
      days_monitored: 30,
      baseline_established: true
    }
  },
  {
    crew_id: 'marin',
    name: 'Elena Marin',
    role: 'Flight Systems Engineer',
    age: 37,
    sex: 'female',
    height_cm: 170,
    weight_kg: 64,
    allergies: ['Sulfa drugs'],
    provenance: 'SIMULATED',
    baseline_vitals: {
      heart_rate_bpm: { min: 52, max: 92, mean: 64, resting: 58 },
      blood_pressure_systolic: { min: 108, max: 132, mean: 116, resting: 116 },
      blood_pressure_diastolic: { min: 68, max: 86, mean: 74, resting: 74 },
      spo2_percent: { min: 97, max: 100, mean: 99.0, resting: 99.0 },
      respiratory_rate_bpm: { min: 11, max: 17, mean: 13, resting: 13 },
      core_temp_celsius: { min: 36.2, max: 37.1, mean: 36.6, resting: 36.6 },
      hrv_rmssd_ms: { min: 45, max: 95, mean: 72, resting: 72 },
      days_monitored: 30,
      baseline_established: true
    }
  },
  {
    crew_id: 'tanaka',
    name: 'Kenji Tanaka',
    role: 'Robotics Specialist',
    age: 39,
    sex: 'male',
    height_cm: 180,
    weight_kg: 76,
    allergies: [],
    provenance: 'SIMULATED',
    baseline_vitals: {
      heart_rate_bpm: { min: 50, max: 90, mean: 62, resting: 56 },
      blood_pressure_systolic: { min: 110, max: 135, mean: 118, resting: 118 },
      blood_pressure_diastolic: { min: 70, max: 88, mean: 76, resting: 76 },
      spo2_percent: { min: 96, max: 100, mean: 98.6, resting: 98.6 },
      respiratory_rate_bpm: { min: 12, max: 18, mean: 14, resting: 14 },
      core_temp_celsius: { min: 36.4, max: 37.3, mean: 36.8, resting: 36.8 },
      hrv_rmssd_ms: { min: 48, max: 96, mean: 74, resting: 74 },
      days_monitored: 30,
      baseline_established: true
    }
  },
  {
    crew_id: 'CREW-01',
    name: 'Elena Rostova',
    role: 'Commander',
    age: 41,
    sex: 'female',
    height_cm: 172,
    weight_kg: 65,
    allergies: ['Penicillin'],
    provenance: 'SIMULATED',
    baseline_vitals: {
      heart_rate_bpm: { min: 55, max: 95, mean: 68, resting: 62 },
      blood_pressure_systolic: { min: 105, max: 130, mean: 114, resting: 114 },
      blood_pressure_diastolic: { min: 65, max: 85, mean: 74, resting: 74 },
      spo2_percent: { min: 96, max: 100, mean: 98.8, resting: 98.8 },
      respiratory_rate_bpm: { min: 12, max: 18, mean: 14, resting: 14 },
      core_temp_celsius: { min: 36.3, max: 37.2, mean: 36.7, resting: 36.7 },
      hrv_rmssd_ms: { min: 40, max: 90, mean: 68, resting: 68 },
      days_monitored: 30,
      baseline_established: true
    }
  },
  {
    crew_id: 'CREW-02',
    name: 'Marcus Vance',
    role: 'Pilot',
    age: 38,
    sex: 'male',
    height_cm: 182,
    weight_kg: 78,
    allergies: [],
    provenance: 'SIMULATED',
    baseline_vitals: {
      heart_rate_bpm: { min: 50, max: 90, mean: 62, resting: 58 },
      blood_pressure_systolic: { min: 110, max: 135, mean: 118, resting: 118 },
      blood_pressure_diastolic: { min: 70, max: 88, mean: 76, resting: 76 },
      spo2_percent: { min: 96, max: 100, mean: 98.5, resting: 98.5 },
      respiratory_rate_bpm: { min: 11, max: 17, mean: 13, resting: 13 },
      core_temp_celsius: { min: 36.4, max: 37.2, mean: 36.8, resting: 36.8 },
      hrv_rmssd_ms: { min: 45, max: 95, mean: 72, resting: 72 },
      days_monitored: 30,
      baseline_established: true
    }
  },
  {
    crew_id: 'CREW-03',
    name: 'Sarah Chen',
    role: 'Chief Medical Officer',
    age: 44,
    sex: 'female',
    height_cm: 165,
    weight_kg: 59,
    allergies: ['Sulfa drugs'],
    provenance: 'SIMULATED',
    baseline_vitals: {
      heart_rate_bpm: { min: 58, max: 98, mean: 70, resting: 65 },
      blood_pressure_systolic: { min: 108, max: 132, mean: 116, resting: 116 },
      blood_pressure_diastolic: { min: 68, max: 86, mean: 75, resting: 75 },
      spo2_percent: { min: 97, max: 100, mean: 99.0, resting: 99.0 },
      respiratory_rate_bpm: { min: 12, max: 18, mean: 14, resting: 14 },
      core_temp_celsius: { min: 36.2, max: 37.1, mean: 36.6, resting: 36.6 },
      hrv_rmssd_ms: { min: 38, max: 85, mean: 62, resting: 62 },
      days_monitored: 30,
      baseline_established: true
    }
  },
  {
    crew_id: 'CREW-04',
    name: 'David Okonjo',
    role: 'Mission Specialist 1',
    age: 36,
    sex: 'male',
    height_cm: 185,
    weight_kg: 82,
    allergies: [],
    provenance: 'SIMULATED',
    baseline_vitals: {
      heart_rate_bpm: { min: 52, max: 92, mean: 65, resting: 60 },
      blood_pressure_systolic: { min: 112, max: 138, mean: 120, resting: 120 },
      blood_pressure_diastolic: { min: 72, max: 90, mean: 78, resting: 78 },
      spo2_percent: { min: 96, max: 100, mean: 98.2, resting: 98.2 },
      respiratory_rate_bpm: { min: 12, max: 18, mean: 14, resting: 14 },
      core_temp_celsius: { min: 36.4, max: 37.3, mean: 36.9, resting: 36.9 },
      hrv_rmssd_ms: { min: 40, max: 88, mean: 64, resting: 64 },
      days_monitored: 30,
      baseline_established: true
    }
  },
  {
    crew_id: 'CREW-05',
    name: 'Aiko Tanaka',
    role: 'Mission Specialist 2',
    age: 35,
    sex: 'female',
    height_cm: 160,
    weight_kg: 54,
    allergies: [],
    provenance: 'SIMULATED',
    baseline_vitals: {
      heart_rate_bpm: { min: 56, max: 96, mean: 68, resting: 64 },
      blood_pressure_systolic: { min: 104, max: 128, mean: 112, resting: 112 },
      blood_pressure_diastolic: { min: 66, max: 84, mean: 72, resting: 72 },
      spo2_percent: { min: 97, max: 100, mean: 99.1, resting: 99.1 },
      respiratory_rate_bpm: { min: 11, max: 17, mean: 13, resting: 13 },
      core_temp_celsius: { min: 36.3, max: 37.2, mean: 36.7, resting: 36.7 },
      hrv_rmssd_ms: { min: 44, max: 92, mean: 70, resting: 70 },
      days_monitored: 30,
      baseline_established: true
    }
  },
  {
    crew_id: 'CREW-06',
    name: 'Liam Gallagher',
    role: 'Flight Engineer',
    age: 39,
    sex: 'male',
    height_cm: 178,
    weight_kg: 75,
    allergies: ['Ibuprofen'],
    provenance: 'SIMULATED',
    baseline_vitals: {
      heart_rate_bpm: { min: 58, max: 98, mean: 72, resting: 66 },
      blood_pressure_systolic: { min: 114, max: 140, mean: 122, resting: 122 },
      blood_pressure_diastolic: { min: 74, max: 92, mean: 80, resting: 80 },
      spo2_percent: { min: 95, max: 100, mean: 98.0, resting: 98.0 },
      respiratory_rate_bpm: { min: 13, max: 19, mean: 15, resting: 15 },
      core_temp_celsius: { min: 36.4, max: 37.3, mean: 36.8, resting: 36.8 },
      hrv_rmssd_ms: { min: 35, max: 80, mean: 58, resting: 58 },
      days_monitored: 30,
      baseline_established: true
    }
  }
];

const DEMO_INVENTORY = [
  { item_id: 'MED-EPIN-01', name: 'Epinephrine Auto-Injector', category: 'medication', quantity: 12, min_threshold: 4, unit: 'vials', expiry_date: new Date('2028-12-31'), location: 'MedKit Alpha', is_critical: true },
  { item_id: 'MED-ATRO-01', name: 'Atropine Sulfate 1mg', category: 'medication', quantity: 8, min_threshold: 3, unit: 'ampoules', expiry_date: new Date('2028-06-30'), location: 'MedKit Alpha', is_critical: true },
  { item_id: 'MED-MFR-01', name: 'Morphine Sulfate 10mg/mL', category: 'medication', quantity: 6, min_threshold: 2, unit: 'ampoules', expiry_date: new Date('2027-10-15'), location: 'Narcotics Safe', is_critical: true },
  { item_id: 'SURG-SCAL-01', name: 'Sterile Disposable Scalpels #10', category: 'surgical', quantity: 20, min_threshold: 5, unit: 'pieces', expiry_date: new Date('2029-01-01'), location: 'MedKit Bravo', is_critical: false },
  { item_id: 'SURG-SUTR-01', name: 'Suture Kit 3-0 Prolene with Needle', category: 'surgical', quantity: 30, min_threshold: 8, unit: 'packs', expiry_date: new Date('2030-01-01'), location: 'MedKit Bravo', is_critical: false },
  { item_id: 'DIAG-PULS-01', name: 'Finger Pulse Oximeter Biosensor', category: 'diagnostic', quantity: 4, min_threshold: 2, unit: 'units', expiry_date: new Date('2030-01-01'), location: 'Diagnostics Bay', is_critical: true },
  { item_id: 'DIAG-US-01', name: 'Handheld Ultrasound Probe (Butterfly iQ)', category: 'diagnostic', quantity: 2, min_threshold: 1, unit: 'units', expiry_date: new Date('2032-01-01'), location: 'Diagnostics Bay', is_critical: true },
  { item_id: 'PPE-MASK-01', name: 'N95 Particulate Respirator Masks', category: 'ppe', quantity: 60, min_threshold: 15, unit: 'pieces', expiry_date: new Date('2029-01-01'), location: 'Safety Locker', is_critical: false },
  { item_id: 'FIRST-AID-01', name: 'Hemostatic Trauma Gauze', category: 'first_aid', quantity: 15, min_threshold: 5, unit: 'packs', expiry_date: new Date('2029-06-01'), location: 'Trauma Bag', is_critical: true }
];

export async function seedDemoData({ reset = false } = {}) {
  const t0 = Date.now();

  if (reset) {
    await CrewProfile.deleteMany({});
    await HealthRecord.deleteMany({});
    await Inventory.deleteMany({});
    await VitalsDailyRollup.deleteMany({});
  }

  // 1. Feature Flags & Datasets
  await initializeDefaultFlags();
  await initializeMissionConfig();
  await setMissionMode('Mars', 'demo_seeder');
  await initializeDatasetRegistry();

  // 2. Default Users
  const defaultUsers = [
    { username: 'admin', email: 'admin@astrocare.nasa', password: 'Password123!', role: 'admin' },
    { username: 'surgeon', email: 'surgeon@astrocare.nasa', password: 'Password123!', role: 'flight_surgeon' },
    { username: 'flight_surgeon', email: 'flight_surgeon@astrocare.nasa', password: 'Password123!', role: 'flight_surgeon' },
    { username: 'control', email: 'control@astrocare.nasa', password: 'Password123!', role: 'mission_control' },
    { username: 'okoye', email: 'okoye@astrocare.nasa', password: 'Password123!', role: 'astronaut', crew_id: 'okoye' },
    { username: 'vega', email: 'vega@astrocare.nasa', password: 'Password123!', role: 'astronaut', crew_id: 'vega' },
    { username: 'marin', email: 'marin@astrocare.nasa', password: 'Password123!', role: 'astronaut', crew_id: 'marin' },
    { username: 'tanaka', email: 'tanaka@astrocare.nasa', password: 'Password123!', role: 'astronaut', crew_id: 'tanaka' },
    { username: 'cmo_sarah', email: 'cmo@astrocare.nasa', password: 'CrewDoctor2026!', role: 'astronaut', crew_id: 'CREW-03' }
  ];
  for (const u of defaultUsers) {
    const passwordHash = await hashPassword(u.password);
    await User.deleteMany({ email: u.email, username: { $ne: u.username } });
    await User.findOneAndUpdate(
      { username: u.username },
      {
        $set: {
          username: u.username,
          email: u.email,
          password_hash: passwordHash,
          role: u.role,
          crew_id: u.crew_id || null
        }
      },
      { upsert: true, new: true }
    );
  }

  // 3. Crew Profiles (Idempotent upsert)
  let crewCount = 0;
  for (const crew of DEMO_CREW) {
    await CrewProfile.findOneAndUpdate(
      { crew_id: crew.crew_id },
      { $set: crew },
      { upsert: true, new: true }
    );
    crewCount++;
  }

  // 4. Baseline Health Records (Idempotent upsert)
  let healthRecordCount = 0;
  for (const crew of DEMO_CREW) {
    await HealthRecord.findOneAndUpdate(
      { crew_id: crew.crew_id },
      {
        $setOnInsert: {
          record_id: `ehr-${crew.crew_id.toLowerCase()}`,
          crew_id: crew.crew_id,
          allergies: crew.allergies.map((a) => ({
            allergen: a,
            reaction: 'Mild reaction',
            severity: 'moderate'
          })),
          chronic_conditions: [],
          current_medications: [],
          medical_clearance: {
            status: 'cleared',
            granted_by: 'flight_surgeon',
            granted_at: new Date('2026-10-01T00:00:00Z'),
            notes: 'Cleared for Mars transit mission'
          },
          soap_notes: []
        }
      },
      { upsert: true }
    );
    healthRecordCount++;
  }

  // 5. Medical Kit Inventory (Idempotent upsert)
  let inventoryCount = 0;
  for (const item of DEMO_INVENTORY) {
    await Inventory.findOneAndUpdate(
      { item_id: item.item_id },
      { $set: item },
      { upsert: true, new: true }
    );
    inventoryCount++;
  }

  // 6. 30 Days of History: VitalsDailyRollup for all 6 crew members (Idempotent upsert)
  let rollupsCount = 0;
  const now = new Date();
  const metrics = ['heart_rate', 'spo2', 'sys_bp', 'dia_bp', 'temperature'];

  const rollupOps = [];
  for (const crew of DEMO_CREW) {
    const base = crew.baseline_vitals;
    for (let dayOffset = 30; dayOffset >= 1; dayOffset--) {
      const targetDate = new Date(now.getTime() - dayOffset * 86400 * 1000);
      const dateStr = targetDate.toISOString().slice(0, 10);

      for (const metric of metrics) {
        let meanVal = base.heart_rate_bpm.resting;
        let minVal = meanVal - 8;
        let maxVal = meanVal + 12;

        if (metric === 'spo2') {
          meanVal = base.spo2_percent.resting;
          minVal = 97.5;
          maxVal = 99.5;
        } else if (metric === 'sys_bp') {
          meanVal = base.blood_pressure_systolic.resting;
          minVal = meanVal - 6;
          maxVal = meanVal + 8;
        } else if (metric === 'dia_bp') {
          meanVal = base.blood_pressure_diastolic.resting;
          minVal = meanVal - 4;
          maxVal = meanVal + 6;
        } else if (metric === 'temperature') {
          meanVal = base.core_temp_celsius.resting;
          minVal = 36.4;
          maxVal = 37.1;
        }

        rollupOps.push({
          updateOne: {
            filter: { crew_id: crew.crew_id, date: dateStr, metric },
            update: {
              $set: {
                crew_id: crew.crew_id,
                date: dateStr,
                metric,
                min: Math.round(minVal * 10) / 10,
                max: Math.round(maxVal * 10) / 10,
                avg: Math.round(meanVal * 10) / 10,
                count: 1440,
                p50: Math.round(meanVal * 10) / 10,
                p95: Math.round((maxVal - 1) * 10) / 10,
                refreshed_at: new Date()
              }
            },
            upsert: true
          }
        });
        rollupsCount++;
      }
    }
  }

  if (rollupOps.length > 0) {
    await VitalsDailyRollup.bulkWrite(rollupOps, { ordered: false });
  }

  const durationMs = Date.now() - t0;

  return {
    success: true,
    duration_ms: durationMs,
    entities_seeded: {
      crew_profiles: crewCount,
      health_records: healthRecordCount,
      inventory_items: inventoryCount,
      daily_rollups: rollupsCount,
      history_days: 30
    }
  };
}
