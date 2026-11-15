import {useState} from 'react';
import {useStore} from '../../store';
import {VitalTile, TrendChart, Gauge, AlertCard, Panel, ConfirmButton, PageHeader, TodayStrip} from '../ui';
import {CameraPulse} from '../ui/CameraPulse';

const SPACE_SYMPTOMS = [
  'Space motion sickness',
  'Headache / Congestion',
  'Facial fullness',
  'Lumbar spine ache',
  'Sleep fragmentation',
  'Eye irritation / SANS',
  'Muscular soreness',
  'Skin xerosis',
  'Chest tightness', // red flag
  'Vision blur', // red flag
  'Syncope / Faint', // red flag
  'Severe disorientation', // red flag
];

export function Astronaut() {
  const crew = useStore((s) => s.crew);
  const cabin = useStore((s) => s.cabin);
  const alerts = useStore((s) => s.alerts);
  const emergency = useStore((s) => s.emergency);
  const setEmergency = useStore((s) => s.setEmergency);
  const addCheckIn = useStore((s) => s.addCheckIn);
  const ackAlert = useStore((s) => s.ackAlert);
  const resolveAlert = useStore((s) => s.resolveAlert);
  const sendMessage = useStore((s) => s.sendMessage);
  const setPage = useStore((s) => s.setPage);
  const startProtocol = useStore((s) => s.startProtocol);
  const cameraPulseActive = useStore((s) => s.cameraPulseActive);
  const missedCheckInHours = useStore((s) => s.missedCheckInHours);
  const lastCheckInTimes = useStore((s) => s.lastCheckInTimes);

  // Tab State in store
  const activeTab = useStore((s) => s.astronautHomeTab);
  const setActiveTab = useStore((s) => s.setAstronautHomeTab);

  // Orders and Broadcasts
  const medicalOfficerCrewId = useStore((s) => s.medicalOfficerCrewId);
  const orders = useStore((s) => s.orders);
  const acknowledgeOrder = useStore((s) => s.acknowledgeOrder);
  const rejectOrder = useStore((s) => s.rejectOrder);
  const broadcasts = useStore((s) => s.broadcasts);
  const markBroadcastRead = useStore((s) => s.markBroadcastRead);

  // Default astronaut is Vega ('vega')
  const vega = crew.find((c) => c.id === 'vega') || crew[0];
  const isCmo = medicalOfficerCrewId === 'vega';

  // Delivered unread broadcasts for Vega
  const unreadBroadcasts = broadcasts.filter(
    (b) => b.status === 'delivered' && !b.readReceipts.some((r) => r.crewId === vega.id || r.name === vega.name)
  );

  // Orders for Vega
  const vegaOrders = orders.filter((o) => o.targetCrewId === 'vega');
  const pendingDirectives = orders.filter((o) => o.targetCrewId === 'vega' && o.status === 'delivered');

  // Overdue check-in calculation
  const lastCheckIn = lastCheckInTimes['vega'] || Date.now() - 86400000 * 2;
  const elapsedHours = (Date.now() - lastCheckIn) / 3600000;
  const isCheckInMissed = elapsedHours > missedCheckInHours;

  // Selected vital for trend chart
  const [selectedMetric, setSelectedMetric] = useState<'hr' | 'spo2' | 'bp' | 'temp' | 'resp' | 'hrv'>('hr');
  const [trendRange, setTrendRange] = useState<'1m' | '5m'>('1m');

  // Check-in form state
  const [mood, setMood] = useState(7);
  const [energy, setEnergy] = useState(8);
  const [pain, setPain] = useState(1);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [checkInToast, setCheckInToast] = useState(false);

  // Consult box state
  const [consultText, setConsultText] = useState('');

  // Latest readings
  const hrArr = vega.readings.hr;
  const spo2Arr = vega.readings.spo2;
  const tempArr = vega.readings.temp;
  const respArr = vega.readings.resp;
  const hrvArr = vega.readings.hrv;
  const bpSysArr = vega.readings.bpSys;
  const bpDiaArr = vega.readings.bpDia;

  const latestHr = hrArr[hrArr.length - 1]?.value ?? vega.baseline.hr;
  const latestSpo2 = spo2Arr[spo2Arr.length - 1]?.value ?? vega.baseline.spo2;
  const latestTemp = tempArr[tempArr.length - 1]?.value ?? vega.baseline.temp;
  const latestResp = respArr[respArr.length - 1]?.value ?? vega.baseline.resp;
  const latestHrv = hrvArr[hrvArr.length - 1]?.value ?? vega.baseline.hrv;
  const latestBpSys = bpSysArr[bpSysArr.length - 1]?.value ?? vega.baseline.bpSys;
  const latestBpDia = bpDiaArr[bpDiaArr.length - 1]?.value ?? vega.baseline.bpDia;

  const bpSysDelta = latestBpSys - vega.baseline.bpSys;
  const bpDiaDelta = latestBpDia - vega.baseline.bpDia;
  const bpDeltaStr = `${bpSysDelta >= 0 ? `+${Math.round(bpSysDelta)}` : Math.round(bpSysDelta)}/${bpDiaDelta >= 0 ? `+${Math.round(bpDiaDelta)}` : Math.round(bpDiaDelta)}`;

  const hrStatus = latestHr > 110 ? 'critical' : latestHr > 90 ? 'watch' : 'normal';
  const spo2Status = latestSpo2 < 94 ? 'critical' : latestSpo2 < 96 ? 'watch' : 'normal';
  const tempStatus = latestTemp > 38 ? 'critical' : latestTemp > 37.5 ? 'watch' : 'normal';
  const hrvStatus = latestHrv < 30 ? 'critical' : latestHrv < 45 ? 'watch' : 'normal';
  const bpStatus: 'normal' | 'watch' | 'critical' =
    latestBpSys >= 140 || latestBpDia >= 90 || latestBpSys < 90 || latestBpDia < 60 || Math.abs(bpSysDelta) >= 22
      ? 'critical'
      : latestBpSys >= 130 || latestBpDia >= 85 || Math.abs(bpSysDelta) >= 12
      ? 'watch'
      : 'normal';

  // Personal alerts for Vega or cabin
  const personalAlerts = alerts.filter((a) => !a.crewId || a.crewId === vega.id);

  const trendData =
    selectedMetric === 'hr'
      ? hrArr
      : selectedMetric === 'spo2'
      ? spo2Arr
      : selectedMetric === 'bp'
      ? bpSysArr
      : selectedMetric === 'temp'
      ? tempArr
      : selectedMetric === 'resp'
      ? respArr
      : hrvArr;

  const metricInfo = {
    hr: {title: 'Heart Rate', unit: 'bpm', baseline: vega.baseline.hr, color: '#6fb6ff'},
    spo2: {title: 'Blood Oxygen', unit: '%', baseline: vega.baseline.spo2, color: '#6fb6ff'},
    bp: {title: 'Blood Pressure (Systolic)', unit: 'mmHg', baseline: vega.baseline.bpSys, color: '#e2704a'},
    temp: {title: 'Core Temperature', unit: '°C', baseline: vega.baseline.temp, color: '#f2e6c9'},
    resp: {title: 'Respiration Rate', unit: 'br/min', baseline: vega.baseline.resp, color: '#6fb6ff'},
    hrv: {title: 'Heart Rate Variability', unit: 'ms', baseline: vega.baseline.hrv, color: '#d8c3b4'},
  }[selectedMetric];

  const handleSymptomToggle = (sym: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleCheckInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addCheckIn({
      crewId: vega.id,
      mood,
      energy,
      pain,
      symptoms: selectedSymptoms,
    });
    setCheckInToast(true);
    setTimeout(() => setCheckInToast(false), 4000);
    setSelectedSymptoms([]);
  };

  const handleSendConsult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultText.trim()) return;
    sendMessage('crew', consultText, 'consult');
    setConsultText('');
  };

  const tabs: Array<{id: 'live' | 'environment' | 'checkin' | 'orders'; label: string; badge?: number}> = [
    {id: 'live', label: 'Live Vitals'},
    {id: 'environment', label: 'Cabin Environment'},
    {id: 'checkin', label: 'Daily Check-In', badge: isCheckInMissed ? 1 : undefined},
    {id: 'orders', label: 'Orders & Consult', badge: vegaOrders.filter((o) => o.status === 'delivered').length || undefined},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="CREW HEALTH CONSOLE · SOL 142"
        title="Commander Elena Vega"
        description="Autonomous physiological monitoring, environmental cabin surveillance, and terrestrial telemedicine sync."
        actions={
          isCmo ? (
            <span className="rounded bg-mars/20 text-mars border border-mars/40 px-2.5 py-1 text-xs font-mono font-bold uppercase">
              CMO Designated
            </span>
          ) : undefined
        }
      />

      {/* Urgent Uplink Directives Banner from Flight Surgeon (Houston) */}
      {pendingDirectives.length > 0 && (
        <aside
          role="region"
          aria-label="Pending Flight Surgeon Directives"
          className="rounded-xl border-2 border-earth bg-void-2/95 p-4 sm:p-5 shadow-2xl animate-fade-in font-mono text-xs space-y-3"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-earth animate-ping" />
              <span className="font-display text-sm uppercase text-earth font-bold">
                Clinical Directive Received From Flight Surgeon
              </span>
            </div>
            <span className="rounded bg-earth/20 text-earth border border-earth/40 px-2 py-0.5 text-[11px] font-bold uppercase">
              Action Required ({pendingDirectives.length})
            </span>
          </div>

          <div className="space-y-3">
            {pendingDirectives.map((directive) => (
              <div
                key={directive.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-void border border-white/10"
              >
                <div>
                  <div className="flex items-center gap-2 text-[11px] text-regolith/60 uppercase">
                    <span className="font-bold text-white">[{directive.type.toUpperCase()}]</span>
                    <span>Issued by {directive.composedBy}</span>
                    <span>· {directive.timeStr}</span>
                  </div>
                  <p className="text-white text-sm font-semibold mt-1">
                    "{directive.text}"
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => acknowledgeOrder(directive.id, vega.name)}
                    className="rounded bg-emerald-500 hover:bg-emerald-400 text-void font-bold uppercase px-3.5 py-2 transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-emerald-400 min-h-[40px] cursor-pointer shadow-md"
                  >
                    ✓ Acknowledge
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectOrder(directive.id, vega.name, 'Local operational constraint')}
                    className="rounded bg-white/10 hover:bg-white/20 text-regolith hover:text-white uppercase font-bold px-3 py-2 transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-mars min-h-[40px] cursor-pointer"
                  >
                    ✕ Cannot Comply
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* Emergency banner across role view */}
      {emergency?.active && (
        <div className="rounded-lg bg-mars p-4 text-white shadow-[0_0_30px_rgba(226,112,74,0.5)] flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-display text-sm md:text-base font-bold uppercase tracking-wider">
                Emergency Protocol Declared
              </h3>
              <p className="text-xs text-white/90">
                Onboard autonomous triage lock engaged at {emergency.time}. Immediate telemetry packet broadcast to Earth.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setEmergency(null)}
            className="rounded bg-black/40 px-3 py-1 font-mono text-xs uppercase hover:bg-black/60"
          >
            Acknowledge & Stand Down
          </button>
        </div>
      )}

      {/* Today Biometric Range & Autonomous Assessment Strip */}
      <TodayStrip personId={vega.id} />

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

      {/* TAB 1: LIVE VITALS */}
      {activeTab === 'live' && (
        <div className="space-y-6" data-tour="ch2-vitals-pulse">
          {/* Live Vitals Grid with HUD Corner Brackets (1 of 3 places) */}
          <Panel title="Continuous biometric streams" brackets>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 min-w-0">
              <VitalTile
                label="Heart Rate"
                value={Math.round(latestHr)}
                unit="bpm"
                baseline={vega.baseline.hr}
                delta={latestHr - vega.baseline.hr}
                status={hrStatus}
                sparklineData={hrArr.slice(-20).map((d) => ({v: d.value}))}
                provenance={cameraPulseActive ? 'REAL' : 'SIMULATED'}
                selected={selectedMetric === 'hr'}
                onClick={() => setSelectedMetric('hr')}
              />
              <VitalTile
                label="Oxygen SpO2"
                value={`${Math.round(latestSpo2)}%`}
                unit=""
                baseline={`${vega.baseline.spo2}%`}
                delta={latestSpo2 - vega.baseline.spo2}
                status={spo2Status}
                sparklineData={spo2Arr.slice(-20).map((d) => ({v: d.value}))}
                provenance="SIMULATED"
                selected={selectedMetric === 'spo2'}
                onClick={() => setSelectedMetric('spo2')}
              />
              <VitalTile
                label="Blood Pressure"
                value={`${Math.round(latestBpSys)}/${Math.round(latestBpDia)}`}
                unit="mmHg"
                baseline={`${vega.baseline.bpSys}/${vega.baseline.bpDia}`}
                delta={bpDeltaStr}
                status={bpStatus}
                sparklineData={bpSysArr.slice(-20).map((d) => ({v: d.value}))}
                provenance="SIMULATED"
                selected={selectedMetric === 'bp'}
                onClick={() => setSelectedMetric('bp')}
              />
              <VitalTile
                label="Core Temp"
                value={latestTemp.toFixed(1)}
                unit="°C"
                baseline={`${vega.baseline.temp}°C`}
                delta={latestTemp - vega.baseline.temp}
                status={tempStatus}
                sparklineData={tempArr.slice(-20).map((d) => ({v: d.value}))}
                provenance="SIMULATED"
                selected={selectedMetric === 'temp'}
                onClick={() => setSelectedMetric('temp')}
              />
              <VitalTile
                label="Respiration"
                value={Math.round(latestResp)}
                unit="br/min"
                baseline={vega.baseline.resp}
                delta={latestResp - vega.baseline.resp}
                sparklineData={respArr.slice(-20).map((d) => ({v: d.value}))}
                provenance="SIMULATED"
                selected={selectedMetric === 'resp'}
                onClick={() => setSelectedMetric('resp')}
              />
              <VitalTile
                label="HRV (RMSSD)"
                value={Math.round(latestHrv)}
                unit="ms"
                baseline={vega.baseline.hrv}
                delta={latestHrv - vega.baseline.hrv}
                status={hrvStatus}
                sparklineData={hrvArr.slice(-20).map((d) => ({v: d.value}))}
                provenance="SIMULATED"
                selected={selectedMetric === 'hrv'}
                onClick={() => setSelectedMetric('hrv')}
              />
            </div>
          </Panel>

          {/* Optical Camera rPPG Pulse Bridge */}
          <CameraPulse />

          <div className="grid gap-6 lg:grid-cols-12 min-w-0">
            {/* Trend Chart */}
            <div className="lg:col-span-8 min-w-0 overflow-hidden">
              <Panel title={`${metricInfo.title} telemetry trendline`}>
                <div className="h-[220px] sm:h-64 min-w-0 overflow-hidden">
                  <TrendChart
                    title={metricInfo.title}
                    unit={metricInfo.unit}
                    data={trendData}
                    baseline={metricInfo.baseline}
                    range={trendRange}
                    onRangeChange={setTrendRange}
                    color={metricInfo.color}
                  />
                </div>
              </Panel>
            </div>

            {/* Personal Alerts */}
            <div className="lg:col-span-4">
              <Panel
                title="Active clinical alerts"
                badge={
                  <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-regolith/80">
                    {personalAlerts.length}
                  </span>
                }
              >
                <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                  {personalAlerts.length === 0 ? (
                    <div className="py-12 text-center font-mono text-label text-regolith/40">
                      No active alerts for Commander Vega.
                    </div>
                  ) : (
                    personalAlerts.map((a) => (
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
            </div>
          </div>

          {/* Emergency Protocol Trigger */}
          <div className="flex items-center justify-between rounded-lg bg-mars/10 p-5 ring-1 ring-mars/30">
            <div>
              <h4 className="font-display text-[0.9375rem] text-mars uppercase">Immediate Medical Emergency</h4>
              <p className="mt-1 text-xs text-regolith/70">
                Declares an active emergency, broadcasts alerts, and launches the interactive protocol runner.
              </p>
            </div>
            <ConfirmButton
              label="Declare Emergency"
              confirmPrompt="Are you declaring an active emergency? This logs the declaration to the immutable audit log and opens the emergency protocol runner."
              onConfirm={() => {
                setEmergency({
                  active: true,
                  time: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'}),
                });
                startProtocol('cpr');
                setPage('protocols');
              }}
              variant="danger"
            />
          </div>
        </div>
      )}

      {/* TAB 2: ENVIRONMENT */}
      {activeTab === 'environment' && (
        <div className="space-y-6">
          <Panel title="Cabin life support & radiation telemetry">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
              <Gauge
                label="CO2 Partial"
                value={cabin.co2}
                max={5000}
                unit="ppm"
                warning={2000}
                critical={3500}
                subtext="Scrubber A"
              />
              <Gauge
                label="Oxygen O2"
                value={cabin.o2}
                max={25}
                unit="%"
                warning={19.5}
                critical={18.0}
                subtext="Cabin mix"
              />
              <Gauge
                label="Pressure"
                value={cabin.pressure}
                max={120}
                unit="kPa"
                subtext="Sea-level equiv"
              />
              <Gauge
                label="Cabin Temp"
                value={cabin.temp}
                max={35}
                unit="°C"
                subtext="HVAC Loop 1"
              />
              <Gauge
                label="Humidity"
                value={cabin.humidity}
                max={100}
                unit="%"
                subtext="Condenser"
              />
              <Gauge
                label="Radiation Dose"
                value={cabin.radiation.cumulative}
                max={1000}
                unit="mSv"
                limit={cabin.radiation.limit}
                warning={500}
                critical={800}
                subtext={`${cabin.radiation.dailyDose.toFixed(1)} mSv/d`}
              />
            </div>
          </Panel>

          <div className="grid md:grid-cols-2 gap-6 font-mono text-xs">
            <div className="rounded-xl bg-void-2 p-5 border border-white/10 space-y-3">
              <span className="font-bold text-white uppercase block">Atmospheric Integrity Assessment</span>
              <p className="text-regolith/80 leading-relaxed">
                Atmosphere recycling system is circulating at nominal flow rate (45 CFM). Primary lithium hydroxide canisters show 88% operational capacity. Trace volatile contaminant scrubber catalytic bed is stable.
              </p>
              <div className="pt-2 border-t border-white/5 flex justify-between text-[11px]">
                <span className="text-regolith/50">CO2 SCRUBBER LOOP</span>
                <span className="text-emerald-400 font-bold">ONLINE · NOMINAL</span>
              </div>
            </div>

            <div className="rounded-xl bg-void-2 p-5 border border-white/10 space-y-3">
              <span className="font-bold text-white uppercase block">Galactic Cosmic Radiation & SPE Status</span>
              <p className="text-regolith/80 leading-relaxed">
                Dosimetry payload records background cosmic radiation flux at {cabin.radiation.dailyDose.toFixed(1)} mSv/day. Active storm shelter polyethylene shielding remains available if solar flux exceeds secondary thresholds.
              </p>
              <div className="pt-2 border-t border-white/5 flex justify-between text-[11px]">
                <span className="text-regolith/50">RADIATION DOSIMETER</span>
                <span className="text-earth font-bold">L2 THRESHOLD BUFFER CLEAR</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CHECK-IN */}
      {activeTab === 'checkin' && (
        <div className="space-y-6">
          {/* Missed Check-In Reminder Badge */}
          {isCheckInMissed && (
            <div className="rounded-lg bg-[#e0b03a]/15 border border-[#e0b03a]/40 p-4 font-mono text-xs text-[#e0b03a] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span>⏰</span>
                <div>
                  <span className="font-bold uppercase block">
                    Routine Biometric Check-In Overdue
                  </span>
                  <span className="text-[11px] text-regolith/80">
                    {Math.round(elapsedHours)} hours elapsed since last check-in (threshold is {missedCheckInHours}h).
                  </span>
                </div>
              </div>
            </div>
          )}

          <Panel
            title="Daily 60-second autonomous check-in"
            subtitle="Self-reported wellbeing inputs fed into circadian and risk models"
          >
            {checkInToast && (
              <div className="mb-4 rounded bg-earth/20 p-3 text-xs text-earth border border-earth/40 flex items-center justify-between font-mono">
                <span>✓ Check-in saved to clinical record and synced with flight surgeon inbox.</span>
              </div>
            )}

            <form onSubmit={handleCheckInSubmit} className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-3">
                <div>
                  <div className="flex justify-between font-mono text-label mb-2">
                    <span className="text-regolith/70 uppercase">Mood State</span>
                    <span className="text-white font-bold">{mood}/10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={mood}
                    onChange={(e) => setMood(+e.target.value)}
                    className="w-full accent-earth"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-mono text-label mb-2">
                    <span className="text-regolith/70 uppercase">Energy Reserve</span>
                    <span className="text-white font-bold">{energy}/10</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={energy}
                    onChange={(e) => setEnergy(+e.target.value)}
                    className="w-full accent-earth"
                  />
                </div>

                <div>
                  <div className="flex justify-between font-mono text-label mb-2">
                    <span className="text-regolith/70 uppercase">Spinal / Physical Pain</span>
                    <span className="text-white font-bold">{pain}/10</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={pain}
                    onChange={(e) => setPain(+e.target.value)}
                    className="w-full accent-mars"
                  />
                </div>
              </div>

              <div>
                <span className="block font-mono text-label text-regolith/70 uppercase mb-3">
                  Symptom Multi-Select (Red flags trigger automated autonomous evaluation)
                </span>
                <div className="flex flex-wrap gap-2">
                  {SPACE_SYMPTOMS.map((sym) => {
                    const isRedFlag = ['Chest tightness', 'Vision blur', 'Syncope / Faint', 'Severe disorientation'].includes(sym);
                    const isSelected = selectedSymptoms.includes(sym);
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => handleSymptomToggle(sym)}
                        className={`rounded px-3 py-1.5 font-mono text-xs transition-colors border ${
                          isSelected
                            ? isRedFlag
                              ? 'bg-mars text-white border-mars'
                              : 'bg-earth text-void border-earth font-bold'
                            : isRedFlag
                            ? 'bg-void-2 text-mars/80 border-mars/30 hover:border-mars'
                            : 'bg-void-2 text-regolith/80 border-white/10 hover:border-white/20'
                        }`}
                      >
                        {sym} {isRedFlag ? '⚠️' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-4">
                <span className="font-mono text-[11px] text-regolith/50">
                  Protocol: AstroCare Onboard Health Index v2.4
                </span>
                <button
                  type="submit"
                  className="rounded bg-white px-6 py-2.5 font-mono text-label text-void font-bold uppercase transition-colors hover:bg-earth"
                >
                  Submit Daily Log
                </button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      {/* TAB 4: ORDERS & CONSULT */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* Fleet Broadcast Alert Banner */}
          {unreadBroadcasts.length > 0 && (
            <div className="rounded-xl bg-earth/15 border border-earth/40 p-4 font-mono text-xs text-white space-y-2 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="font-bold text-earth uppercase flex items-center gap-2">
                  <span className="animate-pulse">📢</span>
                  <span>Fleetwide Uplink Announcement from Houston</span>
                </span>
                <span className="text-[11px] text-regolith/60">
                  {unreadBroadcasts[0].timeStr}
                </span>
              </div>
              <p className="text-white text-xs leading-relaxed bg-void/50 p-2.5 rounded border border-white/10">
                {unreadBroadcasts[0].message}
              </p>
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => markBroadcastRead(unreadBroadcasts[0].id, vega.id, vega.name)}
                  className="rounded bg-earth px-4 py-1.5 font-bold uppercase text-void hover:bg-earth/90 transition-colors shadow"
                >
                  Confirm & Mark Read ✓
                </button>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Medical Orders Card */}
            <Panel
              title="Medical orders & directives"
              badge={
                <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-regolith/80">
                  {vegaOrders.length}
                </span>
              }
            >
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 font-mono text-xs">
                {vegaOrders.length === 0 ? (
                  <div className="py-12 text-center text-regolith/40 text-xs">
                    No medical orders assigned to Vega.
                  </div>
                ) : (
                  vegaOrders.map((o) => {
                    const canAck = o.status === 'delivered';
                    return (
                      <div
                        key={o.id}
                        className="rounded-lg bg-void p-3.5 border border-white/10 space-y-2 hover:border-white/20 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] rounded bg-white/10 px-1.5 py-0.5 text-regolith uppercase font-bold">
                            {o.type}
                          </span>
                          <span className="text-[11px] text-regolith/60">
                            By: {o.composedBy}
                          </span>
                        </div>

                        <p className="text-white text-xs">{o.text}</p>

                        <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                          <span className="text-earth font-bold uppercase">
                            [{o.status}]
                          </span>

                          {canAck && (
                            <button
                              type="button"
                              onClick={() => acknowledgeOrder(o.id, vega.name)}
                              className="rounded bg-earth px-2.5 py-1 text-[11px] font-bold text-void uppercase hover:bg-earth/90 transition-colors shadow"
                            >
                              Acknowledge ✓
                            </button>
                          )}
                          {o.status === 'acknowledged' && (
                            <span className="text-emerald-400 font-bold">
                              ✓ Complied
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Panel>

            {/* Send Consult to Earth Ground */}
            <Panel title="Send telemedicine consult" subtitle="Store-and-forward queue">
              <form onSubmit={handleSendConsult} className="space-y-4 font-mono text-xs">
                <textarea
                  rows={5}
                  placeholder="Describe astronaut symptom, requested medication adjustment, or operational query..."
                  value={consultText}
                  onChange={(e) => setConsultText(e.target.value)}
                  className="w-full rounded bg-void p-3 text-white border border-white/15 focus:outline-none focus:border-earth text-xs"
                />
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-regolith/50">Dispatches via DSN queue</span>
                  <button
                    type="submit"
                    className="rounded bg-earth px-4 py-2 font-bold text-void uppercase hover:bg-earth/90 transition-colors"
                  >
                    Send to Ground
                  </button>
                </div>
              </form>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}