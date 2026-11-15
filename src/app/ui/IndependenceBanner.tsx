import {useStore, MODES, getIndependenceLevel, LEVELS} from '../../store';

export function IndependenceBanner() {
  const mode = useStore((s) => s.mode);
  const commsBlackout = useStore((s) => s.commsBlackout);

  const level = getIndependenceLevel(mode);
  const levelData = LEVELS[level];
  const modeData = MODES[mode];
  const rttSec = modeData.delaySec * 2;
  const mm = String(Math.floor(rttSec / 60)).padStart(2, '0');
  const ss = String(Math.floor(rttSec % 60)).padStart(2, '0');

  // Colour shift: L0/L1 blue/earth (#6fb6ff), L2 amber (#e0b03a), L3 mars (#e2704a)
  const colorClass =
    level === 3
      ? 'border-mars/50 bg-mars/10 text-mars'
      : level === 2
      ? 'border-[#e0b03a]/50 bg-[#e0b03a]/10 text-[#e0b03a]'
      : 'border-earth/40 bg-earth/10 text-earth';

  const barColor =
    level === 3 ? 'bg-mars' : level === 2 ? 'bg-[#e0b03a]' : 'bg-earth';

  return (
    <div
      className={`border-b px-4 py-2.5 sm:px-6 md:px-8 transition-colors duration-500 font-mono text-xs ${colorClass}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 sm:gap-5">
          <div className="flex items-center gap-2">
            <span className="font-bold tracking-wider uppercase text-white">
              Level {level} · {levelData.label}
            </span>
            <span className="hidden md:inline text-regolith/70">— {levelData.note}</span>
          </div>

          <div className="flex items-center gap-2 text-white/90">
            <span className="text-[11px] text-regolith/50 uppercase">RTT Delay</span>
            <span className="font-bold tabular-nums">{mm}:{ss} min</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`size-2 rounded-full ${
                commsBlackout
                  ? 'bg-mars animate-ping'
                  : 'bg-emerald-400'
              }`}
            />
            <span className="text-[11px] uppercase">
              {commsBlackout ? 'Carrier Blackout' : 'DSN Linked'}
            </span>
          </div>
        </div>

        {/* 4-step segmented bar */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3].map((step) => (
            <div
              key={step}
              className={`h-2 w-8 rounded-sm transition-all duration-500 ${
                step <= level ? barColor : 'bg-white/10'
              }`}
              title={`Level ${step}: ${LEVELS[step].label}`}
            />
          ))}
        </div>
      </div>

      {level === 3 && (
        <div className="mt-1.5 text-[11px] text-mars/90 font-medium">
          ⚡ Incidents route to onboard triage first — Earth consultation runs asynchronously.
        </div>
      )}
    </div>
  );
}
