import {useState, useEffect, useRef} from 'react';
import {Panel, PageHeader} from '../ui';

interface TeleMessage {
  id: string;
  sender: 'astronaut' | 'surgeon';
  senderLabel: string;
  text: string;
  sentAt: number;
  deliveryAt: number;
  delivered: boolean;
}

export function TeleSession() {
  const [delaySec, setDelaySec] = useState<number>(5);
  const [messages, setMessages] = useState<TeleMessage[]>([
    {
      id: 'msg-init-1',
      sender: 'surgeon',
      senderLabel: 'Dr. Priya Nair (Houston)',
      text: 'Good morning AstroCare-1 crew. Reviewing Sol 142 morning biometrics. All systems nominal.',
      sentAt: Date.now() - 60000,
      deliveryAt: Date.now() - 55000,
      delivered: true,
    },
    {
      id: 'msg-init-2',
      sender: 'astronaut',
      senderLabel: 'Commander Elena Vega (Craft)',
      text: 'Copy Ground. Completing cycle on the cycle ergometer. No pain or subjective discomfort.',
      sentAt: Date.now() - 40000,
      deliveryAt: Date.now() - 35000,
      delivered: true,
    },
  ]);

  // Draft inputs for both panes
  const [astroInput, setAstroInput] = useState('');
  const [surgeonInput, setSurgeonInput] = useState('');

  // Typing indicators
  const [isAstroTyping, setIsAstroTyping] = useState(false);
  const [isSurgeonTyping, setIsSurgeonTyping] = useState(false);

  // Auto-typing timeouts
  const astroTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const surgeonTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleAstroChange = (val: string) => {
    setAstroInput(val);
    setIsAstroTyping(true);
    if (astroTypingTimer.current) clearTimeout(astroTypingTimer.current);
    astroTypingTimer.current = setTimeout(() => setIsAstroTyping(false), 2000);
  };

  const handleSurgeonChange = (val: string) => {
    setSurgeonInput(val);
    setIsSurgeonTyping(true);
    if (surgeonTypingTimer.current) clearTimeout(surgeonTypingTimer.current);
    surgeonTypingTimer.current = setTimeout(() => setIsSurgeonTyping(false), 2000);
  };

  // Dispatch message with injected delay
  const sendMessage = (sender: 'astronaut' | 'surgeon', text: string) => {
    if (!text.trim()) return;
    const now = Date.now();
    const deliveryAt = now + delaySec * 1000;

    const newMsg: TeleMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sender,
      senderLabel: sender === 'astronaut' ? 'Commander Elena Vega (Craft)' : 'Dr. Priya Nair (Houston)',
      text: text.trim(),
      sentAt: now,
      deliveryAt,
      delivered: delaySec === 0,
    };

    setMessages((prev) => [...prev, newMsg]);

    if (sender === 'astronaut') {
      setAstroInput('');
      setIsAstroTyping(false);
    } else {
      setSurgeonInput('');
      setIsSurgeonTyping(false);
    }
  };

  // Check delivery arrivals on 100ms interval
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setMessages((prev) => {
        let changed = false;
        const updated = prev.map((m) => {
          if (!m.delivered && now >= m.deliveryAt) {
            changed = true;
            return {...m, delivered: true};
          }
          return m;
        });
        return changed ? updated : prev;
      });
    }, 200);

    return () => clearInterval(timer);
  }, []);

  const inFlightCount = messages.filter((m) => !m.delivered).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="F068 Delayed Tele-Consultation"
        title="Split-role asynchronous tele-session"
        description="Bilateral communication console demonstrating conversational flow, typing telemetry, and radio latency buffering between deep-space crew and flight surgeons."
      />

      {/* Latency Control Bar */}
      <div className="rounded-xl bg-void-2 p-4 border border-white/10 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-4 flex-1 max-w-md">
          <div className="space-y-1 flex-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-regolith/60 uppercase">Injected Carrier Latency:</span>
              <span className="text-earth font-bold">{delaySec} Seconds One-Way</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={delaySec}
              onChange={(e) => setDelaySec(Number(e.target.value))}
              className="w-full accent-earth cursor-pointer"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {inFlightCount > 0 ? (
            <span className="rounded bg-earth/20 text-earth border border-earth/40 px-3 py-1 font-bold flex items-center gap-2 animate-pulse">
              <span>📡</span>
              <span>{inFlightCount} Message(s) In Flight</span>
            </span>
          ) : (
            <span className="rounded bg-white/5 text-regolith/60 border border-white/10 px-3 py-1">
              Carrier Clear · No Packets in Transit
            </span>
          )}
        </div>
      </div>

      {/* Two-Pane Split Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* PANE 1: ASTRONAUT VIEW (Vega / Deep Space) */}
        <Panel
          title="Astronaut view (Craft terminal · Sol 142)"
          subtitle="Local Terminal: Commander Elena Vega"
        >
          <div className="flex flex-col h-[460px] font-mono text-xs justify-between">
            {/* Chat History for Astronaut */}
            <div
              className="flex-1 overflow-y-auto space-y-3 p-3 bg-void rounded-lg border border-white/10"
              data-lenis-prevent
            >
              {messages.map((m) => {
                // Sent by astronaut = always visible to astronaut immediately
                // Sent by surgeon = visible only after delivered
                const isMine = m.sender === 'astronaut';
                if (!isMine && !m.delivered) return null;

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-regolith/50 mb-1">
                      <span>{m.senderLabel}</span>
                      {isMine && !m.delivered && (
                        <span className="text-earth animate-pulse font-bold">
                          [Uplink In Flight... {Math.max(1, Math.round((m.deliveryAt - Date.now()) / 1000))}s]
                        </span>
                      )}
                      {isMine && m.delivered && <span className="text-emerald-400">✓ Delivered</span>}
                    </div>

                    <div
                      className={`rounded-xl px-4 py-2.5 max-w-[85%] text-xs leading-relaxed ${
                        isMine
                          ? 'bg-earth text-void font-medium shadow'
                          : 'bg-void-2 text-white border border-white/15'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}

              {/* Typing Indicator: Show when Surgeon is typing */}
              {isSurgeonTyping && (
                <div className="flex items-center gap-2 text-earth text-[11px] animate-pulse">
                  <span>✍️</span>
                  <span>Dr. Priya Nair (Houston) is drafting a transmission...</span>
                </div>
              )}
            </div>

            {/* Astronaut Input Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage('astronaut', astroInput);
              }}
              className="mt-3 flex gap-2"
            >
              <input
                type="text"
                value={astroInput}
                onChange={(e) => handleAstroChange(e.target.value)}
                placeholder="Astronaut message to Dr. Priya Nair..."
                className="flex-1 rounded bg-void border border-white/15 px-3 py-2 text-white focus:border-earth focus:outline-none min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth"
              />
              <button
                type="submit"
                className="rounded-lg bg-earth px-4 py-2 text-void font-bold uppercase hover:bg-earth/90 min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none"
              >
                Send Uplink
              </button>
            </form>
          </div>
        </Panel>

        {/* PANE 2: FLIGHT SURGEON VIEW (Houston / Ground) */}
        <Panel
          title="Flight surgeon view (Ground medical console)"
          subtitle="Ground Station: Dr. Priya Nair (Houston)"
        >
          <div className="flex flex-col h-[460px] font-mono text-xs justify-between">
            {/* Chat History for Surgeon */}
            <div
              className="flex-1 overflow-y-auto space-y-3 p-3 bg-void rounded-lg border border-white/10"
              data-lenis-prevent
            >
              {messages.map((m) => {
                // Sent by surgeon = always visible immediately to surgeon
                // Sent by astronaut = visible only after delivered
                const isMine = m.sender === 'surgeon';
                if (!isMine && !m.delivered) return null;

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[11px] text-regolith/50 mb-1">
                      <span>{m.senderLabel}</span>
                      {isMine && !m.delivered && (
                        <span className="text-earth animate-pulse font-bold">
                          [Downlink In Flight... {Math.max(1, Math.round((m.deliveryAt - Date.now()) / 1000))}s]
                        </span>
                      )}
                      {isMine && m.delivered && <span className="text-emerald-400">✓ Delivered</span>}
                    </div>

                    <div
                      className={`rounded-xl px-4 py-2.5 max-w-[85%] text-xs leading-relaxed ${
                        isMine
                          ? 'bg-earth text-void font-medium shadow'
                          : 'bg-void-2 text-white border border-white/15'
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                );
              })}

              {/* Typing Indicator: Show when Astronaut is typing */}
              {isAstroTyping && (
                <div className="flex items-center gap-2 text-earth text-[11px] animate-pulse">
                  <span>✍️</span>
                  <span>Commander Elena Vega is drafting a transmission from craft...</span>
                </div>
              )}
            </div>

            {/* Surgeon Input Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage('surgeon', surgeonInput);
              }}
              className="mt-3 flex gap-2"
            >
              <input
                type="text"
                value={surgeonInput}
                onChange={(e) => handleSurgeonChange(e.target.value)}
                placeholder="Flight Surgeon directive to Commander Elena Vega..."
                className="flex-1 rounded bg-void border border-white/15 px-3 py-2 text-white focus:border-earth focus:outline-none min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth"
              />
              <button
                type="submit"
                className="rounded-lg bg-earth px-4 py-2 text-void font-bold uppercase hover:bg-earth/90 min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none"
              >
                Send Downlink
              </button>
            </form>
          </div>
        </Panel>
      </div>
    </div>
  );
}
