// Microgravity Cephalad Fluid Shift & Cardiovascular Adaptation Priors (X03)
// Illustrative curves. NASA HRP sources must be cited before any claim is made.

export interface AdaptationPoint {
  day: number;
  label: string;
  expectedHrDelta: number; // expected resting HR elevation due to fluid redistribution
  hrLower: number;
  hrUpper: number;
  fluidShiftIndex: number; // 0 to 10 scale representing headward fluid shift
  fluidLower: number;
  fluidUpper: number;
  notes: string;
}

export const ADAPTATION_ENVELOPE: AdaptationPoint[] = [
  {day: 1, label: 'Day 1', expectedHrDelta: 6, hrLower: 2, hrUpper: 10, fluidShiftIndex: 8.2, fluidLower: 6.5, fluidUpper: 9.5, notes: 'Acute headward fluid surge (~1.5-2L shift), facial edema, space motion sickness onset.'},
  {day: 2, label: 'Day 2', expectedHrDelta: 8, hrLower: 4, hrUpper: 12, fluidShiftIndex: 8.8, fluidLower: 7.0, fluidUpper: 9.8, notes: 'Peak central blood volume congestion; Gauer-Henry reflex triggered, diuresis initiated.'},
  {day: 3, label: 'Day 3', expectedHrDelta: 7, hrLower: 3, hrUpper: 11, fluidShiftIndex: 8.0, fluidLower: 6.5, fluidUpper: 9.0, notes: 'Plasma volume contraction begins (~10-15% reduction in circulating volume).'},
  {day: 4, label: 'Day 4', expectedHrDelta: 6, hrLower: 2, hrUpper: 9, fluidShiftIndex: 7.2, fluidLower: 5.8, fluidUpper: 8.2, notes: 'Vestibular neurovestibular adaptation progressing; acute nausea subsides.'},
  {day: 5, label: 'Day 5', expectedHrDelta: 5, hrLower: 1, hrUpper: 8, fluidShiftIndex: 6.5, fluidLower: 5.2, fluidUpper: 7.6, notes: 'Red blood cell mass begins erythropoietin-mediated downregulation.'},
  {day: 6, label: 'Day 6', expectedHrDelta: 4, hrLower: 1, hrUpper: 7, fluidShiftIndex: 6.0, fluidLower: 4.8, fluidUpper: 7.0, notes: 'New plasma volume set point reached. Resting cardiovascular tone stabilizing.'},
  {day: 7, label: 'Day 7', expectedHrDelta: 3, hrLower: 0, hrUpper: 6, fluidShiftIndex: 5.5, fluidLower: 4.2, fluidUpper: 6.5, notes: 'End of acute adaptation phase. Stable microgravity homeostatic envelope.'},
  {day: 8, label: 'Day 8', expectedHrDelta: 3, hrLower: 0, hrUpper: 5, fluidShiftIndex: 5.2, fluidLower: 4.0, fluidUpper: 6.2, notes: 'Sustained microgravity equilibrium. Baseline shift normalized.'},
  {day: 9, label: 'Day 9', expectedHrDelta: 2, hrLower: -1, hrUpper: 5, fluidShiftIndex: 5.0, fluidLower: 3.8, fluidUpper: 6.0, notes: 'Exercise countermeasures become primary determinant of tone.'},
  {day: 10, label: 'Day 10', expectedHrDelta: 2, hrLower: -1, hrUpper: 5, fluidShiftIndex: 4.8, fluidLower: 3.6, fluidUpper: 5.8, notes: 'Chronic SANS surveillance begins.'},
  {day: 11, label: 'Day 11', expectedHrDelta: 2, hrLower: -1, hrUpper: 4, fluidShiftIndex: 4.7, fluidLower: 3.5, fluidUpper: 5.7, notes: 'Stable autonomic state.'},
  {day: 12, label: 'Day 12', expectedHrDelta: 1, hrLower: -2, hrUpper: 4, fluidShiftIndex: 4.6, fluidLower: 3.4, fluidUpper: 5.6, notes: 'Stable autonomic state.'},
  {day: 13, label: 'Day 13', expectedHrDelta: 1, hrLower: -2, hrUpper: 4, fluidShiftIndex: 4.5, fluidLower: 3.3, fluidUpper: 5.5, notes: 'Stable autonomic state.'},
  {day: 14, label: 'Day 14', expectedHrDelta: 1, hrLower: -2, hrUpper: 4, fluidShiftIndex: 4.5, fluidLower: 3.2, fluidUpper: 5.5, notes: 'Full short-term adaptation established. Future deviations represent acute anomalies.'},
];
