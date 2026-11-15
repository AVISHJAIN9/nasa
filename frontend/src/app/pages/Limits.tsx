import {useStore} from '../../store';
import {Panel, PageHeader} from '../ui';

export function Limits() {
  const crew = useStore((s) => s.crew);

  // Compute live provenance shares across all crew metric streams (REAL vs SIMULATED)
  let realCount = 0;
  let simulatedCount = 0;

  crew.forEach((c) => {
    Object.values(c.readings).forEach((stream) => {
      stream.forEach((r) => {
        if (r.provenance === 'REAL') realCount++;
        else simulatedCount++;
      });
    });
  });

  const total = realCount + simulatedCount || 1;
  const realPct = +((realCount / total) * 100).toFixed(1);
  const simPct = +((simulatedCount / total) * 100).toFixed(1);

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        eyebrow="R01 OPERATIONAL BOUNDARIES"
        title="System limits, regulatory stance & ethics"
        description="Explicit boundary disclosure: AstroCare is an Earth-independent clinical decision-support prototype. It is not an FDA-cleared diagnostic device."
      />

      {/* Live Data-Source Share Bar */}
      <Panel title="Live Telemetry Provenance Share">
        <div className="space-y-3 font-mono text-xs">
          <div className="flex justify-between items-baseline">
            <span className="text-regolith/60 uppercase">Active Buffer Stream Composition</span>
            <span className="text-white font-bold">{total.toLocaleString()} Data Points</span>
          </div>

          <div className="h-4 w-full rounded overflow-hidden flex bg-white/5 border border-white/10">
            <div
              style={{width: `${realPct}%`}}
              className="bg-earth transition-all duration-500"
              title={`REAL: ${realPct}%`}
            />
            <div
              style={{width: `${simPct}%`}}
              className="bg-white/20 transition-all duration-500"
              title={`SIMULATED: ${simPct}%`}
            />
          </div>

          <div className="flex flex-wrap gap-6 pt-1 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-earth" />
              <span className="text-white font-bold">{realPct}% REAL</span>
              <span className="text-regolith/50">(Camera rPPG live on Vega)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-white/30" />
              <span className="text-white font-bold">{simPct}% SIMULATED</span>
              <span className="text-regolith/50">(Synthetic physiology generator)</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Structured Ethics & Limitations Disclosures */}
      <div className="space-y-6 text-xs text-regolith/85 leading-relaxed font-sans">
        <div className="rounded-lg bg-void-2 p-6 border border-white/10 space-y-2">
          <h3 className="font-display text-sm text-white uppercase font-bold">1. What is Real vs What is Simulated</h3>
          <p>
            Vega's heart rate stream can be captured from your device's webcam using optical photoplethysmography (rPPG).
          </p>
          <p>
            All other vital parameters (SpO2, core temperature, arterial pressure, respiration, and HRV) and crew members are mathematically simulated models.
          </p>
          <p>
            Cabin environmental readouts (CO2, O2, ionizing flux) are generated from life-support differential equations.
          </p>
        </div>

        <div className="rounded-lg bg-void-2 p-6 border border-white/10 space-y-2">
          <h3 className="font-display text-sm text-white uppercase font-bold">2. What is Not Validated</h3>
          <p>
            Optical pulse measurement has not been validated across diverse skin pigmentation tones or motion artifacts in zero-gravity.
          </p>
          <p>
            SHAP diagnostic weighting factors are illustrative algorithmic outputs and have not been validated against blinded board-certified flight surgeons.
          </p>
        </div>

        <div className="rounded-lg bg-void-2 p-6 border border-white/10 space-y-2">
          <h3 className="font-display text-sm text-white uppercase font-bold">3. No Medical Diagnosis Claims</h3>
          <p>
            AstroCare does not diagnose, treat, cure, or prevent any human disease or acute trauma.
          </p>
          <p>
            All recommendations are decision-support aids designed for extreme communication latency environments where terrestrial telemedicine is physically inaccessible.
          </p>
        </div>

        <div className="rounded-lg bg-void-2 p-6 border border-white/10 space-y-2">
          <h3 className="font-display text-sm text-white uppercase font-bold">4. Camera Data Processed Entirely Locally</h3>
          <p>
            Zero video frames or raw images are saved to disk, uploaded to cloud servers, or transmitted across network connections.
          </p>
          <p>
            Mean green channel luminescence extraction executes synchronously in the client browser's WebGL / Canvas context and is discarded immediately after sampling.
          </p>
        </div>

        <div className="rounded-lg bg-void-2 p-6 border border-white/10 space-y-2">
          <h3 className="font-display text-sm text-white uppercase font-bold">5. Model Limits & Degradation Boundaries</h3>
          <p>
            When sensors report flatline artifacts or high drift, the system watchdog automatically disengages machine learning models.
          </p>
          <p>
            Failsafe deterministic threshold rules remain operational even when AI confidence drops below baseline reliability.
          </p>
        </div>

        <div className="rounded-lg bg-void-2 p-6 border border-white/10 space-y-2">
          <h3 className="font-display text-sm text-white uppercase font-bold">6. Intended Use Definition</h3>
          <p className="font-mono text-white text-xs">
            "A decision-support prototype for deep-space crews. Not a medical device."
          </p>
          <p>
            Intended exclusively for operational flight concept evaluation and multi-agent latency research during simulated interplanetary transit missions.
          </p>
        </div>

        <div className="rounded-lg bg-void-2 p-6 border border-white/10 space-y-2">
          <h3 className="font-display text-sm text-white uppercase font-bold">7. Dataset Licences & Attribution</h3>
          <p>
            Planned datasets: PhysioNet MMASH and NASA OSDR Inspiration4. Not yet integrated. Licence and source will be recorded per file before use.
          </p>
          <p className="text-[11px] text-regolith/70 pt-2 border-t border-white/5">
            3D model: Z-Anatomy and BodyParts3D, CC BY-SA. Modified.
          </p>
        </div>
      </div>
    </div>
  );
}
