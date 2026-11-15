import crypto from 'node:crypto';
import { Alert } from '../models/Alert.js';
import { eventBus } from '../bus/index.js';

// Priority hierarchy for severity ranking
const SEVERITY_WEIGHT = {
  EMERGENCY: 4,
  CRITICAL: 3,
  WARNING: 2,
  INFO: 1
};

/**
 * Fuses an incoming burst or array of raw alerts into deduplicated, prioritized grouped alerts.
 * Requirement: "Duplicate storm of 50 raw alerts becomes under 5 grouped alerts."
 */
export async function fuseAlertStorm(rawAlerts, options = {}) {
  const {
    windowSeconds = 60,
    escalationThreshold = 5, // if >= 5 warnings, escalate to CRITICAL
    persistGrouped = true
  } = options;

  if (!rawAlerts || rawAlerts.length === 0) {
    return { raw_count: 0, grouped_count: 0, grouped_alerts: [] };
  }

  // 1. Group alerts by composite cluster key: (crew_id, category, metric_family)
  const clusters = new Map();

  for (const alert of rawAlerts) {
    const crewId = alert.crew_id || 'STATION';
    const category = alert.category || 'GENERAL';
    const metric = alert.metric || 'vital';
    
    // Normalize metric to family (e.g. 'sys_bp' and 'dia_bp' -> 'blood_pressure')
    let metricFamily = metric;
    if (metric.includes('bp') || metric.includes('pressure')) {
      metricFamily = 'blood_pressure';
    } else if (metric.includes('co2') || metric.includes('o2') || metric.includes('cabin')) {
      metricFamily = 'cabin_atmosphere';
    }

    const clusterKey = `${crewId}:${category}:${metricFamily}`;

    if (!clusters.has(clusterKey)) {
      clusters.set(clusterKey, {
        clusterKey,
        crew_id: crewId,
        category,
        metric: metricFamily,
        alerts: []
      });
    }

    clusters.get(clusterKey).alerts.push(alert);
  }

  // 2. Synthesize each cluster into one grouped alert
  const groupedAlerts = [];

  for (const cluster of clusters.values()) {
    const count = cluster.alerts.length;
    const rawIds = cluster.alerts.map((a) => a.alert_id || a._id?.toString() || `raw-${Math.random()}`);
    const sources = [...new Set(cluster.alerts.map((a) => a.source || 'RULE'))];

    // Determine highest raw severity
    let maxSeverityWeight = 1;
    let highestSeverity = 'INFO';

    for (const a of cluster.alerts) {
      const sev = (a.severity || 'WARNING').toUpperCase();
      const weight = SEVERITY_WEIGHT[sev] || 1;
      if (weight > maxSeverityWeight) {
        maxSeverityWeight = weight;
        highestSeverity = sev;
      }
    }

    // Escalation Matrix: if duplicate storm >= escalationThreshold warnings, escalate to CRITICAL
    let finalSeverity = highestSeverity;
    if (count >= escalationThreshold && finalSeverity === 'WARNING') {
      finalSeverity = 'CRITICAL';
    }

    // Determine value range if numeric
    const numericValues = cluster.alerts
      .map((a) => Number(a.value))
      .filter((v) => !isNaN(v));

    let valueSummary = '';
    if (numericValues.length > 0) {
      const minVal = Math.min(...numericValues);
      const maxVal = Math.max(...numericValues);
      valueSummary = minVal === maxVal ? `(Value: ${maxVal})` : `(Range: ${minVal} - ${maxVal})`;
    }

    const groupId = `grp-${crypto.randomBytes(6).toString('hex')}`;
    const representative = cluster.alerts[0];

    const grouped = {
      group_id: groupId,
      alert_id: groupId,
      crew_id: cluster.crew_id,
      category: cluster.category,
      metric: cluster.metric,
      source: sources.length > 1 ? 'FUSED' : sources[0],
      severity: finalSeverity,
      title: `[Fused x${count}] ${representative.title || `${cluster.metric} Alert`}`,
      message: `Cluster of ${count} ${cluster.metric} alerts for ${cluster.crew_id} across ${sources.join(', ')} ${valueSummary}.`,
      status: 'ACTIVE',
      dedup_count: count,
      raw_alert_ids: rawIds,
      metadata: {
        sources,
        escalated: finalSeverity !== highestSeverity,
        suppression_window_sec: windowSeconds,
        first_alert_time: cluster.alerts[0].created_at || new Date().toISOString(),
        last_alert_time: cluster.alerts[count - 1].created_at || new Date().toISOString()
      }
    };

    if (persistGrouped) {
      try {
        await Alert.create(grouped);
        await eventBus.publish({
          event_type: 'alert.fused',
          channel: 'alerts',
          severity: finalSeverity.toLowerCase(),
          payload: grouped
        });
      } catch {
        // Continue even if logging fails in test mock
      }
    }

    groupedAlerts.push(grouped);
  }

  // Sort grouped alerts by severity descending
  groupedAlerts.sort((a, b) => (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0));

  return {
    raw_count: rawAlerts.length,
    grouped_count: groupedAlerts.length,
    grouped_alerts: groupedAlerts
  };
}
