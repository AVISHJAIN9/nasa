import {useState} from 'react';
import {useStore} from '../../store';
import {Panel, PageHeader} from '../ui';
import {computeWhatIfScenario} from '../../data/whatif';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

export function WhatIf() {
  const crew = useStore((s) => s.crew);
  const selectedCrewId = useStore((s) => s.selectedCrewId);
  const setSelectedCrewId = useStore((s) => s.setSelectedCrewId);

  const [activeCrewId, setActiveCrewId] = useState<string>(selectedCrewId || crew[0]?.id || 'vega');
  const [scenarioId, setScenarioId] = useState<'no_exercise' | 'co2_elevation' | 'sleep_deficit'>('no_exercise');
  const [activeMetric, setActiveMetric] = useState<'hr' | 'hrv' | 'risk'>('hr');

  const activeMember = crew.find((c) => c.id === activeCrewId) || crew[0];
  const projection = computeWhatIfScenario(scenarioId, activeMember.baseline.hr, activeMember.baseline.hrv);

  // Compute delta for min/max area representation in Recharts:
  // base = min, band = max - min
  const chartData = projection.points.map((p) => ({
    label: p.label,
    hr: p.restingHr,
    hrMin: p.hrMin,
    hrBand: p.hrMax - p.hrMin,
    hrv: p.hrv,
    hrvMin: p.hrvMin,
    hrvBand: p.hrvMax - p.hrvMin,
    risk: p.riskScore,
    riskMin: p.riskMin,
    riskBand: p.riskMax - p.riskMin,
  }));

  const scenarios: Array<{
    id: 'no_exercise' | 'co2_elevation' | 'sleep_deficit';
    title: string;
    duration: string;
    icon: string;
  }> = [
    {id: 'no_exercise', title: 'No exercise for 14 days', duration: '14 Days', icon: '🏃‍♂️'},
    {id: 'co2_elevation', title: 'CO2 held at 2500 ppm for 3 days', duration: '72 Hours', icon: '💨'},
    {id: 'sleep_deficit', title: 'Sleep 5 h for 7 days', duration: '7 Days', icon: '💤'},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="F105 IN-SILICO MODELING"
        title="What-if counterfactual clinical projections"
        description="Parametric multi-day trajectory modeling of physiological degradation under operational microgravity stressors."
      />

      {/* Slim 36px Disclaimer Banner */}
      <div className="h-9 px-3 rounded-lg bg-mars/15 border border-mars/40 font-mono text-xs text-mars flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <span>⚠️</span>
          <span className="font-bold uppercase tracking-wider truncate">
            Illustrative projections, not validated clinical predictions.
          </span>
        </div>
        <span className="text-[11px] text-regolith/70 hidden sm:inline shrink-0">
          Synthetic parametric models · Non-diagnostic
        </span>
      </div>

      {/* Selectors */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Crew Selector */}
        <div className="space-y-2 font-mono text-xs">
          <span className="text-regolith/60 uppercase block">1. Select Target Astronaut</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {crew.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveCrewId(c.id);
                  setSelectedCrewId(c.id);
                }}
                className={`rounded p-2 text-center uppercase font-bold border transition-colors min-h-[44px] ${
                  c.id === activeCrewId
                    ? 'bg-earth text-void border-earth shadow'
                    : 'bg-void text-regolith/75 border-white/10 hover:border-white/30 hover:text-white'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Scenario Selector */}
        <div className="space-y-2 font-mono text-xs">
          <span className="text-regolith/60 uppercase block">2. Select Operational Stressor Scenario</span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {scenarios.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => setScenarioId(sc.id)}
                className={`rounded p-2 text-left uppercase font-bold border transition-colors flex flex-col justify-between min-h-[44px] ${
                  scenarioId === sc.id
                    ? 'bg-white/20 text-white border-white/30 shadow'
                    : 'bg-void text-regolith/70 border-white/10 hover:border-white/20 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs">
                  <span>{sc.icon}</span>
                  <span className="line-clamp-1">{sc.title}</span>
                </div>
                <span className="text-[11px] text-regolith/50 pt-1">{sc.duration}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scenario Summary Card */}
      <Panel
        title={`Scenario Dynamics: ${projection.title}`}
        badge={<span className="rounded bg-white/10 text-regolith/80 px-2 py-0.5 text-[11px] font-mono uppercase font-bold">Illustrative</span>}
      >
        <div className="space-y-4 font-mono text-xs">
          <p className="text-regolith/90 leading-relaxed">{projection.summary}</p>

          {/* Metric Selector Buttons */}
          <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4">
            <span className="text-regolith/60 uppercase mr-2 self-center">Projected Metric:</span>
            {[
              {id: 'hr', label: 'Resting Heart Rate (bpm)', color: '#e2704a'},
              {id: 'hrv', label: 'Heart Rate Variability (ms)', color: '#6fb6ff'},
              {id: 'risk', label: 'Deconditioning Risk Score (0-100)', color: '#e0b03a'},
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveMetric(m.id as typeof activeMetric)}
                className={`rounded px-3 py-1.5 uppercase font-bold border transition-colors min-h-[40px] ${
                  activeMetric === m.id
                    ? 'bg-white/20 text-white border-white/30 shadow'
                    : 'bg-void text-regolith/60 border-white/10 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Recharts Area Projection Chart */}
          <div className="h-[220px] sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{top: 10, right: 20, left: 0, bottom: 0}}>
                <XAxis dataKey="label" stroke="#8b909b" fontSize={10} />
                <YAxis
                  stroke="#8b909b"
                  fontSize={10}
                  domain={[(dataMin: number) => Math.floor(dataMin * 0.95), (dataMax: number) => Math.ceil(dataMax * 1.05)]}
                  tickFormatter={(val) => Number(val).toFixed(1)}
                />
                <Tooltip />
                <Legend />

                {activeMetric === 'hr' && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="hrMin"
                      stackId="band"
                      stroke="transparent"
                      fill="transparent"
                      legendType="none"
                    />
                    <Area
                      type="monotone"
                      dataKey="hrBand"
                      name="Confidence Envelope (Min-Max)"
                      stackId="band"
                      stroke="#e2704a"
                      strokeDasharray="3 3"
                      fill="#e2704a"
                      fillOpacity={0.2}
                    />
                    <Area
                      type="monotone"
                      dataKey="hr"
                      name="Projected Resting HR"
                      stroke="#e2704a"
                      strokeWidth={2.5}
                      fill="transparent"
                    />
                  </>
                )}

                {activeMetric === 'hrv' && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="hrvMin"
                      stackId="band"
                      stroke="transparent"
                      fill="transparent"
                      legendType="none"
                    />
                    <Area
                      type="monotone"
                      dataKey="hrvBand"
                      name="Confidence Envelope (Min-Max)"
                      stackId="band"
                      stroke="#6fb6ff"
                      strokeDasharray="3 3"
                      fill="#6fb6ff"
                      fillOpacity={0.2}
                    />
                    <Area
                      type="monotone"
                      dataKey="hrv"
                      name="Projected HRV"
                      stroke="#6fb6ff"
                      strokeWidth={2.5}
                      fill="transparent"
                    />
                  </>
                )}

                {activeMetric === 'risk' && (
                  <>
                    <Area
                      type="monotone"
                      dataKey="riskMin"
                      stackId="band"
                      stroke="transparent"
                      fill="transparent"
                      legendType="none"
                    />
                    <Area
                      type="monotone"
                      dataKey="riskBand"
                      name="Confidence Envelope (Min-Max)"
                      stackId="band"
                      stroke="#e0b03a"
                      strokeDasharray="3 3"
                      fill="#e0b03a"
                      fillOpacity={0.2}
                    />
                    <Area
                      type="monotone"
                      dataKey="risk"
                      name="Risk Score"
                      stroke="#e0b03a"
                      strokeWidth={2.5}
                      fill="transparent"
                    />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Envelope Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="rounded bg-void p-3 border border-white/10">
              <span className="text-[11px] text-regolith/50 uppercase block">Baseline Value</span>
              <span className="text-white font-bold font-display text-sm">
                {activeMetric === 'hr'
                  ? `${activeMember.baseline.hr} bpm`
                  : activeMetric === 'hrv'
                  ? `${activeMember.baseline.hrv} ms`
                  : '15 / 100'}
              </span>
            </div>

            <div className="rounded bg-void p-3 border border-white/10">
              <span className="text-[11px] text-regolith/50 uppercase block">Terminal Projected Value</span>
              <span className="text-mars font-bold font-display text-sm">
                {activeMetric === 'hr'
                  ? `${chartData[chartData.length - 1].hr} bpm`
                  : activeMetric === 'hrv'
                  ? `${chartData[chartData.length - 1].hrv} ms`
                  : `${chartData[chartData.length - 1].risk} / 100`}
              </span>
            </div>

            <div className="rounded bg-void p-3 border border-white/10">
              <span className="text-[11px] text-regolith/50 uppercase block">Projected Trajectory Drift</span>
              <span className="text-earth font-bold font-display text-sm">
                {activeMetric === 'hr'
                  ? `+${chartData[chartData.length - 1].hr - activeMember.baseline.hr} bpm`
                  : activeMetric === 'hrv'
                  ? `${chartData[chartData.length - 1].hrv - activeMember.baseline.hrv} ms`
                  : `+${chartData[chartData.length - 1].risk - 15} pts`}
              </span>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
