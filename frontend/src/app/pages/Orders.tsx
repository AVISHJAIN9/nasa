import {useState} from 'react';
import {useStore, type OrderType} from '../../store';
import {Panel, PageHeader} from '../ui';

export function Orders() {
  const role = useStore((s) => s.role);
  const crew = useStore((s) => s.crew);
  const orders = useStore((s) => s.orders);
  const composeOrder = useStore((s) => s.composeOrder);
  const acknowledgeOrder = useStore((s) => s.acknowledgeOrder);
  const medicalOfficerCrewId = useStore((s) => s.medicalOfficerCrewId);
  const mode = useStore((s) => s.mode);

  const isMedicalOfficer = role === 'astronaut' && medicalOfficerCrewId === 'vega';
  const canCompose = role === 'surgeon' || isMedicalOfficer;

  const [targetCrewId, setTargetCrewId] = useState<string>('vega');
  const [orderType, setOrderType] = useState<OrderType>('medication');
  const [orderText, setOrderText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderText.trim() || !canCompose) return;

    const author = role === 'surgeon' ? 'Dr. Priya Nair (Houston)' : 'Elena Vega (CMO)';
    composeOrder(targetCrewId, orderType, orderText.trim(), author);
    setOrderText('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'queued':
        return <span className="rounded bg-white/10 text-regolith/80 border border-white/20 px-2 py-0.5 text-[11px] font-bold uppercase">Queued</span>;
      case 'in-flight':
        return <span className="rounded bg-earth/20 text-earth border border-earth/40 px-2 py-0.5 text-[11px] font-bold uppercase animate-pulse">In Flight 📡</span>;
      case 'delivered':
        return <span className="rounded bg-[#e0b03a]/20 text-[#e0b03a] border border-[#e0b03a]/40 px-2 py-0.5 text-[11px] font-bold uppercase">Delivered</span>;
      case 'acknowledged':
        return <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold uppercase">✓ Acknowledged</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="F100 DIRECTIVES & COMMUNICATIONS"
        title="Clinical orders & latency queue"
        description="Mission control & flight surgeon medical orders are injected into the deep-space link carrier, transitioning from queued to in-flight, delivered, and verified upon bilateral receipt acknowledgment."
        actions={
          canCompose ? (
            <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 font-mono text-xs font-bold uppercase">
              ✍️ Order Issuer ({role === 'surgeon' ? 'Dr. Priya Nair' : 'Elena Vega CMO'})
            </span>
          ) : (
            <span className="rounded bg-white/10 text-regolith/70 border border-white/15 px-3 py-1 font-mono text-xs font-bold uppercase">
              👁️ Observer / Recipient
            </span>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Compose Order */}
        <div className="lg:col-span-1 space-y-6">
          <Panel title="Compose Medical Order">
            {canCompose ? (
              <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-regolith/60 uppercase text-[11px] mb-1">
                    Target Crew Member
                  </label>
                  <select
                    value={targetCrewId}
                    onChange={(e) => setTargetCrewId(e.target.value)}
                    className="w-full rounded bg-void border border-white/15 px-3 py-2 text-white font-mono min-h-[44px]"
                  >
                    {crew.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — {c.roleTitle}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-regolith/60 uppercase text-[11px] mb-1">
                    Directive Category
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['medication', 'exercise', 'rest', 'other'] as OrderType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setOrderType(t)}
                        className={`rounded px-3 py-2 uppercase font-bold border transition-colors ${
                          orderType === t
                            ? 'bg-earth text-void border-earth shadow'
                            : 'bg-void text-regolith/70 border-white/10 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-regolith/60 uppercase text-[11px] mb-1">
                    Order Details & Instructions
                  </label>
                  <textarea
                    rows={4}
                    value={orderText}
                    onChange={(e) => setOrderText(e.target.value)}
                    placeholder="e.g. Ingest 1000 mL electrolyte solution, suspend treadmill run for Sol 143, repeat visual test..."
                    className="w-full rounded bg-void border border-white/15 p-3 text-white font-mono focus:border-earth focus:outline-none"
                    required
                  />
                </div>

                <div className="rounded bg-void p-3 border border-white/10 text-[11px] text-regolith/70 space-y-1">
                  <span className="text-white font-bold block uppercase">Carrier Transit Delay</span>
                  <p>Current operational mode: <strong className="text-earth">{mode}</strong></p>
                  <p>One-way uplink delay will apply before delivery to craft.</p>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-earth px-5 py-2.5 font-bold uppercase text-void hover:bg-earth/90 transition-colors shadow min-h-[44px]"
                >
                  Transmit Order Uplink →
                </button>

                {submitted && (
                  <p className="text-emerald-400 text-center font-bold">
                    ✓ Order entered uplink comms queue!
                  </p>
                )}
              </form>
            ) : (
              <div className="p-4 rounded-lg bg-void border border-white/15 text-xs font-mono text-regolith/70 space-y-2">
                <p>Order composition requires Ground Flight Surgeon credentials or Crew Medical Officer designation.</p>
                <p className="text-[11px]">Select Flight Surgeon in the left rail to issue clinical directives.</p>
              </div>
            )}
          </Panel>
        </div>

        {/* Right: Orders Table */}
        <div className="lg:col-span-2 space-y-6">
          <Panel title={`Live Comms Order Ledger (${orders.length})`}>
            <div className="space-y-4 font-mono text-xs">
              {orders.length === 0 ? (
                <div className="p-6 text-center text-regolith/50">
                  No medical orders in ledger. Transmit an order to observe queue progression.
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((o) => {
                    const target = crew.find((c) => c.id === o.targetCrewId);
                    const canAck = o.status === 'delivered';

                    return (
                      <div
                        key={o.id}
                        className="rounded-lg bg-void p-4 border border-white/10 hover:border-white/20 space-y-3 transition-colors"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] rounded bg-white/10 px-1.5 py-0.5 text-regolith uppercase font-bold">
                              {o.type}
                            </span>
                            <span className="font-bold text-white">
                              To: {target?.name || o.targetCrewId}
                            </span>
                            <span className="text-[11px] text-regolith/60">
                              By: {o.composedBy}
                            </span>
                          </div>
                          <div>{getStatusBadge(o.status)}</div>
                        </div>

                        <p className="text-white text-xs leading-relaxed">{o.text}</p>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-regolith/60 pt-1">
                          <span>Created: {o.timeStr}</span>
                          {o.ackTimeStr && (
                            <span className="text-emerald-400">
                              Acked: {o.ackTimeStr}
                            </span>
                          )}

                          {canAck && (
                            <button
                              type="button"
                              onClick={() => acknowledgeOrder(o.id, target?.name || 'Astronaut')}
                              className="rounded bg-earth px-3 py-1 font-bold text-void uppercase hover:bg-earth/90 transition-colors shadow"
                            >
                              Acknowledge Receipt & Comply ✓
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
