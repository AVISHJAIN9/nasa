import {useState} from 'react';
import {useStore} from '../../store';
import {Panel, PageHeader} from '../ui';

export function Supplies() {
  const kitInventory = useStore((s) => s.kitInventory);

  // Find current kit stock or fallback defaults
  const kitOrs = kitInventory.find((k) => k.name.toLowerCase().includes('rehydration'))?.quantity ?? 48;
  const kitIv = kitInventory.find((k) => k.name.toLowerCase().includes('saline'))?.quantity ?? 12;

  // State inputs
  const [affectedCrew, setAffectedCrew] = useState<number>(2);
  const [missionDaysLeft, setMissionDaysLeft] = useState<number>(30);
  const [orsStock, setOrsStock] = useState<number>(kitOrs);
  const [ivStock, setIvStock] = useState<number>(kitIv);

  // Presets
  const applyPreset = (preset: 1 | 2 | 3) => {
    if (preset === 1) {
      // Mild Single-Crew
      setAffectedCrew(1);
      setMissionDaysLeft(14);
      setOrsStock(48);
      setIvStock(12);
    } else if (preset === 2) {
      // Multi-Crew Flare
      setAffectedCrew(3);
      setMissionDaysLeft(20);
      setOrsStock(36);
      setIvStock(12);
    } else {
      // Severe Extended Transit
      setAffectedCrew(2);
      setMissionDaysLeft(60);
      setOrsStock(30);
      setIvStock(10);
    }
  };

  // Treatment Plan Math (Ranked: Oral first, IV only if needed)
  // Daily oral rate: 2 packets per affected crew / day
  // Daily IV rate: 1 bag (1000ml) per affected crew / day
  const dailyOrsRate = affectedCrew * 2;
  const dailyIvRate = affectedCrew * 1;

  // Days covered by ORS alone
  const orsDays = dailyOrsRate > 0 ? Math.floor(orsStock / dailyOrsRate) : missionDaysLeft;
  const remainingDaysAfterOrs = Math.max(0, missionDaysLeft - orsDays);

  // If ORS runs out before mission end, IV Saline is deployed
  const ivDays = dailyIvRate > 0 ? Math.floor(ivStock / dailyIvRate) : 0;
  const totalDaysCovered = orsDays + ivDays;
  const stockRunsOutDay = totalDaysCovered;
  const willRunOut = totalDaysCovered < missionDaysLeft;
  const deficitDays = willRunOut ? missionDaysLeft - totalDaysCovered : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="X10 RESOURCE ALLOCATION"
        title="Supply-constrained treatment planner"
        description="Ranked countermeasure rationing under finite craft medical stowage. Prioritizes oral rehydration therapy before escalating to invasive intravenous fluids."
      />

      {/* Slim 36px Warning Line */}
      <div className="h-9 px-3 rounded-lg bg-mars/15 border border-mars/40 font-mono text-xs text-mars flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <span>⚠️</span>
          <span className="font-bold uppercase tracking-wider truncate">
            Illustrative planner, not medical advice. Reviewed by: pending.
          </span>
        </div>
        <span className="text-[11px] text-regolith/70 hidden sm:inline shrink-0">
          Simulation scenario: Acute Hypohydration / Gastroenteritis
        </span>
      </div>

      {/* Preset Scenarios Buttons */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="text-regolith/60 uppercase mr-1">Load Preset Case:</span>
        <button
          type="button"
          onClick={() => applyPreset(1)}
          className="rounded bg-void border border-white/15 px-3 py-1.5 text-white hover:border-earth uppercase transition-colors min-h-[40px]"
        >
          Case 1: Single-Crew Mild (14d)
        </button>
        <button
          type="button"
          onClick={() => applyPreset(2)}
          className="rounded bg-void border border-white/15 px-3 py-1.5 text-white hover:border-earth uppercase transition-colors min-h-[40px]"
        >
          Case 2: 3-Crew Outbreak (20d)
        </button>
        <button
          type="button"
          onClick={() => applyPreset(3)}
          className="rounded bg-void border border-white/15 px-3 py-1.5 text-white hover:border-earth uppercase transition-colors min-h-[40px]"
        >
          Case 3: Deep Transit Deficit (60d)
        </button>
      </div>

      {/* Main Grid: Inputs on Left, Ranked Plan on Right */}
      <div className="grid gap-6 lg:grid-cols-3" data-tour="ch7-controls-supplies">
        {/* Left: Input Parameters */}
        <div className="lg:col-span-1 space-y-6">
          <Panel title="Scenario Parameters">
            <div className="space-y-4 font-mono text-xs">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-regolith/60 uppercase text-[11px]">Affected Crew Count</span>
                  <span className="text-earth font-bold">{affectedCrew} Astronaut(s)</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="4"
                  value={affectedCrew}
                  onChange={(e) => setAffectedCrew(Number(e.target.value))}
                  className="w-full accent-earth cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-regolith/60 uppercase text-[11px]">Horizon / Days Left in Mission</span>
                  <span className="text-white font-bold">{missionDaysLeft} Days</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="90"
                  step="5"
                  value={missionDaysLeft}
                  onChange={(e) => setMissionDaysLeft(Number(e.target.value))}
                  className="w-full accent-earth cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-regolith/60 uppercase text-[11px]">Oral Rehydration Salts (ORS)</span>
                  <span className="text-white font-bold">{orsStock} Packets</span>
                </div>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={orsStock}
                  onChange={(e) => setOrsStock(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded bg-void border border-white/15 px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-regolith/60 uppercase text-[11px]">IV Normal Saline 0.9% (1000ml)</span>
                  <span className="text-white font-bold">{ivStock} Bags</span>
                </div>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={ivStock}
                  onChange={(e) => setIvStock(Math.max(0, Number(e.target.value)))}
                  className="w-full rounded bg-void border border-white/15 px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="rounded bg-void p-3 border border-white/10 text-[11px] text-regolith/60 space-y-1">
                <span className="text-white font-bold uppercase block">Kit Store Sync</span>
                <p>Initial values read directly from craft medical stowage inventory.</p>
              </div>
            </div>
          </Panel>
        </div>

        {/* Right: Ranked Treatment Plan & Depletion Projection */}
        <div className="lg:col-span-2 space-y-6">
          <Panel
            title="Ranked Clinical Countermeasure Protocol"
            badge={<span className="rounded bg-white/10 text-regolith/80 px-2 py-0.5 text-[11px] font-mono uppercase font-bold">Illustrative</span>}
          >
            <div className="space-y-5 font-mono text-xs">
              {/* Depletion Callout Line */}
              <div
                className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                  willRunOut
                    ? 'bg-mars/20 border-mars/40 text-mars'
                    : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{willRunOut ? '⏳' : '🛡️'}</span>
                  <div>
                    <span className="font-bold text-sm block uppercase tracking-wider">
                      {willRunOut
                        ? `Stock runs out on day ${stockRunsOutDay} (Sol ${142 + stockRunsOutDay})`
                        : `Sufficient stock for all ${missionDaysLeft} days remaining`}
                    </span>
                    <span className="text-xs text-regolith/80">
                      {willRunOut
                        ? `Critical depletion deficit of ${deficitDays} day(s) before transit concludes. Medical rationing mandatory.`
                        : `Total fluid reserve sustains therapy through Sol ${142 + missionDaysLeft}.`}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] uppercase block opacity-75">Reserve Coverage</span>
                  <span className="font-display text-base font-bold">
                    {totalDaysCovered} / {missionDaysLeft} Days
                  </span>
                </div>
              </div>

              {/* Tier 1: Primary Oral Rehydration */}
              <div className="rounded-lg bg-void p-4 border border-white/10 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-earth/20 text-earth px-2 py-0.5 text-[11px] font-bold uppercase">
                      Tier 1 · Primary
                    </span>
                    <span className="text-white font-bold uppercase">
                      Oral Rehydration Solution (ORS)
                    </span>
                  </div>
                  <span className="text-earth font-bold">
                    {dailyOrsRate} packets / day ({2} pkts/crew)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-regolith/50 text-[11px] uppercase block">Assigned Stock</span>
                    <span className="text-white font-bold">{orsStock} packets</span>
                  </div>
                  <div>
                    <span className="text-regolith/50 text-[11px] uppercase block">Coverage Span</span>
                    <span className="text-earth font-bold">
                      Days 1 – {Math.min(orsDays, missionDaysLeft)}
                    </span>
                  </div>
                  <div>
                    <span className="text-regolith/50 text-[11px] uppercase block">Depletion Point</span>
                    <span className="text-mars font-bold">
                      {orsDays < missionDaysLeft ? `Exhausted Day ${orsDays}` : 'Surplus Available'}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-regolith/75">
                  Dissolve 1 sachet per 500 mL water. Administer hourly sip protocol. Non-invasive, preserves vascular access consumables.
                </p>
              </div>

              {/* Tier 2: Secondary IV Saline Rescue */}
              <div className="rounded-lg bg-void p-4 border border-white/10 space-y-3">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-[#e0b03a]/20 text-[#e0b03a] px-2 py-0.5 text-[11px] font-bold uppercase">
                      Tier 2 · Rescue Only
                    </span>
                    <span className="text-white font-bold uppercase">
                      Intravenous Normal Saline 0.9%
                    </span>
                  </div>
                  <span className="text-[#e0b03a] font-bold">
                    {remainingDaysAfterOrs > 0 ? `${dailyIvRate} bags / day` : 'Standby / 0 per day'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-regolith/50 text-[11px] uppercase block">Rescue Stowage</span>
                    <span className="text-white font-bold">{ivStock} bags (1000 mL)</span>
                  </div>
                  <div>
                    <span className="text-regolith/50 text-[11px] uppercase block">Activation Window</span>
                    <span className="text-white font-bold">
                      {orsDays < missionDaysLeft
                        ? `Days ${orsDays + 1} – ${Math.min(orsDays + ivDays, missionDaysLeft)}`
                        : 'Unused (ORS Covers Horizon)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-regolith/50 text-[11px] uppercase block">Depletion Point</span>
                    <span className="text-mars font-bold">
                      {totalDaysCovered < missionDaysLeft ? `Exhausted Day ${totalDaysCovered}` : 'Sustained'}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-regolith/75">
                  Reserved exclusively for severe hemodynamic collapse, intractable emesis, or upon complete exhaustion of oral sachets.
                </p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
