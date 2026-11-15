import { getMissionConfig } from './missionConfigService.js';

export function getCommsLatencyDetails() {
  const config = getMissionConfig();
  const mode = config.mode || 'ISS';
  const oneWaySeconds = Number(config.comms_delay_seconds || 0.5);
  const roundTripSeconds = oneWaySeconds * 2;

  return {
    mode,
    one_way_delay_seconds: oneWaySeconds,
    round_trip_delay_seconds: roundTripSeconds,
    one_way_display: formatDelayDisplay(oneWaySeconds),
    round_trip_display: formatDelayDisplay(roundTripSeconds)
  };
}

export function formatDelayDisplay(seconds) {
  if (seconds < 1) {
    return `${Math.round(seconds * 1000)} ms (near zero)`;
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function isBlackoutActive(checkDate = new Date()) {
  const config = getMissionConfig();
  const schedule = config.blackout_schedule || [];

  const hours = checkDate.getUTCHours();
  const minutes = checkDate.getUTCMinutes();
  const seconds = checkDate.getUTCSeconds();
  const currentSecondsOfDay = hours * 3600 + minutes * 60 + seconds;

  for (const window of schedule) {
    if (!window.start_time) continue;
    const [startH, startM] = window.start_time.split(':').map(Number);
    const startSec = startH * 3600 + startM * 60;
    const endSec = startSec + (window.duration_seconds || 3600);

    if (currentSecondsOfDay >= startSec && currentSecondsOfDay < endSec) {
      const remainingSeconds = endSec - currentSecondsOfDay;
      return {
        is_blackout: true,
        reason: 'Planetary occultation / solar conjunction',
        remaining_seconds: remainingSeconds,
        window
      };
    }
  }

  return {
    is_blackout: false,
    reason: null,
    remaining_seconds: 0
  };
}

export function calculateDeliveryTime(options = {}) {
  const {
    direction = 'space_to_ground',
    sentAt = new Date(),
    forceBlackout = false
  } = options;

  const latency = getCommsLatencyDetails();
  const blackout = forceBlackout ? { is_blackout: true, remaining_seconds: 3600 } : isBlackoutActive(sentAt);

  let delaySeconds = direction === 'local' ? 0 : latency.one_way_delay_seconds;

  if (blackout.is_blackout) {
    delaySeconds += blackout.remaining_seconds;
  }

  const deliverAt = new Date(sentAt.getTime() + delaySeconds * 1000);

  return {
    sent_at: sentAt,
    deliver_at: deliverAt,
    delay_seconds_applied: delaySeconds,
    latency_seconds: latency.one_way_delay_seconds,
    is_blackout: blackout.is_blackout,
    blackout_remaining_seconds: blackout.remaining_seconds,
    mode: latency.mode
  };
}
