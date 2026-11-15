import {useState, useEffect} from 'react';
import {useStore} from '../../store';

export function ConsentModal() {
  const consentAccepted = useStore((s) => s.consentAccepted);
  const consentVersion = useStore((s) => s.consentVersion);
  const acceptConsent = useStore((s) => s.acceptConsent);
  const role = useStore((s) => s.role);

  const [operatorName, setOperatorName] = useState(() => {
    return role === 'astronaut'
      ? 'CDR Elena Vega'
      : role === 'surgeon'
      ? 'Dr. Priya Nair (Houston)'
      : 'Flight Director Reyes';
  });

  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState('');

  // Update default operator name if role changes while modal is visible
  useEffect(() => {
    if (role === 'astronaut') setOperatorName('CDR Elena Vega');
    else if (role === 'surgeon') setOperatorName('Dr. Priya Nair (Houston)');
    else if (role === 'control') setOperatorName('Flight Director Reyes');
  }, [role]);

  if (consentAccepted) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!acknowledged) {
      setError('You must confirm review of the clinical decision-support boundaries.');
      return;
    }
    if (!operatorName.trim()) {
      setError('Please provide an operator identifier / callsign.');
      return;
    }
    acceptConsent(operatorName.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="consent-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-white/20 bg-void-2 p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto font-mono text-xs">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/10 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded bg-mars/20 text-mars border border-mars/30 px-2 py-0.5 text-[11px] font-bold uppercase">
                Regulatory Disclosure
              </span>
              <span className="rounded bg-white/10 text-white px-2 py-0.5 text-[11px] font-bold">
                Version {consentVersion}
              </span>
            </div>
            <h2 id="consent-title" className="font-display text-lg sm:text-xl text-white font-bold uppercase tracking-wider">
              Clinical Protocol & Decision-Support Acknowledgment
            </h2>
          </div>
          <span className="text-xl text-regolith/40">🛡️</span>
        </div>

        {/* Scrollable Terms & Operational Stance */}
        <div className="space-y-4 text-regolith/85 leading-relaxed rounded-lg bg-void p-4 border border-white/10 max-h-56 overflow-y-auto">
          <div>
            <h4 className="text-white font-bold uppercase text-[11px]">1. Research Decision-Support Prototype</h4>
            <p className="mt-1">
              AstroCare is an Earth-independent clinical decision-support prototype engineered exclusively for interplanetary transit simulations and latency research. 
              <strong className="text-mars"> It is NOT an FDA-cleared diagnostic device and does not substitute for licensed physician oversight.</strong>
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold uppercase text-[11px]">2. Local Client-Side Execution</h4>
            <p className="mt-1">
              All biometric analysis, optical rPPG pulse extraction, and synthetic triage reasoning run synchronously inside your client browser. No video frames, camera buffers, or protected health information are transmitted across cloud networks.
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold uppercase text-[11px]">3. Deep-Space Latency & Human-in-the-Loop Authority</h4>
            <p className="mt-1">
              During interplanetary transit, round-trip light speed delays reach tens of minutes. Under Level 3 autonomy, onboard algorithms propose actionable protocols, but the crew maintains final operational execution authority.
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold uppercase text-[11px]">4. Auditability & Cryptographic Logging</h4>
            <p className="mt-1">
              All consent approvals, protocol triggers, vital overrides, and clinical directives are hashed and logged to an immutable FNV-1a event log chain.
            </p>
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="operator-callsign" className="block text-[11px] text-regolith/60 uppercase font-bold mb-1.5">
              Operator Callsign / Physician Name
            </label>
            <input
              id="operator-callsign"
              type="text"
              value={operatorName}
              onChange={(e) => {
                setOperatorName(e.target.value);
                setError('');
              }}
              className="w-full rounded-lg bg-void border border-white/15 px-3.5 py-2.5 text-white font-mono text-xs focus:border-earth focus:outline-none focus:ring-1 focus:ring-earth min-h-[44px]"
              placeholder="e.g. CDR Elena Vega"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => {
                setAcknowledged(e.target.checked);
                setError('');
              }}
              className="mt-0.5 size-4 rounded border-white/30 bg-void text-earth focus:ring-earth min-w-[16px]"
            />
            <span className="text-[11px] text-regolith/90">
              I acknowledge that AstroCare provides algorithmic decision-support only, understand its operational boundaries, and confirm local processing consent (Version {consentVersion}).
            </span>
          </label>

          {error && (
            <p className="rounded bg-mars/15 border border-mars/40 px-3 py-1.5 text-[11px] text-mars">
              {error}
            </p>
          )}

          <div className="pt-2 flex flex-col-reverse sm:flex-row justify-end gap-3">
            <button
              type="submit"
              className="w-full sm:w-auto rounded-lg bg-earth px-6 py-3 font-display text-xs font-bold uppercase text-void tracking-wider hover:bg-earth/90 transition-colors shadow-lg min-h-[48px] focus:outline-none focus:ring-2 focus:ring-earth focus:ring-offset-2 focus:ring-offset-void"
            >
              Accept & Enter Mission Console →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
