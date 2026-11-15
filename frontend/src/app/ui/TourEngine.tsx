import React, {useEffect, useState, useRef, useCallback} from 'react';
import {useStore, STORY_STEPS, type StoryStepDef} from '../../store';

export function TourEngine() {
  const storyRunning = useStore((s) => s.storyRunning);
  const storyPaused = useStore((s) => s.storyPaused);
  const storyStepIndex = useStore((s) => s.storyStepIndex);
  const storyElapsedSec = useStore((s) => s.storyElapsedSec);
  const pauseMarsStory = useStore((s) => s.pauseMarsStory);
  const resumeMarsStory = useStore((s) => s.resumeMarsStory);
  const skipMarsStoryStep = useStore((s) => s.skipMarsStoryStep);
  const prevMarsStoryStep = useStore((s) => s.prevMarsStoryStep);
  const jumpToStoryStep = useStore((s) => s.jumpToStoryStep);
  const stopMarsStory = useStore((s) => s.stopMarsStory);
  const startMarsStory = useStore((s) => s.startMarsStory);
  const resetDemoState = useStore((s) => s.resetDemoState);
  const setPage = useStore((s) => s.setPage);

  // Local Tour Settings
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [presenterMode, setPresenterMode] = useState(false);
  const [spotlightRect, setSpotlightRect] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const [targetFound, setTargetFound] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  // Speed multiplier: detect dev ?speed=16 query param or default 1
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const s = params.get('speed');
      if (s) {
        const parsed = parseFloat(s);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    return 1;
  });

  const currentChapter: StoryStepDef | undefined = STORY_STEPS[storyStepIndex];
  const nextChapter: StoryStepDef | undefined = STORY_STEPS[storyStepIndex + 1];

  // Tour Completion check (480s reached)
  useEffect(() => {
    if (storyRunning && storyElapsedSec >= 480) {
      setShowComplete(true);
    }
  }, [storyRunning, storyElapsedSec]);

  // Dev accelerated clock interval (when speed > 1)
  useEffect(() => {
    if (!storyRunning || storyPaused || speedMultiplier <= 1) return;
    const intervalMs = Math.max(20, Math.floor(1000 / speedMultiplier));
    const timer = setInterval(() => {
      const state = useStore.getState();
      if (!state.storyRunning || state.storyPaused) return;

      const nextSec = state.storyElapsedSec + 1;
      const currentStep = state.storyStepIndex;
      const nextStepDef = STORY_STEPS[currentStep + 1];

      if (nextStepDef && nextSec >= nextStepDef.atSec) {
        useStore.setState({
          storyStepIndex: currentStep + 1,
          storyElapsedSec: nextSec,
        });
        nextStepDef.run(useStore.getState());
      } else if (nextSec >= 480) {
        useStore.setState({storyElapsedSec: 480});
        setShowComplete(true);
      } else {
        useStore.setState({storyElapsedSec: nextSec});
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [storyRunning, storyPaused, speedMultiplier]);

  // Spotlight position updater
  const updateSpotlight = useCallback(() => {
    if (!currentChapter) {
      setSpotlightRect(null);
      return;
    }

    const selector = currentChapter.targetSelector;
    let attempts = 0;

    const findEl = () => {
      const el = document.querySelector(selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        // Add 8px margin around element
        const pad = 8;
        setSpotlightRect({
          top: Math.max(0, rect.top - pad),
          left: Math.max(0, rect.left - pad),
          width: Math.min(window.innerWidth, rect.width + pad * 2),
          height: rect.height + pad * 2,
        });
        setTargetFound(true);

        // Smoothly scroll target into view if outside viewport
        if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
          el.scrollIntoView({behavior: 'smooth', block: 'center'});
        }
      } else {
        attempts++;
        if (attempts < 6) {
          setTimeout(findEl, 200);
        } else {
          // Graceful skip if target is absent
          setSpotlightRect(null);
          setTargetFound(false);
        }
      }
    };

    findEl();
  }, [currentChapter]);

  // Recalculate spotlight on chapter or window resize
  useEffect(() => {
    if (!storyRunning) {
      setSpotlightRect(null);
      return;
    }

    updateSpotlight();

    const handleResize = () => updateSpotlight();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [storyRunning, storyStepIndex, updateSpotlight]);

  // Web Speech API narration
  useEffect(() => {
    if (!speechEnabled || !storyRunning || storyPaused || !currentChapter) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentChapter.narration);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [speechEnabled, storyRunning, storyPaused, storyStepIndex, currentChapter]);

  // Keyboard navigation
  useEffect(() => {
    if (!storyRunning) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in form inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (storyPaused) resumeMarsStory();
        else pauseMarsStory();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        skipMarsStoryStep();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        prevMarsStoryStep();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        stopMarsStory();
        setShowComplete(false);
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setPresenterMode((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    storyRunning,
    storyPaused,
    resumeMarsStory,
    pauseMarsStory,
    skipMarsStoryStep,
    prevMarsStoryStep,
    stopMarsStory,
  ]);

  if (!storyRunning && !showComplete) {
    return null;
  }

  // Format mm:ss
  const elapsedMinutes = Math.floor(storyElapsedSec / 60);
  const elapsedSeconds = storyElapsedSec % 60;
  const timeStr = `${String(elapsedMinutes).padStart(2, '0')}:${String(
    elapsedSeconds
  ).padStart(2, '0')}`;

  const remainingSec = Math.max(0, 480 - storyElapsedSec);
  const remMinutes = Math.floor(remainingSec / 60);
  const remSeconds = remainingSec % 60;
  const remStr = `${String(remMinutes).padStart(2, '0')}:${String(
    remSeconds
  ).padStart(2, '0')}`;

  const progressPercent = Math.min(100, (storyElapsedSec / 480) * 100);

  return (
    <>
      {/* 1. TOP PROGRESS BAR */}
      <div className="fixed top-0 inset-x-0 z-[100] h-1.5 bg-void border-b border-white/10 pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-earth via-[#e0b03a] to-mars transition-all duration-300 shadow-[0_0_12px_rgba(111,182,255,0.6)]"
          style={{width: `${progressPercent}%`}}
        />
      </div>

      {/* 2. TOP HUD CONTROL BAR */}
      <div className="fixed top-2 inset-x-0 z-[95] flex justify-center px-3 pointer-events-none">
        <div
          role="region"
          aria-label="Mars 8-Minute Timeline Tour Controls"
          className="pointer-events-auto max-w-4xl w-full rounded-xl bg-void-2/95 border border-white/20 p-2.5 backdrop-blur-xl shadow-2xl font-mono text-xs text-white flex flex-wrap items-center justify-between gap-3 animate-fade-in"
        >
          {/* Chapter & Timeline Info */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="shrink-0 rounded bg-earth/20 text-earth border border-earth/40 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">
              Ch. {storyStepIndex + 1}/10
            </span>
            <div className="min-w-0">
              <span className="font-display font-bold text-xs truncate block text-white">
                {currentChapter?.title || 'Mars Autonomous Timeline'}
              </span>
              <span className="text-[10px] text-regolith/60 block truncate">
                {timeStr} / 08:00 · Remaining: {remStr}
              </span>
            </div>
          </div>

          {/* Interactive Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Speed Toggle (0.5x, 1x, 2x, 16x) */}
            <div className="flex items-center rounded bg-void p-0.5 border border-white/15 text-[10px]">
              {([0.5, 1, 2] as const).map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => setSpeedMultiplier(spd)}
                  className={`px-1.5 py-0.5 rounded uppercase font-bold transition-colors ${
                    speedMultiplier === spd
                      ? 'bg-earth text-void'
                      : 'text-regolith/60 hover:text-white'
                  }`}
                  title={`Play at ${spd}x speed`}
                >
                  {spd}x
                </button>
              ))}
              {speedMultiplier > 2 && (
                <span className="px-1.5 py-0.5 rounded bg-mars/30 text-mars font-bold">
                  {speedMultiplier}x
                </span>
              )}
            </div>

            {/* Prev Chapter */}
            <button
              type="button"
              onClick={prevMarsStoryStep}
              disabled={storyStepIndex === 0}
              aria-label="Previous Chapter (Left Arrow)"
              title="Previous Chapter (Left Arrow)"
              className="rounded bg-void-2 border border-white/15 p-1.5 text-regolith hover:text-white hover:border-earth transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              ⏮
            </button>

            {/* Play / Pause */}
            <button
              type="button"
              onClick={() => (storyPaused ? resumeMarsStory() : pauseMarsStory())}
              aria-label={storyPaused ? 'Resume Demo (Space)' : 'Pause Demo (Space)'}
              title={storyPaused ? 'Resume Demo (Space)' : 'Pause Demo (Space)'}
              className={`rounded px-3 py-1 font-bold uppercase border transition-all flex items-center gap-1.5 ${
                storyPaused
                  ? 'bg-earth text-void border-earth shadow-[0_0_12px_rgba(111,182,255,0.4)]'
                  : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
              }`}
            >
              <span>{storyPaused ? '▶ Resume' : '⏸ Pause'}</span>
            </button>

            {/* Next Chapter */}
            <button
              type="button"
              onClick={skipMarsStoryStep}
              disabled={storyStepIndex >= STORY_STEPS.length - 1}
              aria-label="Next Chapter (Right Arrow)"
              title="Next Chapter (Right Arrow)"
              className="rounded bg-void-2 border border-white/15 p-1.5 text-regolith hover:text-white hover:border-earth transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              ⏭
            </button>

            {/* Speech Narration Toggle */}
            <button
              type="button"
              onClick={() => setSpeechEnabled((v) => !v)}
              aria-label={speechEnabled ? 'Mute Speech Narration' : 'Enable Speech Narration'}
              title={speechEnabled ? 'Speech Narration: ON' : 'Speech Narration: OFF'}
              className={`rounded p-1.5 border transition-colors ${
                speechEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-void-2 text-regolith/50 border-white/10 hover:text-white'
              }`}
            >
              {speechEnabled ? '🔊' : '🔇'}
            </button>

            {/* Presenter Notes Toggle ('P') */}
            <button
              type="button"
              onClick={() => setPresenterMode((v) => !v)}
              aria-label="Toggle Presenter Notes ('P')"
              title="Toggle Presenter Notes ('P')"
              className={`rounded px-2 py-1 text-[11px] font-bold uppercase border transition-colors ${
                presenterMode
                  ? 'bg-[#e0b03a] text-void border-[#e0b03a]'
                  : 'bg-void-2 text-regolith/70 border-white/15 hover:text-white'
              }`}
            >
              P Notes
            </button>

            {/* Reset Demo Button */}
            <button
              type="button"
              onClick={() => {
                resetDemoState();
                startMarsStory();
              }}
              aria-label="Restart Demo (Shift+R)"
              title="Restart Demo (Shift+R)"
              className="rounded bg-void-2 border border-white/15 p-1.5 text-regolith/70 hover:text-mars hover:border-mars transition-colors"
            >
              ↺
            </button>

            {/* Exit Tour */}
            <button
              type="button"
              onClick={stopMarsStory}
              aria-label="Exit Demo Tour (Esc)"
              title="Exit Demo Tour (Esc)"
              className="rounded bg-mars/20 border border-mars/40 px-2.5 py-1 text-mars font-bold uppercase hover:bg-mars hover:text-white transition-colors"
            >
              ✕ Exit
            </button>
          </div>
        </div>
      </div>

      {/* 3. SPOTLIGHT CUTOUT & PULSING OUTLINE */}
      {spotlightRect && (
        <div
          className="fixed pointer-events-none z-[85] transition-all duration-300 rounded-xl ring-2 ring-earth shadow-[0_0_24px_rgba(111,182,255,0.45)] animate-pulse"
          style={{
            top: `${spotlightRect.top}px`,
            left: `${spotlightRect.left}px`,
            width: `${spotlightRect.width}px`,
            height: `${spotlightRect.height}px`,
          }}
        />
      )}

      {/* 4. NARRATION CAPTION CARD (aria-live) */}
      <aside
        aria-live="polite"
        aria-label="Tour Chapter Narration"
        className="fixed bottom-6 inset-x-0 z-[90] flex justify-center px-4 pointer-events-none"
      >
        <div className="pointer-events-auto max-w-2xl w-full rounded-2xl bg-void-2/95 border border-earth/40 p-4 shadow-2xl backdrop-blur-xl font-mono text-xs space-y-2.5 animate-slide-up">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-earth animate-ping" />
              <span className="font-display font-bold uppercase tracking-wider text-earth text-xs">
                {currentChapter?.title}
              </span>
            </div>
            <span className="text-[10px] text-regolith/50 uppercase">
              {timeStr} · Chapter {storyStepIndex + 1} of 10
            </span>
          </div>

          <p className="text-white text-xs leading-relaxed font-sans">
            {currentChapter?.narration}
          </p>

          {/* Quick jump chapter pills */}
          <div className="flex items-center justify-between pt-1 font-mono text-[10px]">
            <span className="text-regolith/50 uppercase">Quick Jump:</span>
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {STORY_STEPS.map((step, idx) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => jumpToStoryStep(idx)}
                  className={`size-5 rounded flex items-center justify-center font-bold transition-colors ${
                    storyStepIndex === idx
                      ? 'bg-earth text-void font-extrabold'
                      : 'bg-void text-regolith/60 hover:text-white border border-white/10'
                  }`}
                  title={step.title}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* 5. PRESENTER NOTES OVERLAY ('P' Key) */}
      {presenterMode && (
        <div
          role="complementary"
          aria-label="Presenter Cues and Rehearsal Notes"
          className="fixed top-18 right-4 z-[92] w-80 rounded-xl bg-void/95 border border-[#e0b03a]/50 p-4 shadow-2xl backdrop-blur-xl font-mono text-xs space-y-2.5 animate-fade-in"
        >
          <div className="flex items-center justify-between border-b border-[#e0b03a]/30 pb-1.5">
            <span className="font-bold text-[#e0b03a] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <span>📋</span> Presenter Mode [P]
            </span>
            <button
              type="button"
              onClick={() => setPresenterMode(false)}
              className="text-regolith/60 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>

          <div>
            <span className="text-[10px] text-regolith/50 uppercase block">Active Cue:</span>
            <p className="text-white text-xs mt-0.5 leading-snug">
              {currentChapter?.presenterNotes}
            </p>
          </div>

          {nextChapter && (
            <div className="pt-2 border-t border-white/10">
              <span className="text-[10px] text-earth uppercase block">
                Up Next: {nextChapter.title}
              </span>
              <span className="text-[10px] text-regolith/60 block mt-0.5">
                Target: {nextChapter.targetSelector}
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-white/10 flex justify-between text-[10px] text-regolith/60">
            <span>Space: Pause/Play</span>
            <span>Arrows: Skip</span>
            <span>Shift+R: Reset</span>
          </div>
        </div>
      )}

      {/* 6. DEMO COMPLETE CARD (At 8:00) */}
      {showComplete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-complete-title"
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in"
        >
          <div className="w-full max-w-lg rounded-2xl bg-void-2 border border-earth/60 p-6 shadow-2xl font-mono text-xs space-y-4 text-center">
            <div className="size-12 mx-auto rounded-full bg-earth/20 border border-earth/60 flex items-center justify-center text-earth text-xl font-bold animate-bounce">
              ✓
            </div>
            <div>
              <h3
                id="demo-complete-title"
                className="font-display text-lg uppercase text-white font-bold tracking-wider"
              >
                Mars 8-Minute Mission Tour Completed
              </h3>
              <span className="text-[11px] text-regolith/60 uppercase block mt-1">
                All 10 Autonomous Deep-Space Milestones Verified
              </span>
            </div>

            <p className="text-regolith/80 text-xs leading-relaxed max-w-md mx-auto">
              You have experienced the complete 8-minute journey across Level 3 autonomy:
              biometrics vs personal baseline, optical pulse confidence gate, passive telehealth,
              pre-symptomatic CO2 early warning, Wait-or-Act decision flip under 24m latency,
              asynchronous surgeon directive uplink, supplies depletion forecasting, offline
              assistant citation verification, hardware watchdog degradation, and scientific proof.
            </p>

            <div className="pt-2 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowComplete(false);
                  resetDemoState();
                  startMarsStory();
                }}
                className="rounded-lg bg-earth px-5 py-2.5 font-bold uppercase text-void hover:bg-earth/90 transition-all shadow-md min-h-[44px]"
              >
                ↺ Replay Tour
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowComplete(false);
                  stopMarsStory();
                  setPage('home');
                }}
                className="rounded-lg bg-void border border-white/20 px-5 py-2.5 font-bold uppercase text-white hover:border-earth transition-all min-h-[44px]"
              >
                Back to Home Console
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
