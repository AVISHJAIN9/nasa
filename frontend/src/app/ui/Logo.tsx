export interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  glow?: boolean;
}

/**
 * Minimal mark combining a heartbeat / ECG line with an interplanetary orbit arc.
 * Crisp from 24px to 128px on dark space backgrounds.
 */
export function LogoIcon({
  size = 28,
  glow = false,
  className = '',
}: {
  size?: number;
  glow?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <defs>
        {/* Interplanetary orbital gradient (Earth blue to Mars rust) */}
        <linearGradient id="astrocare-orbit-grad" x1="6" y1="8" x2="42" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6fb6ff" />
          <stop offset="50%" stopColor="#d8c3b4" />
          <stop offset="100%" stopColor="#e2704a" />
        </linearGradient>

        {/* Glow filter for active beacon / medical telemetry */}
        <filter id="astrocare-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Orbital / Planetary Elliptical Arc */}
      <ellipse
        cx="24"
        cy="24"
        rx="20"
        ry="13"
        transform="rotate(-25 24 24)"
        stroke="url(#astrocare-orbit-grad)"
        strokeWidth="2"
        strokeDasharray="1.5 3.5"
        strokeOpacity="0.45"
      />

      {/* Solid Orbit Horizon Crescent */}
      <path
        d="M9 22 C 11 12, 23 8, 33 13 C 39 16, 42 21, 41 26"
        stroke="#6fb6ff"
        strokeWidth="2.25"
        strokeLinecap="round"
        filter={glow ? 'url(#astrocare-glow)' : undefined}
      />

      {/* Heartbeat / ECG Telemetry Line intersecting the planet */}
      <path
        d="M4 27 L 14 27 L 17 21 L 21 34 L 25 15 L 29 32 L 32 25 L 35 28 L 44 28"
        stroke="#ffffff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter={glow ? 'url(#astrocare-glow)' : undefined}
      />

      {/* Interplanetary Beacon / Satellite Pulse Node */}
      <circle cx="33" cy="13" r="3.25" fill="#6fb6ff" />
      <circle cx="33" cy="13" r="1.5" fill="#ffffff" />

      {/* Mars Distal Node */}
      <circle cx="41" cy="26" r="2.5" fill="#e2704a" />
    </svg>
  );
}

export function Logo({
  size = 28,
  showWordmark = true,
  className = '',
  glow = false,
}: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <LogoIcon size={size} glow={glow} />
      {showWordmark && (
        <span className="font-display font-bold uppercase tracking-[0.24em] text-white text-[0.9375rem] leading-none">
          <span>ASTRO</span>
          <span className="text-earth">CARE</span>
        </span>
      )}
    </div>
  );
}
