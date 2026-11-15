import {useState, useEffect} from 'react';
import {useStore, type SoapNote} from '../../store';
import {Panel, PageHeader} from '../ui';

export function Notes() {
  const role = useStore((s) => s.role);
  const crew = useStore((s) => s.crew);
  const selectedCrewId = useStore((s) => s.selectedCrewId);
  const setSelectedCrewId = useStore((s) => s.setSelectedCrewId);
  const medicalOfficerCrewId = useStore((s) => s.medicalOfficerCrewId);
  const notes = useStore((s) => s.notes);
  const saveNote = useStore((s) => s.saveNote);
  const restoreNoteVersion = useStore((s) => s.restoreNoteVersion);
  const draftSoapTemplate = useStore((s) => s.draftSoapTemplate);

  // Active crew selection
  const [activeCrewId, setActiveCrewId] = useState<string>(selectedCrewId || crew[0]?.id || 'vega');

  // Can the current user edit notes?
  // Write actions only for surgeon or medical officer (F066 / Batch D Nav)
  const isMedicalOfficer = role === 'astronaut' && medicalOfficerCrewId === 'vega';
  const canEdit = role === 'surgeon' || isMedicalOfficer;

  // Local SOAP draft state
  const [soap, setSoap] = useState<SoapNote>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync draft from latest saved note or blank when crew changes
  useEffect(() => {
    const crewNotes = notes[activeCrewId] || [];
    if (crewNotes.length > 0) {
      setSoap({
        subjective: crewNotes[0].subjective,
        objective: crewNotes[0].objective,
        assessment: crewNotes[0].assessment,
        plan: crewNotes[0].plan,
      });
    } else {
      // Initialize with drafted template if empty
      const draft = draftSoapTemplate(activeCrewId);
      setSoap(draft);
    }
  }, [activeCrewId, notes, draftSoapTemplate]);

  const handleDraftClick = () => {
    const draft = draftSoapTemplate(activeCrewId);
    setSoap(draft);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    const authorName = role === 'surgeon' ? 'Dr. Priya Nair (Houston)' : 'Elena Vega (CMO)';
    saveNote(activeCrewId, authorName, soap.subjective, soap.objective, soap.assessment, soap.plan);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const crewVersions = notes[activeCrewId] || [];
  const activeMember = crew.find((c) => c.id === activeCrewId) || crew[0];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="F099 CLINICAL DOCUMENTATION"
        title="SOAP clinical encounter notes"
        description="Structured subjective, objective, assessment, and plan documentation with deterministic telemetry synthesis and immutable version tracking."
        actions={
          canEdit ? (
            <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1 font-mono text-xs font-bold uppercase">
              ✍️ Write Enabled ({role === 'surgeon' ? 'Dr. Priya Nair' : 'Elena Vega CMO'})
            </span>
          ) : (
            <span className="rounded bg-white/10 text-regolith/70 border border-white/15 px-3 py-1 font-mono text-xs font-bold uppercase">
              👁️ Read Only (Surgeon / CMO Required)
            </span>
          )
        }
      />

      {/* Crew Selector Buttons */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="text-regolith/60 uppercase mr-1">Select Patient:</span>
        {crew.map((c) => {
          const isSel = c.id === activeCrewId;
          const isCmo = medicalOfficerCrewId === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setActiveCrewId(c.id);
                setSelectedCrewId(c.id);
              }}
              className={`rounded px-3 py-1.5 uppercase font-bold border transition-colors flex items-center gap-2 min-h-[44px] ${
                isSel
                  ? 'bg-earth text-void border-earth shadow'
                  : 'bg-void text-regolith/75 border-white/15 hover:border-white/30 hover:text-white'
              }`}
            >
              <span>{c.name}</span>
              {isCmo && <span className="text-[11px] bg-mars/30 text-mars px-1 rounded">CMO</span>}
            </button>
          );
        })}
      </div>

      {/* Main Grid: Form on Left, Version History on Right */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Panel
            title={`SOAP Chart — ${activeMember.name} (${activeMember.roleTitle})`}
            rightAction={
              canEdit ? (
                <button
                  type="button"
                  onClick={handleDraftClick}
                  className="rounded bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 font-mono text-xs text-white uppercase transition-colors"
                >
                  ⚡ Draft from Telemetry
                </button>
              ) : undefined
            }
          >
            <form onSubmit={handleSave} className="space-y-4 font-mono text-xs">
              {!canEdit && (
                <div className="rounded-lg bg-void border border-white/15 p-3 text-regolith/70 text-xs">
                  Read-only view. Write actions are restricted to Ground Flight Surgeon or the designated Crew Medical Officer.
                </div>
              )}

              {/* Subjective */}
              <div className="space-y-1">
                <label className="block text-white font-bold uppercase text-[11px]">
                  Subjective (S) — Crew Reported Symptoms & History
                </label>
                <textarea
                  rows={3}
                  value={soap.subjective}
                  disabled={!canEdit}
                  onChange={(e) => setSoap({...soap, subjective: e.target.value})}
                  className="w-full rounded bg-void border border-white/15 p-3 text-white focus:border-earth focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                  placeholder="Patient report, self-checks, pain description, sleep quality..."
                />
              </div>

              {/* Objective */}
              <div className="space-y-1">
                <label className="block text-white font-bold uppercase text-[11px]">
                  Objective (O) — Measured Vitals & Sensor Telemetry
                </label>
                <textarea
                  rows={4}
                  value={soap.objective}
                  disabled={!canEdit}
                  onChange={(e) => setSoap({...soap, objective: e.target.value})}
                  className="w-full rounded bg-void border border-white/15 p-3 text-white focus:border-earth focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                  placeholder="Vitals vs baseline, heart rate, SpO2, core temp, active alerts..."
                />
              </div>

              {/* Assessment */}
              <div className="space-y-1">
                <label className="block text-white font-bold uppercase text-[11px]">
                  Assessment (A) — Clinical Impression & Differential
                </label>
                <textarea
                  rows={3}
                  value={soap.assessment}
                  disabled={!canEdit}
                  onChange={(e) => setSoap({...soap, assessment: e.target.value})}
                  className="w-full rounded bg-void border border-white/15 p-3 text-white focus:border-earth focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                  placeholder="Etiology, risk tier, syndrome matching..."
                />
              </div>

              {/* Plan */}
              <div className="space-y-1">
                <label className="block text-white font-bold uppercase text-[11px]">
                  Plan (P) — Medical Countermeasures & Diagnostics
                </label>
                <textarea
                  rows={3}
                  value={soap.plan}
                  disabled={!canEdit}
                  onChange={(e) => setSoap({...soap, plan: e.target.value})}
                  className="w-full rounded bg-void border border-white/15 p-3 text-white focus:border-earth focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                  placeholder="Orders, medications, exercise modifications, follow-up..."
                />
              </div>

              {/* Save Button */}
              {canEdit && (
                <div className="flex items-center justify-between pt-2">
                  <div>
                    {savedSuccess && (
                      <span className="text-emerald-400 font-bold">
                        ✓ Note version committed to immutable ledger!
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-earth px-6 py-2.5 font-bold uppercase text-void hover:bg-earth/90 transition-colors shadow min-h-[44px]"
                  >
                    Commit New Note Version →
                  </button>
                </div>
              )}
            </form>
          </Panel>
        </div>

        {/* Right Col: Version History */}
        <div className="space-y-6">
          <Panel title="Version History">
            <div className="space-y-3 font-mono text-xs">
              {crewVersions.length === 0 ? (
                <p className="text-regolith/50 text-[11px]">No prior revisions recorded for this crew member.</p>
              ) : (
                crewVersions.map((v, idx) => (
                  <div
                    key={v.version}
                    className="rounded-lg bg-void p-3.5 border border-white/10 space-y-2 hover:border-white/25 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">
                        {idx === 0 ? 'Current Revision' : `v${v.version}`}
                      </span>
                      <span className="text-[11px] text-regolith/60">{v.timeStr}</span>
                    </div>
                    <div className="text-[11px] text-earth">Author: {v.author}</div>
                    <p className="text-[11px] text-regolith/75 line-clamp-2">
                      {v.assessment || v.subjective}
                    </p>
                    {canEdit && idx !== 0 && (
                      <button
                        type="button"
                        onClick={() => restoreNoteVersion(activeCrewId, v.version)}
                        className="rounded bg-white/10 px-2.5 py-1 text-[11px] font-bold uppercase text-white hover:bg-white/20"
                      >
                        ↩ Restore This Version
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
