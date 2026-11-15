import {useState, useEffect, useRef, useCallback} from 'react';
import {useStore} from '../store';
import {apiUrl} from './client';

export type TodayResponse = {
  state: 'normal' | 'off_today' | 'unsure';
  probability: number;
  band: {low: number; high: number};
  crew_band: {low: number; high: number};
  contributors: {signal: string; direction: 'up' | 'down'; weight: number}[];
  abstained: boolean;
};

// Stable baseline parameters per crew member around 0.12 with width ~0.10
const CREW_BASELINES: Record<string, {probability: number; band: {low: number; high: number}}> = {
  vega: {probability: 0.12, band: {low: 0.07, high: 0.17}},
  okoye: {probability: 0.13, band: {low: 0.08, high: 0.18}},
  marin: {probability: 0.11, band: {low: 0.06, high: 0.16}},
  tanaka: {probability: 0.12, band: {low: 0.07, high: 0.17}},
};

// Compute other crew members' average band (stays within +/-0.02 of 0.10 to 0.20)
function computeCrewBand(personId: string): {low: number; high: number} {
  const allIds = ['vega', 'okoye', 'marin', 'tanaka'];
  const others = allIds.filter((id) => id !== personId);
  
  // Baseline anchors for other crew members ensuring low ~0.10 and high ~0.18
  const otherBands = others.map((id) => {
    switch (id) {
      case 'vega': return {low: 0.09, high: 0.17};
      case 'okoye': return {low: 0.11, high: 0.19};
      case 'marin': return {low: 0.10, high: 0.18};
      case 'tanaka': return {low: 0.10, high: 0.18};
      default: return {low: 0.10, high: 0.18};
    }
  });

  const avgLow = otherBands.reduce((acc, b) => acc + b.low, 0) / otherBands.length;
  const avgHigh = otherBands.reduce((acc, b) => acc + b.high, 0) / otherBands.length;

  return {
    low: +(avgLow.toFixed(2)),
    high: +(avgHigh.toFixed(2)),
  };
}

// Mock state evaluation rule:
// abstained => 'unsure'; band width >= 0.5 => 'unsure'; band.low >= 0.35 => 'off_today'; else 'normal'
export function evaluateMockState(
  band: {low: number; high: number},
  abstained: boolean
): 'normal' | 'off_today' | 'unsure' {
  if (abstained) return 'unsure';
  const width = band.high - band.low;
  if (width >= 0.5) return 'unsure';
  if (band.low >= 0.35) return 'off_today';
  return 'normal';
}

