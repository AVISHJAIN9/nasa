import {useState} from 'react';
import {useStore} from '../../store';
import {Panel, PageHeader} from '../ui';

export function Broadcast() {
  const role = useStore((s) => s.role);
  const crew = useStore((s) => s.crew);
  const broadcasts = useStore((s) => s.broadcasts);
  const sendBroadcast = useStore((s) => s.sendBroadcast);
  const markBroadcastRead = useStore((s) => s.markBroadcastRead);
  const mode = useStore((s) => s.mode);

  const [messageText, setMessageText] = useState('');
  const [sentNotice, setSentNotice] = useState(false);

  const canBroadcast = role === 'surgeon' || role === 'control';

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    const author = role === 'control' ? 'Flight Director Reyes' : 'Dr. Priya Nair (Houston)';
    sendBroadcast('Fleet Announcement', messageText.trim(), 'routine', author);
    setMessageText('');
    setSentNotice(true);
    setTimeout(() => setSentNotice(false), 3000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="F115 Fleetwide Communications"
        title="Fleetwide announcements & crew read receipts"
        description="Mission control & flight surgeon announcements broadcast across link carrier with one-way propagation delay and individual crew read-receipt acknowledgments."
        actions={
          <div>
            {canBroadcast ? (
              <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 font-mono text-xs font-bold uppercase">
                📢 Broadcast Authorized ({role === 'control' ? 'Flight Director' : 'Surgeon'})
              </span>
            ) : (
              <span className="rounded bg-white/10 text-regolith/70 border border-white/15 px-3 py-1 font-mono text-xs font-bold uppercase">
                👁️ Crew Receiver View
              </span>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Compose Broadcast */}
        <div className="lg:col-span-1 space-y-6">
          <Panel title="Compose fleet broadcast">
            {canBroadcast ? (
              <form onSubmit={handleSend} className="space-y-4 font-mono text-xs">
                <div>
                  <label className="block text-regolith/60 uppercase text-[11px] mb-1">
                    Audience Target
                  </label>
                  <div className="rounded bg-void border border-white/10 p-2.5 text-earth font-bold flex items-center gap-2">
                    <span>🛰️</span>
                    <span>All Craft Crew (Vega, Okoye, Marin, Tanaka)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-regolith/60 uppercase text-[11px] mb-1">
                    Announcement Message
                  </label>
                  <textarea
                    rows={5}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="e.g. Flight Surgeon Notice: Sol 143 water ration protocol updated. All crew report to Galley for electrolyte supplementation..."
                    className="w-full rounded bg-void border border-white/15 p-3 text-white font-mono focus:border-earth focus:outline-none focus-visible:ring-2 focus-visible:ring-earth"
                    required
                  />
                </div>

                <div className="rounded bg-void p-3 border border-white/10 text-[11px] text-regolith/70 space-y-1">
                  <span className="text-white font-bold block uppercase">Transmission Carrier</span>
                  <p>Current link mode: <strong className="text-earth">{mode}</strong></p>
                  <p>Messages transit through comms queue before arriving on crew terminals.</p>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-earth px-5 py-2.5 font-bold uppercase text-void hover:bg-earth/90 transition-colors shadow min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none"
                >
                  Transmit All-Crew Uplink →
                </button>

                {sentNotice && (
                  <p className="text-emerald-400 text-center font-bold">
                    ✓ Announcement broadcast to queue!
                  </p>
                )}
              </form>
            ) : (
              <div className="p-4 rounded-lg bg-void border border-white/15 text-xs font-mono text-regolith/70 space-y-2">
                <p>Fleet broadcasts can only be initiated by Mission Control or Ground Flight Surgeon.</p>
                <p className="text-[11px]">Switch role in the left rail to compose all-crew broadcasts.</p>
              </div>
            )}
          </Panel>
        </div>

        {/* Right: Broadcast Feed & Read Receipts */}
        <div className="lg:col-span-2 space-y-6">
          <Panel title={`Fleet announcements (${broadcasts.length})`}>
            <div className="space-y-4 font-mono text-xs">
              {broadcasts.length === 0 ? (
                <div className="p-6 text-center text-regolith/50">
                  No fleet announcements in queue. Transmit an announcement to observe propagation.
                </div>
              ) : (
                broadcasts.map((b) => {
                  const isDelivered = b.status === 'delivered';

                  return (
                    <div
                      key={b.id}
                      className="rounded-lg bg-void p-5 border border-white/10 hover:border-white/20 space-y-4 transition-colors"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white uppercase text-xs">
                            {b.sentBy}
                          </span>
                          <span className="text-[11px] text-regolith/50">
                            {b.timeStr}
                          </span>
                        </div>
                        <div>
                          {isDelivered ? (
                            <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold uppercase">
                              ✓ Delivered to Craft
                            </span>
                          ) : (
                            <span className="rounded bg-earth/20 text-earth border border-earth/40 px-2 py-0.5 text-[11px] font-bold uppercase animate-pulse">
                              Carrier In Flight 📡
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-white text-xs leading-relaxed bg-void-2 p-3 rounded border border-white/5">
                        {b.message}
                      </p>

                      {/* Read Receipts Table */}
                      <div className="space-y-2 border-t border-white/10 pt-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-white uppercase">
                            Crew Read Receipts ({b.readReceipts.length} / {crew.length})
                          </span>
                          <span className="text-[11px] text-regolith/60">
                            {b.readReceipts.length === crew.length ? 'All crew confirmed' : 'Receipts pending'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {crew.map((c) => {
                            const receipt = b.readReceipts.find((r) => r.crewId === c.id || r.name === c.name);
                            const hasRead = Boolean(receipt);

                            return (
                              <div
                                key={c.id}
                                className={`rounded p-2 border text-[11px] flex flex-col justify-between ${
                                  hasRead
                                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                                    : 'bg-void-2 border-white/10 text-regolith/50'
                                }`}
                              >
                                <span className="font-bold">{c.name}</span>
                                {hasRead ? (
                                  <span className="text-[11px] text-emerald-400">
                                    Read · {receipt?.readTimeStr}
                                  </span>
                                ) : (
                                  <div className="flex items-center justify-between pt-1">
                                    <span>Unread</span>
                                    {isDelivered && (
                                      <button
                                        type="button"
                                        onClick={() => markBroadcastRead(b.id, c.id, c.name)}
                                        className="rounded bg-earth/30 text-earth px-2 py-1 text-[11px] font-bold uppercase hover:bg-earth hover:text-void min-h-[30px] focus-visible:ring-2 focus-visible:ring-earth"
                                      >
                                        Mark Read
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
