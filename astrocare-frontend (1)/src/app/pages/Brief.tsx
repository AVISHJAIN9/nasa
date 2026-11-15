import {useState} from 'react';
import {useStore} from '../../store';
import {Panel, PageHeader} from '../ui';

export function Brief() {
  const crew = useStore((s) => s.crew);
  const selectedCrewId = useStore((s) => s.selectedCrewId);
  const setSelectedCrewId = useStore((s) => s.setSelectedCrewId);
  const alerts = useStore((s) => s.alerts);
  const moodLogs = useStore((s) => s.moodLogs);
  const painLogs = useStore((s) => s.painLogs);
  const visionLogs = useStore((s) => s.visionLogs);

  const [activeCrewId, setActiveCrewId] = useState<string>(selectedCrewId || crew[0]?.id || 'vega');
  const [regenCount, setRegenCount] = useState<number>(0);

  const activeMember = crew.find((c) => c.id === activeCrewId) || crew[0];

  // Sigma thresholds and current readings
  const hrStream = activeMember.readings.hr;
  const hrvStream = activeMember.readings.hrv;
  const spo2Stream = activeMember.readings.spo2;
  const tempStream = activeMember.readings.temp;

  const currentHr = hrStream[hrStream.length - 1]?.value ?? activeMember.baseline.hr;
  const currentHrv = hrvStream[hrStream.length - 1]?.value ?? activeMember.baseline.hrv;
  const currentSpo2 = spo2Stream[hrStream.length - 1]?.value ?? activeMember.baseline.spo2;
  const currentTemp = tempStream[hrStream.length - 1]?.value ?? activeMember.baseline.temp;

  // Assumed standard deviations for 1.5-sigma checks
  const SD_HR = 7.5;
  const SD_HRV = 8.0;
  const SD_SPO2 = 0.7;
  const SD_TEMP = 0.2;

  const hrZ = (currentHr - activeMember.baseline.hr) / SD_HR;
  const hrvZ = (currentHrv - activeMember.baseline.hrv) / SD_HRV;
  const spo2Z = (currentSpo2 - activeMember.baseline.spo2) / SD_SPO2;
  const tempZ = (currentTemp - activeMember.baseline.temp) / SD_TEMP;

  // Filter metrics with > 1.5 sigma drift
  const driftList: Array<{metric: string; z: number; val: string; base: string}> = [];
  if (Math.abs(hrZ) >= 1.5) {
    driftList.push({
      metric: 'Heart Rate',
      z: hrZ,
      val: `${Math.round(currentHr)} bpm`,
      base: `${activeMember.baseline.hr} bpm`,
    });
  }
  if (Math.abs(hrvZ) >= 1.5) {
    driftList.push({
      metric: 'Heart Rate Variability',
      z: hrvZ,
      val: `${Math.round(currentHrv)} ms`,
      base: `${activeMember.baseline.hrv} ms`,
    });
  }
  if (Math.abs(spo2Z) >= 1.5) {
    driftList.push({
      metric: 'SpO2 Oxygen Saturation',
      z: spo2Z,
      val: `${currentSpo2.toFixed(1)}%`,
      base: `${activeMember.baseline.spo2}%`,
    });
  }
  if (Math.abs(tempZ) >= 1.5) {
    driftList.push({
      metric: 'Core Temperature',
      z: tempZ,
      val: `${currentTemp.toFixed(1)}°C`,
      base: `${activeMember.baseline.temp}°C`,
    });
  }

  // Active alerts for this crew member or craft
  const crewAlerts = alerts.filter(
    (a) => a.status !== 'resolved' && (!a.crewId || a.crewId === activeCrewId)
  );

  // Check-ins for this crew member
  const memberMood = moodLogs.find((m) => m.crewId === activeCrewId);
  const memberPain = painLogs.find((p) => p.crewId === activeCrewId);
  const memberVision = visionLogs.find((v) => v.crewId === activeCrewId);

  // Watch list compilation
  const watchItems: Array<{item: string; reason: string; chip: string}> = [];
  if (driftList.length > 0) {
    watchItems.push({
      item: 'Autonomic Baseline Drift',
      reason: `${driftList.map((d) => d.metric).join(', ')} exceeded statistical tolerance band.`,
      chip: `${driftList[0].metric}: ${driftList[0].val} (${driftList[0].z > 0 ? '+' : ''}${driftList[0].z.toFixed(1)}σ)`,
    });
  }
  if (memberPain && memberPain.areas.length > 0) {
    watchItems.push({
      item: 'Musculoskeletal Discomfort',
      reason: `Reported pain in ${memberPain.areas.map((a) => a.label).join(', ')}.`,
      chip: `Pain: Max ${Math.max(...memberPain.areas.map((a) => a.severity))}/10`,
    });
  }
  if (memberVision && memberVision.amslerDistortions > 0) {
    watchItems.push({
      item: 'SANS Metamorphopsia Check',
      reason: 'Amsler grid distortion logged during self-exam.',
      chip: `Amsler: ${memberVision.amslerDistortions} cells`,
    });
  }
  if (watchItems.length === 0) {
    watchItems.push({
      item: 'Routine Surveillance',
      reason: 'No physiological or psychological triggers flagged for active surveillance.',
      chip: 'Status: Nominal',
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="F101 AUTONOMOUS SYNTHESIS"
        title="Daily clinical health brief"
        description="Templated, verifiable daily crew status synthesis. Every clinical statement embeds an exact source telemetry chip for auditability."
        actions={
          <button
            type="button"
            onClick={() => setRegenCount((c) => c + 1)}
            className="rounded bg-earth px-4 py-2 font-mono text-xs font-bold uppercase text-void hover:bg-earth/90 transition-colors shadow flex items-center gap-2"
          >
            <span>↻</span>
            <span>Regenerate Synthesis</span>
          </button>
        }
      />

      {/* Crew Selector */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="text-regolith/60 uppercase mr-1">Select Crew Member:</span>
        {crew.map((c) => {
          const isSel = c.id === activeCrewId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setActiveCrewId(c.id);
                setSelectedCrewId(c.id);
              }}
              className={`rounded px-3.5 py-2 uppercase font-bold border transition-colors min-h-[44px] ${
                isSel
                  ? 'bg-earth text-void border-earth shadow'
                  : 'bg-void text-regolith/75 border-white/15 hover:border-white/30 hover:text-white'
              }`}
            >
              {c.name} · {c.roleTitle}
            </button>
          );
        })}
      </div>

      {/* Brief Content Box */}
      <Panel
        title={`Executive Medical Brief: ${activeMember.name} (Sol 142 · Rev ${regenCount + 1})`}
      >
        <div className="space-y-6 font-mono text-xs">
          {/* Section 1: What Changed (> 1.5 sigma drift) */}
          <div className="rounded-xl bg-void p-5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-display text-xs text-white font-bold uppercase tracking-wider flex items-center gap-2">
                <span>📈</span>
                <span>1. What Changed (Last 24h &gt; 1.5σ Drift)</span>
              </h3>
              <span className="text-[11px] text-regolith/60 uppercase">
                Threshold: |Z| &ge; 1.5
              </span>
            </div>

            {driftList.length === 0 ? (
              <p className="text-regolith/80 leading-relaxed flex flex-wrap items-center gap-2">
                <span>All biometric streams tracked within acceptable statistical deviation limits (&lt; 1.5σ from mission baseline).</span>
                <span className="rounded bg-white/10 text-earth px-2 py-0.5 text-[11px] font-bold">
                  HR: {Math.round(currentHr)} bpm ({hrZ >= 0 ? '+' : ''}{hrZ.toFixed(1)}σ)
                </span>
                <span className="rounded bg-white/10 text-earth px-2 py-0.5 text-[11px] font-bold">
                  HRV: {Math.round(currentHrv)} ms ({hrvZ >= 0 ? '+' : ''}{hrvZ.toFixed(1)}σ)
                </span>
                <span className="rounded bg-white/10 text-earth px-2 py-0.5 text-[11px] font-bold">
                  SpO2: {currentSpo2.toFixed(1)}%
                </span>
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-white leading-relaxed">
                  Significant statistical baseline deviation detected in {driftList.length} parameter(s) during past operational cycle:
                </p>
                <div className="space-y-1.5 pt-1">
                  {driftList.map((d, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-mars font-bold">• {d.metric}</span>
                      <span>drifted to</span>
                      <span className="rounded bg-mars/20 text-mars border border-mars/30 px-2 py-0.5 text-[11px] font-bold">
                        {d.val} (baseline: {d.base}, {d.z > 0 ? '+' : ''}{d.z.toFixed(1)}σ)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Watch List */}
          <div className="rounded-xl bg-void p-5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-display text-xs text-white font-bold uppercase tracking-wider flex items-center gap-2">
                <span>🔍</span>
                <span>2. Clinical Watch List</span>
              </h3>
              <span className="text-[11px] text-regolith/60 uppercase">
                {watchItems.length} active priority item(s)
              </span>
            </div>

            <div className="space-y-2">
              {watchItems.map((w, idx) => (
                <div key={idx} className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-void-2 border border-white/5">
                  <div className="space-y-0.5">
                    <span className="text-white font-bold block">{w.item}</span>
                    <span className="text-regolith/75 text-[11px]">{w.reason}</span>
                  </div>
                  <span className="rounded bg-earth/20 text-earth border border-earth/30 px-2 py-0.5 text-[11px] font-bold">
                    {w.chip}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Open Alerts */}
          <div className="rounded-xl bg-void p-5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-display text-xs text-white font-bold uppercase tracking-wider flex items-center gap-2">
                <span>⚠️</span>
                <span>3. Active Clinical & Environmental Alerts</span>
              </h3>
              <span className="text-[11px] text-regolith/60 uppercase">
                {crewAlerts.length} unresolved
              </span>
            </div>

            {crewAlerts.length === 0 ? (
              <p className="text-regolith/75 flex items-center gap-2">
                <span>No active critical or advisory alerts for this astronaut.</span>
                <span className="rounded bg-emerald-500/20 text-emerald-300 px-2 py-0.5 text-[11px] font-bold">
                  Status: All Clear
                </span>
              </p>
            ) : (
              <div className="space-y-2">
                {crewAlerts.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded bg-void-2 border border-mars/20">
                    <div>
                      <span className="text-white font-bold block">{a.title}</span>
                      <span className="text-regolith/70 text-[11px]">{a.explanation}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-mars/20 text-mars border border-mars/40 px-2 py-0.5 text-[11px] font-bold uppercase">
                        {a.severity}
                      </span>
                      <span className="rounded bg-white/10 text-regolith px-2 py-0.5 text-[11px]">
                        {a.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: Check-Ins */}
          <div className="rounded-xl bg-void p-5 border border-white/10 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-display text-xs text-white font-bold uppercase tracking-wider flex items-center gap-2">
                <span>📋</span>
                <span>4. Self-Reported Check-In Telemetry</span>
              </h3>
              <span className="text-[11px] text-regolith/60 uppercase">
                Last Logged Cycle
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded bg-void-2 p-3 border border-white/5 space-y-1">
                <span className="text-[11px] text-regolith/50 uppercase block">Psychological Screening</span>
                <span className="text-white font-bold">
                  {memberMood ? `PHQ: ${memberMood.phqScore}/6 · GAD: ${memberMood.gadScore}/6` : 'No mood logged'}
                </span>
                <span className="rounded bg-earth/20 text-earth px-2 py-0.5 text-[11px] font-bold inline-block">
                  {memberMood ? memberMood.timeStr : 'Pending'}
                </span>
              </div>

              <div className="rounded bg-void-2 p-3 border border-white/5 space-y-1">
                <span className="text-[11px] text-regolith/50 uppercase block">Musculoskeletal Pain</span>
                <span className="text-white font-bold">
                  {memberPain ? `${memberPain.areas.length} area(s) reported` : 'No pain logged'}
                </span>
                <span className="rounded bg-earth/20 text-earth px-2 py-0.5 text-[11px] font-bold inline-block">
                  {memberPain ? memberPain.timeStr : 'Nominal'}
                </span>
              </div>

              <div className="rounded bg-void-2 p-3 border border-white/5 space-y-1">
                <span className="text-[11px] text-regolith/50 uppercase block">Visual Acuity Screening</span>
                <span className="text-white font-bold">
                  {memberVision ? `Snellen: ${memberVision.acuityScore}` : 'No vision logged'}
                </span>
                <span className="rounded bg-earth/20 text-earth px-2 py-0.5 text-[11px] font-bold inline-block">
                  {memberVision ? `${memberVision.timeStr}` : 'Baseline 1.0'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
