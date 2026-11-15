import {useStore, MODES, getIndependenceLevel, LEVELS} from '../../store';
import {Panel, Gauge, AlertCard, PageHeader} from '../ui';
import {ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend} from 'recharts';

export function Control() {
  const mode = useStore((s) => s.mode);
  const cabin = useStore((s) => s.cabin);
  const alerts = useStore((s) => s.alerts);
  const crew = useStore((s) => s.crew);
  const messages = useStore((s) => s.messages);
  const commsBlackout = useStore((s) => s.commsBlackout);
  const ackAlert = useStore((s) => s.ackAlert);
  const resolveAlert = useStore((s) => s.resolveAlert);
  const broadcasts = useStore((s) => s.broadcasts);

  // Tab State in store
  const activeTab = useStore((s) => s.controlHomeTab);
  const setActiveTab = useStore((s) => s.setControlHomeTab);

  const indLevel = getIndependenceLevel(mode);
  const levelInfo = LEVELS[indLevel];
  const modeInfo = MODES[mode];

  // Comms Queue calculations
  const inFlightMessages = messages.filter((m) => m.status === 'in-flight');
  const now = Date.now();

  // Dual-axis data: Cabin CO2 and Mean Crew HRV over recent 40 ticks
  const chartPointsCount = 40;
  const overlayData = Array.from({length: chartPointsCount}, (_, i) => {
    const idxOffset = chartPointsCount - 1 - i;
    let totalHrv = 0;
    crew.forEach((c) => {
      const reading = c.readings.hrv[c.readings.hrv.length - 1 - idxOffset];
      totalHrv += reading ? reading.value : c.baseline.hrv;
    });
    const meanHrv = Math.round(totalHrv / crew.length);
    const co2 = Math.round(Math.max(800, cabin.co2 - idxOffset * (cabin.co2 > 1200 ? 15 : 2)));

    return {
      t: `-${idxOffset}s`,
      co2,
      meanHrv,
    };
  });

  const tabs: Array<{id: 'overview' | 'cabin' | 'comms'; label: string; badge?: number}> = [
    {id: 'overview', label: 'Overview & ECLSS'},
    {id: 'cabin', label: 'Cabin vs Body Dynamics'},
    {id: 'comms', label: 'Comms & Uplinks', badge: inFlightMessages.length || undefined},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="FLIGHT DYNAMICS & CABIN SYSTEMS"
        title="Flight Director Reyes"
        description="Deep space carrier link tracking, environmental control telemetry, and fleet-wide packet scheduling."
      />

      {/* Role Navigation Tabs */}
      <div className="flex border-b border-white/10 gap-2 font-mono text-xs overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-bold uppercase rounded-t border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                isActive
                  ? 'border-earth text-earth bg-white/5'
                  : 'border-transparent text-regolith/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="rounded-full bg-mars px-1.5 py-0.2 text-[11px] text-white font-bold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & ECLSS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Telemetry & Link Status Header */}
          <section aria-label="Flight dynamics and link telemetry">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 font-mono">
              <div className="rounded-xl bg-void-2 p-4 border border-white/10">
                <span className="text-[11px] text-regolith/50 uppercase block">Round-Trip Signal Latency</span>
                <span className="font-display text-xl text-earth font-bold mt-1 block">
                  {modeInfo.delaySec * 2 >= 60 ? `${Math.round((modeInfo.delaySec * 2) / 60)} min 00 s` : `${modeInfo.delaySec * 2} s`}
                </span>
                <span className="text-[11px] text-regolith/60 mt-1 block">
                  One-way uplink: {modeInfo.delaySec >= 60 ? `${Math.round(modeInfo.delaySec / 60)} min` : `${modeInfo.delaySec} s`}
                </span>
              </div>

              <div className="rounded-xl bg-void-2 p-4 border border-white/10">
                <span className="text-[11px] text-regolith/50 uppercase block">Autonomous Operating Tier</span>
                <span className="font-display text-xl text-mars font-bold mt-1 block">
                  Level {indLevel}
                </span>
                <span className="text-[11px] text-regolith/60 mt-1 block">
                  {levelInfo.label} — {levelInfo.note}
                </span>
              </div>

              <div className="rounded-xl bg-void-2 p-4 border border-white/10">
                <span className="text-[11px] text-regolith/50 uppercase block">Deep Space Network Carrier</span>
                <span className="font-display text-xl text-white font-bold mt-1 block">
                  DSN Goldstone 70m
                </span>
                <span className={`text-[11px] mt-1 block font-bold uppercase ${commsBlackout ? 'text-mars' : 'text-earth'}`}>
                  {commsBlackout ? '● Solar Conjunction Blackout' : '● Transceiver Locked (Ka-Band)'}
                </span>
              </div>

              <div className="rounded-xl bg-void-2 p-4 border border-white/10">
                <span className="text-[11px] text-regolith/50 uppercase block">Radiation Environment</span>
                <span className="font-display text-xl text-white font-bold mt-1 block">
                  {cabin.radiation.dailyDose.toFixed(1)} mSv/d
                </span>
                <span className="text-[11px] text-regolith/60 mt-1 block">
                  Cumulative: {cabin.radiation.cumulative.toFixed(1)} / 1000 mSv
                </span>
              </div>
            </div>
          </section>

          {/* Atmospheric Scrubbing & Environmental Life Support */}
          <Panel title="Environmental control & life support system (ECLSS)">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              <Gauge
                label="Carbon Dioxide"
                value={cabin.co2}
                max={5000}
                unit="ppm"
                warning={2000}
                critical={3500}
                subtext="Primary Bed"
              />
              <Gauge
                label="Atmospheric O2"
                value={cabin.o2}
                max={25}
                unit="%"
                warning={19.5}
                critical={18.0}
                subtext="Cabin Mix"
              />
              <Gauge
                label="Cabin Pressure"
                value={cabin.pressure}
                max={120}
                unit="kPa"
                subtext="Nominal 101.3"
              />
              <Gauge
                label="Internal Temp"
                value={cabin.temp}
                max={35}
                unit="°C"
                subtext="Loop B"
              />
              <Gauge
                label="Relative Humidity"
                value={cabin.humidity}
                max={100}
                unit="%"
                subtext="Condenser"
              />
              <Gauge
                label="Career Radiation"
                value={cabin.radiation.cumulative}
                max={1000}
                unit="mSv"
                limit={cabin.radiation.limit}
                warning={500}
                critical={800}
                subtext="Limit 1000 mSv"
              />
            </div>
          </Panel>

          {/* Fleet Telemetry Summary */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
            {crew.map((member) => {
              const hr = member.readings.hr.slice(-1)[0]?.value ?? member.baseline.hr;
              const spo2 = member.readings.spo2.slice(-1)[0]?.value ?? member.baseline.spo2;
              const temp = member.readings.temp.slice(-1)[0]?.value ?? member.baseline.temp;
              return (
                <div key={member.id} className="rounded-xl bg-void-2 p-3.5 border border-white/10 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">{member.name}</span>
                    <span className="text-[11px] text-regolith/50 uppercase">{member.roleTitle}</span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1 border-t border-white/5">
                    <span className="text-regolith/60">HR / SpO2:</span>
                    <span className="text-white font-medium">{Math.round(hr)} bpm / {Math.round(spo2)}%</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-regolith/60">Core Temp:</span>
                    <span className="text-white font-medium">{temp.toFixed(1)}°C</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CABIN VS BODY */}
      {activeTab === 'cabin' && (
        <div className="space-y-6">
          <Panel
            title="Cabin atmospheric vs crew autonomic response (early warning overlay)"
            subtitle="Tracking environmental CO2 against mean crew HRV to capture pre-symptomatic physiological decay"
          >
            <div className="h-[220px] sm:h-72 font-mono text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={overlayData} margin={{top: 10, right: 30, left: 10, bottom: 0}}>
                  <XAxis dataKey="t" stroke="#8b909b" fontSize={10} />
                  <YAxis
                    yAxisId="co2Axis"
                    domain={[600, 4800]}
                    stroke="#e2704a"
                    fontSize={10}
                    unit=" ppm"
                  />
                  <YAxis
                    yAxisId="hrvAxis"
                    orientation="right"
                    domain={[15, 80]}
                    stroke="#6fb6ff"
                    fontSize={10}
                    unit=" ms"
                  />
                  <Tooltip
                    content={({active, payload}) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded bg-void-2 border border-white/20 p-2 font-mono text-xs shadow-xl space-y-1">
                            <p className="text-white font-bold">Timeline: {payload[0].payload.t}</p>
                            <p className="text-mars">Cabin CO2: {payload[0].value} ppm</p>
                            <p className="text-earth">Mean HRV: {payload[1].value} ms</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="co2Axis"
                    type="monotone"
                    dataKey="co2"
                    stroke="#e2704a"
                    strokeWidth={2}
                    name="Cabin CO2 (ppm)"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    yAxisId="hrvAxis"
                    type="monotone"
                    dataKey="meanHrv"
                    stroke="#6fb6ff"
                    strokeWidth={2}
                    name="Mean Crew HRV (ms)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid md:grid-cols-2 gap-6 font-mono text-xs">
            <div className="rounded-xl bg-void-2 p-5 border border-white/10 space-y-2">
              <span className="font-bold text-white uppercase block">Physiological Cross-Coupling Rule</span>
              <p className="text-regolith/80 leading-relaxed">
                Elevated ambient carbon dioxide (&gt;1500 ppm) induces compensatory autonomic activation, causing instantaneous vagal suppression (HRV drop) prior to overt hypercapnic symptoms such as cephalad throbbing or dyspnea.
              </p>
            </div>
            <div className="rounded-xl bg-void-2 p-5 border border-white/10 space-y-2">
              <span className="font-bold text-white uppercase block">Automated Scrubbing Escalation</span>
              <p className="text-regolith/80 leading-relaxed">
                When CO2 rises above 2000 ppm with concurrent crew HRV depression, autonomous life support switches to dual-canister desorptive cycling without awaiting ground command confirmation.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COMMS & UPLINKS */}
      {activeTab === 'comms' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Comms Queue Panel */}
            <div className="lg:col-span-6 space-y-6">
              <Panel
                title="Deep space comms store-and-forward queue"
                subtitle={`Queue Depth: ${inFlightMessages.length} packet(s)`}
              >
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 text-[11px]">
                    <span className="text-regolith/50 uppercase">Link State</span>
                    <span className={commsBlackout ? 'text-mars font-bold' : 'text-emerald-400 font-bold'}>
                      {commsBlackout ? 'HOLD (BLACKOUT ACTIVE)' : 'TRANSMITTING'}
                    </span>
                  </div>

                  {inFlightMessages.length === 0 ? (
                    <div className="py-12 text-center text-regolith/40">
                      No in-flight communication packets in transit.
                    </div>
                  ) : (
                    inFlightMessages.map((msg) => {
                      const remMs = Math.max(0, msg.deliverAt - now);
                      const remSec = Math.ceil(remMs / 1000);
                      const remMin = Math.floor(remSec / 60);

                      return (
                        <div
                          key={msg.id}
                          className="rounded-lg bg-void p-3 border border-white/10 space-y-2"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-earth font-bold uppercase">
                              {msg.from === 'crew' ? 'Crew Transit → Earth' : 'Earth Ground → Crew'}
                            </span>
                            <div className="flex items-center gap-1.5 text-white">
                              <span className="size-2 rounded-full border border-earth border-t-transparent animate-spin" />
                              <span>Delivery in {remMin > 0 ? `${remMin}m ${remSec % 60}s` : `${remSec}s`}</span>
                            </div>
                          </div>
                          <p className="text-white text-xs font-sans">{msg.text}</p>
                          <span className="text-[11px] text-regolith/40 uppercase block">
                            Kind: {msg.kind}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </Panel>
            </div>

            {/* Broadcasts & Uplink Alerts Queue */}
            <div className="lg:col-span-6 space-y-6">
              <Panel title="Active telemetry alerts & uplink queue">
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {alerts.length === 0 ? (
                    <div className="py-12 text-center font-mono text-label text-regolith/40">
                      Uplink queue clear. No pending telemetry directives.
                    </div>
                  ) : (
                    alerts.map((a) => (
                      <AlertCard
                        key={a.id}
                        alert={a}
                        onAck={ackAlert}
                        onResolve={resolveAlert}
                      />
                    ))
                  )}
                </div>
              </Panel>

              {/* Fleet Broadcast Status */}
              <Panel title="Fleetwide broadcast directives">
                <div className="space-y-2 font-mono text-xs">
                  {broadcasts.length === 0 ? (
                    <div className="py-6 text-center text-regolith/40">No broadcasts recorded.</div>
                  ) : (
                    broadcasts.map((b) => (
                      <div key={b.id} className="rounded bg-void p-3 border border-white/10 space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="font-bold text-white uppercase">{b.title}</span>
                          <span className="text-earth font-bold uppercase">[{b.priority}]</span>
                        </div>
                        <p className="text-regolith/80 text-xs">{b.message}</p>
                        <div className="flex justify-between text-[11px] text-regolith/50 pt-1 border-t border-white/5">
                          <span>By: {b.sentBy}</span>
                          <span>Receipts: {b.readReceipts.length} / 4 crew</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}