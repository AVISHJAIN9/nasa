import { useState, useEffect } from 'react';
import { useStore } from '../../store';
import { Panel, PageHeader } from '../ui';
import { api } from '../../api/client';

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

  // Backend Plan State
  const [backendPlan, setBackendPlan] = useState<any>(null);
  const [planSource, setPlanSource] = useState<'BACKEND' | 'CLIENT (MOCK FALLBACK)'>('CLIENT (MOCK FALLBACK)');

  useEffect(() => {
    let cancelled = false;
    async function fetchPlan() {
      try {
        const res = await api.post<any>('supplies/treatment-plan', {
          scenario: 'DEHYDRATION',
          severity: affectedCrew >= 3 ? 'SEVERE' : affectedCrew === 2 ? 'MODERATE' : 'MILD',
          mission_days_remaining: missionDaysLeft,
          iv_saline_available: ivStock,
          ors_packets_available: orsStock,
          crew_size: 4,
        });

        const selectedPlan = res?.selected_treatment_plan || res?.selected_plan;
        if (!cancelled && selectedPlan) {
          setBackendPlan(res);
          setPlanSource('BACKEND');
        }
      } catch (err) {
        if (!cancelled) {
          setBackendPlan(null);
          setPlanSource('CLIENT (MOCK FALLBACK)');
        }
      }
    }

    fetchPlan();
    return () => {
      cancelled = true;
    };
  }, [affectedCrew, missionDaysLeft, orsStock, ivStock]);

  // Presets
  const applyPreset = (preset: 1 | 2 | 3) => {
    if (preset === 1) {
      setAffectedCrew(1);
      setMissionDaysLeft(14);
      setOrsStock(48);
      setIvStock(12);
    } else if (preset === 2) {
      setAffectedCrew(3);
      setMissionDaysLeft(20);
      setOrsStock(36);
      setIvStock(12);
    } else {
      setAffectedCrew(2);
      setMissionDaysLeft(60);
      setOrsStock(30);
      setIvStock(10);
    }
  };

  // Treatment Plan Math (Client Fallback)
  const dailyOrsRate = affectedCrew * 2;
  const dailyIvRate = affectedCrew * 1;
  const orsDays = dailyOrsRate > 0 ? Math.floor(orsStock / dailyOrsRate) : missionDaysLeft;
  const remainingDaysAfterOrs = Math.max(0, missionDaysLeft - orsDays);
  const ivDays = dailyIvRate > 0 ? Math.floor(ivStock / dailyIvRate) : 0;
  const totalDaysCovered = orsDays + ivDays;
  const willRunOut = totalDaysCovered < missionDaysLeft;
  const deficitDays = willRunOut ? missionDaysLeft - totalDaysCovered : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="X10 RESOURCE ALLOCATION"
        title="Supply-constrained treatment planner"
        description="Ranked countermeasure rationing under finite craft medical stowage. Prioritizes oral rehydration therapy before escalating to invasive intravenous fluids."
        actions={
          <span
            id="supplies-plan-source"
            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
              planSource === 'BACKEND'
                ? 'bg-earth/20 text-earth border border-earth/40'
                : 'bg-white/10 text-regolith/80 border border-white/20'
            }`}
          >
            Source: {planSource}
          </span>
        }
      />

      {/* Warning Line */}
      <div className="h-9 px-3 rounded-lg bg-mars/15 border border-mars/40 font-mono text-xs text-mars flex items-center justify-between">
        <div className="flex items-center gap-2 truncate">
          <span>⚠️</span>
          <span className="font-bold uppercase tracking-wider truncate">
            Illustrative Decision Support · Not Certified Medical Advice · Exploration Medical Capability (ExMC)
          </span>
        </div>
        <span className="rounded bg-mars/20 text-mars px-1.5 py-0.5 text-[10px] font-bold shrink-0">
          NON-DIAGNOSTIC
        </span>
      </div>

      {/* Preset Selector */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="text-regolith/60 uppercase text-[11px]">Clinical Presets:</span>
        <button
          type="button"
          onClick={() => applyPreset(1)}
          className="rounded px-2.5 py-1 bg-void border border-white/10 text-white hover:border-earth hover:text-earth transition-colors"
        >
          Preset 1: Mild Single-Crew (14d)
        </button>
        <button
          type="button"
          onClick={() => applyPreset(2)}
          className="rounded px-2.5 py-1 bg-void border border-white/10 text-white hover:border-earth hover:text-earth transition-colors"
        >
          Preset 2: Multi-Crew Flare (20d)
        </button>
        <button
          type="button"
          onClick={() => applyPreset(3)}
          className="rounded px-2.5 py-1 bg-void border border-white/10 text-white hover:border-earth hover:text-earth transition-colors"
        >
          Preset 3: Severe Transit Deficit (60d)
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12 font-mono">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-6">
          <Panel title="Scenario Parameters & Medical Stowage">
            <div className="space-y-4 text-xs">
              <div>
                <div className="flex justify-between text-regolith/80 mb-1">
                  <span>Affected Crew Members</span>
                  <span className="font-bold text-white">{affectedCrew} / 4</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={4}
                  value={affectedCrew}
                  onChange={(e) => setAffectedCrew(Number(e.target.value))}
                  id="affected-crew-slider"
                  className="w-full accent-earth cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-regolith/80 mb-1">
                  <span>Mission Days Remaining</span>
                  <span className="font-bold text-white">{missionDaysLeft} Days</span>
                </div>
                <input
                  type="range"
                  min={7}
                  max={90}
                  value={missionDaysLeft}
                  onChange={(e) => setMissionDaysLeft(Number(e.target.value))}
                  id="mission-days-slider"
                  className="w-full accent-earth cursor-pointer"
                />
              </div>

              <div className="border-t border-white/10 pt-3 space-y-3">
                <div>
                  <div className="flex justify-between text-regolith/80 mb-1">
                    <span>Oral Rehydration (ORS Packets)</span>
                    <span className="font-bold text-earth" id="ors-stock-count">{orsStock} Packets</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    value={orsStock}
                    onChange={(e) => setOrsStock(Number(e.target.value))}
                    id="ors-stock-slider"
                    className="w-full accent-earth cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-regolith/80 mb-1">
                    <span>IV Saline Bags 0.9% (1000 mL)</span>
                    <span className="font-bold text-[#e0b03a]" id="iv-stock-count">{ivStock} Bags</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    value={ivStock}
                    onChange={(e) => setIvStock(Number(e.target.value))}
                    id="iv-stock-slider"
                    className="w-full accent-[#e0b03a] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </Panel>
        </div>

        {/* Plan Output Column */}
        <div className="lg:col-span-7 space-y-6">
          <Panel
            title="Optimized Countermeasure Rationing Plan"
            badge={
              backendPlan ? (
                <span className="rounded bg-earth/20 text-earth px-2 py-0.5 text-[10px] font-bold uppercase">
                  {(backendPlan.selected_treatment_plan || backendPlan.selected_plan)?.tier || 'OPTIMIZED'}
                </span>
              ) : willRunOut ? (
                <span className="rounded bg-mars/20 text-mars border border-mars/30 px-2 py-0.5 text-[10px] font-bold uppercase">
                  Deficit at Day {totalDaysCovered}
                </span>
              ) : (
                <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase">
                  Stock Adequate
                </span>
              )
            }
          >
            {backendPlan ? (
              <div className="space-y-4 text-xs" id="backend-plan-content">
                <div className="p-3 rounded-lg bg-void border border-earth/30 space-y-1.5">
                  <span className="text-[10px] text-earth uppercase font-bold block">Recommended Protocol (Backend)</span>
                  <h4 className="text-sm font-bold text-white" id="plan-title">
                    {(backendPlan.selected_treatment_plan || backendPlan.selected_plan)?.title}
                  </h4>
                  <p className="text-regolith/80 text-[11px] leading-relaxed">
                    {(backendPlan.selected_treatment_plan || backendPlan.selected_plan)?.clinical_rationale ||
                      (backendPlan.selected_treatment_plan || backendPlan.selected_plan)?.rationale}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-void rounded border border-white/10">
                    <span className="text-[10px] text-regolith/60 uppercase block">Scarcity Action</span>
                    <span className="text-xs font-bold text-white mt-1 block" id="plan-scarcity-action">
                      {backendPlan.optimization_verdict?.constraint_status ||
                        backendPlan.tradeoff_analysis?.scarcity_action ||
                        'NOMINAL'}
                    </span>
                  </div>
                  <div className="p-3 bg-void rounded border border-white/10">
                    <span className="text-[10px] text-regolith/60 uppercase block">Clinical Efficacy</span>
                    <span className="text-xs font-bold text-earth mt-1 block">
                      {(backendPlan.selected_treatment_plan || backendPlan.selected_plan)?.efficacy_score ?? 84}%
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-white/5 border border-white/10 text-[11px] text-regolith/70">
                  <span className="font-bold text-white">Logistics Recommendation: </span>
                  {backendPlan.optimization_verdict?.decision_rationale ||
                    backendPlan.recommendation ||
                    backendPlan.tradeoff_analysis?.rationale}
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs" id="client-plan-content">
                <div className="p-3 rounded bg-void border border-white/10 space-y-1">
                  <span className="text-[10px] text-regolith/60 uppercase block">Client Simulated Coverage</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-white">{totalDaysCovered} Days</span>
                    <span className="text-regolith/60">of {missionDaysLeft} days covered</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-regolith/80 text-[11px]">
                    Phase 1 (Days 1–{orsDays}): Enteral ORS ({dailyOrsRate} pkts/day).
                  </p>
                  {remainingDaysAfterOrs > 0 && ivDays > 0 && (
                    <p className="text-[#e0b03a] text-[11px]">
                      Phase 2 (Days {orsDays + 1}–{totalDaysCovered}): Sterile IV Saline deployed ({dailyIvRate} bags/day).
                    </p>
                  )}
                  {willRunOut && (
                    <p className="text-mars font-bold text-[11px]">
                      ⚠️ Emergency Rationing Trigger: Complete depletion occurs {deficitDays} days before mission recovery.
                    </p>
                  )}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
