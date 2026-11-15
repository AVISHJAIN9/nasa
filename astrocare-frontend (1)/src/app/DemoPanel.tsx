import {useEffect, useState, useRef} from 'react';
import {useStore, type MissionMode} from '../store';

export function DemoPanel() {
  const [open, setOpen] = useState(false);

  const mode = useStore((s) => s.mode);
  const setMode = useStore((s) => s.setMode);
  const timeScale = useStore((s) => s.timeScale);
  const setTimeScale = useStore((s) => s.setTimeScale);
  const sensorFailure = useStore((s) => s.sensorFailure);
  const sensorDrift = useStore((s) => s.sensorDrift);
  const commsBlackout = useStore((s) => s.commsBlackout);
  const toggleCommsBlackout = useStore((s) => s.toggleCommsBlackout);
  const tamperEventLog = useStore((s) => s.tamperEventLog);

  // Link and consent controls
  const linkUp = useStore((s) => s.linkUp);
  const toggleLinkUp = useStore((s) => s.toggleLinkUp);
  const consentVersion = useStore((s) => s.consentVersion);
  const bumpConsentVersion = useStore((s) => s.bumpConsentVersion);
  const missedCheckInHours = useStore((s) => s.missedCheckInHours);
  const setMissedCheckInHours = useStore((s) => s.setMissedCheckInHours);

  const startCO2Leak = useStore((s) => s.startCO2Leak);
  const startSolarEvent = useStore((s) => s.startSolarEvent);
  const startIllness = useStore((s) => s.startIllness);
  const clearScenarios = useStore((s) => s.clearScenarios);
  const injectSensorFailure = useStore((s) => s.injectSensorFailure);
  const injectDrift = useStore((s) => s.injectDrift);

  // Feature Flags & Backup
  const mlAlertsEnabled = useStore((s) => s.mlAlertsEnabled);
  const toggleMlAlerts = useStore((s) => s.toggleMlAlerts);
  const assistantMode = useStore((s) => s.assistantMode);
  const setAssistantMode = useStore((s) => s.setAssistantMode);
  const waitOrActEnabled = useStore((s) => s.waitOrActEnabled);
  const toggleWaitOrAct = useStore((s) => s.toggleWaitOrAct);
  const exportStateJson = useStore((s) => s.exportStateJson);
  const importStateJson = useStore((s) => s.importStateJson);
  const addToast = useStore((s) => s.addToast);

  // Three-Moment & Story Actions
  const runMoment1LivePulse = useStore((s) => s.runMoment1LivePulse);
  const runMoment2PullTheCable = useStore((s) => s.runMoment2PullTheCable);
  const runMoment3InjectFailure = useStore((s) => s.runMoment3InjectFailure);
  const runMoment4TodayBandWidens = useStore((s) => s.runMoment4TodayBandWidens);
  const selectedCrewId = useStore((s) => s.selectedCrewId);
  const startMarsStory = useStore((s) => s.startMarsStory);
  const pauseMarsStory = useStore((s) => s.pauseMarsStory);
  const resumeMarsStory = useStore((s) => s.resumeMarsStory);
  const skipMarsStoryStep = useStore((s) => s.skipMarsStoryStep);
  const stopMarsStory = useStore((s) => s.stopMarsStory);
  const resetDemoState = useStore((s) => s.resetDemoState);
  const storyRunning = useStore((s) => s.storyRunning);
  const storyPaused = useStore((s) => s.storyPaused);
  const storyStepIndex = useStore((s) => s.storyStepIndex);
  const storyElapsedSec = useStore((s) => s.storyElapsedSec);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExportState = () => {
    const json = exportStateJson();
    const blob = new Blob([json], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `astrocare-state-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Exported system state to JSON file', 'success');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = importStateJson(content);
        if (res.success) {
          addToast('State successfully restored from JSON backup', 'success');
        } else {
          addToast(res.error || 'Failed to parse backup JSON file', 'warn');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Toggle on 'd' or 'D' keypress, Esc to close, Shift+R to reset demo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.shiftKey && (e.key === 'R' || e.key === 'r')) {
        e.preventDefault();
        resetDemoState();
        return;
      }
      if (e.key === 'd' || e.key === 'D') {
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, resetDemoState]);

  return (
    <>
      {/* Floating activator button in bottom corner (shrinks to round icon on mobile) */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Toggle Demo Simulator (Key: D · Reset: Shift+R)"
        aria-label="Toggle Demo Lab"
        className="fixed bottom-4 right-4 z-50 flex items-center justify-center rounded-full bg-void-2 text-earth font-mono text-[11px] font-bold uppercase ring-1 ring-earth/40 backdrop-blur-md shadow-2xl hover:bg-earth hover:text-void transition-all min-h-[44px] min-w-[44px] p-2.5 md:py-2 md:px-3.5 focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none"
      >
        <span className="text-base">⚡</span>
        <span className="hidden md:inline ml-1.5">Demo Lab [D]</span>
      </button>

      {/* Floating Demo Control Panel modal/drawer */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Clinical Demo Simulation Lab"
          className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-void-2/95 p-6 shadow-2xl ring-1 ring-white/15 backdrop-blur-xl flex flex-col justify-between overflow-y-auto font-mono"
        >
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display text-sm tracking-wider text-white uppercase">Clinical Demo Lab</h3>
                <span className="text-[11px] text-regolith/50">Autonomous Deep-Space Verification</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close demo lab"
                className="text-regolith/50 hover:text-white text-sm min-h-[44px] min-w-[44px] flex items-center justify-center rounded focus-visible:ring-2 focus-visible:ring-earth"
              >
                ✕
              </button>
            </div>

            {/* TOP SECTION: DEMO SCRIPT (D01) */}
            <div className="rounded-xl bg-void p-4 border border-earth/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-earth tracking-wider">
                  Demo Script (3 Key Moments)
                </span>
                <span className="text-[11px] text-regolith/50">D01</span>
              </div>

              <div className="space-y-2">
                {/* Moment 1 */}
                <button
                  type="button"
                  onClick={() => {
                    runMoment1LivePulse();
                    setOpen(false);
                  }}
                  className="w-full text-left rounded-lg bg-void-2 p-3 border border-earth/30 hover:border-earth hover:bg-earth/10 transition-colors focus-visible:ring-2 focus-visible:ring-earth min-h-[44px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-xs">Moment 1 · Live Pulse</span>
                    <span className="text-[11px] text-earth font-bold uppercase">Run →</span>
                  </div>
                  <span className="text-[11px] text-regolith/75 block mt-0.5">
                    Go to Astronaut home, Live tab, open optical camera rPPG pulse.
                  </span>
                </button>

                {/* Moment 2 */}
                <button
                  type="button"
                  onClick={() => {
                    runMoment2PullTheCable();
                    setOpen(false);
                  }}
                  className="w-full text-left rounded-lg bg-void-2 p-3 border border-earth/30 hover:border-earth hover:bg-earth/10 transition-colors focus-visible:ring-2 focus-visible:ring-earth min-h-[44px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-xs">Moment 2 · Pull the Cable</span>
                    <span className="text-[11px] text-earth font-bold uppercase">Run →</span>
                  </div>
                  <span className="text-[11px] text-regolith/75 block mt-0.5">
                    Go to Assistant, flip to Offline, auto-ask CO2 poisoning symptoms.
                  </span>
                </button>

                {/* Moment 3 */}
                <button
                  type="button"
                  onClick={() => {
                    runMoment3InjectFailure();
                    setOpen(false);
                  }}
                  className="w-full text-left rounded-lg bg-void-2 p-3 border border-mars/40 hover:border-mars hover:bg-mars/10 transition-colors focus-visible:ring-2 focus-visible:ring-mars min-h-[44px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-xs">Moment 3 · Inject Failure</span>
                    <span className="text-[11px] text-mars font-bold uppercase">Run →</span>
                  </div>
                  <span className="text-[11px] text-regolith/75 block mt-0.5">
                    Inject sensor failure, show amber AI-degraded banner, rules-only inbox.
                  </span>
                </button>

                {/* Moment 4 */}
                <button
                  type="button"
                  onClick={() => {
                    runMoment4TodayBandWidens(selectedCrewId || 'vega');
                    setOpen(false);
                  }}
                  className="w-full text-left rounded-lg bg-void-2 p-3 border border-earth/30 hover:border-earth hover:bg-earth/10 transition-colors focus-visible:ring-2 focus-visible:ring-earth min-h-[44px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold text-xs">Moment 4: Today band widens (30 s)</span>
                    <span className="text-[11px] text-earth font-bold uppercase">Run →</span>
                  </div>
                  <span className="text-[11px] text-regolith/75 block mt-0.5">
                    Viewed astronaut band widens over 30 s, contributors appear, ends in unsure state.
                  </span>
                </button>
              </div>
            </div>

            {/* 8-MINUTE MARS FULL STORY RUNNER (F145) */}
            <div className="rounded-xl bg-void p-4 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-white tracking-wider">
                  8-Minute Mars Story (F145)
                </span>
                {storyRunning && (
                  <span className="rounded bg-earth/20 text-earth border border-earth/40 px-2 py-0.5 text-[11px] font-bold uppercase animate-pulse">
                    {storyPaused ? 'PAUSED' : `STEP ${storyStepIndex + 1}/8 · ${Math.floor(storyElapsedSec / 60)}:${String(storyElapsedSec % 60).padStart(2, '0')}`}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-regolith/70 leading-relaxed">
                Full 8-minute trajectory: Level 3 transit, solar event, CO2 leak, crew illness, Wait-or-Act decision flip, protocol execution, sensor failure, and honest verification.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {!storyRunning ? (
                  <button
                    type="button"
                    onClick={() => {
                      startMarsStory();
                      setOpen(false);
                    }}
                    className="col-span-2 rounded-lg bg-earth px-4 py-2.5 text-void font-bold uppercase hover:bg-earth/90 transition-colors shadow min-h-[44px] text-xs focus-visible:ring-2 focus-visible:ring-earth"
                  >
                    ▶ Run Mars Full Story
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => (storyPaused ? resumeMarsStory() : pauseMarsStory())}
                      className="rounded bg-white/10 px-3 py-2 text-white font-bold uppercase hover:bg-white/20 transition-colors min-h-[44px] text-[11px] border border-white/20 focus-visible:ring-2 focus-visible:ring-white"
                    >
                      {storyPaused ? '▶ Resume' : '⏸ Pause'}
                    </button>
                    <button
                      type="button"
                      onClick={skipMarsStoryStep}
                      className="rounded bg-earth/20 text-earth px-3 py-2 font-bold uppercase hover:bg-earth hover:text-void transition-colors min-h-[44px] text-[11px] border border-earth/30 focus-visible:ring-2 focus-visible:ring-earth"
                    >
                      Skip Step ⏭
                    </button>
                    <button
                      type="button"
                      onClick={stopMarsStory}
                      className="col-span-2 rounded bg-mars/20 text-mars border border-mars/40 px-3 py-2 font-bold uppercase hover:bg-mars hover:text-white transition-colors min-h-[44px] text-[11px] focus-visible:ring-2 focus-visible:ring-mars"
                    >
                      Stop Story ✕
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* RESET DEMO (Keyboard shortcut: Shift+R) */}
            <div className="rounded-xl bg-void p-4 border border-white/10 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white uppercase">Reset Demo</span>
                <span className="text-[11px] text-earth font-mono">Shift+R</span>
              </div>
              <p className="text-[11px] text-regolith/70 leading-relaxed">
                Clears scenarios, alerts, messages, notes, orders, and event log; reseeds 30-day history; returns to MARS Astronaut home in &lt;2s.
              </p>
              <button
                type="button"
                onClick={() => {
                  resetDemoState();
                  setOpen(false);
                }}
                className="w-full rounded-lg bg-void-2 border border-white/20 hover:border-mars hover:text-mars py-2.5 text-xs font-bold uppercase text-white transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-mars"
              >
                ↺ Reset Demo State
              </button>
            </div>

            {/* Offline-First Link Toggle (F039) */}
            <div className="rounded-lg bg-void p-3 border border-white/10 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-white font-bold uppercase">Deep-Space Link (F039)</span>
                <span className={`text-[11px] font-bold uppercase ${linkUp ? 'text-earth' : 'text-mars'}`}>
                  {linkUp ? '● ONLINE' : '○ CARRIER LOSS'}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleLinkUp}
                className={`w-full rounded py-2 text-xs font-bold uppercase border transition-colors min-h-[44px] ${
                  !linkUp
                    ? 'bg-mars text-white border-mars shadow-md'
                    : 'bg-void-2 text-regolith/80 border-white/15 hover:border-mars hover:text-mars'
                }`}
              >
                {linkUp ? 'Simulate Link Down (Pull Carrier)' : 'Restore Deep-Space Link'}
              </button>
            </div>

            {/* Consent Policy Version Bump (F006) */}
            <div className="rounded-lg bg-void p-3 border border-white/10 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-white font-bold uppercase">Consent Version (F006)</span>
                <span className="text-earth text-[11px] font-bold">v{consentVersion}</span>
              </div>
              <button
                type="button"
                onClick={bumpConsentVersion}
                className="w-full rounded bg-void-2 border border-white/15 py-2 text-xs font-bold uppercase text-regolith hover:text-white hover:border-earth transition-colors min-h-[44px]"
              >
                Bump Consent Version (Re-prompt)
              </button>
            </div>

            {/* Missed Check-In Reminder Threshold (F035) */}
            <div className="rounded-lg bg-void p-3 border border-white/10 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-white font-bold uppercase">Check-In Window (F035)</span>
                <span className="text-mars text-[11px] font-bold">{missedCheckInHours}h threshold</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[12, 24, 48].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setMissedCheckInHours(h)}
                    className={`rounded py-1.5 text-xs font-bold uppercase border transition-colors ${
                      missedCheckInHours === h
                        ? 'bg-mars text-white border-mars'
                        : 'bg-void-2 text-regolith/70 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {h}h Window
                  </button>
                ))}
              </div>
            </div>

            {/* Time Scaling */}
            <div>
              <span className="text-[11px] text-regolith/60 uppercase block mb-1.5">Simulation Velocity</span>
              <div className="grid grid-cols-3 gap-2">
                {([1, 5, 20] as const).map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => setTimeScale(scale)}
                    className={`rounded py-1 text-xs font-bold uppercase transition-colors border ${
                      timeScale === scale
                        ? 'bg-earth text-void border-earth'
                        : 'bg-void text-regolith/80 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {scale}x Speed
                  </button>
                ))}
              </div>
            </div>

            {/* Mode Switcher */}
            <div>
              <span className="text-[11px] text-regolith/60 uppercase block mb-1.5">Mission Latency Mode</span>
              <div className="grid grid-cols-3 gap-2">
                {(['ISS', 'MOON', 'MARS'] as MissionMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded py-1 text-xs font-bold uppercase transition-colors border ${
                      mode === m
                        ? 'bg-mars text-white border-mars'
                        : 'bg-void text-regolith/80 border-white/10 hover:border-white/20'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Injected Scenarios */}
            <div>
              <span className="text-[11px] text-regolith/60 uppercase block mb-1.5">Emergency Scenarios</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={startCO2Leak}
                  className="rounded bg-void p-2 text-xs text-left text-white border border-white/10 hover:border-mars hover:text-mars transition-colors"
                >
                  <span className="font-bold block">CO2 Leak</span>
                  <span className="text-[11px] text-regolith/50">+40ppm/s ramp</span>
                </button>
                <button
                  type="button"
                  onClick={startSolarEvent}
                  className="rounded bg-void p-2 text-xs text-left text-white border border-white/10 hover:border-mars hover:text-mars transition-colors"
                >
                  <span className="font-bold block">Solar Event</span>
                  <span className="text-[11px] text-regolith/50">x40 flux spike</span>
                </button>
                <button
                  type="button"
                  onClick={() => startIllness('okoye')}
                  className="rounded bg-void p-2 text-xs text-left text-white border border-white/10 hover:border-mars hover:text-mars transition-colors col-span-2"
                >
                  <span className="font-bold block">Astronaut Illness (Amara Okoye)</span>
                  <span className="text-[11px] text-regolith/50">Pyrexia & tachycardia drift</span>
                </button>
              </div>
            </div>

            {/* Network & Sensor Faults */}
            <div>
              <span className="text-[11px] text-regolith/60 uppercase block mb-1.5">Network & Sensor Faults</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={injectSensorFailure}
                  className={`rounded p-1.5 text-xs font-bold uppercase border transition-colors ${
                    sensorFailure
                      ? 'bg-mars text-white border-mars'
                      : 'bg-void text-regolith/80 border-white/10 hover:border-white/20'
                  }`}
                >
                  {sensorFailure ? 'Restore Sensor' : 'Sensor Failure'}
                </button>
                <button
                  type="button"
                  onClick={injectDrift}
                  className={`rounded p-1.5 text-xs font-bold uppercase border transition-colors ${
                    sensorDrift
                      ? 'bg-[#e0b03a] text-void border-[#e0b03a]'
                      : 'bg-void text-regolith/80 border-white/10 hover:border-white/20'
                  }`}
                >
                  {sensorDrift ? 'Calibrate Drift' : 'Inject Drift'}
                </button>
                <button
                  type="button"
                  onClick={toggleCommsBlackout}
                  className={`rounded p-1.5 text-xs font-bold uppercase border transition-colors col-span-2 ${
                    commsBlackout
                      ? 'bg-mars text-white border-mars'
                      : 'bg-void text-regolith/80 border-white/10 hover:border-white/20'
                  }`}
                >
                  {commsBlackout ? 'Lift Comms Blackout' : 'Engage Comms Blackout'}
                </button>
              </div>
            </div>

            {/* Audit Log Tamper Button */}
            <div className="pt-2 border-t border-white/10 flex justify-between items-center">
              <span className="text-[11px] text-regolith/50 uppercase">Cryptographic Audit Test</span>
              <button
                type="button"
                onClick={tamperEventLog}
                className="rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-regolith/70 hover:text-white uppercase focus-visible:ring-2 focus-visible:ring-earth"
              >
                Tamper Log Chain
              </button>
            </div>

            {/* Feature Flags (F141) */}
            <div>
              <span className="text-[11px] text-regolith/60 uppercase block mb-1.5">System Feature Flags (F141)</span>
              <div className="space-y-1.5 text-xs">
                {/* ML Alerts Flag */}
                <div className="flex items-center justify-between p-2 rounded bg-void border border-white/10">
                  <span className="text-white">ML Anomaly Alerts</span>
                  <button
                    type="button"
                    onClick={toggleMlAlerts}
                    className={`rounded px-2.5 py-0.5 font-bold uppercase text-[11px] border ${
                      mlAlertsEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-mars/20 text-mars border border-mars/40'
                    }`}
                  >
                    {mlAlertsEnabled ? 'ENABLED' : 'OFF (Rules Only)'}
                  </button>
                </div>

                {/* Assistant Mode Flag */}
                <div className="flex items-center justify-between p-2 rounded bg-void border border-white/10">
                  <span className="text-white">Assistant Mode</span>
                  <button
                    type="button"
                    onClick={() => setAssistantMode(assistantMode === 'cloud' ? 'offline' : 'cloud')}
                    className="rounded bg-earth/20 text-earth border border-earth/40 px-2.5 py-0.5 font-bold uppercase text-[11px]"
                  >
                    {assistantMode}
                  </button>
                </div>

                {/* Wait-or-Act Flag */}
                <div className="flex items-center justify-between p-2 rounded bg-void border border-white/10">
                  <span className="text-white">Wait-or-Act Engine</span>
                  <button
                    type="button"
                    onClick={toggleWaitOrAct}
                    className={`rounded px-2.5 py-0.5 font-bold uppercase text-[11px] border ${
                      waitOrActEnabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-mars/20 text-mars border border-mars/40'
                    }`}
                  >
                    {waitOrActEnabled ? 'ACTIVE' : 'BYPASS'}
                  </button>
                </div>
              </div>
            </div>

            {/* Persistent State Backup / Restore (F128) */}
            <div>
              <span className="text-[11px] text-regolith/60 uppercase block mb-1.5">State Backup & Restore (F128)</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExportState}
                  className="rounded bg-void p-2 text-xs text-white border border-white/10 hover:border-earth uppercase font-bold focus-visible:ring-2 focus-visible:ring-earth min-h-[44px]"
                >
                  Export JSON ⤓
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded bg-void p-2 text-xs text-white border border-white/10 hover:border-earth uppercase font-bold focus-visible:ring-2 focus-visible:ring-earth min-h-[44px]"
                >
                  Import State ⤒
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-3 mt-4">
            <button
              type="button"
              onClick={clearScenarios}
              className="w-full rounded bg-white/10 py-2 text-xs text-regolith hover:text-white uppercase transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-white"
            >
              Reset Scenarios & Clear All
            </button>
          </div>
        </div>
      )}
    </>
  );
}
