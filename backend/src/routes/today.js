import express from 'express';
import { Alert } from '../models/Alert.js';
import { ClinicalOrder } from '../models/ClinicalOrder.js';
import { BroadcastAnnouncement } from '../models/BroadcastAnnouncement.js';
import { VitalsDailyRollup } from '../models/VitalsDailyRollup.js';
import { CrewProfile } from '../models/CrewProfile.js';

const router = express.Router();

const CREW_BASELINES = {
  vega: { probability: 0.12, band: { low: 0.07, high: 0.17 } },
  okoye: { probability: 0.13, band: { low: 0.08, high: 0.18 } },
  marin: { probability: 0.11, band: { low: 0.06, high: 0.16 } },
  tanaka: { probability: 0.12, band: { low: 0.07, high: 0.17 } }
};

function computeCrewBand(personId) {
  const allIds = ['vega', 'okoye', 'marin', 'tanaka'];
  const others = allIds.filter((id) => id !== personId);
  const otherBands = others.map((id) => {
    switch (id) {
      case 'vega': return { low: 0.09, high: 0.17 };
      case 'okoye': return { low: 0.11, high: 0.19 };
      case 'marin': return { low: 0.10, high: 0.18 };
      case 'tanaka': return { low: 0.10, high: 0.18 };
      default: return { low: 0.10, high: 0.18 };
    }
  });
  const avgLow = otherBands.reduce((acc, b) => acc + b.low, 0) / otherBands.length;
  const avgHigh = otherBands.reduce((acc, b) => acc + b.high, 0) / otherBands.length;
  return {
    low: +(avgLow.toFixed(2)),
    high: +(avgHigh.toFixed(2))
  };
}

function evaluateState(band, abstained) {
  if (abstained) return 'unsure';
  const width = band.high - band.low;
  if (width >= 0.5) return 'unsure';
  if (band.low >= 0.35) return 'off_today';
  return 'normal';
}

async function fetchJsonWithTimeout(url, timeoutMs = 1200) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

router.get(['/v1/today', '/api/v1/today'], async (req, res, next) => {
  try {
    const personId = (req.query.person_id || req.query.crew_id || 'vega').toLowerCase();
    const baseline = CREW_BASELINES[personId] || { probability: 0.12, band: { low: 0.07, high: 0.17 } };
    const crewBand = computeCrewBand(personId);

    // 1. Query Mongo local clinical data
    let activeAlerts = 0;
    let pendingOrders = 0;
    let recentBroadcasts = 0;
    let vitals = null;

    try {
      const [alerts, orders, broadcasts, latestVitals] = await Promise.all([
        Alert.find({ crew_id: personId, status: { $ne: 'resolved' } }).lean().catch(() => []),
        ClinicalOrder.find({ target_crew_id: personId }).lean().catch(() => []),
        BroadcastAnnouncement.find({}).sort({ created_at: -1 }).limit(5).lean().catch(() => []),
        VitalsDailyRollup.findOne({ crew_id: personId }).sort({ date: -1 }).lean().catch(() => null)
      ]);

      activeAlerts = alerts ? alerts.length : 0;
      pendingOrders = orders ? orders.filter(o => o.status !== 'COMPLETED' && o.status !== 'CANCELLED').length : 0;
      recentBroadcasts = broadcasts ? broadcasts.length : 0;
      vitals = latestVitals;
    } catch (err) {
      // Keep going even if partial mongo error
    }

    // 2. Query FastAPI for multimodal scores (cross-service link)
    const fastApiUrl = (process.env.FASTAPI_URL || '').replace(/\/+$/, '');
    let multimodal = null;
    const sensorsUrl = fastApiUrl
      ? `${fastApiUrl}/api/v1/sensors/state?crew_id=${encodeURIComponent(personId)}`
      : null;
    const passiveUrl = fastApiUrl ? `${fastApiUrl}/api/v1/passive/metrics` : null;
    const [sensorsRes, passiveRes] = fastApiUrl
      ? await Promise.all([fetchJsonWithTimeout(sensorsUrl), fetchJsonWithTimeout(passiveUrl)])
      : [null, null];
    const degraded = !sensorsRes || !passiveRes;
    const missingKeys = degraded
      ? ['voice', 'behavior', ...(!sensorsRes ? ['sensors'] : []), ...(!passiveRes ? ['passive'] : [])]
      : [];

    if (sensorsRes || passiveRes) {
      multimodal = {
        sensors: sensorsRes?.sensors || null,
        consent_version: sensorsRes?.consent_version || 1,
        passive_metrics: passiveRes || null
      };
    }

    // 3. Synthesize point estimate and contributors based on clinical & multimodal state
    let probability = baseline.probability;
    let band = { ...baseline.band };
    const contributors = [];

    if (activeAlerts > 0) {
      probability = Math.min(0.85, probability + 0.15 * activeAlerts);
      band.high = Math.min(0.95, band.high + 0.20 * activeAlerts);
      contributors.push({
        signal: 'Active clinical alert',
        direction: 'up',
        weight: 0.45
      });
    }

    const state = evaluateState(band, false);

    return res.json({
      person_id: personId,
      state,
      probability: +(probability.toFixed(2)),
      band,
      crew_band: crewBand,
      contributors,
      abstained: false,
      clinical_summary: {
        active_alerts: activeAlerts,
        pending_orders: pendingOrders,
        recent_broadcasts: recentBroadcasts,
        vitals_monitored: vitals ? true : false
      },
      multimodal,
      degraded,
      ml_status: degraded ? 'not_available' : 'available',
      ...(degraded ? { degraded_message: 'AI DEGRADED: RULES ONLY' } : {}),
      missing_keys: missingKeys
    });
  } catch (err) {
    next(err);
  }
});

export default router;
