import {useState, useEffect} from 'react';
import {useStore} from '../../store';

export function OnboardingWizard() {
  const role = useStore((s) => s.role);
  const consentAccepted = useStore((s) => s.consentAccepted);
  const onboardingCompleted = useStore((s) => s.onboardingCompleted);
  const completeOnboarding = useStore((s) => s.completeOnboarding);

  const [step, setStep] = useState<number>(() => {
    if (typeof window === 'undefined') return 1;
    const saved = localStorage.getItem('astrocare_onboarding_step');
    return saved ? parseInt(saved, 10) : 1;
  });

  // Step 1 Profile Fields
  const [age, setAge] = useState<string>('34');
  const [sex, setSex] = useState<'M' | 'F' | 'O'>('F');
  const [height, setHeight] = useState<string>('172');
  const [weight, setWeight] = useState<string>('64');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  // Step 2 Device Selection
  const [device, setDevice] = useState<'simulated' | 'camera'>('simulated');

  // Step 3 20-Second Baseline Calibration Progress
  const [baselineSec, setBaselineSec] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const saved = localStorage.getItem('astrocare_onboarding_baseline_sec');
    return saved ? Math.min(20, Math.max(0, parseInt(saved, 10))) : 0;
  });
  const [calibrating, setCalibrating] = useState(false);

  // Sync step to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('astrocare_onboarding_step', step.toString());
    } catch {
      // ignore
    }
  }, [step]);

  // Sync baselineSec to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('astrocare_onboarding_baseline_sec', baselineSec.toString());
    } catch {
      // ignore
    }
  }, [baselineSec]);

  // Step 3 20-second timer
  useEffect(() => {
    if (step !== 3) return;
    setCalibrating(true);
    const interval = setInterval(() => {
      setBaselineSec((prev) => {
        if (prev >= 20) {
          clearInterval(interval);
          setCalibrating(false);
          return 20;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  // Only show for astronaut role once consent is accepted and onboarding is not complete
  if (!consentAccepted || role !== 'astronaut' || onboardingCompleted) {
    return null;
  }

  const validateProfile = (): boolean => {
    const errs: Record<string, string> = {};
    const ageNum = parseInt(age, 10);
    const heightNum = parseInt(height, 10);
    const weightNum = parseFloat(weight);

    if (isNaN(ageNum) || ageNum < 18 || ageNum > 65) {
      errs.age = 'Age must be between 18 and 65 years.';
    }
    if (isNaN(heightNum) || heightNum < 140 || heightNum > 220) {
      errs.height = 'Height must be between 140 and 220 cm.';
    }
    if (isNaN(weightNum) || weightNum < 40 || weightNum > 150) {
      errs.weight = 'Weight must be between 40 and 150 kg.';
    }

    setProfileErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateProfile()) {
      setStep(2);
    }
  };

  const handleStep2Next = () => {
    setStep(3);
    setCalibrating(true);
  };

  const handleFinish = () => {
    completeOnboarding(
      {
        age: parseInt(age, 10) || 34,
        sex,
        height: parseInt(height, 10) || 172,
        weight: parseFloat(weight) || 64,
      },
      device
    );
  };

  const handleSkip = () => {
    completeOnboarding(
      {age: 34, sex: 'F', height: 172, weight: 64},
      'simulated'
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-xl rounded-2xl border border-white/20 bg-void-2 p-6 sm:p-8 shadow-2xl space-y-6 font-mono text-xs">
        {/* Header & Stepper Indicators */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <span className="text-[11px] text-earth uppercase font-bold tracking-wider">
              Astronaut Telemetry Setup · Step {step} of 3
            </span>
            <h2 id="wizard-title" className="font-display text-lg text-white font-bold uppercase tracking-wider mt-0.5">
              {step === 1 && 'Personal Biometric Profile'}
              {step === 2 && 'Primary Sensor Device Choice'}
              {step === 3 && '20-Second Biometric Baseline Calibration'}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="rounded px-2.5 py-1 text-[11px] text-regolith/60 hover:text-white border border-white/10 hover:border-white/30 uppercase"
          >
            Skip for demo ⏭
          </button>
        </div>

        {/* Step Progress Dots */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                s <= step ? 'bg-earth' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {/* STEP 1: Profile Form */}
        {step === 1 && (
          <form onSubmit={handleStep1Next} className="space-y-4">
            <p className="text-regolith/75 text-xs">
              Configure baseline physical parameters for Commander Elena Vega to tune autonomic HRV and metabolic models.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="input-age" className="block text-[11px] text-regolith/60 uppercase mb-1">
                  Age (Years)
                </label>
                <input
                  id="input-age"
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full rounded bg-void border border-white/15 px-3 py-2 text-white font-mono focus:border-earth focus:outline-none min-h-[44px]"
                />
                {profileErrors.age && <p className="text-mars text-[11px] mt-1">{profileErrors.age}</p>}
              </div>

              <div>
                <label htmlFor="select-sex" className="block text-[11px] text-regolith/60 uppercase mb-1">
                  Biological Sex
                </label>
                <select
                  id="select-sex"
                  value={sex}
                  onChange={(e) => setSex(e.target.value as 'M' | 'F' | 'O')}
                  className="w-full rounded bg-void border border-white/15 px-3 py-2 text-white font-mono focus:border-earth focus:outline-none min-h-[44px]"
                >
                  <option value="F">Female (F)</option>
                  <option value="M">Male (M)</option>
                  <option value="O">Other (O)</option>
                </select>
              </div>

              <div>
                <label htmlFor="input-height" className="block text-[11px] text-regolith/60 uppercase mb-1">
                  Height (cm)
                </label>
                <input
                  id="input-height"
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full rounded bg-void border border-white/15 px-3 py-2 text-white font-mono focus:border-earth focus:outline-none min-h-[44px]"
                />
                {profileErrors.height && <p className="text-mars text-[11px] mt-1">{profileErrors.height}</p>}
              </div>

              <div>
                <label htmlFor="input-weight" className="block text-[11px] text-regolith/60 uppercase mb-1">
                  Weight (kg)
                </label>
                <input
                  id="input-weight"
                  type="number"
                  step="0.5"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full rounded bg-void border border-white/15 px-3 py-2 text-white font-mono focus:border-earth focus:outline-none min-h-[44px]"
                />
                {profileErrors.weight && <p className="text-mars text-[11px] mt-1">{profileErrors.weight}</p>}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                className="rounded-lg bg-earth px-5 py-2.5 font-bold text-void uppercase tracking-wider hover:bg-earth/90 transition-colors min-h-[48px]"
              >
                Proceed to Device Selection →
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: Device Selection */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-regolith/75 text-xs">
              Select how your biometric telemetry stream will be ingested during this session.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setDevice('simulated')}
                className={`w-full rounded-xl p-4 text-left border transition-all ${
                  device === 'simulated'
                    ? 'border-earth bg-earth/10 ring-1 ring-earth'
                    : 'border-white/10 bg-void hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">Synthetic Physiology Generator (Default)</span>
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] text-white">SIMULATED</span>
                </div>
                <p className="mt-1 text-[11px] text-regolith/70">
                  Simulates realistic Mars transit microgravity heart rate, autonomic HRV drift, and respiratory sinus arrhythmia.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setDevice('camera')}
                className={`w-full rounded-xl p-4 text-left border transition-all ${
                  device === 'camera'
                    ? 'border-earth bg-earth/10 ring-1 ring-earth'
                    : 'border-white/10 bg-void hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">Webcam Optical rPPG Pulse</span>
                  <span className="rounded bg-earth/20 text-earth border border-earth/30 px-2 py-0.5 text-[11px] font-bold">
                    REAL
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-regolith/70">
                  Measures live facial blood volume pulse using client-side green channel photoplethysmography. Zero video frames saved.
                </p>
              </button>
            </div>

            <div className="pt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-regolith/60 hover:text-white uppercase text-xs"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={handleStep2Next}
                className="rounded-lg bg-earth px-5 py-2.5 font-bold text-void uppercase tracking-wider hover:bg-earth/90 transition-colors min-h-[48px]"
              >
                Start Baseline Calibration →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: 20-Second Baseline Check */}
        {step === 3 && (
          <div className="space-y-5">
            <p className="text-regolith/75 text-xs">
              Recording 20-second resting biometric baseline to calibrate autonomous anomaly thresholds (HR, HRV RMSSD, and respiratory sinus arrhythmia).
            </p>

            {/* Circular / Linear Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white font-bold">
                  {calibrating && baselineSec < 20 ? 'Calibrating Biometrics...' : 'Calibration Complete'}
                </span>
                <span className="text-earth font-bold">{baselineSec} / 20 s</span>
              </div>
              <div className="h-3 w-full rounded-full bg-void border border-white/10 overflow-hidden">
                <div
                  style={{width: `${(baselineSec / 20) * 100}%`}}
                  className="h-full bg-gradient-to-r from-earth to-mars transition-all duration-300"
                />
              </div>
            </div>

            {/* Live Parameter Sampling Feed */}
            <div className="grid grid-cols-3 gap-3 rounded-xl bg-void p-4 border border-white/10 text-center font-mono">
              <div>
                <span className="text-[11px] text-regolith/50 uppercase block">Resting HR</span>
                <span className="text-white font-bold text-base mt-1 block">
                  {baselineSec > 4 ? '66 bpm' : 'Sampling...'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-regolith/50 uppercase block">RMSSD HRV</span>
                <span className="text-white font-bold text-base mt-1 block">
                  {baselineSec > 10 ? '64 ms' : 'Computing...'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-regolith/50 uppercase block">Respiration</span>
                <span className="text-white font-bold text-base mt-1 block">
                  {baselineSec > 15 ? '14 br/min' : 'Sampling...'}
                </span>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-regolith/60 hover:text-white uppercase text-xs"
              >
                ← Back
              </button>

              <button
                type="button"
                onClick={handleFinish}
                disabled={baselineSec < 20}
                className={`rounded-lg px-6 py-2.5 font-bold uppercase tracking-wider transition-colors min-h-[48px] ${
                  baselineSec >= 20
                    ? 'bg-earth text-void hover:bg-earth/90 shadow-lg cursor-pointer'
                    : 'bg-white/10 text-regolith/40 cursor-not-allowed'
                }`}
              >
                {baselineSec >= 20 ? 'Complete & Enter Console ✓' : `Calibrating (${20 - baselineSec}s remaining)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
