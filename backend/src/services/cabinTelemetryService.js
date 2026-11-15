import crypto from 'crypto';
import { CabinTelemetry } from '../models/CabinTelemetry.js';
import { eventBus } from '../bus/index.js';

export const CABIN_THRESHOLDS = {
  co2: {
    label: 'Carbon Dioxide',
    unit: '%',
    nominal_max: 0.6,
    caution_max: 0.8,
    min_safe: 0.0,
    max_safe: 0.6
  },
  o2: {
    label: 'Oxygen',
    unit: '%',
    nominal_min: 20.0,
    caution_min: 19.0,
    min_safe: 20.0,
    max_safe: 22.0
  },
  pressure: {
    label: 'Cabin Pressure',
    unit: 'kPa',
    nominal_min: 98.0,
    caution_min: 92.0,
    min_safe: 98.0,
    max_safe: 103.0
  },
  temperature: {
    label: 'Temperature',
    unit: '°C',
    nominal_min: 19.0,
    nominal_max: 24.0,
    min_safe: 19.0,
    max_safe: 24.0
  },
  humidity: {
    label: 'Relative Humidity',
    unit: '%',
    nominal_min: 40.0,
    nominal_max: 60.0,
    min_safe: 40.0,
    max_safe: 60.0
  }
};

export function evaluateCabinStatus(metrics) {
  const alerts = [];
  let status = 'NOMINAL';

  // CO2
  if (metrics.co2_percent >= CABIN_THRESHOLDS.co2.caution_max) {
    status = 'WARNING';
    alerts.push(`Critical CO2 Level: ${metrics.co2_percent}% exceeds scrubber clearance threshold (0.8%)`);
  } else if (metrics.co2_percent >= CABIN_THRESHOLDS.co2.nominal_max) {
    if (status !== 'WARNING') status = 'CAUTION';
    alerts.push(`Elevated CO2: ${metrics.co2_percent}% (Scrubber efficiency dropping)`);
  }

  // O2
  if (metrics.o2_percent < CABIN_THRESHOLDS.o2.caution_min) {
    status = 'WARNING';
    alerts.push(`Hypoxia Warning: O2 concentration dropped to ${metrics.o2_percent}%`);
  } else if (metrics.o2_percent < CABIN_THRESHOLDS.o2.nominal_min) {
    if (status !== 'WARNING') status = 'CAUTION';
    alerts.push(`Sub-nominal O2: ${metrics.o2_percent}%`);
  }

  // Pressure
  if (metrics.cabin_pressure_kpa < CABIN_THRESHOLDS.pressure.caution_min) {
    status = 'WARNING';
    alerts.push(`Depressurization Warning: Cabin pressure at ${metrics.cabin_pressure_kpa} kPa`);
  } else if (metrics.cabin_pressure_kpa < CABIN_THRESHOLDS.pressure.nominal_min) {
    if (status !== 'WARNING') status = 'CAUTION';
    alerts.push(`Low Cabin Pressure: ${metrics.cabin_pressure_kpa} kPa`);
  }

  return { status, alerts };
}

export async function recordCabinTelemetry(data) {
  const { status, alerts } = evaluateCabinStatus(data);
  const readingId = data.reading_id || `cab-${crypto.randomBytes(6).toString('hex')}`;

  const doc = await CabinTelemetry.create({
    reading_id: readingId,
    compartment: data.compartment || 'hab_module_alpha',
    timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
    co2_percent: data.co2_percent,
    o2_percent: data.o2_percent,
    cabin_pressure_kpa: data.cabin_pressure_kpa,
    temperature_c: data.temperature_c,
    humidity_percent: data.humidity_percent,
    ambient_noise_db: data.ambient_noise_db ?? 58.5,
    overall_status: status,
    active_alerts: alerts
  });

  // Visibly raise alerts on event bus
  if (alerts.length > 0) {
    await eventBus.publish({
      event_type: 'CABIN_ENVIRONMENT_ALERT',
      channel: 'cabin_telemetry',
      severity: status === 'WARNING' ? 'critical' : 'warning',
      source: 'cabin_telemetry_service',
      title: alerts[0],
      payload: {
        compartment: doc.compartment,
        status,
        alerts,
        metrics: {
          co2: doc.co2_percent,
          o2: doc.o2_percent,
          pressure: doc.cabin_pressure_kpa
        }
      }
    });
  }

  return doc.toJSON();
}

