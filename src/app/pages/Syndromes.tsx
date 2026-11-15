import {useState} from 'react';
import {useStore} from '../../store';
import {Panel, PageHeader} from '../ui';

export function Syndromes() {
  const crew = useStore((s) => s.crew);
  const selectedCrewId = useStore((s) => s.selectedCrewId);
  const setSelectedCrewId = useStore((s) => s.setSelectedCrewId);
  const visionLogs = useStore((s) => s.visionLogs);
  const painLogs = useStore((s) => s.painLogs);
  const moodLogs = useStore((s) => s.moodLogs);

  const [activeCrewId, setActiveCrewId] = useState<string>(selectedCrewId || crew[0]?.id || 'vega');
  const targetMember = crew.find((c) => c.id === activeCrewId) || crew[0];

  // Store data lookups for risk score calculation
  const memberVision = visionLogs.find((v) => v.crewId === activeCrewId);
  const memberPain = painLogs.find((p) => p.crewId === activeCrewId);
  const memberMood = moodLogs.find((m) => m.crewId === activeCrewId);

  const hrStream = targetMember.readings.hr;
  const hrvStream = targetMember.readings.hrv;
  const currentHr = hrStream[hrStream.length - 1]?.value ?? targetMember.baseline.hr;
  const currentHrv = hrvStream[hrStream.length - 1]?.value ?? targetMember.baseline.hrv;

  const hrDrift = Math.max(0, currentHr - targetMember.baseline.hr);
  const hrvDrop = Math.max(0, targetMember.baseline.hrv - currentHrv);

  // 1. SANS Risk Computation
  const acuityDrop = memberVision ? Math.max(0, 1.0 - memberVision.acuityScore) : 0;
  const amslerCount = memberVision?.amslerDistortions ?? 0;
  const headPain = memberPain?.areas.some((a) => a.regionId.includes('head')) ? 15 : 0;
  const sansScore = Math.min(100, Math.round(acuityDrop * 60 + amslerCount * 12 + headPain + 12));

  // 2. Space Motion Sickness (SMS) Risk Computation
  const moodAnxiety = memberMood ? memberMood.gadScore * 6 : 0;
  const neckPain = memberPain?.areas.some((a) => a.regionId.includes('neck')) ? 15 : 0;
  const smsScore = Math.min(100, Math.round(18 + moodAnxiety + neckPain));

  // 3. Venous Thrombosis Risk (VTE / IJV Stasis) Computation
  const vteScore = Math.min(100, Math.round(22 + (hrvDrop > 8 ? 16 : 0) + (hrDrift > 10 ? 12 : 0)));

  // 4. Kidney Stones (Nephrolithiasis) Computation
  const lumbarPain = memberPain?.areas.some((a) => a.regionId === 'lumbar_spine' || a.regionId === 'pelvis') ? 22 : 0;
  const stonesScore = Math.min(100, Math.round(15 + lumbarPain + (hrDrift > 6 ? 10 : 0)));

  // 5. Cardiovascular Deconditioning Computation
  const cardioScore = Math.min(100, Math.round(18 + hrDrift * 2.2 + hrvDrop * 1.5));

  const syndromesList = [
    {
      id: 'sans',
      name: 'SANS (Spaceflight-Associated Neuro-ocular Syndrome)',
      score: sansScore,
      indicators: [
        `Visual acuity: ${memberVision ? memberVision.acuityScore : '1.0'}`,
        `Amsler grid metamorphopsia: ${amslerCount} distorted quadrant(s)`,
        headPain > 0 ? 'Cranial pain reported' : 'No cranial discomfort',
      ],
      nasaRef: 'NASA HRP evidence report: citation to be added',
    },
    {
      id: 'sms',
      name: 'Space Motion Sickness (Neurovestibular Adaptation)',
      score: smsScore,
      indicators: [
        'Vestibulo-ocular reflex conflict',
        `Anxiety/autonomic tension: GAD ${memberMood?.gadScore ?? 0}/6`,
        neckPain > 0 ? 'Cervical stiffness noted' : 'Cervical range nominal',
      ],
      nasaRef: 'NASA HRP evidence report: citation to be added',
    },
    {
      id: 'vte',
      name: 'Venous Thromboembolism & Jugular Stasis (VTE)',
      score: vteScore,
      indicators: [
        'Cephalad microgravity fluid shift',
        `Internal jugular vein flow stasis risk index: ${vteScore > 40 ? 'Elevated' : 'Nominal'}`,
        `Autonomic tone: HRV ${Math.round(currentHrv)} ms`,
      ],
      nasaRef: 'NASA HRP evidence report: citation to be added',
    },
    {
      id: 'stones',
      name: 'Nephrolithiasis (Renal Calculi Formation)',
      score: stonesScore,
      indicators: [
        'Bone demineralization microgravity hypercalciuria',
        lumbarPain > 0 ? 'Flank / Lumbar spine pain reported' : 'No flank discomfort',
        'Hydration turnover tracking required',
      ],
      nasaRef: 'NASA HRP evidence report: citation to be added',
    },
    {
      id: 'cardio',
      name: 'Cardiovascular Orthostatic Deconditioning',
      score: cardioScore,
      indicators: [
        `Resting HR drift: +${Math.round(hrDrift)} bpm over baseline`,
        `Parasympathetic vagal withdrawal: -${Math.round(hrvDrop)} ms HRV`,
        'Plasma volume reduction & stroke volume decrease',
      ],
      nasaRef: 'NASA HRP evidence report: citation to be added',
    },
  ];

  const getTrafficLight = (score: number) => {
    if (score >= 60) {
      return (
        <span className="rounded bg-mars/20 text-mars border border-mars/40 px-2 py-0.5 text-[11px] font-bold uppercase flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-mars animate-pulse" />
          High Risk ({score})
        </span>
      );
    }
    if (score >= 35) {
      return (
        <span className="rounded bg-[#e0b03a]/20 text-[#e0b03a] border border-[#e0b03a]/40 px-2 py-0.5 text-[11px] font-bold uppercase flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-[#e0b03a]" />
          Moderate ({score})
        </span>
      );
    }
    return (
      <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-bold uppercase flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-emerald-400" />
        Low / Watch ({score})
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="F046 PATHOLOGY SURVEILLANCE"
        title="Deep-space syndrome risk matrix"
        description="Continuous multi-factorial scoring for spaceflight clinical syndromes, combining sensor streams, behavioral logs, vision self-checks, and anatomical pain reports."
      />

      {/* Crew Selector */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="text-regolith/60 uppercase mr-1">Select Crew Member:</span>
        {crew.map((c) => {
          const isSel = c.id === activeCrewId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setActiveCrewId(c.id);
                setSelectedCrewId(c.id);
              }}
              className={`rounded px-3 py-1.5 uppercase font-bold border transition-colors min-h-[44px] ${
                isSel
                  ? 'bg-earth text-void border-earth shadow'
                  : 'bg-void text-regolith/75 border-white/15 hover:border-white/30 hover:text-white'
              }`}
            >
              {c.name} · {c.roleTitle}
            </button>
          );
        })}
      </div>

      {/* Syndrome Table */}
      <Panel
        title={`Space syndromes surveillance matrix — ${targetMember.name}`}
        badge={<span className="rounded bg-white/10 text-regolith/80 px-2 py-0.5 text-[11px] font-mono uppercase font-bold">Illustrative</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-white/10 text-regolith/50 uppercase text-[11px]">
                <th className="py-3 px-3">Syndrome</th>
                <th className="py-3 px-4">Physiological Indicators & Telemetry Inputs</th>
                <th className="py-3 px-3 text-right">Risk Score</th>
                <th className="py-3 px-3 text-right">Status Tier</th>
                <th className="py-3 px-3">Clinical Reference Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {syndromesList.map((s) => (
                <tr key={s.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-3 font-bold text-white max-w-xs">
                    {s.name}
                  </td>
                  <td className="py-3.5 px-4 text-regolith/80 text-xs">
                    <ul className="space-y-1">
                      {s.indicators.map((ind, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="text-earth">•</span>
                          <span>{ind}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="py-3.5 px-3 text-right font-display text-sm font-bold">
                    {s.score} / 100
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    {getTrafficLight(s.score)}
                  </td>
                  <td className="py-3.5 px-3 text-regolith/50 text-[11px] italic whitespace-nowrap">
                    {s.nasaRef}
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