function getMockToday(personId: string): TodayResponse {
  const normalizedId = personId.toLowerCase();
  const baseline = CREW_BASELINES[normalizedId] || {probability: 0.12, band: {low: 0.07, high: 0.17}};
  const crewBand = computeCrewBand(normalizedId);

  // Check if Moment 4 scenario is currently active for this person
  const store = useStore.getState();
  const scenario = store.todayScenario;

  if (scenario && scenario.active && (scenario.personId === normalizedId || !scenario.personId)) {
    const elapsedSec = (Date.now() - scenario.startWallTime) / 1000;

    if (elapsedSec < 8) {
      // 0-8 s: normal
      return {
        state: 'normal',
        probability: baseline.probability,
        band: {...baseline.band},
        crew_band: crewBand,
        contributors: [],
        abstained: false,
      };
    } else if (elapsedSec < 22) {
      // 8-22 s: that person's band widens from width 0.10 to about 0.60
      // low falls, high rises, point estimate drifts 0.15 to 0.45 while crew_band stays flat
      const t = Math.min(1, Math.max(0, (elapsedSec - 8) / 14));
      const low = +(0.07 - t * 0.05).toFixed(2); // 0.07 -> 0.02
      const high = +(0.17 + t * 0.45).toFixed(2); // 0.17 -> 0.62 (width = 0.60)
      const probability = +(0.15 + t * 0.30).toFixed(2); // 0.15 -> 0.45

      const contributors: {signal: string; direction: 'up' | 'down'; weight: number}[] = [];
      if (elapsedSec >= 10) {
        contributors.push({signal: 'Heart rate variability', direction: 'down', weight: 0.42});
      }
      if (elapsedSec >= 14) {
        contributors.push({signal: 'Resting heart rate', direction: 'up', weight: 0.35});
      }
      if (elapsedSec >= 18) {
        contributors.push({signal: 'Sleep duration', direction: 'down', weight: 0.28});
      }

      const band = {low, high};
      const state = evaluateMockState(band, false);

      return {
        state,
        probability,
        band,
        crew_band: crewBand,
        contributors,
        abstained: false,
      };
    } else {
      // From 22 s: abstained=true and the state stays 'unsure' until Clear or Reset demo
      const band = {low: 0.02, high: 0.62};
      const contributors = [
        {signal: 'Heart rate variability', direction: 'down' as const, weight: 0.42},
        {signal: 'Resting heart rate', direction: 'up' as const, weight: 0.35},
        {signal: 'Sleep duration', direction: 'down' as const, weight: 0.28},
      ];

      return {
        state: 'unsure',
        probability: 0.45,
        band,
        crew_band: crewBand,
        contributors,
        abstained: true,
      };
    }
  }

  // Baseline nominal response
  const state = evaluateMockState(baseline.band, false);
  return {
    state,
    probability: baseline.probability,
    band: {...baseline.band},
    crew_band: crewBand,
    contributors: [],
    abstained: false,
  };
}

export async function fetchToday(personId: string): Promise<TodayResponse> {
  const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';

  if (useMocks) {
    // Return mock response
    return Promise.resolve(getMockToday(personId));
  }

  const response = await fetch(apiUrl(`/v1/today?person_id=${encodeURIComponent(personId)}`));
  if (!response.ok) {
    throw new Error(`fetchToday failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export function usePollToday(personId: string) {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);

  const lastSuccessRef = useRef<number>(Date.now());
  const isFetchingRef = useRef<boolean>(false);
  const scenarioStartTime = useStore((s) => s.todayScenario?.startWallTime);

  const doFetch = useCallback(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const res = await fetchToday(personId);
      setData(res);
      lastSuccessRef.current = Date.now();
      setSecondsSinceUpdate(0);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Poll failed'));
      // Keep last good value in data
    } finally {
      isFetchingRef.current = false;
    }
  }, [personId]);

  // Initial fetch and fetch when personId or scenario trigger changes
  useEffect(() => {
    doFetch();
  }, [personId, scenarioStartTime, doFetch]);

  // 5000 ms real-time polling interval (not scaled by timeScale)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      doFetch();
    }, 5000);

    // 1000 ms timer for secondsSinceUpdate
    const clockInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'hidden') {
        const elapsed = Math.floor((Date.now() - lastSuccessRef.current) / 1000);
        setSecondsSinceUpdate(elapsed);
      }
    }, 1000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Math.floor((Date.now() - lastSuccessRef.current) / 1000);
        setSecondsSinceUpdate(elapsed);
        if (elapsed >= 5) {
          doFetch();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(pollInterval);
      clearInterval(clockInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [doFetch]);

  // If there has been no success for 15 s, display the 'unsure' state
  const isOverdue = secondsSinceUpdate >= 15;
  const effectiveData: TodayResponse | null = data
    ? {
        ...data,
        state: isOverdue ? 'unsure' : data.state,
      }
    : isOverdue
    ? {
        state: 'unsure',
        probability: 0.5,
        band: {low: 0.1, high: 0.7},
        crew_band: {low: 0.1, high: 0.18},
        contributors: [],
        abstained: true,
      }
    : null;

  return {
    data: effectiveData,
    secondsSinceUpdate,
    error,
    refetch: doFetch,
  };
}
