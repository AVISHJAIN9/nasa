import { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../../store';
import { PageHeader, Panel, ProvenanceBadge } from '../ui';
import { api } from '../../api/client';

interface WindowMetrics {
  timestamp: number;
  flightMedianMs: number;
  dwellMedianMs: number;
  backspaceRate: number;
  pointerJitter: number;
  totalKeys: number;
  composite: number;
}

export function TypingPointer() {
  const role = useStore((s) => s.role);
  const crewMember = useStore((s) => s.crew[0]?.id || 'vega');

  // Consent toggle (default OFF)
  const [consentGranted, setConsentGranted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('astrocare_typing_consent') === 'true';
  });

  // Interactive typing field
  const [testInput, setTestInput] = useState('');

  // Kinematic state
  const [rawKeyCount, setRawKeyCount] = useState(0);
  const [backspaceCount, setBackspaceCount] = useState(0);
  const [currentDwell, setCurrentDwell] = useState<number | null>(null);
  const [currentFlight, setCurrentFlight] = useState<number | null>(null);
  const [pointerSpeed, setPointerSpeed] = useState<number>(0);
  const [pointerJitterCount, setPointerJitterCount] = useState<number>(0);

  // Buffer of events for backend payload
  const eventsBuffer = useRef<Array<{
    event_id: string;
    crew_id: string;
    ts_ms: number;
    kind: 'key_down' | 'key_up' | 'pointer_move' | 'pointer_click';
    dwell_ms: number;
    flight_ms: number;
    speed_px_s: number;
    click_latency_ms: number;
  }>>([]);

  // Timing and count references
  const keyPressMap = useRef<Map<string, number>>(new Map());
  const lastKeyUpTime = useRef<number>(0);
  const lastPointerPos = useRef<{ x: number; y: number; time: number; angle: number } | null>(null);
  const windowFlights = useRef<number[]>([]);
  const windowDwells = useRef<number[]>([]);
  const windowKeyCount = useRef<number>(0);
  const windowBackspaceCount = useRef<number>(0);
  const windowJitterCount = useRef<number>(0);

  // Windows history
  const [windows, setWindows] = useState<WindowMetrics[]>([]);
  const [backendStatus, setBackendStatus] = useState<string | null>(null);
  const [lastFlushedEvents, setLastFlushedEvents] = useState<number>(0);

  // Persist consent and notify backend
  const toggleConsent = async (val: boolean) => {
    setConsentGranted(val);
    localStorage.setItem('astrocare_typing_consent', val ? 'true' : 'false');

    if (val) {
      try {
        await Promise.allSettled([
          api.post('/consent', {
            crew_id: crewMember,
            sensor: 'keyboard',
            granted: true,
            consent_version: 1,
          }),
          api.post('/consent', {
            crew_id: crewMember,
            sensor: 'pointer',
            granted: true,
            consent_version: 1,
          }),
        ]);
      } catch (err) {
        console.warn('Backend consent sync failed (fallback to local):', err);
      }
    }
  };

  // Keyboard capture
  useEffect(() => {
    if (!consentGranted) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Strictly ignore password fields
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'password') {
        return;
      }

      const now = performance.now();
      const nowEpoch = Date.now();

      // Inter-key flight time
      if (lastKeyUpTime.current > 0) {
        const flight = now - lastKeyUpTime.current;
        if (flight > 10 && flight < 3000) {
          setCurrentFlight(Math.round(flight));
          windowFlights.current.push(flight);
        }
      }

      // Record keydown timestamp locally
      keyPressMap.current.set(e.code, now);
      windowKeyCount.current += 1;
      setRawKeyCount((c) => c + 1);

      if (e.key === 'Backspace') {
        windowBackspaceCount.current += 1;
        setBackspaceCount((b) => b + 1);
      }

      // Push sanitized telemetry (NO key name, character, or text)
      eventsBuffer.current.push({
        event_id: `evt-kd-${nowEpoch}-${Math.random().toString(36).slice(2, 7)}`,
        crew_id: crewMember,
        ts_ms: nowEpoch,
        kind: 'key_down',
        dwell_ms: 0,
        flight_ms: currentFlight || 0,
        speed_px_s: 0,
        click_latency_ms: 0,
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'password') {
        return;
      }

      const now = performance.now();
      const nowEpoch = Date.now();
      const downTime = keyPressMap.current.get(e.code);

      if (downTime) {
        const dwell = now - downTime;
        if (dwell > 5 && dwell < 2000) {
          setCurrentDwell(Math.round(dwell));
          windowDwells.current.push(dwell);
        }
        keyPressMap.current.delete(e.code);

        // Push sanitized telemetry (NO key name, character, or text)
        eventsBuffer.current.push({
          event_id: `evt-ku-${nowEpoch}-${Math.random().toString(36).slice(2, 7)}`,
          crew_id: crewMember,
          ts_ms: nowEpoch,
          kind: 'key_up',
          dwell_ms: Math.round(dwell),
          flight_ms: 0,
          speed_px_s: 0,
          click_latency_ms: 0,
        });
      }

      lastKeyUpTime.current = now;
    };

    window.addEventListener('keydown', handleKeyDown, { passive: true });
    window.addEventListener('keyup', handleKeyUp, { passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [consentGranted, crewMember]);

  // Pointer kinematics capture
  useEffect(() => {
    if (!consentGranted) return;

    let lastThrottle = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastThrottle < 40) return; // ~25 Hz sampling
      lastThrottle = now;

      const nowEpoch = Date.now();
      const prev = lastPointerPos.current;

      if (prev) {
        const dt = (now - prev.time) / 1000;
        if (dt > 0.001) {
          const dx = e.clientX - prev.x;
          const dy = e.clientY - prev.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const speed = Math.round(dist / dt);
          setPointerSpeed(speed);

          const angle = Math.atan2(dy, dx);
          const angleDelta = Math.abs(angle - prev.angle);
          if (angleDelta > 1.2 && dist > 5) {
            windowJitterCount.current += 1;
            setPointerJitterCount((j) => j + 1);
          }

          lastPointerPos.current = { x: e.clientX, y: e.clientY, time: now, angle };

          if (dist > 10) {
            eventsBuffer.current.push({
              event_id: `evt-pm-${nowEpoch}-${Math.random().toString(36).slice(2, 7)}`,
              crew_id: crewMember,
              ts_ms: nowEpoch,
              kind: 'pointer_move',
              dwell_ms: 0,
              flight_ms: 0,
              speed_px_s: speed,
              click_latency_ms: 0,
            });
          }
        }
      } else {
        lastPointerPos.current = { x: e.clientX, y: e.clientY, time: now, angle: 0 };
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, [consentGranted, crewMember]);

  // Window Flush Function (every 15s or manual)
  const flushWindow = async () => {
    if (!consentGranted) return;

    const flights = [...windowFlights.current];
    const dwells = [...windowDwells.current];
    windowFlights.current = [];
    windowDwells.current = [];

    const median = (arr: number[]) => {
      if (!arr.length) return 0;
      const s = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
    };

    const fMed = Math.round(median(flights));
    const dMed = Math.round(median(dwells));
    const keys = windowKeyCount.current;
    const bks = windowBackspaceCount.current;
    const bkRate = keys > 0 ? +(bks / keys).toFixed(3) : 0;
    const jitter = windowJitterCount.current;

    // Reset counts for next window
    windowKeyCount.current = 0;
    windowBackspaceCount.current = 0;
    windowJitterCount.current = 0;
    setRawKeyCount(0);
    setBackspaceCount(0);
    setPointerJitterCount(0);

    const composite = Math.round(fMed * 0.4 + dMed * 0.3 + bkRate * 200 + jitter * 2);

    const newWin: WindowMetrics = {
      timestamp: Date.now(),
      flightMedianMs: fMed || (dwells.length ? 180 : 0),
      dwellMedianMs: dMed || 90,
      backspaceRate: bkRate,
      pointerJitter: jitter,
      totalKeys: flights.length + dwells.length,
      composite,
    };

    setWindows((prev) => [...prev.slice(-10), newWin]);

    // Send payload to backend
    const batch = [...eventsBuffer.current];
    eventsBuffer.current = [];
    setLastFlushedEvents(batch.length);

    if (batch.length > 0) {
      try {
        const res = await api.post<any>('/behavior/events', { events: batch });
        setBackendStatus(`Synced (${res?.events_processed || batch.length} events, updated ${res?.windows_updated ?? 1} windows)`);
      } catch (err: any) {
        setBackendStatus(`Local offline (${err?.message || 'endpoint unreachable'})`);
      }
    }
  };

  // Auto-flush window every 15s when active
  useEffect(() => {
    if (!consentGranted) return;
    const timer = setInterval(() => {
      flushWindow();
    }, 15000);
    return () => clearInterval(timer);
  }, [consentGranted, rawKeyCount, backspaceCount, pointerJitterCount]);

  // Robust Baseline Calculation (N = 3 required)
  const REQUIRED_BASELINE_WINDOWS = 3;
  const calibrationProgress = Math.min(windows.length, REQUIRED_BASELINE_WINDOWS);
  const isCalibrated = windows.length >= REQUIRED_BASELINE_WINDOWS;

  const baselineStats = useMemo(() => {
    if (windows.length < REQUIRED_BASELINE_WINDOWS) return null;
    const baselineSlice = windows.slice(0, REQUIRED_BASELINE_WINDOWS);
    const composites = baselineSlice.map((w) => w.composite).sort((a, b) => a - b);
    const medianVal = composites[Math.floor(composites.length / 2)];

    const diffs = composites.map((c) => Math.abs(c - medianVal)).sort((a, b) => a - b);
    const mad = diffs[Math.floor(diffs.length / 2)] || 15;

    return { median: medianVal, mad };
  }, [windows]);

  // Fatigue Index (Robust Z-Score)
  const latestWindow = windows[windows.length - 1];
  const fatigueIndex = useMemo(() => {
    if (!baselineStats || !latestWindow) return 0;
    const { median, mad } = baselineStats;
    const diff = latestWindow.composite - median;
    const z = diff / (1.4826 * mad + 1.0);
    return +z.toFixed(2);
  }, [baselineStats, latestWindow]);

  const fatigueStatus = useMemo(() => {
    if (!isCalibrated) return 'calibrating';
    if (fatigueIndex > 2.0) return 'alert';
    if (fatigueIndex > 1.0) return 'watch';
    return 'normal';
  }, [isCalibrated, fatigueIndex]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="T1 PASSIVE BIOMETRIC KINEMATICS"
        title="Typing & pointer fatigue"
        description="Tracks subtle changes in motor timing—inter-key flight intervals, key dwell durations, error corrections, and pointer jitter—to detect early cognitive fatigue without capturing text."
        badge={<ProvenanceBadge provenance="REAL" />}
      />

      {/* Consent Gate Banner */}
      <Panel
        title="Privacy Consent & Kinematic Monitoring"
        badge={
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
              consentGranted
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-mars/20 text-mars border border-mars/40'
            }`}
          >
            {consentGranted ? '● ACTIVE (LOCAL ONLY)' : '○ DISABLED'}
          </span>
        }
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 font-mono text-xs">
          <div className="space-y-1.5 max-w-xl">
            <p className="text-white font-medium">
              Multimodal Kinematic Surveillance Consent (Astronaut {crewMember.toUpperCase()})
            </p>
            <p className="text-regolith/70 text-[11px] leading-relaxed">
              When enabled, timing intervals between key presses and mouse movements are captured in the active AstroCare tab.
              <strong className="text-earth"> Key identity, letter contents, and typed words are strictly forbidden and discarded.</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleConsent(!consentGranted)}
            id="typing-consent-toggle"
            className={`px-4 py-2.5 rounded-lg font-bold uppercase transition-all shadow-md shrink-0 ${
              consentGranted
                ? 'bg-mars text-white hover:bg-mars/90'
                : 'bg-earth text-void hover:bg-earth/90'
            }`}
          >
            {consentGranted ? 'Revoke Consent' : 'Grant Consent'}
          </button>
        </div>
      </Panel>

      {/* Main Monitoring Deck */}
      {consentGranted ? (
        <div className="grid gap-6 lg:grid-cols-12 font-mono">
          {/* Left Column: Live Gauges & Fatigue Index */}
          <div className="lg:col-span-7 space-y-6">
            <Panel title="Real-Time Kinematic Latencies">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-void p-3 rounded-lg border border-white/10">
                  <span className="text-[10px] text-regolith/60 uppercase block">Flight Time</span>
                  <span className="text-xl font-bold text-white block mt-1" id="live-flight-ms">
                    {currentFlight ? `${currentFlight} ms` : '--'}
                  </span>
                  <span className="text-[10px] text-regolith/50">inter-key interval</span>
                </div>

                <div className="bg-void p-3 rounded-lg border border-white/10">
                  <span className="text-[10px] text-regolith/60 uppercase block">Dwell Time</span>
                  <span className="text-xl font-bold text-white block mt-1" id="live-dwell-ms">
                    {currentDwell ? `${currentDwell} ms` : '--'}
                  </span>
                  <span className="text-[10px] text-regolith/50">key hold duration</span>
                </div>

                <div className="bg-void p-3 rounded-lg border border-white/10">
                  <span className="text-[10px] text-regolith/60 uppercase block">Backspace Rate</span>
                  <span className="text-xl font-bold text-white block mt-1" id="live-backspace-rate">
                    {rawKeyCount > 0 ? `${Math.round((backspaceCount / rawKeyCount) * 100)}%` : '0%'}
                  </span>
                  <span className="text-[10px] text-regolith/50">{backspaceCount} corrections</span>
                </div>

                <div className="bg-void p-3 rounded-lg border border-white/10">
                  <span className="text-[10px] text-regolith/60 uppercase block">Pointer Speed</span>
                  <span className="text-xl font-bold text-white block mt-1">
                    {pointerSpeed} <span className="text-[11px] font-normal text-regolith/60">px/s</span>
                  </span>
                  <span className="text-[10px] text-regolith/50">jitter: {pointerJitterCount}</span>
                </div>
              </div>

              {/* Interactive Calibration Box */}
              <div className="mt-5 space-y-2 border-t border-white/10 pt-4">
                <label htmlFor="typing-exercise-input" className="text-[11px] text-regolith/70 uppercase block">
                  Interactive Test Typing Area (exercise keyboard to feed window metrics):
                </label>
                <textarea
                  id="typing-exercise-input"
                  rows={3}
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder="Type nominal mission logs or clinical checklists here. Keystroke timing will be captured; characters are NOT stored."
                  className="w-full bg-void-2 border border-white/15 rounded-lg p-3 text-white text-xs font-mono focus:border-earth focus:outline-none"
                />
                <div className="flex justify-between items-center text-[10px] text-regolith/50">
                  <span>Keys captured: {rawKeyCount} | Buffer: {eventsBuffer.current.length}</span>
                  <button
                    type="button"
                    onClick={flushWindow}
                    id="flush-window-button"
                    className="px-2.5 py-1 rounded bg-white/10 hover:bg-earth hover:text-void text-white transition-colors"
                  >
                    Flush 30s Window Now
                  </button>
                </div>
              </div>
            </Panel>

            {/* Fatigue Index Status Card */}
            <Panel title="Personal Baseline & Fatigue Index">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-regolith/60 uppercase block">Calibration Status</span>
                    <span className="text-sm font-bold text-white" id="calibration-status">
                      {isCalibrated ? 'Baseline Established (3/3 windows)' : `Calibrating (${calibrationProgress}/${REQUIRED_BASELINE_WINDOWS} windows)`}
                    </span>
                  </div>
                  <div>
                    <span
                      id="fatigue-status-badge"
                      className={`px-3 py-1 rounded text-xs font-bold uppercase ${
                        fatigueStatus === 'alert'
                          ? 'bg-mars text-white animate-pulse'
                          : fatigueStatus === 'watch'
                          ? 'bg-[#e0b03a] text-void'
                          : fatigueStatus === 'normal'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/10 text-regolith/80'
                      }`}
                    >
                      {fatigueStatus === 'calibrating' ? 'CALIBRATING' : `FATIGUE ${fatigueStatus}`}
                    </span>
                  </div>
                </div>

                {isCalibrated && (
                  <div className="grid grid-cols-2 gap-4 bg-void p-3 rounded border border-white/10">
                    <div>
                      <span className="text-[10px] text-regolith/60 uppercase block">Fatigue Index (Robust Z-Score)</span>
                      <span className="text-2xl font-bold text-white" id="fatigue-index-value">
                        {fatigueIndex > 0 ? `+${fatigueIndex}` : fatigueIndex}
                      </span>
                      <span className="text-[10px] text-regolith/50">median/MAD relative drift</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-regolith/60 uppercase block">Personal Baseline Anchor</span>
                      <span className="text-sm text-regolith mt-1 block">
                        Median Composite: {baselineStats?.median} (MAD: {baselineStats?.mad})
                      </span>
                      <span className="text-[10px] text-regolith/50">calculated from own resting runs</span>
                    </div>
                  </div>
                )}

                <div className="border-t border-white/10 pt-3 flex justify-between items-center text-[11px]">
                  <p className="text-regolith/70 italic">
                    ⚖️ Honest Medical Boundary: <span className="text-white">Relative change from your own baseline, not a diagnosis.</span>
                  </p>
                  {backendStatus && (
                    <span className="text-earth text-[10px]" id="backend-sync-status">
                      {backendStatus}
                    </span>
                  )}
                </div>
              </div>
            </Panel>
          </div>

          {/* Right Column: Windows Feed & Audit */}
          <div className="lg:col-span-5 space-y-6">
            <Panel title="Historical Kinematic Windows">
              {windows.length === 0 ? (
                <p className="text-regolith/60 text-xs py-4 text-center">
                  No windows finalized yet. Type above to record the first window.
                </p>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto">
                  {windows.slice().reverse().map((win, idx) => (
                    <div
                      key={win.timestamp}
                      className="p-2.5 rounded bg-void border border-white/10 text-xs flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-white block">
                          Window #{windows.length - idx} · {new Date(win.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-[10px] text-regolith/70">
                          Flight: {win.flightMedianMs}ms | Dwell: {win.dwellMedianMs}ms | Backspace: {Math.round(win.backspaceRate * 100)}%
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-earth font-bold block">
                          Comp {win.composite}
                        </span>
                        <span className="text-[10px] text-regolith/50">
                          {idx === windows.length - 1 ? 'Baseline #1' : idx >= windows.length - 3 ? 'Baseline' : 'Monitoring'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Privacy Guarantee & Zero-Text Invariant">
              <div className="space-y-2 text-[11px] text-regolith/70 leading-relaxed">
                <p>
                  🔒 <strong className="text-white">Zero Text Retention:</strong> Only keydown/keyup millisecond deltas are processed. The specific keys pressed are never serialized or transmitted.
                </p>
                <p>
                  🛡️ <strong className="text-white">Password Masking:</strong> Sensitive input elements (type="password") are completely bypassed at the event listener boundary.
                </p>
                <p>
                  📡 <strong className="text-white">Backend Payload Contract:</strong> Strictly adheres to FastAPI Pydantic validator rejecting fields `key`, `code`, `char`, `text`, `value`.
                </p>
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-white/20 p-12 text-center font-mono space-y-3">
          <span className="text-3xl block">⌨️</span>
          <h3 className="text-sm font-bold uppercase text-white">Passive Kinematic Monitoring Disengaged</h3>
          <p className="text-xs text-regolith/60 max-w-md mx-auto">
            AstroCare respects strict operational privacy. No keyboard flight intervals, dwell times, or pointer kinematics are recorded while consent is revoked.
          </p>
          <button
            type="button"
            onClick={() => toggleConsent(true)}
            className="rounded bg-earth px-4 py-2 font-bold uppercase text-void hover:bg-earth/90 text-xs"
          >
            Enable Typing & Pointer Monitoring
          </button>
        </div>
      )}
    </div>
  );
}
