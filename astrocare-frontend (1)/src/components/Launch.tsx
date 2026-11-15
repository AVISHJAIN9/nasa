import {useReveals} from '../hooks/useReveals';
import {MODES, LEVELS, getIndependenceLevel, useStore, type MissionMode, type UserRole} from '../store';

export function Launch() {
  const ref = useReveals<HTMLElement>();
  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const setRole = useStore((s) => s.setRole);
  const setView = useStore((s) => s.setView);

  const handleSelectRole = (r: UserRole) => {
    setRole(r);
    setView('app');
    window.scrollTo({top: 0, behavior: 'instant'});
  };

  const modeKeys: MissionMode[] = ['ISS', 'MOON', 'MARS'];

  const roles = [
    {
      id: 'astronaut' as const,
      title: 'Astronaut Console',
      roleName: 'Elena Vega (Commander)',
      summary: '60-second self triage, real-time vitals tiles, and plain-language alert explanations.',
      badge: 'Onboard crew',
    },
    {
      id: 'surgeon' as const,
      title: 'Flight Surgeon Hub',
      roleName: 'Clinical Operations',
      summary: 'Crew-wide risk matrix, telemetry trendlines, AI diagnosis factor breakdowns, and action queue.',
      badge: 'Ground / Transit',
    },
    {
      id: 'control' as const,
      title: 'Mission Control',
      roleName: 'Flight Dynamics & Systems',
      summary: 'Cabin atmospheric scrubbing, radiation dosimeters, and comms delay telemetry.',
      badge: 'Deep space telemetry',
    },
  ];

  return (
    <section ref={ref} id="launch" aria-labelledby="launch-title" className="relative min-h-screen bg-void px-4 py-24 sm:px-6 md:px-[6vw]">
      <div className="mx-auto max-w-6xl">
        <div data-reveal>
          <p className="font-mono text-label text-earth uppercase">Mission configuration</p>
          <h2 id="launch-title" className="mt-3 font-display text-display text-white">
            Choose your mission.
          </h2>
          <p className="mt-3 max-w-2xl text-body text-regolith/75">
            Communication latency shapes autonomy. Select an operational distance to view how medical decision-support shifts from ground control to onboard autonomy.
          </p>
        </div>

        {/* Mode cards */}
        <div className="mt-12 grid gap-5 sm:grid-cols-3" data-reveal>
          {modeKeys.map((key) => {
            const data = MODES[key];
            const isSelected = mode === key;
            const indLevel = getIndependenceLevel(key);
            const levelObj = LEVELS[indLevel];

            return (
              <button
                key={key}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setMode(key)}
                className={`relative flex flex-col justify-between rounded-lg p-6 text-left transition-all ring-1 ${
                  isSelected
                    ? 'bg-void-2 ring-mars shadow-[0_0_24px_rgba(226,112,74,0.18)]'
                    : 'bg-void-2/60 ring-white/10 hover:ring-white/25 hover:bg-void-2'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[1.125rem] tracking-wider text-white uppercase">{key}</span>
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider ${
                        isSelected ? 'bg-mars text-void font-bold' : 'bg-white/10 text-regolith/80'
                      }`}
                    >
                      {isSelected ? 'Active' : 'Select'}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-label text-regolith/60 uppercase">{data.label}</p>

                  <div className="mt-6 space-y-2.5 font-mono text-label">
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-regolith/60">One-way delay</span>
                      <span className="text-white">
                        {data.delaySec >= 60 ? `${Math.round(data.delaySec / 60)} min` : `${data.delaySec} sec`}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-regolith/60">Round-trip latency</span>
                      <span className="text-earth">
                        {data.delaySec * 2 >= 60 ? `${Math.round((data.delaySec * 2) / 60)} min` : `${data.delaySec * 2} sec`}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-regolith/60">Radiation rate</span>
                      <span className="text-white">{data.radiation} mSv/d</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-1.5">
                      <span className="text-regolith/60">Crew complement</span>
                      <span className="text-white">{data.crewSize} astronauts</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-3 border-t border-white/10">
                  <span className="font-mono text-[11px] text-regolith/50 uppercase block">Autonomy mode</span>
                  <span className="font-mono text-label text-mars font-medium uppercase mt-0.5 block">
                    Level {indLevel} · {levelObj.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Roles section */}
        <div className="mt-20" data-reveal>
          <div className="border-t border-white/10 pt-12">
            <p className="font-mono text-label text-earth uppercase">Operational consoles</p>
            <h3 className="mt-2 font-display text-[1.5rem] text-white">Enter the system by role</h3>
            <p className="mt-2 max-w-xl text-body text-regolith/75">
              Launch into the clinical and telemetry interface as an onboard astronaut, attending flight surgeon, or ground operations team.
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-3">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => handleSelectRole(r.id)}
                  className="group relative flex flex-col justify-between rounded-lg bg-void-2 p-6 text-left ring-1 ring-white/10 transition-all hover:ring-earth hover:bg-void-2/90"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[11px] text-regolith/80 uppercase tracking-wider">
                        {r.badge}
                      </span>
                      <span className="font-mono text-label text-earth transition-transform group-hover:translate-x-1">→</span>
                    </div>
                    <h4 className="mt-4 font-display text-[1.125rem] text-white group-hover:text-earth transition-colors">
                      {r.title}
                    </h4>
                    <p className="mt-1 font-mono text-label text-regolith/60 uppercase">{r.roleName}</p>
                    <p className="mt-3 text-[0.875rem] leading-relaxed text-regolith/70">{r.summary}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/5">
                    <span className="inline-block rounded bg-earth/15 px-3 py-1.5 font-mono text-[11px] text-earth uppercase tracking-wider group-hover:bg-earth group-hover:text-void font-semibold transition-colors">
                      Launch console
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
