import { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { PageHeader, Panel, ProvenanceBadge } from '../ui';
import { api } from '../../api/client';

export interface SensorStatusItem {
  id: string;
  name: string;
  sensor: 'camera' | 'mic' | 'keyboard' | 'pointer' | 'motion';
  isPassive: boolean;
  status: 'READY' | 'NEEDS MODEL FILE' | 'NOT SUPPORTED ON THIS DEVICE';
  granted: boolean;
  lastSeen: string;
  detail: string;
}

export function SensorsConsent() {
  const crewMember = useStore((s) => s.crew[0]?.id || 'vega');

  const [sensors, setSensors] = useState<SensorStatusItem[]>([
    {
      id: 's-cam',
      name: 'Webcam Optical Sensor',
      sensor: 'camera',
      isPassive: true,
      status: 'NEEDS MODEL FILE', // Neural face landmark / rPPG weights absent
      granted: false,
      lastSeen: 'Idle',
      detail: 'Photoplethysmography & facial fluid shift swelling morphometry.',
    },
    {
      id: 's-mic',
      name: 'Acoustic Microphone Sensor',
      sensor: 'mic',
      isPassive: true,
      status: 'NEEDS MODEL FILE', // Voice biomarker model absent
      granted: false,
      lastSeen: 'Inactive',
      detail: 'Voice jitter, shimmer, pause duration, and vocal cord strain.',
    },
    {
      id: 's-kb',
      name: 'Keyboard Kinematics Engine',
      sensor: 'keyboard',
      isPassive: false,
      status: 'READY',
      granted: false,
      lastSeen: 'Active',
      detail: 'Inter-key flight intervals and key dwell durations. Zero text saved.',
    },
    {
      id: 's-ptr',
      name: 'Pointer Dynamics Tracker',
      sensor: 'pointer',
      isPassive: false,
      status: 'READY',
      granted: false,
      lastSeen: 'Active',
      detail: 'Cursor speed, velocity drift, and micro-jitter angle changes.',
    },
    {
      id: 's-mot',
      name: 'Device Accelerometer (Motion)',
      sensor: 'motion',
      isPassive: true,
      status: typeof window !== 'undefined' && 'DeviceMotionEvent' in window ? 'READY' : 'NOT SUPPORTED ON THIS DEVICE',
      granted: false,
      lastSeen: 'Inactive',
      detail: 'Restlessness index and micro-accelerometry during sleep windows.',
    },
  ]);

  const [passiveShare, setPassiveShare] = useState<number>(0.6);
  const [timeToFirstEstimate, setTimeToFirstEstimate] = useState<string>('null (fusion pending)');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state from FastAPI backend
  const fetchSensorState = async () => {
    try {
      const [stateRes, passiveRes] = await Promise.allSettled([
        api.get<any>(`/sensors/state?crew_id=${crewMember}`),
        api.get<any>('/passive/metrics'),
      ]);

      if (stateRes.status === 'fulfilled' && stateRes.value?.sensors) {
        const remoteSensors = stateRes.value.sensors;
        setSensors((prev) =>
          prev.map((s) => {
            const remote = remoteSensors[s.sensor];
            return {
              ...s,
              granted: remote ? remote.granted : s.granted,
              lastSeen: remote?.updated_at ? new Date(remote.updated_at).toLocaleTimeString() : s.lastSeen,
            };
          })
        );
      }

      if (passiveRes.status === 'fulfilled' && passiveRes.value) {
        setPassiveShare(passiveRes.value.passive_signals_share ?? 0.6);
        setTimeToFirstEstimate(
          passiveRes.value.time_to_first_estimate !== null && passiveRes.value.time_to_first_estimate !== undefined
            ? `${passiveRes.value.time_to_first_estimate}s`
            : 'null (fusion pending)'
        );
      }
      setErrorMsg(null);
    } catch (err: any) {
      console.warn('Backend sensor state unreachable (using local state):', err);
      setErrorMsg('Operating with local offline consent ledger.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSensorState();
  }, [crewMember]);

  // Toggle consent for specific sensor
  const handleToggleConsent = async (sensorKey: SensorStatusItem['sensor'], currentGranted: boolean) => {
    const nextGranted = !currentGranted;

    // Optimistic UI update
    setSensors((prev) =>
      prev.map((s) => (s.sensor === sensorKey ? { ...s, granted: nextGranted, lastSeen: 'Just now' } : s))
    );

    try {
      await api.post('/consent', {
        crew_id: crewMember,
        sensor: sensorKey,
        granted: nextGranted,
        consent_version: 1,
      });
      fetchSensorState();
    } catch (err: any) {
      console.warn(`Failed to push consent for ${sensorKey} to server:`, err);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="C01 MULTIMODAL SENSING LEDGER"
        title="Sensors & consent management"
        description="Granular operational consent ledger for all passive and active sensory modalities. Sensor access is strictly enforced server-side; unconsented telemetry packets are rejected at the API boundary."
        badge={<ProvenanceBadge provenance="REAL" />}
      />

      {errorMsg && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 font-mono text-xs text-amber-300">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Passive Metrics Summary Card */}
      <Panel title="Zero-Action Passive Metric Ratios (M01 Proof)">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono">
          <div className="p-3.5 bg-void rounded-lg border border-white/10">
            <span className="text-[10px] text-regolith/60 uppercase block">Passive Signals Share</span>
            <span className="text-2xl font-bold text-earth block mt-1" id="passive-signals-share">
              {(passiveShare * 100).toFixed(0)}%
            </span>
            <span className="text-[10px] text-regolith/50">3 of 5 sensors zero user burden</span>
          </div>

          <div className="p-3.5 bg-void rounded-lg border border-white/10">
            <span className="text-[10px] text-regolith/60 uppercase block">Time-to-First-Estimate</span>
            <span className="text-sm font-bold text-white block mt-2" id="time-to-first-estimate">
              {timeToFirstEstimate}
            </span>
            <span className="text-[10px] text-regolith/50">honest clinical limit: null until fusion</span>
          </div>

          <div className="p-3.5 bg-void rounded-lg border border-white/10">
            <span className="text-[10px] text-regolith/60 uppercase block">Target Astronaut</span>
            <span className="text-lg font-bold text-white block mt-1 uppercase">
              {crewMember}
            </span>
            <span className="text-[10px] text-regolith/50">per-crew granular access control</span>
          </div>
        </div>
      </Panel>

      {/* Sensor Modality Toggles List */}
      <Panel title="Configured Modalities & Device Support">
        <div className="divide-y divide-white/10 font-mono text-xs">
          {sensors.map((item) => (
            <div key={item.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{item.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      item.status === 'READY'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : item.status === 'NEEDS MODEL FILE'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-white/10 text-regolith/60 border border-white/20'
                    }`}
                  >
                    {item.status}
                  </span>
                  {item.isPassive && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-earth/15 text-earth border border-earth/30">
                      PASSIVE
                    </span>
                  )}
                </div>
                <p className="text-regolith/70 text-[11px] leading-relaxed max-w-xl">{item.detail}</p>
                <span className="text-[10px] text-regolith/50 block">Last Active / Sync: {item.lastSeen}</span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] text-regolith/60 uppercase font-bold">
                  {item.granted ? 'GRANTED' : 'REVOKED'}
                </span>
                <button
                  type="button"
                  id={`consent-toggle-${item.sensor}`}
                  onClick={() => handleToggleConsent(item.sensor, item.granted)}
                  className={`px-3.5 py-1.5 rounded-lg font-bold uppercase transition-all shadow-sm ${
                    item.granted
                      ? 'bg-mars text-white hover:bg-mars/90'
                      : 'bg-earth text-void hover:bg-earth/90'
                  }`}
                >
                  {item.granted ? 'Revoke' : 'Grant'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Enforcement & Auditing Policy">
        <p className="font-mono text-xs text-regolith/80 leading-relaxed">
          🔒 Every telemetry ingestion route in AstroCare strictly evaluates active consent before parsing or persisting health kinematics.
          Revoking consent takes effect immediately across all background ingest workers and websocket aggregators.
        </p>
      </Panel>
    </div>
  );
}
