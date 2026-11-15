export interface GaugeProps {
  label: string;
  value: number;
  max: number;
  unit: string;
  limit?: number;
  warning?: number;
  critical?: number;
  subtext?: string;
}

export function Gauge({
  label,
  value,
  max,
  unit,
  limit,
  warning,
  critical,
  subtext,
}: GaugeProps) {
  // Semi-circle arc gauge: angle from -180 to 0 degrees
  const clamped = Math.min(max, Math.max(0, value));
  const percent = clamped / max;

  // Gauge status colors
  let arcColor = '#6fb6ff'; // nominal earth
  if (critical !== undefined && value >= critical) {
    arcColor = '#e2704a'; // critical mars
  } else if (warning !== undefined && value >= warning) {
    arcColor = '#e0b03a'; // watch amber
  } else if (limit !== undefined && value >= limit * 0.8) {
    arcColor = '#e0b03a';
  }

  // SVG coordinates for arc of radius 40
  const r = 38;
  const cx = 50;
  const cy = 48;
  const circumference = Math.PI * r;
  const strokeDashoffset = circumference * (1 - percent);

  return (
    <div className="flex flex-col items-center text-center p-3 rounded-lg bg-void-2/60 ring-1 ring-white/10 w-full">
      <span className="font-mono text-label text-regolith/60 uppercase">{label}</span>
      <div className="relative mt-2 size-24">
        <svg viewBox="0 0 100 55" className="w-full">
          {/* Background track */}
          <path
            d="M 12 48 A 38 38 0 0 1 88 48"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Active value arc */}
          <path
            d="M 12 48 A 38 38 0 0 1 88 48"
            fill="none"
            stroke={arcColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out"
          />
          {/* Optional limit tick mark */}
          {limit && (
            <line
              x1={cx + Math.cos(-Math.PI * (1 - limit / max)) * (r - 7)}
              y1={cy + Math.sin(-Math.PI * (1 - limit / max)) * (r - 7)}
              x2={cx + Math.cos(-Math.PI * (1 - limit / max)) * (r + 7)}
              y2={cy + Math.sin(-Math.PI * (1 - limit / max)) * (r + 7)}
              stroke="#e2704a"
              strokeWidth="2"
            />
          )}
        </svg>
        <div className="absolute inset-x-0 bottom-1 flex flex-col items-center">
          <span className="font-display text-[1.125rem] font-bold text-white leading-none">
            {value >= 100 ? Math.round(value) : value.toFixed(1)}
          </span>
          <span className="font-mono text-[11px] text-regolith/50">{unit}</span>
        </div>
      </div>
      {subtext && <span className="font-mono text-[11px] text-regolith/50 mt-1">{subtext}</span>}
      {limit && (
        <span className="font-mono text-[11px] text-regolith/40 mt-0.5 uppercase">
          Limit: {limit} {unit}
        </span>
      )}
    </div>
  );
}
