import {useEffect, useState} from 'react';
import {useStore} from '../../store';
import {PROTOCOLS, type Protocol} from '../../data/protocols';
import {Panel, PageHeader} from '../ui';

export function Protocols() {
  const activeProtocol = useStore((s) => s.activeProtocol);
  const startProtocol = useStore((s) => s.startProtocol);
  const advanceProtocolStep = useStore((s) => s.advanceProtocolStep);
  const abortProtocol = useStore((s) => s.abortProtocol);
  const eventLog = useStore((s) => s.eventLog);
  const verifyEventLogChain = useStore((s) => s.verifyEventLogChain);
  const addToast = useStore((s) => s.addToast);

  // Local state for active protocol ID in runner
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>('cpr');
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
  const [verificationResult, setVerificationResult] = useState<{valid: boolean; brokenIndex?: number} | null>(null);

  const currentProtocol: Protocol =
    PROTOCOLS.find((p) => p.id === (activeProtocol?.protocolId || selectedProtocolId)) || PROTOCOLS[0];

  const currentStepIdx = activeProtocol?.stepIndex ?? 0;
  const currentStep = currentProtocol.steps[currentStepIdx] || currentProtocol.steps[0];
  const totalSteps = currentProtocol.steps.length;

  // Step countdown timer
  useEffect(() => {
    if (activeProtocol && currentStep.timerSec) {
      setTimerLeft(currentStep.timerSec);
    } else {
      setTimerLeft(null);
    }
  }, [activeProtocol, currentStepIdx, currentStep.timerSec]);

  useEffect(() => {
    if (timerLeft === null || timerLeft <= 0) return;
    const timer = setInterval(() => {
      setTimerLeft((t) => (t && t > 1 ? t - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [timerLeft]);

  const handleNextStep = (nextIdx: number) => {
    if (nextIdx >= totalSteps) {
      addToast(`Protocol ${currentProtocol.title} successfully completed`, 'success');
      abortProtocol();
    } else {
      advanceProtocolStep(nextIdx);
    }
  };

  const handleVerify = () => {
    const res = verifyEventLogChain();
    setVerificationResult(res);
    if (res.valid) {
      addToast('Event log chain verified: all FNV-1a block hashes match ✓', 'success');
    } else {
      addToast(`Tamper detected! Hash broken at block #${res.brokenIndex}`, 'warn');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="F060, F063–F065, F073"
        title="Emergency protocol runner & audit log"
        description="Step-by-step clinical execution with cryptographic tamper-evident hash chaining."
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Active Protocol Runner (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          <Panel title="Protocol Interactive Stepper">
            <div className="space-y-6 font-mono text-xs">
              {/* Protocol selector tabs if not actively running */}
              {!activeProtocol && (
                <div className="grid grid-cols-3 gap-2 border-b border-white/10 pb-4">
                  {PROTOCOLS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedProtocolId(p.id)}
                      className={`rounded p-3 text-left border transition-colors ${
                        selectedProtocolId === p.id
                          ? 'bg-void-2 text-white border-earth ring-1 ring-earth'
                          : 'bg-void text-regolith/70 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <span className="font-bold block truncate">{p.title}</span>
                      <span className="text-[11px] text-regolith/50">{p.durationEst}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Protocol Header Info */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-regolith/50 uppercase block">Active Procedure</span>
                  <h3 className="font-display text-base text-white font-bold">{currentProtocol.title}</h3>
                </div>
                {activeProtocol ? (
                  <button
                    type="button"
                    onClick={abortProtocol}
                    className="rounded bg-mars/20 border border-mars/40 px-3 py-1 font-mono text-xs text-mars uppercase font-bold hover:bg-mars hover:text-white transition-colors"
                  >
                    Abort Protocol
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startProtocol(currentProtocol.id)}
                    className="rounded bg-earth px-4 py-2 font-mono text-xs text-void font-bold uppercase hover:bg-earth/90 transition-colors"
                  >
                    Start Protocol Runner
                  </button>
                )}
              </div>

              {/* Progress bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-regolith/60 uppercase">
                  <span>Step {currentStepIdx + 1} of {totalSteps}</span>
                  <span>{Math.round(((currentStepIdx + 1) / totalSteps) * 100)}% Complete</span>
                </div>
                <div className="h-1.5 w-full rounded bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-earth transition-all duration-300"
                    style={{width: `${((currentStepIdx + 1) / totalSteps) * 100}%`}}
                  />
                </div>
              </div>

              {/* Current Step Content Box */}
              <div className="rounded-lg bg-void p-5 border border-white/15 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-earth uppercase font-bold">
                      Instruction #{currentStepIdx + 1}
                    </span>
                    <h4 className="mt-2 font-display text-base text-white">{currentStep.title}</h4>
                  </div>

                  {timerLeft !== null && (
                    <div className="rounded bg-void-2 border border-earth/40 p-3 text-center shrink-0">
                      <span className="text-[11px] text-regolith/50 uppercase block">Timer</span>
                      <span className="font-display text-2xl text-earth font-bold tabular-nums">
                        {timerLeft}s
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-sm text-regolith/90 leading-relaxed font-sans">
                  {currentStep.detail}
                </p>

                {/* Branching decision questions */}
                {currentStep.branch && (
                  <div className="rounded bg-void-2 p-4 border border-[#e0b03a]/30 space-y-3">
                    <p className="text-white font-bold">{currentStep.branch.question}</p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => handleNextStep(currentStep.branch!.yes)}
                        className="rounded bg-earth px-4 py-2 text-void font-bold uppercase hover:bg-earth/90"
                      >
                        Yes → Step {currentStep.branch.yes + 1}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNextStep(currentStep.branch!.no)}
                        className="rounded bg-white/10 px-4 py-2 text-white font-bold uppercase hover:bg-white/20"
                      >
                        No → Step {currentStep.branch.no + 1}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Standard Step Advancement (if not a branching question) */}
              {!currentStep.branch && (
                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    disabled={currentStepIdx === 0}
                    onClick={() => handleNextStep(Math.max(0, currentStepIdx - 1))}
                    className="rounded bg-white/5 px-4 py-2 text-regolith/70 uppercase hover:text-white disabled:opacity-30"
                  >
                    ← Previous Step
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNextStep(currentStepIdx + 1)}
                    className="rounded bg-white px-6 py-2.5 text-void font-bold uppercase hover:bg-earth transition-colors"
                  >
                    {currentStepIdx + 1 === totalSteps ? 'Complete Protocol ✓' : 'Confirm & Next Step →'}
                  </button>
                </div>
              )}

              {/* Source Line */}
              <div className="text-[11px] text-regolith/50 pt-2 border-t border-white/5">
                Source: {currentProtocol.source}
              </div>
            </div>
          </Panel>
        </div>

        {/* Right: Cryptographic Append-Only Event Log (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          <Panel
            title="Append-Only Audit Log (FNV-1a Chain)"
            rightAction={
              <button
                type="button"
                onClick={handleVerify}
                className="rounded bg-earth/20 text-earth px-2.5 py-1 font-mono text-[11px] font-bold uppercase hover:bg-earth hover:text-void transition-colors"
              >
                Verify Chain
              </button>
            }
          >
            <div className="space-y-3 font-mono text-xs">
              {verificationResult && (
                <div
                  className={`rounded p-2.5 text-xs border ${
                    verificationResult.valid
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                      : 'bg-mars/20 text-mars border-mars/40 font-bold animate-pulse'
                  }`}
                >
                  {verificationResult.valid
                    ? '✓ Hash Chain Verified: 100% cryptographic integrity intact.'
                    : `⚠️ TAMPER DETECTED: Hash broken at block #${verificationResult.brokenIndex}!`}
                </div>
              )}

              <div
                data-lenis-prevent
                className="space-y-2 max-h-[460px] overflow-y-auto pr-1"
              >
                {eventLog.map((entry) => (
                  <div
                    key={entry.index}
                    className="rounded bg-void p-2.5 border border-white/5 space-y-1 text-[11px]"
                  >
                    <div className="flex items-center justify-between text-regolith/50">
                      <span>#{entry.index} · {entry.timeStr}</span>
                      <span className="text-earth font-bold">Hash: {entry.hash}</span>
                    </div>
                    <p className="text-white font-medium break-words">{entry.payload}</p>
                    <span className="text-[11px] text-regolith/40 block">Prev: {entry.prevHash}</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
