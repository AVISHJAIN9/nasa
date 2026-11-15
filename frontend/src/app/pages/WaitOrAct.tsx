import {useState, useMemo} from 'react';
import {useStore, type Incident} from '../../store';
import {Panel, Gauge, PageHeader, DelaySlider} from '../ui';
import {ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend} from 'recharts';

// Seeded RNG (seed 42) for deterministic policy comparison over 1000 simulated incidents
function createSeededSimulator() {
  let s = 42;
  const rng = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };

  const incidents = Array.from({length: 1000}, () => {
    const sev = +(0.2 + rng() * 0.8).toFixed(2);
    const ttc = +(8 + rng() * 52).toFixed(1); // 8 to 60 minutes
    const resolvesOnOwn = rng() < 0.38; // incident that would have resolved without intervention
    return {sev, ttc, resolvesOnOwn};
  });

  const delays = [0, 2, 10, 20, 44];

  const comparison = delays.map((delay) => {
    // 1. Wait-or-Act Policy
    let woaTimeSum = 0;
    let woaMissed = 0;

    // 2. Always-Wait Policy
    let waitTimeSum = 0;
    let waitMissed = 0;

    // 3. Always-Act Policy
    let actTimeSum = 0;
    let actMissed = 0;
    let actUnnecessary = 0;

    incidents.forEach(({sev, ttc, resolvesOnOwn}) => {
      // pHarm calculation
      const pHarm = Math.min(1, Math.max(0, delay / ttc)) * sev;
      const decision = pHarm > 0.6 ? 'ACT NOW' : pHarm > 0.25 ? 'ACT SAFELY' : 'WAIT';

      // Wait-or-Act
      if (decision === 'ACT NOW') {
        woaTimeSum += 1.5;
        if (ttc < 1.5) woaMissed++;
      } else if (decision === 'ACT SAFELY') {
        woaTimeSum += 3.0;
        if (ttc < 3.0) woaMissed++;
      } else {
        woaTimeSum += delay;
        if (delay > ttc) woaMissed++;
      }

      // Always-Wait
      waitTimeSum += delay;
      if (delay > ttc) waitMissed++;

      // Always-Act: intervenes on every incident
      actTimeSum += 1.5;
      if (ttc < 1.5) actMissed++;
      if (resolvesOnOwn) actUnnecessary++;
    });

    return {
      delayLabel: `${delay} min`,
      delay,
      woaTime: +(woaTimeSum / 1000).toFixed(1),
      woaMissed: +(woaMissed / 10).toFixed(1), // percentage
      waitTime: +(waitTimeSum / 1000).toFixed(1),
      waitMissed: +(waitMissed / 10).toFixed(1),
      actTime: +(actTimeSum / 1000).toFixed(1),
      actMissed: +(actMissed / 10).toFixed(1),
      actUnnecessary: +(actUnnecessary / 10).toFixed(1), // actions taken on self-resolving incidents
    };
  });

  return comparison;
}

