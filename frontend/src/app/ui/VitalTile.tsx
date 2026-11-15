import {ResponsiveContainer, LineChart, Line} from 'recharts';
import {ProvenanceBadge} from './ProvenanceBadge';

export interface VitalTileProps {
  label: string;
  value: number | string;
  unit: string;
  baseline: number | string;
  delta?: number | string;
  status?: 'normal' | 'watch' | 'critical';
  sparklineData?: Array<{v: number}>;
  provenance?: 'SIMULATED' | 'REAL';
  selected?: boolean;
  onClick?: () => void;
}

export function VitalTile({
  label,
  value,
  unit,
  baseline,
  delta,
  status = 'normal',
  sparklineData,
  provenance = 'SIMULATED',
  selected = false,
  onClick,
}: VitalTileProps) {
  const statusColor =
    status === 'critical'
      ? 'text-mars border-mars/40 bg-mars/5'
      : status === 'watch'
      ? 'text-[#e0b03a] border-[#e0b03a]/40 bg-[#e0b03a]/5'
      : 'text-white border-white/10 bg-void-2';

  const strokeColor =
    status === 'critical' ? '#e2704a' : status === 'watch' ? '#e0b03a' : '#6fb6ff';

  const numericDelta = typeof delta === 'number' ? delta : null;
  const stringDelta = typeof delta === 'string' ? delta : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col justify-between rounded-lg p-3.5 sm:p-4 text-left transition-all ring-1 w-full min-w-0 overflow-hidden ${
        selected ? 'ring-2 ring-earth shadow-[0_0_16px_rgba(111,182,255,0.15)]' : 'ring-white/10 hover:ring-white/20'
      } ${statusColor}`}
    >
      <div className="flex items-start justify-between w-full min-w-0 gap-1.5">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-label text-regolith/60 uppercase block truncate">{label}</span>
          <div className="mt-1 flex items-baseline gap-1 min-w-0">
            <span className="font-display text-[clamp(1.15rem,1.4vw,1.625rem)] font-bold tracking-tight text-white truncate">
              {value}
            </span>
            {unit && <span className="font-mono text-[10px] text-regolith/50 shrink-0">{unit}</span>}
          </div>
        </div>
        <ProvenanceBadge provenance={provenance} />
      </div>

      <div className="mt-3 sm:mt-4 flex items-end justify-between w-full gap-1.5 min-w-0">
        <div className="font-mono text-[10px] sm:text-[11px] text-regolith/60 min-w-0 truncate" title={`Base: ${baseline}`}>
          <span className="truncate">Base: {baseline}</span>
          {numericDelta !== null && (
            <span
              className={`ml-1 font-medium ${
                Math.abs(numericDelta) < 0.1
                  ? 'text-regolith/50'
                  : numericDelta > 0
                  ? 'text-mars'
                  : 'text-earth'
              }`}
            >
              {numericDelta > 0 ? `+${numericDelta.toFixed(0)}` : numericDelta.toFixed(0)}
            </span>
          )}
          {stringDelta && (
            <span className="ml-1 text-earth font-medium">{stringDelta}</span>
          )}
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <div className="h-6 sm:h-7 w-16 sm:w-20 shrink-0 pointer-events-none">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={strokeColor}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </button>
  );
}