export async function getCabin5Gauges(compartment = 'hab_module_alpha') {
  // Find latest reading or provide nominal default
  let latest = await CabinTelemetry.findOne({ compartment }).sort({ timestamp: -1 }).lean();

  if (!latest) {
    latest = {
      co2_percent: 0.41,
      o2_percent: 21.0,
      cabin_pressure_kpa: 101.3,
      temperature_c: 21.8,
      humidity_percent: 48.0,
      ambient_noise_db: 58.0,
      overall_status: 'NOMINAL',
      active_alerts: []
    };
  }

  const gauges = [
    {
      metric: 'co2',
      label: CABIN_THRESHOLDS.co2.label,
      value: latest.co2_percent,
      unit: CABIN_THRESHOLDS.co2.unit,
      min_safe: CABIN_THRESHOLDS.co2.min_safe,
      max_safe: CABIN_THRESHOLDS.co2.max_safe,
      status: latest.co2_percent >= 0.8 ? 'WARNING' : latest.co2_percent >= 0.6 ? 'CAUTION' : 'NOMINAL'
    },
    {
      metric: 'o2',
      label: CABIN_THRESHOLDS.o2.label,
      value: latest.o2_percent,
      unit: CABIN_THRESHOLDS.o2.unit,
      min_safe: CABIN_THRESHOLDS.o2.min_safe,
      max_safe: CABIN_THRESHOLDS.o2.max_safe,
      status: latest.o2_percent < 19.0 ? 'WARNING' : latest.o2_percent < 20.0 ? 'CAUTION' : 'NOMINAL'
    },
    {
      metric: 'pressure',
      label: CABIN_THRESHOLDS.pressure.label,
      value: latest.cabin_pressure_kpa,
      unit: CABIN_THRESHOLDS.pressure.unit,
      min_safe: CABIN_THRESHOLDS.pressure.min_safe,
      max_safe: CABIN_THRESHOLDS.pressure.max_safe,
      status: latest.cabin_pressure_kpa < 92.0 ? 'WARNING' : latest.cabin_pressure_kpa < 98.0 ? 'CAUTION' : 'NOMINAL'
    },
    {
      metric: 'temperature',
      label: CABIN_THRESHOLDS.temperature.label,
      value: latest.temperature_c,
      unit: CABIN_THRESHOLDS.temperature.unit,
      min_safe: CABIN_THRESHOLDS.temperature.min_safe,
      max_safe: CABIN_THRESHOLDS.temperature.max_safe,
      status: (latest.temperature_c > 27.0 || latest.temperature_c < 18.0) ? 'WARNING' : (latest.temperature_c > 24.0 || latest.temperature_c < 19.0) ? 'CAUTION' : 'NOMINAL'
    },
    {
      metric: 'humidity',
      label: CABIN_THRESHOLDS.humidity.label,
      value: latest.humidity_percent,
      unit: CABIN_THRESHOLDS.humidity.unit,
      min_safe: CABIN_THRESHOLDS.humidity.min_safe,
      max_safe: CABIN_THRESHOLDS.humidity.max_safe,
      status: (latest.humidity_percent > 70.0 || latest.humidity_percent < 30.0) ? 'WARNING' : (latest.humidity_percent > 60.0 || latest.humidity_percent < 40.0) ? 'CAUTION' : 'NOMINAL'
    }
  ];

  return {
    compartment,
    overall_status: latest.overall_status,
    active_alerts: latest.active_alerts,
    gauge_count: gauges.length,
    gauges
  };
}

export async function simulateCO2LeakScenario({
  startCO2 = 0.4,
  peakCO2 = 1.25,
  steps = 5,
  compartment = 'hab_module_alpha'
}) {
  const results = [];
  const startMs = Date.now();

  for (let i = 0; i < steps; i++) {
    const fraction = i / (steps - 1);
    const co2 = Math.round((startCO2 + fraction * (peakCO2 - startCO2)) * 100) / 100;
    const reading = await recordCabinTelemetry({
      reading_id: `cab-co2-sim-${startMs}-${i}`,
      compartment,
      timestamp: new Date(startMs + i * 30000),
      co2_percent: co2,
      o2_percent: Math.round((21.0 - fraction * 0.8) * 10) / 10,
      cabin_pressure_kpa: 101.1,
      temperature_c: 22.1,
      humidity_percent: 50.0
    });
    results.push(reading);
  }

  return {
    scenario: 'CO2_SCRUBBER_FAILURE_LEAK',
    compartment,
    total_steps: steps,
    readings: results,
    final_status: results[results.length - 1].overall_status,
    final_alerts: results[results.length - 1].active_alerts
  };
}
