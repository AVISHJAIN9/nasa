import {useState} from 'react';
import type {Alert} from '../../store';

export interface AlertCardProps {
  alert: Alert;
  onAck?: (id: string) => void;
  onResolve?: (id: string, note?: string) => void;
  onFeedback?: (isTrue: boolean) => void;
  selected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}

export function AlertCard({
  alert,
  onAck,
  onResolve,
  onFeedback,
  selected = false,
  onSelect,
  compact = false,
}: AlertCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [showResolveInput, setShowResolveInput] = useState(false);

  const severityStyles =
    alert.severity === 'critical'
      ? 'border-mars/50 bg-mars/5 text-mars'
      : alert.severity === 'watch'
      ? 'border-[#e0b03a]/50 bg-[#e0b03a]/5 text-[#e0b03a]'
      : 'border-earth/40 bg-earth/5 text-earth';

  const badgeColor =
    alert.source === 'AI'
      ? 'bg-purple-950/60 text-purple-300 border-purple-800/40'
      : alert.source === 'CABIN'
      ? 'bg-amber-950/60 text-amber-300 border-amber-800/40'
      : 'bg-blue-950/60 text-blue-300 border-blue-800/40';

  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border p-4 transition-all ${
        selected ? 'ring-2 ring-earth shadow-lg' : ''
      } ${
        alert.status === 'resolved'
          ? 'border-white/5 bg-void-2/40 opacity-70'
          : severityStyles
      } ${onSelect ? 'cursor-pointer hover:border-white/30' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase ${badgeColor}`}>
            {alert.source}
          </span>
          <span className="font-mono text-label uppercase text-regolith/60">{alert.time}</span>
          {alert.count > 1 && (
            <span className="rounded bg-white/10 px-1.5 py-0.2 font-mono text-[11px] text-white">
              ×{alert.count}
            </span>
          )}
          {alert.status !== 'new' && (
            <span className="font-mono text-[11px] uppercase text-regolith/50">
              [{alert.status}]
            </span>
          )}
        </div>

        <span className="font-mono text-[11px] uppercase tracking-wider font-semibold">
          {alert.severity}
        </span>
      </div>

      <h4 className="mt-2 font-display text-[0.9375rem] text-white">{alert.title}</h4>

      {/* Prediction Set Chips & AI Unsure (F048, X04) */}
      {alert.predictionSet && alert.predictionSet.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-regolith/50 uppercase">Differential:</span>
          {alert.predictionSet.map((p, idx) => (
            <span
              key={idx}
              className="rounded bg-earth/20 text-earth border border-earth/30 px-1.5 py-0.2 font-mono text-[11px]"
            >
              {p}
            </span>
          ))}
          {(alert.aiUnsure || alert.predictionSet.length > 1 || alert.confidence < 0.55) && (
            <span className="rounded bg-[#e0b03a]/25 text-[#e0b03a] border border-[#e0b03a]/40 px-1.5 py-0.2 font-mono text-[11px] font-bold uppercase animate-pulse">
              AI UNSURE — escalate
            </span>
          )}
        </div>
      )}

      {!compact && (
        <>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-regolith/80">{alert.explanation}</p>

          {/* Factors bar list */}
          {alert.factors && alert.factors.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-white/5 pt-2">
              <span className="font-mono text-[11px] text-regolith/50 uppercase block">Diagnostic Factors</span>
              {alert.factors.map((f, i) => (
                <div key={i} className="flex items-center justify-between gap-3 font-mono text-[11px]">
                  <span className="text-regolith/70 truncate">{f.label}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={f.direction === 'up' ? 'text-mars' : 'text-earth'}>
                      {f.direction === 'up' ? '▲' : '▼'}
                    </span>
                    <div className="h-1.5 w-16 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${f.direction === 'up' ? 'bg-mars' : 'bg-earth'}`}
                        style={{width: `${Math.round(f.size * 100)}%`}}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Expandable "Why" plain-language explanation */}
          <div className="mt-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="font-mono text-[11px] text-earth underline hover:text-white"
            >
              {expanded ? 'Hide clinical rationale' : 'Why did this trigger?'}
            </button>
            {expanded && (
              <div className="mt-2 rounded bg-void p-3 font-mono text-[11px] text-regolith/85 border border-white/10 space-y-1.5">
                <p>
                  <strong className="text-white">Clinical Logic:</strong> Decision threshold calibrated for deep-space autonomous stabilization during communication outage.
                </p>
                <p>
                  <strong className="text-white">Confidence Score:</strong> {(alert.confidence * 100).toFixed(0)}% algorithmic certainty.
                </p>
                {alert.resolveNote && (
                  <p className="text-earth">
                    <strong className="text-white">Resolution Note:</strong> {alert.resolveNote}
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Action buttons */}
      {((onAck || onResolve) && alert.status !== 'resolved' || onFeedback) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap items-center gap-2">
            {onAck && alert.status === 'new' && (
              <button
                type="button"
                onClick={() => onAck(alert.id)}
                className="rounded bg-white/10 px-3 py-1 font-mono text-label text-white uppercase hover:bg-white/20 transition-colors"
              >
                Acknowledge
              </button>
            )}

            {onResolve && !showResolveInput && (
              <button
                type="button"
                onClick={() => setShowResolveInput(true)}
                className="rounded bg-earth/15 px-3 py-1 font-mono text-label text-earth uppercase hover:bg-earth hover:text-void transition-colors"
              >
                Resolve...
              </button>
            )}
          </div>

          {/* False-Alarm Feedback Buttons (F050) */}
          {onFeedback && (
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                type="button"
                onClick={() => onFeedback(true)}
                className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 font-mono text-[11px] font-bold uppercase hover:bg-emerald-500 hover:text-void transition-colors"
                title="Confirm as true alert (decrements sigma threshold)"
              >
                True alert
              </button>
              <button
                type="button"
                onClick={() => onFeedback(false)}
                className="rounded bg-mars/20 text-mars border border-mars/40 px-2 py-0.5 font-mono text-[11px] font-bold uppercase hover:bg-mars hover:text-white transition-colors"
                title="Flag as false alarm (raises sigma threshold)"
              >
                False alarm
              </button>
            </div>
          )}

          {showResolveInput && onResolve && (
            <div className="flex w-full items-center gap-2 mt-1">
              <input
                type="text"
                placeholder="Action note (e.g. Scrubber B switched)..."
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                className="flex-1 rounded bg-void px-2.5 py-1 text-xs text-white border border-white/20 focus:outline-none focus:border-earth"
              />
              <button
                type="button"
                onClick={() => {
                  onResolve(alert.id, resolveNote || 'Clinical triage confirmed');
                  setShowResolveInput(false);
                }}
                className="rounded bg-earth px-2.5 py-1 font-mono text-xs text-void font-bold uppercase"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowResolveInput(false)}
                className="font-mono text-xs text-regolith/50 hover:text-white"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
