import {ResponsiveContainer, LineChart, Line} from 'recharts';
import {ProvenanceBadge} from './ProvenanceBadge';

export interface VitalTileProps {
  label: string;
  value: number | string;
  unit: string;
  baseline: number | string;
  delta?: number;
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

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex flex-col justify-between rounded-lg p-4 text-left transition-all ring-1 w-full ${
        selected ? 'ring-2 ring-earth shadow-[0_0_16px_rgba(111,182,255,0.15)]' : 'ring-white/10 hover:ring-white/20'
      } ${statusColor}`}
    >
      <div className="flex items-start justify-between w-full">
        <div>
          <span className="font-mono text-label text-regolith/60 uppercase block">{label}</span>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-[1.625rem] font-bold tracking-tight text-white">{value}</span>
            <span className="font-mono text-label text-regolith/50">{unit}</span>
          </div>
        </div>
        <ProvenanceBadge provenance={provenance} />
      </div>

      <div className="mt-4 flex items-end justify-between w-full gap-2">
        <div className="font-mono text-[11px] text-regolith/60">
          <span>Base: {baseline}</span>
          {typeof delta === 'number' && (
            <span
              className={`ml-1.5 font-medium ${
                Math.abs(delta) < 0.1
                  ? 'text-regolith/50'
                  : delta > 0
                  ? 'text-mars'
                  : 'text-earth'
              }`}
            >
              {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
            </span>
          )}
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <div className="h-7 w-20 shrink-0 pointer-events-none">
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
