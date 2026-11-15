import { Router } from 'express';
import { getCommsLatencyDetails, isBlackoutActive } from '../services/delayEmulatorService.js';
import { getMissionConfig } from '../services/missionConfigService.js';

const router = Router();

export function buildCommsWidgetData(options = {}) {
  const latency = getCommsLatencyDetails();
  const blackout = options.referenceDate ? isBlackoutActive(options.referenceDate) : isBlackoutActive();
  const config = getMissionConfig();

  const mode = latency.mode;
  const isBlackout = blackout.is_blackout;

  const bandwidth = {
    uplink_kbps: mode === 'ISS' ? 10000 : mode === 'Moon' ? 2048 : 256,
    downlink_kbps: mode === 'ISS' ? 50000 : mode === 'Moon' ? 10240 : 1024
  };

  const widget = {
    title: 'Comms Link Status',
    mode,
    status_label: isBlackout ? 'BLACKOUT' : 'NOMINAL',
    latency_display: latency.one_way_display,
    roundtrip_display: latency.round_trip_display,
    badge_variant: isBlackout ? 'destructive' : mode === 'Mars' ? 'warning' : 'success',
    indicator_color: isBlackout ? '#ef4444' : mode === 'Mars' ? '#f59e0b' : '#10b981',
    description: isBlackout
      ? `Signal loss due to ${blackout.reason}. Resumes in ${Math.round(blackout.remaining_seconds / 60)} min.`
      : `Active link established. One-way propagation delay: ${latency.one_way_display}.`
  };

  return {
    mode,
    link_state: isBlackout ? 'BLACKOUT' : 'ONLINE',
    is_blackout: isBlackout,
    blackout_reason: blackout.reason,
    blackout_remaining_seconds: blackout.remaining_seconds,
    one_way_delay_seconds: latency.one_way_delay_seconds,
    round_trip_delay_seconds: latency.round_trip_delay_seconds,
    one_way_display: latency.one_way_display,
    round_trip_display: latency.round_trip_display,
    blackout_schedule: config.blackout_schedule || [],
    bandwidth,
    widget,
    disclaimer: 'Decision-support prototype on synthetic and public data. Not a medical device. No diagnosis claims.'
  };
}

router.get('/api/v1/comms/status', (req, res) => {
  const data = buildCommsWidgetData();
  res.json(data);
});

export default router;
