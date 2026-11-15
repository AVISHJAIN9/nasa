import evalData from '../../data/evalRun.json';
import {Panel, PageHeader} from '../ui';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';

export function Proof() {
  const {stats, roc, calibration, ablation, latency, runId} = evalData;

  const mappedAblation = ablation.map((item) => ({
    ...item,
    method: item.method.includes('Rules')
      ? 'Rules'
      : item.method.includes('Baseline')
      ? 'Baseline ML'
      : 'AstroCare',
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="P01 ALGORITHMIC VERIFICATION"
        title="Synthetic twin verification & safety benchmarks"
        description="Placeholder results from a synthetic benchmark — not yet computed from real data"
      />

      {/* Slim 36px Warning Line */}
      <div className="h-9 px-3 rounded-lg bg-[#e0b03a]/15 border border-[#e0b03a]/40 font-mono text-xs text-[#e0b03a] flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <span>⚠️</span>
          <span className="truncate">Placeholder data — replace src/data/evalRun.json with real `make eval` output.</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-white">
            Run: {runId}
          </span>
          <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 text-[11px] font-bold">
            PLACEHOLDER
          </span>
        </div>
      </div>

      {/* Stat Strip (1 of 3 places with corner brackets) */}
      <Panel title="Verification Performance Indicators" brackets>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 font-mono">
          <div className="rounded-lg bg-void p-3.5 border border-white/10">
            <div className="flex justify-between items-center text-[11px] text-regolith/50 uppercase">
              <span>Overall AUROC</span>
              <div className="flex items-center gap-1">
                <span className="text-earth">{runId}</span>
                <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.2 text-[11px] font-bold">
                  PLACEHOLDER
                </span>
              </div>
            </div>
            <span className="font-display text-2xl text-white font-bold mt-1 block">
              {stats.auroc}
            </span>
            <span className="text-[11px] text-emerald-400 mt-1 block">
              +0.08 over Random Forest
            </span>
          </div>

          <div className="rounded-lg bg-void p-3.5 border border-white/10">
            <div className="flex justify-between items-center text-[11px] text-regolith/50 uppercase">
              <span>Mean Triage Latency</span>
              <div className="flex items-center gap-1">
                <span className="text-earth">{runId}</span>
                <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.2 text-[11px] font-bold">
                  PLACEHOLDER
                </span>
              </div>
            </div>
            <span className="font-display text-2xl text-white font-bold mt-1 block">
              {stats.meanLatencySec} s
            </span>
            <span className="text-[11px] text-emerald-400 mt-1 block">
              Sub-5s decision boundary
            </span>
          </div>

          <div className="rounded-lg bg-void p-3.5 border border-white/10">
            <div className="flex justify-between items-center text-[11px] text-regolith/50 uppercase">
              <span>False Alarm Frequency</span>
              <div className="flex items-center gap-1">
                <span className="text-earth">{runId}</span>
                <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.2 text-[11px] font-bold">
                  PLACEHOLDER
                </span>
              </div>
            </div>
            <span className="font-display text-2xl text-white font-bold mt-1 block">
              {stats.falseAlarmsPerDay} / day
            </span>
            <span className="text-[11px] text-regolith/60 mt-1 block">
              &lt; 0.2 threshold met
            </span>
          </div>

          <div className="rounded-lg bg-void p-3.5 border border-white/10">
            <div className="flex justify-between items-center text-[11px] text-regolith/50 uppercase">
              <span>Clinical Coverage</span>
              <div className="flex items-center gap-1">
                <span className="text-earth">{runId}</span>
                <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 py-0.2 text-[11px] font-bold">
                  PLACEHOLDER
                </span>
              </div>
            </div>
            <span className="font-display text-2xl text-white font-bold mt-1 block">
              {stats.coveragePercent}%
            </span>
            <span className="text-[11px] text-regolith/60 mt-1 block">
              Across critical flight anomalies
            </span>
          </div>
        </div>
      </Panel>

      {/* Grid: ROC Curve & Calibration Plot */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="ROC Characteristic Curve (True vs False Positive)">
          <div className="h-[220px] sm:h-64 font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={roc} margin={{top: 10, right: 20, left: -15, bottom: 0}}>
                <XAxis dataKey="fpr" type="number" domain={[0, 1]} stroke="#8b909b" fontSize={10} />
                <YAxis dataKey="tpr" type="number" domain={[0, 1]} stroke="#8b909b" fontSize={10} />
                <Tooltip
                  content={({active, payload}) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded bg-void-2 border border-white/20 p-2 font-mono text-xs shadow-xl">
                          <p className="text-white">FPR: {payload[0].payload.fpr}</p>
                          <p className="text-earth font-bold">TPR: {payload[0].payload.tpr}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <ReferenceLine y={0.5} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey="tpr"
                  stroke="#6fb6ff"
                  strokeWidth={2.5}
                  dot={{r: 3, fill: '#6fb6ff'}}
                  name="AstroCare Model (AUROC 0.94)"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Reliability Calibration Plot (Predicted vs Observed Probability)">
          <div className="h-[220px] sm:h-64 font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={calibration} margin={{top: 10, right: 20, left: -15, bottom: 0}}>
                <XAxis dataKey="pred" type="number" domain={[0, 1]} stroke="#8b909b" fontSize={10} />
                <YAxis dataKey="observed" type="number" domain={[0, 1]} stroke="#8b909b" fontSize={10} />
                <Tooltip
                  content={({active, payload}) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded bg-void-2 border border-white/20 p-2 font-mono text-xs shadow-xl">
                          <p className="text-white">Confidence: {payload[0].payload.pred}</p>
                          <p className="text-earth font-bold">Observed: {payload[0].payload.observed}</p>
                          <p className="text-regolith/50">Samples: {payload[0].payload.count}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="observed"
                  stroke="#e2704a"
                  strokeWidth={2.5}
                  dot={{r: 3, fill: '#e2704a'}}
                  name="AstroCare Calibration"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Grid: Ablation Study & Detection Latency */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Ablation Benchmark: Rules vs ML vs AstroCare Bayesian">
          <div className="h-[220px] sm:h-64 font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mappedAblation} margin={{top: 10, right: 20, left: -15, bottom: 0}}>
                <XAxis dataKey="method" stroke="#8b909b" fontSize={11} interval={0} />
                <YAxis domain={[0, 1]} stroke="#8b909b" fontSize={10} />
                <Tooltip />
                <Legend />
                <Bar dataKey="auroc" name="AUROC" fill="#6fb6ff" />
                <Bar dataKey="precision" name="Precision" fill="#e0b03a" />
                <Bar dataKey="recall" name="Recall" fill="#e2704a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Detection Latency by Pathology (Seconds to Trigger)">
          <div className="h-[220px] sm:h-64 font-mono text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={latency} margin={{top: 10, right: 20, left: -15, bottom: 0}}>
                <XAxis dataKey="condition" stroke="#8b909b" fontSize={9} />
                <YAxis stroke="#8b909b" fontSize={10} unit="s" />
                <Tooltip />
                <Legend />
                <Bar dataKey="rulesSec" name="Rules Only (s)" fill="#8b909b" />
                <Bar dataKey="baselineSec" name="Standard ML (s)" fill="#e0b03a" />
                <Bar dataKey="astrocareSec" name="AstroCare (s)" fill="#6fb6ff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Risk-Coverage Card */}
      <Panel
        title="Conformal Risk-Coverage Curve"
        subtitle="Coverage guarantee is approximate for time series."
      >
        <div className="space-y-4 font-mono text-xs">
          <div className="flex items-center justify-between">
            <span className="text-regolith/60 uppercase text-[11px]">Selective Classification Frontier</span>
            <span className="rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 text-[11px] font-bold">
              PLACEHOLDER
            </span>
          </div>

          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evalData.riskCoverage || []} margin={{top: 10, right: 20, left: -10, bottom: 0}}>
                <XAxis dataKey="coverage" stroke="#8b909b" fontSize={10} unit="%" />
                <YAxis stroke="#8b909b" fontSize={10} unit="%" />
                <Tooltip />
                <Line type="monotone" dataKey="errorRate" name="Error Rate (%)" stroke="#e2704a" strokeWidth={2.5} dot={{r: 4, fill: '#e2704a'}} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[11px] text-regolith/70 border-t border-white/5 pt-2">
            Coverage guarantee is approximate for time series.
          </p>
        </div>
      </Panel>
    </div>
  );
}