export function WaitOrAct() {
  const incidents = useStore((s) => s.incidents);
  const resolveIncident = useStore((s) => s.resolveIncident);
  const startProtocol = useStore((s) => s.startProtocol);
  const sendMessage = useStore((s) => s.sendMessage);
  const setPage = useStore((s) => s.setPage);
  const addToast = useStore((s) => s.addToast);

  const [selectedIncidentId, setSelectedIncidentId] = useState<string>(incidents[0]?.id || '');
  const [sliderDelay, setSliderDelay] = useState<number>(44); // default Mars delay 44 min

  const simComparison = useMemo(() => createSeededSimulator(), []);

  const activeIncident: Incident =
    incidents.find((i) => i.id === selectedIncidentId) ||
    incidents[0] || {
      id: 'mock',
      title: 'Hab Atmospheric CO2 Elevation',
      severity: 0.8,
      timeToCritical: 25,
      status: 'pending',
      createdAt: Date.now(),
    };

  // Decision rule calculation
  // pHarm = clamp(rttMin / timeToCritical, 0, 1) * severity
  const rawRatio = activeIncident.timeToCritical > 0 ? sliderDelay / activeIncident.timeToCritical : 1;
  const clampedRatio = Math.min(1, Math.max(0, rawRatio));
  const pHarm = clampedRatio * activeIncident.severity;

  const decision: 'ACT NOW' | 'ACT SAFELY + CONSULT' | 'WAIT FOR EARTH' =
    pHarm > 0.6
      ? 'ACT NOW'
      : pHarm > 0.25
      ? 'ACT SAFELY + CONSULT'
      : 'WAIT FOR EARTH';

  const decisionColor =
    decision === 'ACT NOW'
      ? 'bg-mars text-white border-mars shadow-[0_0_20px_rgba(226,112,74,0.3)]'
      : decision === 'ACT SAFELY + CONSULT'
      ? 'bg-[#e0b03a] text-void border-[#e0b03a]'
      : 'bg-earth text-void border-earth';

  const handleActOnIncident = () => {
    resolveIncident(activeIncident.id);
    startProtocol('toxic-atmo');
    sendMessage('crew', `AUTONOMOUS TRIAGE INITIATED: Executing toxic atmosphere protocol for ${activeIncident.title}`, 'report');
    addToast('Executing autonomous protocol. Report queued for ground review.', 'success');
    setPage('protocols');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="X01 OPERATIONAL ENGINE"
        title="Wait-or-act decision logic"
        description="Dynamically balances the hazard of autonomous intervention against the risk of patient deterioration during deep-space round-trip latency."
      />

      {/* Main Grid: Interactive Calculator + Active Incidents */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Live pHarm Decision Engine */}
        <div className="lg:col-span-2 space-y-6" data-tour="ch5-wait-or-act">
          <Panel title="Real-Time Decision Frontier" brackets>
            <div className="space-y-6">
              {/* Active Incident Metadata */}
              <div className="rounded-lg bg-void p-4 border border-white/10 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
                <div>
                  <span className="text-regolith/50 uppercase text-[11px] block">Target Incident</span>
                  <span className="text-white font-bold text-sm">{activeIncident.title}</span>
                </div>
                <div className="flex gap-4">
                  <div>
                    <span className="text-regolith/50 uppercase text-[11px] block">Severity Score</span>
                    <span className="text-mars font-bold">{(activeIncident.severity * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="text-regolith/50 uppercase text-[11px] block">Time to Critical</span>
                    <span className="text-earth font-bold">{activeIncident.timeToCritical} min</span>
                  </div>
                </div>
              </div>

              {/* Slider: Latency Delay with interactive hover tooltip & autonomy tiers */}
              <DelaySlider
                id="latency-slider"
                roundTripMinutes={sliderDelay}
                onChange={setSliderDelay}
                min={0}
                max={50}
                step={1}
              />

              {/* Decision Callout Badge */}
              <div className="rounded-xl border border-white/15 bg-void-2 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-[11px] text-regolith/50 uppercase block">Engine Recommendation</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`rounded px-3 py-1 font-display text-sm font-bold tracking-wider uppercase border ${decisionColor}`}>
                      {decision}
                    </span>
                    <span className="font-mono text-xs text-regolith/80">
                      (pHarm = {(pHarm * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-regolith/70">
                    {decision === 'ACT NOW' && 'Delay exceeds critical window. Immediate autonomous onboard intervention authorized.'}
                    {decision === 'ACT SAFELY + CONSULT' && 'Conservative stabilizing actions taken locally while asynchronous consult message is transmitted to Earth.'}
                    {decision === 'WAIT FOR EARTH' && 'Clinical deterioration risk is low relative to signal delay. Await Earth surgeon direction.'}
                  </p>
                </div>

                {decision !== 'WAIT FOR EARTH' && (
                  <button
                    type="button"
                    onClick={handleActOnIncident}
                    className="shrink-0 rounded bg-mars px-4 py-2.5 font-mono text-xs font-bold text-white uppercase hover:bg-mars/90 transition-colors shadow-lg"
                  >
                    Authorize Action →
                  </button>
                )}
              </div>
            </div>
          </Panel>
        </div>

        {/* Right Col: Gauge + Incident Picker */}
        <div className="space-y-6">
          <Panel title="Deterioration Hazard">
            <div className="flex justify-center py-2">
              <Gauge
                value={Math.round(pHarm * 100)}
                max={100}
                unit="%"
                label="pHarm Score"
                subtext={`Calculated at ${sliderDelay}m latency`}
              />
            </div>
          </Panel>

          <Panel title="Active Incident Queue">
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1 font-mono text-xs">
              {incidents.map((inc) => (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => setSelectedIncidentId(inc.id)}
                  className={`w-full text-left rounded p-3 border transition-colors ${
                    activeIncident.id === inc.id
                      ? 'border-earth bg-void-2 ring-1 ring-earth'
                      : 'border-white/10 bg-void hover:border-white/20'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-white truncate max-w-[200px]">{inc.title}</span>
                    <span className="text-[11px] text-mars">Sev {(inc.severity * 100).toFixed(0)}%</span>
                  </div>
                  <div className="mt-1 flex justify-between text-[11px] text-regolith/60">
                    <span>Critical in: {inc.timeToCritical}m</span>
                    <span className="uppercase">[{inc.status}]</span>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Policy Comparison Benchmark (1000 simulated incidents) */}
      <Panel
        title="Simulated Policy Comparison, Seed 42 (1,000 Incidents)"
        subtitle="Comparing Wait-or-Act algorithm vs Always-Wait vs Always-Act policies"
        badge={<span className="rounded bg-white/10 text-regolith/80 px-2 py-0.5 text-[11px] font-mono uppercase font-bold">Illustrative</span>}
      >
        <div className="space-y-6 font-mono text-xs">
          {/* Grouped Bar Chart */}
          <div className="h-[220px] sm:h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={simComparison} margin={{top: 10, right: 10, left: -10, bottom: 0}}>
                <XAxis dataKey="delayLabel" stroke="#8b909b" fontSize={11} />
                <YAxis stroke="#8b909b" fontSize={11} unit="%" />
                <Tooltip
                  content={({active, payload}) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded bg-void-2 border border-white/20 p-2.5 font-mono text-xs shadow-xl space-y-1">
                          <p className="font-bold text-white">{payload[0].payload.delayLabel} Latency</p>
                          <p className="text-earth">Wait-or-Act: {payload[0].value}% missed</p>
                          <p className="text-mars">Always-Wait: {payload[1].value}% missed</p>
                          <p className="text-regolith">Always-Act: {payload[2].value}% missed</p>
                          <p className="text-[#e0b03a]">Unnecessary Actions: {payload[3]?.value}%</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="woaMissed" name="Wait-or-Act Missed (%)" fill="#6fb6ff" />
                <Bar dataKey="waitMissed" name="Always-Wait Missed (%)" fill="#e2704a" />
                <Bar dataKey="actMissed" name="Always-Act Missed (%)" fill="#a0786a" />
                <Bar dataKey="actUnnecessary" name="Always-act unnecessary actions (%)" fill="#e0b03a" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="overflow-x-auto border-t border-white/10 pt-4">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-white/10 text-regolith/50 uppercase text-[11px]">
                  <th className="py-2">Latency Delay</th>
                  <th className="py-2 text-earth">WoA Time-to-Tx (min)</th>
                  <th className="py-2 text-earth">WoA Missed Det. (%)</th>
                  <th className="py-2 text-mars">Always-Wait Missed (%)</th>
                  <th className="py-2 text-regolith">Always-Act Missed (%)</th>
                  <th className="py-2 text-[#e0b03a]">Always-act unnecessary actions (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white">
                {simComparison.map((row) => (
                  <tr key={row.delay} className="hover:bg-white/5">
                    <td className="py-2 font-bold">{row.delayLabel}</td>
                    <td className="py-2 text-earth">{row.woaTime} min</td>
                    <td className="py-2 text-earth font-bold">{row.woaMissed}%</td>
                    <td className="py-2 text-mars font-bold">{row.waitMissed}%</td>
                    <td className="py-2 text-regolith">{row.actMissed}%</td>
                    <td className="py-2 text-[#e0b03a] font-bold">{row.actUnnecessary}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}
