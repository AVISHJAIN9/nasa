import {useState} from 'react';
import {PageHeader} from '../ui';

interface RoadmapItem {
  id: string;
  title: string;
  summary: string;
  area: 'Monitoring' | 'Emergency' | 'Wellness' | 'Analytics' | 'Operations';
}

const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    id: 'rm-1',
    title: 'EVA Readiness Check',
    summary: 'Autonomous pre-breathe decompression sickness risk assessment and biometric clearance verification prior to airlock depressurization.',
    area: 'Monitoring',
  },
  {
    id: 'rm-2',
    title: 'EVA Live Monitoring',
    summary: 'Suit pressure telemetry, metabolic rate calculation, liquid cooling garment garment sensor ingestion, and CO2 washout surveillance.',
    area: 'Monitoring',
  },
  {
    id: 'rm-3',
    title: 'Sleep Tracking',
    summary: 'Continuous polysomnography proxy combining micro-accelerometry and ECG R-R interval analysis for microgravity sleep staging.',
    area: 'Wellness',
  },
  {
    id: 'rm-4',
    title: 'Circadian Model',
    summary: 'Two-process mathematical sleep-wake model factoring melanopic lux light exposure, core body temperature rhythm, and phase-delay shifts.',
    area: 'Wellness',
  },
  {
    id: 'rm-5',
    title: 'Bone and Muscle Estimator',
    summary: 'Kinematic workload integration forecasting trabecular bone mineral density demineralization and postural calf muscle atrophy rates.',
    area: 'Analytics',
  },
  {
    id: 'rm-6',
    title: 'Radiation Health-Risk Bands',
    summary: 'Real-time linear energy transfer (LET) spectrum integration modeling stochastic oncogenic and acute central nervous system risk percentiles.',
    area: 'Analytics',
  },
  {
    id: 'rm-7',
    title: 'Digital Twin',
    summary: 'High-fidelity in-silico cardiovascular hemodynamic avatar parameterized by personalized pre-flight ground testing data.',
    area: 'Analytics',
  },
  {
    id: 'rm-8',
    title: 'Voice Symptom Logging',
    summary: 'Edge acoustic speech biomarker analysis detecting microgravity vocal tract shifts, dysarthria, fatigue, and cognitive load indicators.',
    area: 'Monitoring',
  },
  {
    id: 'rm-9',
    title: 'Cognitive Tests',
    summary: 'Spaceflight 3-minute Cognition battery: psychomotor vigilance, spatial working memory, and dual-task visual search scoring.',
    area: 'Wellness',
  },
  {
    id: 'rm-10',
    title: 'Wound Photo Log',
    summary: 'Stereoscopic computer vision wound assessment: erythema boundary tracking, epithelialization rate, and infection risk staging.',
    area: 'Monitoring',
  },
  {
    id: 'rm-11',
    title: 'Triage Priority Board',
    summary: 'Multi-casualty situational triage optimization engine under comms-outage scenarios with consumable-constrained prioritization.',
    area: 'Emergency',
  },
  {
    id: 'rm-12',
    title: 'Abort and Evacuation Options',
    summary: 'Autonomous orbital flight dynamic trajectory solver evaluating ballistic return windows vs onboard surgical stabilization.',
    area: 'Emergency',
  },
  {
    id: 'rm-13',
    title: 'Emergency Drill Mode',
    summary: 'Simulated high-stress clinical contingencies (cardiac arrest, cabin hypoxia) for in-flight crew procedural re-currency training.',
    area: 'Emergency',
  },
  {
    id: 'rm-14',
    title: 'Nutrition Planner',
    summary: 'Dynamic metabolic macro- and micronutrient demand balancing based on real-time ergometer caloric expenditure and fluid turnover.',
    area: 'Wellness',
  },
  {
    id: 'rm-15',
    title: 'Exercise Prescription',
    summary: 'Autonomously adapted high-intensity interval training (HIIT) load schedules to counter individual rate of bone demineralization.',
    area: 'Wellness',
  },
  {
    id: 'rm-16',
    title: 'Pose Rep Counting',
    summary: 'On-device optical computer vision tracking joint kinematics, range of motion, and rep completion on the advanced resistive device.',
    area: 'Operations',
  },
  {
    id: 'rm-17',
    title: 'Team Dynamics Monitor',
    summary: 'Non-invasive sociometric interaction clustering and sentiment cadence tracking to forecast small-crew psychosocial friction points.',
    area: 'Operations',
  },
  {
    id: 'rm-18',
    title: 'Cohort Analytics',
    summary: 'Multi-crew comparative statistical distributions identifying baseline population outliers and latent environmental hazards.',
    area: 'Analytics',
  },
  {
    id: 'rm-19',
    title: 'Auto Incident Report',
    summary: 'Automated flight surgeon debrief packet compiler summarizing telemetry timelines, diagnostic triggers, interventions, and outcomes.',
    area: 'Operations',
  },
  {
    id: 'rm-20',
    title: 'Consumables Forecast',
    summary: 'Predictive inventory depletion model tracking pharmaceuticals, surgical dressings, and life-support gas reserves across transit days.',
    area: 'Operations',
  },
];

type AreaFilter = 'All' | 'Monitoring' | 'Emergency' | 'Wellness' | 'Analytics' | 'Operations';

export function Roadmap() {
  const [filter, setFilter] = useState<AreaFilter>('All');

  const filteredItems = filter === 'All'
    ? ROADMAP_ITEMS
    : ROADMAP_ITEMS.filter((item) => item.area === filter);

  const filterOptions: AreaFilter[] = [
    'All',
    'Monitoring',
    'Emergency',
    'Wellness',
    'Analytics',
    'Operations',
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tier 3 Architectural Scoping"
        title="System capabilities & flight readiness roadmap"
        description="Documented and scoped, not built in this prototype."
        actions={
          <span className="rounded bg-white/10 px-3 py-1 font-mono text-xs text-regolith/80">
            {filteredItems.length} of {ROADMAP_ITEMS.length} Capabilities
          </span>
        }
      />

      {/* Area Filter Chips */}
      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <span className="text-regolith/60 uppercase mr-1 text-[11px]">Domain Filter:</span>
        {filterOptions.map((area) => {
          const isSelected = filter === area;
          return (
            <button
              key={area}
              type="button"
              onClick={() => setFilter(area)}
              className={`rounded px-3 py-2 uppercase font-medium border transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-earth focus-visible:outline-none ${
                isSelected
                  ? 'bg-earth text-void border-earth shadow-sm'
                  : 'bg-void text-regolith/75 border-white/10 hover:border-white/20 hover:text-white'
              }`}
            >
              {area}
            </button>
          );
        })}
      </div>

      {/* Grid of 20 Planned Features */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="rounded-lg bg-void-2/70 border border-white/10 p-5 space-y-2.5 flex flex-col justify-between hover:border-white/20 transition-colors"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-white/10 text-earth px-2 py-0.5 font-mono text-[11px] font-bold uppercase">
                  {item.area}
                </span>
                <span className="rounded bg-white/5 border border-white/15 px-2 py-0.5 font-mono text-[11px] text-regolith/60 font-semibold uppercase">
                  Planned
                </span>
              </div>
              <h3 className="font-display text-sm font-semibold text-white tracking-wide">
                {item.title}
              </h3>
              <p className="text-xs text-regolith/80 leading-relaxed">
                {item.summary}
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between font-mono text-[11px] text-regolith/50">
              <span>Deep-Space Target: L3 Autonomous</span>
              <span>TRL 4-5</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
