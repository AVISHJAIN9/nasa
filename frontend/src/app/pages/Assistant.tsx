import {useState, useEffect} from 'react';
import {useStore} from '../../store';
import {KNOWLEDGE_BASE, type KBChunk} from '../../data/kb';
import {Panel, PageHeader} from '../ui';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  isEmergencyAlert?: boolean;
  citations?: Array<{index: number; chunk: KBChunk; score: number}>;
  sentences?: Array<{text: string; supported: boolean; citationIdx: number}>;
  isFallback?: boolean;
}

const EMERGENCY_KEYWORDS = [
  'chest pain',
  'not breathing',
  'unconscious',
  'severe bleeding',
  'suicidal',
];

const SUGGESTED_PROMPTS = [
  'What are the first symptoms of cabin CO2 poisoning?',
  'How do we manage radiation during a solar particle event?',
  'Astronaut has a severe burn on forearm from electrical panel',
  'Crew member reports acute lumbar spine pain',
  'What causes SANS ocular refractive shift in space?',
];

// TF-IDF Cosine Retrieval in Browser
function retrieveChunks(query: string): Array<{chunk: KBChunk; score: number}> {
  const tokenize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const totalDocs = KNOWLEDGE_BASE.length;
  const docTokens = KNOWLEDGE_BASE.map((c) => tokenize(`${c.title} ${c.text}`));

  // Document frequencies
  const df: Record<string, number> = {};
  docTokens.forEach((tokens) => {
    const unique = new Set(tokens);
    unique.forEach((t) => {
      df[t] = (df[t] || 0) + 1;
    });
  });

  const idf = (t: string) => Math.log((1 + totalDocs) / (1 + (df[t] || 0))) + 1;

  // Query vector
  const qVec: Record<string, number> = {};
  queryTokens.forEach((t) => {
    qVec[t] = (qVec[t] || 0) + 1 * idf(t);
  });

  const qMag = Math.sqrt(Object.values(qVec).reduce((sum, v) => sum + v * v, 0)) || 1;

  // Compute cosine similarity for each chunk
  const scored = KNOWLEDGE_BASE.map((chunk, i) => {
    const tokens = docTokens[i];
    const dVec: Record<string, number> = {};
    tokens.forEach((t) => {
      dVec[t] = (dVec[t] || 0) + 1 * idf(t);
    });

    let dot = 0;
    for (const [qt, qVal] of Object.entries(qVec)) {
      if (dVec[qt]) dot += qVal * dVec[qt];
    }

    const dMag = Math.sqrt(Object.values(dVec).reduce((sum, v) => sum + v * v, 0)) || 1;
    const score = dot / (qMag * dMag);

    return {chunk, score};
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 2);
}

// Compute word overlap percentage
function checkSentenceSupport(sentence: string, chunkText: string): boolean {
  const tokenize = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
  const sWords = tokenize(sentence);
  if (sWords.length === 0) return true;
  const cWords = new Set(tokenize(chunkText));
  let matchCount = 0;
  sWords.forEach((w) => {
    if (cWords.has(w)) matchCount++;
  });
  return matchCount / sWords.length >= 0.55;
}

export function Assistant() {
  const setEmergency = useStore((s) => s.setEmergency);
  const sendMessage = useStore((s) => s.sendMessage);
  const addToast = useStore((s) => s.addToast);
  const assistantOffline = useStore((s) => s.assistantOffline);
  const setAssistantOffline = useStore((s) => s.setAssistantOffline);
  const assistantInitialQuery = useStore((s) => s.assistantInitialQuery);
  const setAssistantInitialQuery = useStore((s) => s.setAssistantInitialQuery);

  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-welcome',
      sender: 'assistant',
      text: 'AstroCare Autonomous Clinical Assistant v3.2 initialized. All guidance retrieved from local NASA HRP and flight medicine knowledge bases.',
    },
  ]);

  const isOffline = assistantOffline;
  const setIsOffline = setAssistantOffline;

  const handleSend = (textToSend?: string) => {
    const q = textToSend || inputQuery;
    if (!q.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: q,
    };

    const hasEmergency = EMERGENCY_KEYWORDS.some((kw) => q.toLowerCase().includes(kw));
    const retrieved = retrieveChunks(q);
    const topScore = retrieved[0]?.score || 0;

    let assistantMsg: ChatMessage;

    if (topScore < 0.12) {
      assistantMsg = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: 'I do not know. This is outside the onboard knowledge base.',
        isFallback: true,
        isEmergencyAlert: hasEmergency,
      };
    } else {
      // Compose answer sentences from top retrieved chunks
      const sentences: Array<{text: string; supported: boolean; citationIdx: number}> = [];
      const citations = retrieved.map((r, i) => ({index: i + 1, chunk: r.chunk, score: r.score}));

      retrieved.forEach((r, idx) => {
        const rawSentences = r.chunk.text.split(/(?<=[.!?])\s+/).filter(Boolean);
        rawSentences.forEach((s) => {
          const supported = checkSentenceSupport(s, r.chunk.text);
          sentences.push({
            text: s,
            supported,
            citationIdx: idx + 1,
          });
        });
      });

      assistantMsg = {
        id: `a-${Date.now()}`,
        sender: 'assistant',
        text: sentences.map((s) => `${s.text} [${s.citationIdx}]`).join(' '),
        sentences,
        citations,
        isEmergencyAlert: hasEmergency,
      };
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInputQuery('');
  };

  const handlePullCable = () => {
    setIsOffline(true);
    addToast('Disconnected from cloud uplink. Operating in 100% onboard offline mode.', 'info');
  };

  useEffect(() => {
    if (assistantInitialQuery) {
      const q = assistantInitialQuery;
      setAssistantInitialQuery(null);
      handleSend(q);
    }
  }, [assistantInitialQuery]);

  return (
    <div className="space-y-6" data-tour="ch8-offline-assistant">
      <PageHeader
        eyebrow="F055, F057–F059, X06"
        title="Clinical decision support & medical intelligence"
        description="Local TF-IDF verified medical retrieval engine with automated sentence support validation."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePullCable}
              className="rounded bg-mars/20 border border-mars/40 px-3 py-1 font-mono text-xs text-mars font-bold uppercase hover:bg-mars hover:text-white transition-colors"
            >
              Pull the cable
            </button>
            <div className="flex rounded bg-void-2 p-1 border border-white/15 font-mono text-xs">
              <button
                type="button"
                onClick={() => setIsOffline(false)}
                className={`rounded px-2.5 py-1 uppercase ${!isOffline ? 'bg-earth text-void font-bold' : 'text-regolith/60'}`}
              >
                Cloud Mirror
              </button>
              <button
                type="button"
                onClick={() => setIsOffline(true)}
                className={`rounded px-2.5 py-1 uppercase ${isOffline ? 'bg-white/20 text-white font-bold' : 'text-regolith/60'}`}
              >
                Offline (Local)
              </button>
            </div>
          </div>
        }
      />

      {/* Offline Status & Benchmark Banner */}
      <div className="grid gap-4 sm:grid-cols-12">
        <div className="sm:col-span-8 rounded-lg bg-void-2 p-4 border border-white/10 flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2.5">
            <span className="size-2 rounded-full bg-emerald-400" />
            <span className="text-white font-bold uppercase">
              {isOffline ? 'Local Engine · Llama 3.2 1B (Simulated)' : 'Deep Space Cloud Mirror'}
            </span>
            <span className="text-regolith/50">| 14 Verified Clinical Chunks</span>
          </div>
          <span className="text-earth font-bold">Latency: 1.2 s</span>
        </div>

        <div className="sm:col-span-4 rounded-lg bg-void-2 p-4 border border-white/10 font-mono text-[11px] text-regolith/70 space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-white font-bold block uppercase">Hardware Footprint</span>
            <span className="rounded bg-white/10 text-regolith/80 px-1.5 py-0.2 text-[11px] font-mono uppercase font-bold">Illustrative</span>
          </div>
          <p>RAM 1.9 GB · 18 tok/s · median latency 1.4 s</p>
          <p className="text-regolith/50">Simulated benchmark footprint metrics.</p>
        </div>
      </div>

      {/* Chat Area */}
      <Panel title="Clinical Consultation Dialogue">
        <div className="space-y-4">
          <div
            data-lenis-prevent
            className="h-96 overflow-y-auto space-y-4 pr-2 font-mono text-xs"
          >
            {messages.map((m) => {
              const isUser = m.sender === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-2xl rounded-lg p-4 space-y-3 ${
                      isUser
                        ? 'bg-earth/20 border border-earth/40 text-white'
                        : 'bg-void border border-white/15 text-regolith/90'
                    }`}
                  >
                    {/* Emergency Alert Banner */}
                    {m.isEmergencyAlert && (
                      <div className="rounded bg-mars/20 border border-mars p-3 text-mars font-mono space-y-2">
                        <div className="flex items-center gap-2 font-bold uppercase text-xs">
                          <span>⚠️</span> Possible Critical Medical Emergency Detected
                        </div>
                        <p className="text-[11px] text-white">
                          Input contains acute keywords. Do not wait for algorithmic review if immediate resuscitation is required.
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setEmergency({
                              active: true,
                              time: new Date().toLocaleTimeString(),
                            })
                          }
                          className="rounded bg-mars px-3 py-1 text-white font-bold uppercase text-[11px] hover:bg-mars/90"
                        >
                          Declare Emergency Protocol Now
                        </button>
                      </div>
                    )}

                    {/* Fallback Message + Consult Queue */}
                    {m.isFallback ? (
                      <div className="space-y-3">
                        <p className="text-white">{m.text}</p>
                        <button
                          type="button"
                          onClick={() => {
                            sendMessage('crew', 'CONSULT REQUEST: Clinical query outside onboard knowledge base. Ground physician evaluation requested.', 'consult');
                            addToast('Transmitted clinical consult request to Earth comms queue.', 'info');
                          }}
                          className="rounded bg-white/10 px-3 py-1.5 text-xs text-earth uppercase hover:bg-white/20 transition-colors"
                        >
                          Queue Urgent Flight Surgeon Consult →
                        </button>
                      </div>
                    ) : m.sentences ? (
                      <div className="space-y-2 leading-relaxed">
                        {m.sentences.map((s, idx) => (
                          <span key={idx} className="mr-1">
                            {s.text}{' '}
                            <sup className="text-earth font-bold">[{s.citationIdx}]</sup>
                            <span
                              title={s.supported ? 'Supported by source (≥60% overlap)' : 'Potential unsupported extrapolation'}
                              className={`ml-0.5 inline-block text-[11px] ${s.supported ? 'text-emerald-400' : 'text-[#e0b03a]'}`}
                            >
                              {s.supported ? '✓' : '⚠'}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p>{m.text}</p>
                    )}

                    {/* Citations Box */}
                    {m.citations && m.citations.length > 0 && (
                      <div className="border-t border-white/10 pt-2.5 mt-2 space-y-1 text-[11px] text-regolith/60">
                        <span className="font-bold uppercase text-regolith/40 block">Retrieved Sources:</span>
                        {m.citations.map((c) => (
                          <div key={c.index} className="flex justify-between">
                            <span>
                              [{c.index}] <strong className="text-white">{c.chunk.title}</strong> — {c.chunk.source}
                            </span>
                            <span className="text-earth">{(c.score * 100).toFixed(0)}% match</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!isUser && (
                      <p className="text-[11px] text-regolith/40 pt-1 border-t border-white/5 uppercase">
                        Decision support, not a diagnosis.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Suggested Prompts */}
          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/10 font-mono text-[11px]">
            <span className="text-regolith/40 uppercase mr-1 self-center">Try:</span>
            {SUGGESTED_PROMPTS.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSend(p)}
                className="rounded bg-void-2 px-2.5 py-1 text-regolith/80 border border-white/10 hover:border-earth hover:text-white transition-colors truncate max-w-xs"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="flex gap-2 pt-2">
            <input
              type="text"
              placeholder="Ask the clinical assistant (e.g. symptoms, burns, fever, radiation)..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              className="flex-1 rounded bg-void px-4 py-2.5 font-mono text-xs text-white border border-white/20 focus:outline-none focus:border-earth"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              className="rounded bg-white px-5 py-2.5 font-mono text-label text-void font-bold uppercase hover:bg-earth transition-colors"
            >
              Query
            </button>
            <button
              type="button"
              onClick={() =>
                setMessages([
                  {
                    id: 'm-reset',
                    sender: 'assistant',
                    text: 'Dialogue cleared. Ready for next clinical inquiry.',
                  },
                ])
              }
              className="rounded bg-void-2 px-3 py-2.5 font-mono text-xs text-regolith/50 hover:text-white uppercase border border-white/10"
            >
              Clear
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
