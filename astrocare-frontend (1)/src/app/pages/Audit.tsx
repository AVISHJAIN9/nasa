import {useState} from 'react';
import {useStore} from '../../store';
import {Panel, PageHeader} from '../ui';

export function Audit() {
  const eventLog = useStore((s) => s.eventLog);
  const verifyEventLogChain = useStore((s) => s.verifyEventLogChain);
  const tamperEventLog = useStore((s) => s.tamperEventLog);

  const [actorFilter, setActorFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [verificationResult, setVerificationResult] = useState<{
    tested: boolean;
    valid: boolean;
    brokenIndex?: number;
  } | null>(null);

  const handleVerify = () => {
    const res = verifyEventLogChain();
    setVerificationResult({tested: true, ...res});
  };

  const filteredLog = eventLog.filter((entry) => {
    if (actorFilter !== 'all') {
      const entryActor = entry.actor?.toLowerCase() || 'system';
      if (!entryActor.includes(actorFilter.toLowerCase())) return false;
    }
    if (categoryFilter !== 'all') {
      if (entry.category !== categoryFilter) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="F124 IMMUTABLE LEDGER"
        title="Cryptographic event log & audit trail"
        description="Cryptographically chained sequence of mission actions, role handoffs, consent grants, and clinical directives."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleVerify}
              className="rounded bg-earth px-4 py-2 font-mono text-xs font-bold uppercase text-void hover:bg-earth/90 transition-colors shadow flex items-center gap-2"
            >
              <span>🔐</span>
              <span>Verify Chain Integrity</span>
            </button>
            <button
              type="button"
              onClick={tamperEventLog}
              className="rounded bg-mars/20 border border-mars/40 px-3 py-2 font-mono text-xs font-bold uppercase text-mars hover:bg-mars/30 transition-colors"
              title="Inject an unauthorized edit to test the verification detector"
            >
              Simulate Tamper
            </button>
          </div>
        }
      />

      {/* Verification Status Banner */}
      {verificationResult?.tested && (
        <div
          className={`rounded-lg p-4 font-mono text-xs border flex items-center justify-between ${
            verificationResult.valid
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
              : 'bg-mars/20 border-mars/50 text-mars animate-pulse'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-base">{verificationResult.valid ? '✓' : '⚠️'}</span>
            <span className="font-bold uppercase tracking-wider">
              {verificationResult.valid
                ? `Cryptographic Chain Verified: All ${eventLog.length} block hashes are mathematically valid & untampered.`
                : `Tamper Detected: Chain broken at block index #${verificationResult.brokenIndex}! Previous hash pointer invalidated.`}
            </span>
          </div>
          <span className="text-[11px] opacity-75">
            FNV-1a 32-bit Chained Digits
          </span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-void-2 p-4 border border-white/10 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-regolith/60 uppercase text-[11px]">Actor:</span>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="rounded bg-void border border-white/15 px-3 py-1.5 text-white font-mono"
            >
              <option value="all">All Actors</option>
              <option value="surgeon">Surgeon</option>
              <option value="astronaut">Astronaut</option>
              <option value="control">Mission Control</option>
              <option value="cmo">Medical Officer</option>
              <option value="system">System / AI</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-regolith/60 uppercase text-[11px]">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded bg-void border border-white/15 px-3 py-1.5 text-white font-mono"
            >
              <option value="all">All Categories</option>
              <option value="alert">Alerts</option>
              <option value="order">Orders</option>
              <option value="note">Notes</option>
              <option value="consent">Consent</option>
              <option value="emergency">Emergency</option>
              <option value="scenario">Scenarios</option>
              <option value="cmo">CMO Designations</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>

        <span className="text-regolith/60 text-[11px] uppercase">
          Showing {filteredLog.length} of {eventLog.length} Ledger Records
        </span>
      </div>

      {/* Event Ledger Table */}
      <Panel title="Chained Audit Ledger">
        <div data-lenis-prevent className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/10 text-regolith/50 uppercase text-[11px]">
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Actor</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-4">Event Payload / Action</th>
                <th className="py-2.5 px-3 text-right">Prev Hash</th>
                <th className="py-2.5 px-3 text-right">Block Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {[...filteredLog].reverse().map((entry) => (
                <tr key={entry.index} className="hover:bg-white/5 transition-colors">
                  <td className="py-2.5 px-3 text-regolith/50 font-bold">
                    #{entry.index}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-regolith/75">
                    {entry.timeStr}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-bold uppercase text-regolith">
                      {entry.actor || 'system'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="rounded bg-earth/20 text-earth border border-earth/30 px-2 py-0.5 text-[11px] font-bold uppercase">
                      {entry.category || 'general'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 max-w-md break-words text-white">
                    {entry.payload}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[11px] text-regolith/50">
                    {entry.prevHash.slice(0, 8)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[11px] text-emerald-400 font-bold">
                    {entry.hash.slice(0, 8)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
