import {useState, useId, useRef} from 'react';

export interface DelaySliderProps {
  id?: string;
  label?: string;
  roundTripMinutes: number;
  onChange: (rttMinutes: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  showPresets?: boolean;
}

export function DelaySlider({
  id: explicitId,
  label = 'Round-Trip Signal Delay (Minutes)',
  roundTripMinutes,
  onChange,
  min = 0,
  max = 50,
  step = 1,
  className = '',
  showPresets = true,
}: DelaySliderProps) {
  const generatedId = useId();
  const id = explicitId || generatedId;
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const oneWayMinutes = roundTripMinutes / 2;
  const pct = Math.max(0, Math.min(100, ((roundTripMinutes - min) / (max - min)) * 100));

  // Determine autonomy tier & theme
  let autonomyTier: 'Ask ground' | 'Shared' | 'Autonomous';
  let tierLevel: string;
  let tierColor: string;
  let badgeBorder: string;
  let badgeBg: string;

  if (oneWayMinutes < 4) {
    autonomyTier = 'Ask ground';
    tierLevel = 'Level 0-1 · Near Earth / Moon';
    tierColor = '#6fb6ff'; // Earth blue
    badgeBorder = 'border-earth/40';
    badgeBg = 'bg-earth/15 text-earth';
  } else if (oneWayMinutes < 15) {
    autonomyTier = 'Shared';
    tierLevel = 'Level 2 · Early Deep Space';
    tierColor = '#e0b03a'; // Amber
    badgeBorder = 'border-[#e0b03a]/40';
    badgeBg = 'bg-[#e0b03a]/15 text-[#e0b03a]';
  } else {
    autonomyTier = 'Autonomous';
    tierLevel = 'Level 3 · Mars Transit & Surface';
    tierColor = '#e2704a'; // Mars rust
    badgeBorder = 'border-mars/40';
    badgeBg = 'bg-mars/15 text-mars';
  }

  const showTooltip = isHovered || isFocused;

  return (
    <div
      ref={containerRef}
      className={`space-y-2 font-mono text-xs select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex justify-between items-center">
        <label htmlFor={id} className="text-regolith/80 uppercase font-medium tracking-wide">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border transition-all duration-150 motion-reduce:transition-none ${badgeBg} ${badgeBorder}`}
          >
            {autonomyTier}
          </span>
          <span className="font-bold text-sm text-white tabular-nums">
            {roundTripMinutes} min RTT
          </span>
        </div>
      </div>

      {/* Slider Track Wrapper with Tooltip */}
      <div className="relative pt-6 pb-1">
        {/* Floating Tooltip */}
        <div
          aria-hidden={!showTooltip}
          style={{left: `${pct}%`}}
          className={`absolute -top-1 -translate-x-1/2 pointer-events-none transition-all duration-150 motion-reduce:transition-none z-30 flex flex-col items-center ${
            showTooltip ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        >
          <div
            className="rounded-lg px-2.5 py-1.5 shadow-xl border text-[11px] font-mono whitespace-nowrap backdrop-blur-md bg-void-2/95 text-white flex flex-col items-center gap-0.5"
            style={{borderColor: tierColor}}
          >
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white tabular-nums">
                {oneWayMinutes.toFixed(1)}m one-way
              </span>
              <span className="text-regolith/40">·</span>
              <span className="font-bold uppercase" style={{color: tierColor}}>
                {autonomyTier}
              </span>
            </div>
            <span className="text-[10px] text-regolith/60">{tierLevel}</span>
          </div>
          {/* Tooltip caret */}
          <div
            className="w-2 h-2 rotate-45 -mt-1 bg-void-2 border-r border-b"
            style={{borderColor: tierColor}}
          />
        </div>

        {/* Custom Track with Dynamic Fill */}
        <div className="relative w-full h-2 rounded-full bg-void border border-white/10 overflow-hidden">
          <div
            className="absolute top-0 bottom-0 left-0 transition-all duration-150 motion-reduce:transition-none rounded-full"
            style={{
              width: `${pct}%`,
              backgroundColor: tierColor,
              boxShadow: isHovered || isFocused ? `0 0 10px ${tierColor}` : 'none',
            }}
          />
        </div>

        {/* Native Range Input overlay */}
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={roundTripMinutes}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={roundTripMinutes}
          aria-valuetext={`${roundTripMinutes} minutes round trip, ${oneWayMinutes.toFixed(1)} minutes one way, autonomy level ${autonomyTier}`}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer focus-visible:outline-none"
        />

        {/* Visual Custom Thumb that tracks pct */}
        <div
          aria-hidden="true"
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-4 rounded-full border-2 border-white pointer-events-none transition-transform duration-150 motion-reduce:transition-none shadow-md ${
            isHovered || isFocused ? 'scale-125 ring-4' : 'scale-100'
          }`}
          style={{
            left: `${pct}%`,
            backgroundColor: tierColor,
            boxShadow: `0 0 12px ${tierColor}`,
          }}
        />
      </div>

      {showPresets && (
        <div className="flex justify-between text-[11px] text-regolith/50 pt-0.5">
          <button
            type="button"
            onClick={() => onChange(0)}
            className="hover:text-earth transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-earth rounded px-1"
          >
            0m (LEO/ISS)
          </button>
          <button
            type="button"
            onClick={() => onChange(6)}
            className="hover:text-earth transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-earth rounded px-1"
          >
            6m (Moon)
          </button>
          <button
            type="button"
            onClick={() => onChange(22)}
            className="hover:text-[#e0b03a] transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-[#e0b03a] rounded px-1"
          >
            22m (Mars Mid)
          </button>
          <button
            type="button"
            onClick={() => onChange(44)}
            className="hover:text-mars transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-mars rounded px-1"
          >
            44m (Conjunction)
          </button>
        </div>
      )}
    </div>
  );
}
