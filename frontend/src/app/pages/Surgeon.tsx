import {useState} from 'react';
import {useStore, isWorkoutMissed, type CrewMember, type Alert} from '../../store';
import {Panel, TrendChart, AlertCard, PageHeader} from '../ui';
import {ResponsiveContainer, LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, Legend} from 'recharts';
import {ADAPTATION_ENVELOPE} from '../../data/adaptation';

export function Surgeon() {
  const crew = useStore((s) => s.crew);
  const alerts = useStore((s) => s.alerts);
  const selectedCrewId = useStore((s) => s.selectedCrewId);
  const setSelectedCrewId = useStore((s) => s.setSelectedCrewId);
  const computeRiskScore = useStore((s) => s.computeRiskScore);
  const ackAlert = useStore((s) => s.ackAlert);
  const resolveAlert = useStore((s) => s.resolveAlert);
  const checkIns = useStore((s) => s.checkIns);
  const aiDegraded = useStore((s) => s.aiDegraded);
  const missedCheckInHours = useStore((s) => s.missedCheckInHours);
  const lastCheckInTimes = useStore((s) => s.lastCheckInTimes);
  const workoutLogs = useStore((s) => s.workoutLogs);
  const orders = useStore((s) => s.orders);
  const composeOrder = useStore((s) => s.composeOrder);
  const linkUp = useStore((s) => s.linkUp);

  // Tab State in store
  const activeTab = useStore((s) => s.surgeonHomeTab);
  const setActiveTab = useStore((s) => s.setSurgeonHomeTab);

  // Batch D additions (F050, F066, X03)
  const crewSigmaThresholds = useStore((s) => s.crewSigmaThresholds);
  const feedbackCounts = useStore((s) => s.feedbackCounts);
  const recordFeedback = useStore((s) => s.recordFeedback);
  const replayLastHour = useStore((s) => s.replayLastHour);
  const medicalOfficerCrewId = useStore((s) => s.medicalOfficerCrewId);
  const designateMedicalOfficer = useStore((s) => s.designateMedicalOfficer);
  const revokeMedicalOfficer = useStore((s) => s.revokeMedicalOfficer);

  // Adaptation Priors state (X03)
  const [missionDay, setMissionDay] = useState<number>(3);
  const [usePriors, setUsePriors] = useState<boolean>(true);

  // Replay Last Hour feedback modal/result state (F050)
  const [replayResult, setReplayResult] = useState<{
    tested: boolean;
    nowFires: number;
    beforeFires: number;
    currentSigma: number;
  } | null>(null);

  // Patient dossier sub-tabs: 'vitals' | 'checkins' | 'alerts'
  const [dossierTab, setDossierTab] = useState<'vitals' | 'checkins' | 'alerts'>('vitals');
  const [selectedVital, setSelectedVital] = useState<'hr' | 'spo2' | 'temp' | 'resp' | 'hrv'>('hr');
  const [trendRange, setTrendRange] = useState<'1m' | '5m'>('1m');

  // Filter for alert inbox: 'all' | 'new' | 'ack' | 'resolved'
  const [alertFilter, setAlertFilter] = useState<'all' | 'new' | 'ack' | 'resolved'>('new');
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  // Consult directive text & category
  const [directiveText, setDirectiveText] = useState('');
  const [directiveCategory, setDirectiveCategory] = useState<'medication' | 'exercise' | 'rest' | 'other'>('medication');
  const [isSendingDirective, setIsSendingDirective] = useState(false);
  const [directiveFeedback, setDirectiveFeedback] = useState<{type: 'success' | 'error'; text: string} | null>(null);

  // Sort crew by risk score descending
  const sortedCrew = [...crew].sort((a, b) => computeRiskScore(b) - computeRiskScore(a));

  const selectedMember: CrewMember = crew.find((c) => c.id === selectedCrewId) || crew[0];
  const patientRisk = computeRiskScore(selectedMember);

  // Patient directives
  const patientOrders = orders.filter((o) => o.targetCrewId === selectedMember.id);

  // Filtered alerts
  const filteredAlerts = alerts.filter((a) => {
    if (alertFilter === 'all') return true;
    return a.status === alertFilter;
  });

  // Selected alert for AI panel (default to first active alert if not selected)
  const selectedAlert: Alert | undefined =
    alerts.find((a) => a.id === selectedAlertId) ||
    alerts.find((a) => a.status !== 'resolved') ||
    alerts[0];

  // Telemetry mapping for patient vitals
  const vitalsMap = {
    hr: {title: 'Heart Rate', data: selectedMember.readings.hr, base: selectedMember.baseline.hr, unit: 'bpm', color: '#6fb6ff'},
    spo2: {title: 'Oxygen Saturation', data: selectedMember.readings.spo2, base: selectedMember.baseline.spo2, unit: '%', color: '#6fb6ff'},
    temp: {title: 'Core Temperature', data: selectedMember.readings.temp, base: selectedMember.baseline.temp, unit: '°C', color: '#f2e6c9'},
    resp: {title: 'Respiration Rate', data: selectedMember.readings.resp, base: selectedMember.baseline.resp, unit: 'br/min', color: '#6fb6ff'},
    hrv: {title: 'HRV (RMSSD)', data: selectedMember.readings.hrv, base: selectedMember.baseline.hrv, unit: 'ms', color: '#d8c3b4'},
  }[selectedVital];

  // Patient check-ins
  const patientCheckIns = checkIns.filter((ci) => ci.crewId === selectedMember.id);
  const patientAlerts = alerts.filter((a) => a.crewId === selectedMember.id);

  const handleSendDirective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directiveText.trim() || isSendingDirective) return;
    setIsSendingDirective(true);
    setDirectiveFeedback(null);

    try {
      composeOrder(
        selectedMember.id,
        directiveCategory,
        directiveText.trim(),
        'Dr. Priya Nair (Houston Flight Surgeon)'
      );
      setDirectiveText('');
      setDirectiveFeedback({
        type: 'success',
        text: linkUp
          ? `Directive successfully dispatched. Transmitting to ${selectedMember.name} across deep-space delay.`
          : `Deep-space link down. Directive queued in buffer and will transmit immediately upon carrier link return.`,
      });
      setTimeout(() => setDirectiveFeedback(null), 6000);
    } catch {
      setDirectiveFeedback({
        type: 'error',
        text: 'Failed to inject directive into comms queue.',
      });
    } finally {
      setIsSendingDirective(false);
    }
  };

  const psiValue = aiDegraded ? 0.28 : 0.04;

  const tabs: Array<{id: 'roster' | 'alerts' | 'priors'; label: string; badge?: number}> = [
    {id: 'roster', label: 'Roster & Dossier'},
    {id: 'alerts', label: 'Alerts & AI Diagnostics', badge: alerts.filter((a) => a.status === 'new').length || undefined},
    {id: 'priors', label: 'Adaptation Priors'},
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="TERRESTRIAL TELEMEDICINE · FLIGHT SURGEON CONSOLE"
        title="Dr. Priya Nair (Houston)"
        description="Ground medical telemetry surveillance, Bayesian biomarker adaptation, and store-and-forward clinical order dispatch."
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

      {/* TAB 1: ROSTER & DOSSIER */}
      {activeTab === 'roster' && (
        <div className="space-y-6">
          {/* Crew Roster Grid */}
          <section aria-label="Crew clinical risk status">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs text-regolith/70 uppercase tracking-wider font-semibold text-[11px]">
                Crew health roster (sorted by clinical risk)
              </span>
              <span className="font-mono text-label text-regolith/50 text-[11px]">4 Active Deep-Space Astronauts</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {sortedCrew.map((member) => {
                const risk = computeRiskScore(member);
                const isSelected = member.id === selectedMember.id;
                const hrLatest = member.readings.hr[member.readings.hr.length - 1]?.value ?? member.baseline.hr;
                const tempLatest = member.readings.temp[member.readings.temp.length - 1]?.value ?? member.baseline.temp;
                const spo2Latest = member.readings.spo2[member.readings.spo2.length - 1]?.value ?? member.baseline.spo2;

                const lastCheckIn = lastCheckInTimes[member.id] || Date.now() - 86400000 * 2;
                const elapsedHours = (Date.now() - lastCheckIn) / 3600000;
                const isMissedCheckin = elapsedHours > missedCheckInHours;
                const isMissedExercise = isWorkoutMissed(member.id, workoutLogs);

                const riskColor =
                  risk >= 60
                    ? 'text-mars border-mars/40 bg-mars/10'
                    : risk >= 30
                    ? 'text-[#e0b03a] border-[#e0b03a]/40 bg-[#e0b03a]/10'
                    : 'text-earth border-earth/30 bg-earth/5';

                return (
                  <div
                    key={member.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedCrewId(member.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedCrewId(member.id);
                      }
                    }}
                    className={`relative rounded-xl p-4 text-left transition-all border min-h-[44px] cursor-pointer focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none ${
                      isSelected
                        ? 'border-earth bg-void-2 shadow-[0_0_20px_rgba(111,182,255,0.12)]'
                        : 'border-white/10 bg-void-2/60 hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-display text-sm text-white font-semibold">{member.name}</h4>
                        <p className="font-mono text-[11px] text-regolith/60 uppercase">{member.roleTitle}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`rounded border px-2 py-0.5 font-mono text-[11px] font-bold uppercase ${riskColor}`}>
                          Risk {risk}
                        </span>
                        {isMissedCheckin && (
                          <span className="rounded border border-mars/40 bg-mars/20 text-mars px-1.5 py-0.2 font-mono text-[11px] font-bold uppercase">
                            MISSED CHECKIN
                          </span>
                        )}
                        {isMissedExercise && (
                          <span className="rounded border border-[#e0b03a]/40 bg-[#e0b03a]/20 text-[#e0b03a] px-1.5 py-0.2 font-mono text-[11px] font-bold uppercase">
                            MISSED WORKOUT
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between font-mono text-xs">
                      <div>
                        <span className="text-regolith/50 text-[11px] block uppercase">HR / SpO2</span>
                        <span className="text-white font-medium">{Math.round(hrLatest)} bpm / {Math.round(spo2Latest)}%</span>
                      </div>
                      <div className="text-right">
                        <span className="text-regolith/50 text-[11px] block uppercase">Temp</span>
                        <span className={tempLatest > 37.8 ? 'text-mars font-bold' : 'text-white'}>
                          {tempLatest.toFixed(1)}°C
                        </span>
                      </div>
                    </div>

                    {/* Mini Sparkline */}
                    <div className="mt-3 h-8 w-full border-t border-white/5 pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={member.readings.hr.slice(-25).map((d) => ({v: d.value}))}>
                          <Line
                            type="monotone"
                            dataKey="v"
                            stroke={risk >= 60 ? '#e2704a' : risk >= 30 ? '#e0b03a' : '#6fb6ff'}
                            strokeWidth={1.5}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* CMO Badge and Designation Button */}
                    <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2">
                      {medicalOfficerCrewId === member.id ? (
                        <span className="rounded bg-mars/20 text-mars border border-mars/40 px-2 py-0.5 text-[11px] font-bold uppercase">
                          MEDICAL OFFICER
                        </span>
                      ) : (
                        <span className="text-[11px] text-regolith/50 uppercase">Crew Member</span>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (medicalOfficerCrewId === member.id) {
                            revokeMedicalOfficer();
                          } else {
                            designateMedicalOfficer(member.id);
                          }
                        }}
                        className="rounded bg-white/10 hover:bg-white/20 text-[11px] uppercase font-bold px-2 py-1 text-white transition-colors focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none"
                      >
                        {medicalOfficerCrewId === member.id ? 'Revoke CMO' : 'Designate CMO'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Patient Dossier Details */}
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-8 space-y-6">
              <Panel
                title={`Patient dossier — ${selectedMember.name}`}
                subtitle={selectedMember.roleTitle}
                rightAction={
                  <div className="flex gap-2">
                    {(['vitals', 'checkins', 'alerts'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setDossierTab(tab)}
                        className={`rounded px-3 py-1 font-mono text-label uppercase transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none ${
                          dossierTab === tab
                            ? 'bg-earth text-void font-bold'
                            : 'bg-white/5 text-regolith/70 hover:text-white'
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                }
              >
                {dossierTab === 'vitals' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3 font-mono text-[11px]">
                      {(['hr', 'spo2', 'temp', 'resp', 'hrv'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedVital(m)}
                          className={`rounded px-2.5 py-1 uppercase min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none ${
                            selectedVital === m
                              ? 'bg-white/20 text-white font-bold'
                              : 'text-regolith/60 hover:text-white'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>

                    <div className="h-[220px] sm:h-64">
                      <TrendChart
                        title={`${vitalsMap.title} — ${selectedMember.name}`}
                        unit={vitalsMap.unit}
                        data={vitalsMap.data}
                        baseline={vitalsMap.base}
                        range={trendRange}
                        onRangeChange={setTrendRange}
                        color={vitalsMap.color}
                      />
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/5 font-mono text-xs">
                      <div className="rounded bg-void p-2">
                        <span className="text-regolith/50 text-[11px] block uppercase">Clinical Risk</span>
                        <span className="font-bold text-white">{patientRisk} / 100</span>
                      </div>
                      <div className="rounded bg-void p-2">
                        <span className="text-regolith/50 text-[11px] block uppercase">Active Alerts</span>
                        <span className="font-bold text-white">{patientAlerts.length}</span>
                      </div>
                      <div className="rounded bg-void p-2">
                        <span className="text-regolith/50 text-[11px] block uppercase">Blood Pressure</span>
                        <span className="font-bold text-white">
                          {Math.round(selectedMember.readings.bpSys.slice(-1)[0]?.value ?? selectedMember.baseline.bpSys)}/
                          {Math.round(selectedMember.readings.bpDia.slice(-1)[0]?.value ?? selectedMember.baseline.bpDia)}
                        </span>
                      </div>
                      <div className="rounded bg-void p-2">
                        <span className="text-regolith/50 text-[11px] block uppercase">Data Source</span>
                        <span className="font-bold text-earth">
                          {selectedMember.id === 'vega' ? 'REAL BIOMETRIC' : 'SIMULATED'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {dossierTab === 'checkins' && (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {patientCheckIns.length === 0 ? (
                      <p className="py-8 text-center font-mono text-label text-regolith/40">
                        No subjective check-in logs submitted yet for this crew member.
                      </p>
                    ) : (
                      patientCheckIns.map((ci) => (
                        <div key={ci.id} className="rounded border border-white/10 bg-void p-3 font-mono text-xs">
                          <div className="flex justify-between text-regolith/60 mb-1">
                            <span>Logged at {ci.time}</span>
                            <span>Mood {ci.mood}/10 · Energy {ci.energy}/10 · Pain {ci.pain}/10</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {ci.symptoms.map((s, idx) => (
                              <span key={idx} className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-white">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {dossierTab === 'alerts' && (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {patientAlerts.length === 0 ? (
                      <p className="py-8 text-center font-mono text-label text-regolith/40">
                        No alerts. Crew nominal.
                      </p>
                    ) : (
                      patientAlerts.map((a) => (
                        <AlertCard
                          key={a.id}
                          alert={a}
                          onAck={ackAlert}
                          onResolve={resolveAlert}
                          onFeedback={(isTrue) => recordFeedback(a.crewId || selectedMember.id, isTrue)}
                          onSelect={() => setSelectedAlertId(a.id)}
                          selected={selectedAlert?.id === a.id}
                        />
                      ))
                    )}
                  </div>
                )}
              </Panel>
            </div>

            {/* Right: Directive Transmit & Latency Queue */}
            <div className="lg:col-span-4 space-y-6">
              <Panel
                title="Transmit clinical directive"
                subtitle={`Target: ${selectedMember.name} (${selectedMember.roleTitle})`}
              >
                <form onSubmit={handleSendDirective} className="space-y-3 font-mono text-xs">
                  {/* Category Buttons */}
                  <div>
                    <label className="text-[10px] text-regolith/50 uppercase block mb-1">
                      Directive Category
                    </label>
                    <div className="grid grid-cols-4 gap-1">
                      {(['medication', 'exercise', 'rest', 'other'] as const).map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setDirectiveCategory(cat)}
                          className={`rounded py-1 text-[10px] uppercase font-bold border transition-colors ${
                            directiveCategory === cat
                              ? 'bg-earth text-void border-earth'
                              : 'bg-void text-regolith/70 border-white/10 hover:border-white/20'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preset quick buttons */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {[
                      'Admin 25mg Promethazine',
                      'Hydrate +500mL electrolytes',
                      'Cycle ergometer 30m',
                      'Rest 4h in quarters',
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setDirectiveText(preset)}
                        className="text-[10px] rounded bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-0.5 text-regolith/70 hover:text-white"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>

                  <textarea
                    rows={3}
                    placeholder={`Enter clinical directive for ${selectedMember.name}...`}
                    value={directiveText}
                    onChange={(e) => setDirectiveText(e.target.value)}
                    disabled={isSendingDirective}
                    className="w-full rounded bg-void p-2.5 text-white border border-white/15 focus:outline-none focus:border-earth text-xs focus-visible:ring-2 focus-visible:ring-earth disabled:opacity-50"
                  />

                  {directiveFeedback && (
                    <div
                      className={`p-2.5 rounded text-[11px] font-mono border ${
                        directiveFeedback.type === 'success'
                          ? 'bg-emerald-950/60 text-emerald-200 border-emerald-600/50'
                          : 'bg-mars/20 text-mars border-mars/40'
                      }`}
                    >
                      {directiveFeedback.text}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] text-regolith/50">
                      {linkUp ? 'Uplinks per DSN latency' : 'Link offline · Will queue'}
                    </span>
                    <button
                      type="submit"
                      disabled={!directiveText.trim() || isSendingDirective}
                      className="rounded bg-earth px-4 py-2 font-bold text-void uppercase hover:bg-earth/90 transition-all min-h-[40px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95 shadow-md flex items-center gap-1.5"
                    >
                      {isSendingDirective ? (
                        <>
                          <span className="animate-spin text-xs">⟳</span>
                          <span>Injecting...</span>
                        </>
                      ) : (
                        <span>Uplink Directive 📡</span>
                      )}
                    </button>
                  </div>
                </form>

                {/* Patient Directives Queue & Receipts */}
                <div className="mt-5 pt-4 border-t border-white/10 space-y-3 font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-regolith/60 font-bold">
                      Directives Log ({patientOrders.length})
                    </span>
                    <span className="text-[10px] text-regolith/40">DSN Transit Buffer</span>
                  </div>

                  {patientOrders.length === 0 ? (
                    <p className="text-[11px] text-regolith/40 italic py-2">
                      No directives issued to {selectedMember.name} yet.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {patientOrders.map((ord) => {
                        const now = Date.now();
                        const remainingSec = Math.max(0, Math.ceil((ord.deliverAt - now) / 1000));

                        return (
                          <div
                            key={ord.id}
                            className="p-3 rounded-lg bg-void border border-white/10 space-y-1.5 text-xs"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-bold uppercase text-white">
                                [{ord.type}] {ord.timeStr}
                              </span>
                              {ord.status === 'queued' && (
                                <span className="rounded bg-white/10 text-regolith/80 border border-white/20 px-2 py-0.5 text-[10px] font-bold uppercase">
                                  Queued (Offline)
                                </span>
                              )}
                              {ord.status === 'in-flight' && (
                                <span className="rounded bg-earth/20 text-earth border border-earth/40 px-2 py-0.5 text-[10px] font-bold uppercase animate-pulse">
                                  Transmitting · {remainingSec}s
                                </span>
                              )}
                              {ord.status === 'delivered' && (
                                <span className="rounded bg-[#e0b03a]/20 text-[#e0b03a] border border-[#e0b03a]/40 px-2 py-0.5 text-[10px] font-bold uppercase">
                                  Delivered · Awaiting Ack
                                </span>
                              )}
                              {ord.status === 'acknowledged' && (
                                <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase">
                                  ✓ Acknowledged
                                </span>
                              )}
                              {ord.status === 'rejected' && (
                                <span className="rounded bg-mars/20 text-mars border border-mars/40 px-2 py-0.5 text-[10px] font-bold uppercase">
                                  ✕ Cannot Comply
                                </span>
                              )}
                            </div>

                            <p className="text-regolith/90 text-xs">
                              "{ord.text}"
                            </p>

                            {ord.status === 'in-flight' && (
                              <div className="w-full bg-void-2 rounded-full h-1.5 border border-white/10 overflow-hidden">
                                <div
                                  className="bg-earth h-full rounded-full transition-all duration-300 animate-pulse"
                                  style={{
                                    width: `${Math.max(5, Math.min(100, 100 - (remainingSec / 30) * 100))}%`,
                                  }}
                                />
                              </div>
                            )}

                            {ord.status === 'acknowledged' && ord.ackTimeStr && (
                              <div className="text-[10px] text-emerald-300/80 pt-0.5">
                                Verified by {ord.ackAstronautName || selectedMember.name} at {ord.ackTimeStr}
                              </div>
                            )}

                            {ord.status === 'rejected' && (
                              <div className="text-[10px] text-mars pt-0.5">
                                Reason: {ord.rejectReason || 'Operational constraint'} ({ord.rejectAstronautName || selectedMember.name})
                              </div>
                            )}
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
      )}

      {/* TAB 2: ALERTS & AI DIAGNOSTICS */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Alert Inbox */}
            <div className="lg:col-span-5 space-y-6">
              <Panel
                title="Clinical alert inbox"
                rightAction={
                  <div className="flex gap-1 font-mono text-[11px]">
                    {(['new', 'ack', 'resolved', 'all'] as const).map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setAlertFilter(filter)}
                        className={`rounded px-2 py-0.5 uppercase min-h-[32px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none ${
                          alertFilter === filter
                            ? 'bg-white/20 text-white font-bold'
                            : 'text-regolith/60 hover:text-white'
                        }`}
                      >
                        {filter}
                      </button>
                    ))}
                  </div>
                }
              >
                {aiDegraded && (
                  <div className="mb-2.5 rounded bg-[#e0b03a]/15 border border-[#e0b03a]/30 p-2 text-[11px] text-[#e0b03a] font-mono">
                    ⚠️ Deterministic rules fallback active (AI degraded). Diagnostic models offline.
                  </div>
                )}
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                  {filteredAlerts.length === 0 ? (
                    <div className="py-12 text-center font-mono text-label text-regolith/40">
                      No alerts. Crew nominal.
                    </div>
                  ) : (
                    filteredAlerts.map((a) => (
                      <AlertCard
                        key={a.id}
                        alert={a}
                        compact
                        onSelect={() => setSelectedAlertId(a.id)}
                        selected={selectedAlert?.id === a.id}
                        onAck={ackAlert}
                        onResolve={resolveAlert}
                        onFeedback={(isTrue) => recordFeedback(a.crewId || selectedMember.id, isTrue)}
                      />
                    ))
                  )}
                </div>
              </Panel>
            </div>

            {/* AI Diagnostic Panel with PSI Drift Indicator */}
            <div className="lg:col-span-7 space-y-6">
              {selectedAlert ? (
                <Panel title="AI clinical intelligence explanation">
                  <div className="space-y-4 font-mono">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-white text-xs font-semibold">{selectedAlert.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-regolith/50">PSI:</span>
                        <span
                          className={`text-[11px] font-bold ${
                            psiValue >= 0.2 ? 'text-mars' : 'text-emerald-400'
                          }`}
                          title="Population Stability Index (Drift indicator: <0.1 nominal, >0.25 degraded)"
                        >
                          {psiValue.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-regolith/90 leading-relaxed font-sans">
                      {selectedAlert.explanation}
                    </p>

                    {/* Differential Prediction Set Chips */}
                    {selectedAlert.predictionSet && selectedAlert.predictionSet.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 border-t border-white/5 pt-2">
                        <span className="text-[11px] text-regolith/50 uppercase">Differential Set:</span>
                        {selectedAlert.predictionSet.map((pred, i) => (
                          <span
                            key={i}
                            className="rounded bg-earth/20 text-earth border border-earth/30 px-2 py-0.5 text-[11px] font-bold"
                          >
                            {pred}
                          </span>
                        ))}
                        {(selectedAlert.aiUnsure || selectedAlert.predictionSet.length > 1 || selectedAlert.confidence < 0.55) && (
                          <span className="rounded bg-[#e0b03a]/25 text-[#e0b03a] border border-[#e0b03a]/40 px-2 py-0.5 text-[11px] font-bold uppercase animate-pulse">
                            AI UNSURE — escalate
                          </span>
                        )}
                      </div>
                    )}

                    {/* Top 3 Factors with Direction/Size bars */}
                    <div className="space-y-2 border-t border-white/5 pt-2">
                      <span className="text-[11px] text-regolith/50 uppercase block">
                        Top Diagnostic Factors (SHAP Feature Weighting)
                      </span>
                      {selectedAlert.factors.slice(0, 3).map((f, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-regolith/80 text-[11px] truncate max-w-[160px]">{f.label}</span>
                          <div className="flex items-center gap-2">
                            <span className={f.direction === 'up' ? 'text-mars text-xs' : 'text-earth text-xs'}>
                              {f.direction === 'up' ? '▲' : '▼'}
                            </span>
                            <div className="h-2 w-28 rounded bg-white/10 overflow-hidden">
                              <div
                                className={`h-full rounded ${f.direction === 'up' ? 'bg-mars' : 'bg-earth'}`}
                                style={{width: `${Math.round(f.size * 100)}%`}}
                              />
                            </div>
                            <span className="text-white text-[11px] w-8 text-right font-medium">
                              {(f.size * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Confidence meter & Unsure State */}
                    <div className="mt-3 border-t border-white/5 pt-2 flex items-center justify-between">
                      <span className="text-[11px] text-regolith/50 uppercase">Diagnostic Confidence</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-xs font-bold">
                          {(selectedAlert.confidence * 100).toFixed(0)}%
                        </span>
                        {selectedAlert.confidence < 0.55 || selectedAlert.aiUnsure ? (
                          <span className="rounded bg-mars/20 border border-mars/40 px-2 py-0.5 text-[11px] text-mars uppercase font-bold">
                            AI Unsure (Low Confidence)
                          </span>
                        ) : (
                          <span className="rounded bg-earth/20 border border-earth/40 px-2 py-0.5 text-[11px] text-earth uppercase">
                            High Confidence
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Per-Crew Sigma Threshold & Feedback Control */}
                    <div className="mt-3 border-t border-white/5 pt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="text-[11px] text-regolith/50 uppercase block">Crew Sigma Threshold</span>
                        <span className="text-earth font-bold">
                          {crewSigmaThresholds[selectedMember.id]?.toFixed(2) ?? '3.00'}σ
                        </span>
                        <span className="text-[11px] text-regolith/50 ml-2">
                          ({feedbackCounts[selectedMember.id]?.trueCount ?? 0} True / {feedbackCounts[selectedMember.id]?.falseCount ?? 0} False)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const res = replayLastHour(selectedMember.id);
                          setReplayResult({tested: true, ...res});
                        }}
                        className="rounded bg-white/10 hover:bg-white/20 border border-white/20 px-2.5 py-1 text-[11px] font-bold uppercase text-white transition-colors min-h-[36px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none"
                      >
                        Replay Last Hour
                      </button>
                    </div>

                    {replayResult?.tested && (
                      <div className="rounded bg-void p-2.5 border border-earth/30 text-[11px] text-earth space-y-1">
                        <span className="font-bold block uppercase">Replay Simulation (Last 1 Hour)</span>
                        <p>Alerts fired before feedback: <strong>{replayResult.beforeFires}</strong> (at 3.00σ baseline)</p>
                        <p>Alerts firing now with adapted threshold: <strong>{replayResult.nowFires}</strong> (at {replayResult.currentSigma.toFixed(2)}σ)</p>
                      </div>
                    )}
                  </div>
                </Panel>
              ) : (
                <div className="rounded-xl border border-white/10 bg-void-2/60 p-8 text-center font-mono text-regolith/50">
                  Select an alert from the inbox to inspect AI diagnostic explanation.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ADAPTATION PRIORS */}
      {activeTab === 'priors' && (
        <div className="space-y-6">
          <Panel
            title="Microgravity adaptation priors (cephalad fluid shift & vagal balance)"
            subtitle="Mission Days 1–14 Physiological Homeostasis"
            badge={<span className="rounded bg-white/10 text-regolith/80 px-2 py-0.5 text-[11px] font-mono uppercase font-bold">Illustrative</span>}
          >
            <div className="space-y-5 font-mono text-xs">
              {/* Controls Bar: Mission Day Slider & Toggle */}
              <div className="rounded-xl bg-void p-4 border border-white/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex-1 max-w-sm space-y-1">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-regolith/60 uppercase">Mission Flight Day:</span>
                    <span className="text-earth font-bold">Day {missionDay} of 14</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="14"
                    value={missionDay}
                    onChange={(e) => setMissionDay(Number(e.target.value))}
                    className="w-full accent-earth cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-regolith/70 uppercase text-[11px]">Use Adaptation Priors:</span>
                  <button
                    type="button"
                    onClick={() => setUsePriors((v) => !v)}
                    className={`rounded px-3 py-1.5 font-bold uppercase transition-colors border min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none ${
                      usePriors
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow'
                        : 'bg-mars/20 text-mars border border-mars/40'
                    }`}
                  >
                    {usePriors ? 'ON (Priors Active)' : 'OFF (Naive Baseline)'}
                  </button>
                </div>
              </div>

              {/* Adaptation Envelopes Chart */}
              <div className="h-[220px] sm:h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={ADAPTATION_ENVELOPE.map((p) => ({
                      label: p.label,
                      day: p.day,
                      hrBase: p.hrLower,
                      hrBand: p.hrUpper - p.hrLower,
                      expectedHr: p.expectedHrDelta,
                      fluidShift: p.fluidShiftIndex,
                    }))}
                    margin={{top: 10, right: 20, left: 0, bottom: 0}}
                  >
                    <XAxis dataKey="label" stroke="#8b909b" fontSize={10} />
                    <YAxis stroke="#8b909b" fontSize={10} />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="hrBase"
                      stackId="hrEnvelope"
                      stroke="transparent"
                      fill="transparent"
                      legendType="none"
                    />
                    <Area
                      type="monotone"
                      dataKey="hrBand"
                      name="Expected HR Delta Envelope (+bpm)"
                      stackId="hrEnvelope"
                      stroke="#e2704a"
                      strokeDasharray="2 2"
                      fill="#e2704a"
                      fillOpacity={0.2}
                    />
                    <Area
                      type="monotone"
                      dataKey="expectedHr"
                      name="Expected Resting HR Elevation (+bpm)"
                      stroke="#e2704a"
                      strokeWidth={2}
                      fill="transparent"
                    />
                    <Area
                      type="monotone"
                      dataKey="fluidShift"
                      name="Cephalad Fluid Shift Index (0-10)"
                      stroke="#6fb6ff"
                      strokeWidth={2}
                      fill="transparent"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Side-by-Side Dual Outcomes Comparison */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Outcome A: Benign Microgravity Adaptation */}
                <div className="rounded-lg bg-void p-4 border border-white/10 space-y-2">
                  <span className="text-white font-bold block uppercase text-xs">
                    Outcome A: Expected Microgravity Adaptation (Day {missionDay})
                  </span>
                  <p className="text-regolith/75 text-[11px]">
                    Fluid redistribution elevates resting heart rate by +{ADAPTATION_ENVELOPE[missionDay - 1]?.expectedHrDelta} bpm.
                  </p>
                  <div className="pt-1">
                    {usePriors ? (
                      <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-bold uppercase inline-block">
                        ✓ Priors ON: Normal adaptation accounted for — 0 false alerts raised.
                      </span>
                    ) : (
                      <span className="rounded bg-mars/20 text-mars border border-mars/40 px-2.5 py-1 text-[11px] font-bold uppercase inline-block animate-pulse">
                        ⚠️ Priors OFF: Static baseline exceeded &gt;3σ — False alert triggered!
                      </span>
                    )}
                  </div>
                </div>

                {/* Outcome B: Real Injected Pathological Sepsis / SPE */}
                <div className="rounded-lg bg-void p-4 border border-white/10 space-y-2">
                  <span className="text-white font-bold block uppercase text-xs">
                    Outcome B: Injected Pathological Episode (+28 bpm Tachycardia)
                  </span>
                  <p className="text-regolith/75 text-[11px]">
                    True illness exceeds both baseline and the adaptation envelope upper bound (+{ADAPTATION_ENVELOPE[missionDay - 1]?.hrUpper} bpm).
                  </p>
                  <div className="pt-1">
                    <span className="rounded bg-mars/20 text-mars border border-mars/40 px-2.5 py-1 text-[11px] font-bold uppercase inline-block">
                      🚨 True Alert Fired: Pathological deviation recognized in both modes.
                    </span>
                  </div>
                </div>
              </div>

              {/* Explicit NASA Source Requirement */}
              <div className="text-[11px] text-regolith/60 italic pt-1 border-t border-white/5">
                Illustrative curves. NASA HRP sources must be cited before any claim is made.
              </div>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}