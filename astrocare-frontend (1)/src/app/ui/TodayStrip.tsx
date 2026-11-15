import {useStore, MODES} from '../../store';
import {usePollToday} from '../../api/today';
import {ProvenanceBadge} from './ProvenanceBadge';
import {VALIDATION_NOTE} from '../../config/validationNote';
import {useReducedMotion} from '../../hooks/useReducedMotion';

export interface TodayStripProps {
  personId?: string;
  className?: string;
}

export function TodayStrip({personId, className = ''}: TodayStripProps) {
  const currentCrewId = useStore((s) => s.selectedCrewId || s.crew[0]?.id || 'vega');
  const targetId = personId || currentCrewId;

  const mode = useStore((s) => s.mode);
  const delaySec = MODES[mode].delaySec;
  const rttMin = Math.round((delaySec * 2) / 60);
  const rttText = rttMin >= 1 ? `${rttMin}` : '<1';

  const reducedMotion = useReducedMotion();
  const isMock = import.meta.env.VITE_USE_MOCKS !== 'false';

  const {data, secondsSinceUpdate, error} = usePollToday(targetId);

  // Fallback defaults while loading initial poll
  const state = data?.state ?? 'normal';
  const probability = data?.probability ?? 0.12;
  const band = data?.band ?? {low: 0.07, high: 0.17};
  const crewBand = data?.crew_band ?? {low: 0.10, high: 0.18};
  const contributors = data?.contributors ?? [];
  const abstained = data?.abstained ?? false;

  // Percentage formatting
  const probPct = Math.round(probability * 100);
  const lowPct = Math.max(0, Math.min(100, Math.round(band.low * 100)));
  const highPct = Math.max(0, Math.min(100, Math.round(band.high * 100)));
  const bandWidthPct = Math.max(2, highPct - lowPct);

  const crewLowPct = Math.max(0, Math.min(100, Math.round(crewBand.low * 100)));
  const crewHighPct = Math.max(0, Math.min(100, Math.round(crewBand.high * 100)));
  const crewWidthPct = Math.max(2, crewHighPct - crewLowPct);

  const pointLabel = abstained ? '-' : `${probPct}%`;
  const rangeLabel = `(${lowPct}-${highPct}%)`;

  // Sorted contributors (up to 4)
  const topContributors = [...contributors].sort((a, b) => b.weight - a.weight).slice(0, 4);

  // Accessibility aria-label in words
  const ariaBandLabel = abstained
    ? `Your band ${lowPct} to ${highPct} percent, point estimate unavailable. Crew average band ${crewLowPct} to ${crewHighPct} percent.`
    : `Your band ${lowPct} to ${highPct} percent, point estimate ${probPct}. Crew average band ${crewLowPct} to ${crewHighPct} percent.`;

  // State presentation (Icon AND text, never colour only)
  const stateConfig = {
    normal: {
      text: 'Within your usual range',
      icon: '✓',
      badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      dotClass: 'bg-emerald-400',
    },
    off_today: {
      text: 'Something is off today',
      icon: '⚠️',
      badgeClass: 'bg-[#e0b03a]/15 text-[#e0b03a] border-[#e0b03a]/40',
      dotClass: 'bg-[#e0b03a]',
    },
    unsure: {
      text: 'Unsure. Ask ground.',
      icon: '❓',
      badgeClass: 'bg-mars/15 text-mars border-mars/40',
      dotClass: 'bg-mars',
    },
  }[state];

  const transitionClass = reducedMotion ? 'transition-none' : 'transition-all duration-700 ease-out';

  return (
    <section
      aria-label="Today health status strip"
      className={`rounded-xl bg-void-2/90 border border-white/10 p-4 sm:p-5 shadow-lg font-mono text-xs ${className}`}
    >
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-center lg:gap-6">
        {/* ZONE 1: State Badge & Telemetry Latency Notice */}
        <div className="lg:col-span-4 flex flex-col justify-center space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="status"
              aria-live="polite"
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 font-bold uppercase tracking-wider text-xs ${stateConfig.badgeClass}`}
            >
              <span aria-hidden="true" className="text-sm">
                {stateConfig.icon}
              </span>
              <span>{stateConfig.text}</span>
            </div>

            {isMock && <ProvenanceBadge provenance="SIMULATED" />}
          </div>

          {/* Under 'unsure' add small line using current delay value */}
          {state === 'unsure' && (
            <p className="text-[11px] text-regolith/80 leading-normal">
              Ground reply expected in about {rttText} min at current delay.
            </p>
          )}

          {/* Stale / Poll Status notice */}
          <div className="flex items-center gap-2 text-[11px] text-regolith/50 pt-0.5">
            {error ? (
              <span className="text-[#e0b03a]">
                Connection delayed · Last updated {secondsSinceUpdate}s ago
              </span>
            ) : secondsSinceUpdate > 5 ? (
              <span>Last updated {secondsSinceUpdate}s ago</span>
            ) : (
              <span>Telemetry sync active (5s poll)</span>
            )}
          </div>
        </div>

        {/* ZONE 2: Horizontal 0-100% Probability Track & Crew Average Track */}
        <div className="lg:col-span-5 flex flex-col justify-center space-y-2">
          {/* Label and numerical readouts */}
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-regolith/75 font-medium">
              Chance today differs from your usual range
            </span>
            <span className="text-white font-bold ml-2 shrink-0">
              {pointLabel} <span className="text-regolith/60 font-normal">{rangeLabel}</span>
            </span>
          </div>

          {/* Main 0-100% Track */}
          <div
            role="img"
            aria-label={ariaBandLabel}
            className="relative h-6 w-full rounded bg-void border border-white/15 overflow-hidden"
          >
            {/* 25%, 50%, 75% subtle background grid ticks */}
            <div className="absolute inset-0 pointer-events-none flex justify-between px-[25%] opacity-15">
              <div className="h-full w-px bg-white" />
              <div className="h-full w-px bg-white" />
            </div>

            {/* Filled / Dashed Range Band */}
            <div
              className={`absolute top-0.5 bottom-0.5 rounded-sm ${
                abstained
                  ? 'border-2 border-dashed border-earth/80 bg-earth/10'
                  : 'bg-earth/30 border border-earth/70'
              } ${transitionClass}`}
              style={{
                left: `${lowPct}%`,
                width: `${bandWidthPct}%`,
              }}
            />

            {/* Point estimate marker (hidden when abstained is true) */}
            {!abstained && (
              <div
                className={`absolute top-0 bottom-0 w-1.5 -translate-x-1/2 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] z-10 ${transitionClass}`}
                style={{
                  left: `${Math.max(0, Math.min(100, probPct))}%`,
                }}
                title={`Point estimate: ${probPct}%`}
              />
            )}
          </div>

          {/* Beneath it: Thinner range for Crew Average */}
          <div className="flex items-center gap-2 pt-0.5 font-mono text-[11px] text-regolith/60">
            <span className="shrink-0 text-[11px]">Crew average</span>
            <div className="relative flex-1 h-2 rounded bg-void border border-white/10 overflow-hidden">
              <div
                className={`absolute top-0 bottom-0 rounded-sm bg-white/20 border border-white/30 ${transitionClass}`}
                style={{
                  left: `${crewLowPct}%`,
                  width: `${crewWidthPct}%`,
                }}
              />
            </div>
            <span className="shrink-0 text-regolith/80 text-[11px]">
              {crewLowPct}-{crewHighPct}%
            </span>
          </div>
        </div>

        {/* ZONE 3: Contributor Chips & Validation Caption */}
        <div className="lg:col-span-3 flex flex-col justify-center space-y-2">
          {/* Contributor Chips (Plain spans, non-clickable, non-focusable) */}
          {topContributors.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {topContributors.map((c, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-regolith/80 select-none pointer-events-none"
                >
                  <span>{c.signal}</span>
                  <span
                    className={
                      c.direction === 'up'
                        ? 'text-mars font-bold text-xs'
                        : 'text-earth font-bold text-xs'
                    }
                  >
                    {c.direction === 'up' ? '↑' : '↓'}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Always Visible Validation Caption */}
          <p className="text-[11px] text-regolith/50 leading-relaxed italic border-t border-white/5 pt-1.5">
            {VALIDATION_NOTE}
          </p>
        </div>
      </div>
    </section>
  );
}
