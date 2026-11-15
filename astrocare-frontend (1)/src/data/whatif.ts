// Parametric curves for What-If Clinical Projections (F105)
// Illustrative projections, not validated clinical predictions.

export interface WhatIfPoint {
  day: number;
  label: string;
  restingHr: number;
  hrMin: number;
  hrMax: number;
  hrv: number;
  hrvMin: number;
  hrvMax: number;
  riskScore: number;
  riskMin: number;
  riskMax: number;
}

export interface ScenarioProjection {
  id: string;
  title: string;
  durationDays: number;
  summary: string;
  points: WhatIfPoint[];
}

export function computeWhatIfScenario(
  scenarioId: 'no_exercise' | 'co2_elevation' | 'sleep_deficit',
  baselineHr: number,
  baselineHrv: number
): ScenarioProjection {
  if (scenarioId === 'no_exercise') {
    // 14 days without exercise: progressive cardiovascular deconditioning
    const points: WhatIfPoint[] = Array.from({length: 15}, (_, day) => {
      const hrDrift = (day / 14) * 14;
      const hrvDrop = (day / 14) * 22;
      const risk = 15 + (day / 14) * 45;

      return {
        day,
        label: `Day ${day}`,
        restingHr: Math.round(baselineHr + hrDrift),
        hrMin: Math.round(baselineHr + hrDrift - 3),
        hrMax: Math.round(baselineHr + hrDrift + 5),
        hrv: Math.max(20, Math.round(baselineHrv - hrvDrop)),
        hrvMin: Math.max(15, Math.round(baselineHrv - hrvDrop - 5)),
        hrvMax: Math.max(25, Math.round(baselineHrv - hrvDrop + 4)),
        riskScore: Math.round(risk),
        riskMin: Math.max(10, Math.round(risk - 6)),
        riskMax: Math.min(100, Math.round(risk + 8)),
      };
    });

    return {
      id: 'no_exercise',
      title: 'No exercise for 14 days',
      durationDays: 14,
      summary:
        'Plasma volume contraction and autonomic tone decay lead to resting tachycardia (+14 bpm) and vagal withdrawal (-35% HRV). Orthostatic intolerance risks surge.',
      points,
    };
  }

  if (scenarioId === 'co2_elevation') {
    // 3 days sustained at 2500 ppm CO2 (72 hours, shown in 6-hour intervals)
    const points: WhatIfPoint[] = Array.from({length: 13}, (_, idx) => {
      const hour = idx * 6;
      const dayFraction = hour / 24;
      const hrDrift = Math.min(12, Math.sin(dayFraction) * 4 + dayFraction * 3.5);
      const hrvDrop = Math.min(26, dayFraction * 8.5);
      const risk = Math.min(78, 20 + dayFraction * 18);

      return {
        day: +dayFraction.toFixed(1),
        label: `T+${hour}h`,
        restingHr: Math.round(baselineHr + hrDrift),
        hrMin: Math.round(baselineHr + hrDrift - 4),
        hrMax: Math.round(baselineHr + hrDrift + 4),
        hrv: Math.max(18, Math.round(baselineHrv - hrvDrop)),
        hrvMin: Math.max(14, Math.round(baselineHrv - hrvDrop - 6)),
        hrvMax: Math.max(22, Math.round(baselineHrv - hrvDrop + 5)),
        riskScore: Math.round(risk),
        riskMin: Math.max(12, Math.round(risk - 5)),
        riskMax: Math.min(100, Math.round(risk + 7)),
      };
    });

    return {
      id: 'co2_elevation',
      title: 'CO2 held at 2500 ppm for 3 days',
      durationDays: 3,
      summary:
        'Chronic hypercapnic respiratory compensation induces persistent cerebral vasodilation, mild respiratory acidosis, headache burden, and sympathetic activation.',
      points,
    };
  }

  // Sleep 5h for 7 days
  const points: WhatIfPoint[] = Array.from({length: 8}, (_, day) => {
    const hrDrift = (day / 7) * 9;
    const hrvDrop = (day / 7) * 18;
    const risk = 18 + (day / 7) * 38;

    return {
      day,
      label: `Day ${day}`,
      restingHr: Math.round(baselineHr + hrDrift),
      hrMin: Math.round(baselineHr + hrDrift - 3),
      hrMax: Math.round(baselineHr + hrDrift + 4),
      hrv: Math.max(22, Math.round(baselineHrv - hrvDrop)),
      hrvMin: Math.max(18, Math.round(baselineHrv - hrvDrop - 4)),
      hrvMax: Math.max(26, Math.round(baselineHrv - hrvDrop + 5)),
      riskScore: Math.round(risk),
      riskMin: Math.max(10, Math.round(risk - 4)),
      riskMax: Math.min(100, Math.round(risk + 6)),
    };
  });

  return {
    id: 'sleep_deficit',
    title: 'Sleep 5 h for 7 days',
    durationDays: 7,
    summary:
      'Cumulative sleep debt leads to allostatic autonomic load, impaired cognitive vigilance response, and blunted baroreceptor sensitivity.',
    points,
  };
}
