import {useState} from 'react';
import {useStore} from '../../store';
import {Panel, PageHeader} from '../ui';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

export function Forecast() {
  const crew = useStore((s) => s.crew);
  const selectedCrewId = useStore((s) => s.selectedCrewId);
  const setSelectedCrewId = useStore((s) => s.setSelectedCrewId);

  const [activeCrewId, setActiveCrewId] = useState<string>(selectedCrewId || crew[0]?.id || 'vega');
  const [metric, setMetric] = useState<'hr' | 'hrv' | 'spo2' | 'temp'>('hr');
  const [horizon, setHorizon] = useState<24 | 48 | 72>(24);

  const targetMember = crew.find((c) => c.id === activeCrewId) || crew[0];

  // Fetch readings for chosen metric
  const stream = targetMember.readings[metric];
  const historyValues = stream.map((s) => s.value);

  // Fallback points if stream is short
  const values = historyValues.length >= 5
    ? historyValues.slice(-15)
    : [72, 73, 74, 75, 76, 78, 80, 81, 82, 84];

  // Holt's Linear Exponential Smoothing (alpha=0.3, beta=0.1)
  const alpha = 0.3;
  const beta = 0.1;

  let level = values[0];
  let trend = values.length > 1 ? values[1] - values[0] : 0;

  // Track one-step-ahead predictions for rolling backtest
  const holtOneStep: number[] = [values[0]];
  const naiveOneStep: number[] = [values[0]];

  for (let t = 1; t < values.length; t++) {
    const prevForecast = level + trend;
    holtOneStep.push(prevForecast);
    naiveOneStep.push(values[t - 1]);

    const actual = values[t];
    const prevLevel = level;
    level = alpha * actual + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }

  // Rolling backtest MAE calculation over stored history
  let holtErrSum = 0;
  let naiveErrSum = 0;
  const backtestCount = values.length - 1;

  for (let t = 1; t < values.length; t++) {
    holtErrSum += Math.abs(values[t] - holtOneStep[t]);
    naiveErrSum += Math.abs(values[t] - naiveOneStep[t]);
  }

  const holtMae = backtestCount > 0 ? +(holtErrSum / backtestCount).toFixed(2) : 0.8;
  const naiveMae = backtestCount > 0 ? +(naiveErrSum / backtestCount).toFixed(2) : 1.2;
  const beatsNaive = holtMae <= naiveMae;

  // Generate Future Forecast Points
  const lastVal = values[values.length - 1];
  const steps = horizon === 24 ? 8 : horizon === 48 ? 12 : 16;
  const stepHours = horizon / steps;

  // Residual std deviation estimate
  const sigmaRes = Math.max(0.4, holtMae * 0.85);

  const forecastPoints: Array<{
    label: string;
    actual?: number;
    holtForecast?: number;
    bandMin?: number;
    bandSpread?: number;
    naiveForecast?: number;
  }> = [];

  // Historical points
  values.forEach((v, i) => {
    forecastPoints.push({
      label: `H-${values.length - i}`,
      actual: +v.toFixed(1),
    });
  });

  // Future steps
  for (let h = 1; h <= steps; h++) {
    const projected = level + h * trend;
    const naive = lastVal;
    const margin = +(1.96 * sigmaRes * Math.sqrt(h)).toFixed(2);

    forecastPoints.push({
      label: `+${Math.round(h * stepHours)}h`,
      holtForecast: +projected.toFixed(1),
      bandMin: +(projected - margin).toFixed(1),
      bandSpread: +(2 * margin).toFixed(1),
      naiveForecast: +naive.toFixed(1),
    });
  }

  const metricLabels = {
    hr: {label: 'Heart Rate', unit: 'bpm', domain: [50, 110]},
    hrv: {label: 'Heart Rate Variability', unit: 'ms', domain: [15, 80]},
    spo2: {label: 'Blood Oxygen (SpO2)', unit: '%', domain: [90, 100]},
    temp: {label: 'Core Temperature', unit: '°C', domain: [35.5, 39.0]},
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="F044 Predictive Telemetry"
        title="Predictive telemetry forecast vs naive baseline"
        description="Real-time browser-evaluated dual exponential smoothing with rolling backtest MAE validation and expanding stochastic confidence bands."
      />

      {/* Selectors Bar */}
      <div className="grid gap-4 md:grid-cols-3 font-mono text-xs">
        {/* Crew */}
        <div>
          <span className="text-regolith/60 uppercase block mb-1.5 text-[11px]">1. Target Astronaut</span>
          <div className="grid grid-cols-2 gap-1.5">
            {crew.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveCrewId(c.id);
                  setSelectedCrewId(c.id);
                }}
                className={`rounded px-2.5 py-2 uppercase font-bold border transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none ${
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

        {/* Metric */}
        <div>
          <span className="text-regolith/60 uppercase block mb-1.5 text-[11px]">2. Biometric Metric</span>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              {id: 'hr', label: 'Heart Rate'},
              {id: 'hrv', label: 'HRV'},
              {id: 'spo2', label: 'SpO2'},
              {id: 'temp', label: 'Core Temp'},
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetric(m.id as typeof metric)}
                className={`rounded px-2.5 py-2 uppercase font-bold border transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none ${
                  metric === m.id
                    ? 'bg-white/20 text-white border-white/30 shadow'
                    : 'bg-void text-regolith/70 border-white/10 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Horizon */}
        <div>
          <span className="text-regolith/60 uppercase block mb-1.5 text-[11px]">3. Forecast Horizon</span>
          <div className="grid grid-cols-3 gap-1.5">
            {([24, 48, 72] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                className={`rounded px-2.5 py-2 uppercase font-bold border transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none ${
                  horizon === h
                    ? 'bg-earth text-void border-earth shadow'
                    : 'bg-void text-regolith/70 border-white/10 hover:text-white'
                }`}
              >
                +{h} Hours
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Model Benchmark Performance Strip */}
      <div className="rounded-xl bg-void-2 p-4 border border-white/10 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-regolith/60 uppercase text-[11px]">Rolling Backtest MAE:</span>
          <span className="rounded bg-earth/20 text-earth border border-earth/30 px-2.5 py-1 font-bold">
            Holt Smoothing: {holtMae} {metricLabels[metric].unit}
          </span>
          <span className="rounded bg-white/10 text-regolith/70 border border-white/15 px-2.5 py-1">
            Naive Last-Value: {naiveMae} {metricLabels[metric].unit}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-regolith/60 text-[11px] uppercase">Beats naive:</span>
            <span
              className={`rounded px-2.5 py-1 text-xs font-bold uppercase border ${
                beatsNaive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  : 'bg-mars/20 text-mars border border-mars/40'
              }`}
            >
              {beatsNaive ? 'YES ✓' : 'NO ✕'}
            </span>
          </div>

          <span className="text-[11px] text-regolith/50 italic">
            Note: Backtest on simulated data.
          </span>
        </div>
      </div>

      {/* Forecast Chart Panel */}
      <Panel
        title={`Predictive trajectory: ${metricLabels[metric].label} (${targetMember.name} · +${horizon}h horizon)`}
        badge={<span className="rounded bg-white/10 text-regolith/80 px-2 py-0.5 text-[11px] font-mono uppercase font-bold">Illustrative</span>}
      >
        <div className="space-y-4 font-mono text-xs">
          <div className="h-[220px] sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecastPoints} margin={{top: 10, right: 20, left: 0, bottom: 0}}>
                <XAxis dataKey="label" stroke="#8b909b" fontSize={10} />
                <YAxis
                  stroke="#8b909b"
                  fontSize={10}
                  domain={[(dataMin: number) => Math.floor(dataMin * 0.95), (dataMax: number) => Math.ceil(dataMax * 1.05)]}
                  tickFormatter={(val) => Number(val).toFixed(1)}
                />
                <Tooltip />
                <Legend />

                {/* Historical Observed Stream */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Observed History"
                  stroke="#ffffff"
                  strokeWidth={2}
                  dot={{r: 3}}
                />

                {/* Holt's Smoothing Forecast */}
                <Line
                  type="monotone"
                  dataKey="holtForecast"
                  name="Holt Forecast"
                  stroke="#6fb6ff"
                  strokeWidth={2.5}
                  strokeDasharray="4 2"
                  dot={{r: 3}}
                />

                {/* Naive Baseline Forecast */}
                <Line
                  type="stepAfter"
                  dataKey="naiveForecast"
                  name="Naive Baseline (Last Value)"
                  stroke="#8b909b"
                  strokeWidth={1.5}
                  strokeDasharray="2 2"
                  dot={false}
                />

                {/* Uncertainty Band (Min base + spread) */}
                <Area
                  type="monotone"
                  dataKey="bandMin"
                  stackId="unc"
                  stroke="transparent"
                  fill="transparent"
                  legendType="none"
                />
                <Area
                  type="monotone"
                  dataKey="bandSpread"
                  name="Uncertainty Band (95% CI)"
                  stackId="unc"
                  stroke="#6fb6ff"
                  strokeDasharray="2 2"
                  fill="#6fb6ff"
                  fillOpacity={0.15}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Model Explanation Line */}
          <div className="rounded bg-void p-3 border border-white/10 text-[11px] text-regolith/70 space-y-1">
            <span className="text-white font-bold block uppercase">Algorithmic Formulation</span>
            <p>
              Dual exponential smoothing estimates instantaneous level (L_t) and trend drift (b_t) with &alpha;=0.3 and &beta;=0.1. The uncertainty band widens proportional to &radic;h to reflect error accumulation across the deep-space planning horizon.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
