// Section 4 calculators. The 0–100 answer is derived SERVER-SIDE from raw inputs
// (Section 5: clients never see the formula). Rubrics are intentionally simple
// and yield one of {0,25,50,75,100} so they fit the assessment scoring scale.
// DRAFT — replace the thresholds with the client's official methodology later.

export type CalculatorType = 'scope12' | 'resource_efficiency';

const SCALE = [0, 25, 50, 75, 100];

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function bool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function toScale(points: number): number {
  const clamped = Math.max(0, Math.min(100, points));
  // Snap to the nearest scale value.
  return SCALE.reduce((best, s) =>
    Math.abs(s - clamped) < Math.abs(best - clamped) ? s : best,
  );
}

/**
 * Scope 1 & 2 emissions maturity:
 *  +25 measures current emissions, +25 has a baseline year, +25 has reduced vs
 *  baseline, +25 has a reduction target.
 */
function scoreScope12(inputs: Record<string, unknown>): number {
  const scope1 = num(inputs.scope1);
  const scope2 = num(inputs.scope2);
  const baseline = num(inputs.baseline);
  const hasTarget = bool(inputs.hasReductionTarget);

  const current = scope1 + scope2;
  let points = 0;
  if (current > 0) points += 25;
  if (baseline > 0) points += 25;
  // Only credit a reduction when current emissions are actually measured.
  if (current > 0 && baseline > 0 && current < baseline) points += 25;
  if (hasTarget) points += 25;
  return toScale(points);
}

/**
 * Resource (energy/water) efficiency maturity:
 *  +25 measures consumption, +25 has a baseline, +25 reduced vs baseline,
 *  +25 has an active efficiency program.
 */
function scoreResourceEfficiency(inputs: Record<string, unknown>): number {
  const energy = num(inputs.energy);
  const water = num(inputs.water);
  const baseEnergy = num(inputs.baselineEnergy);
  const baseWater = num(inputs.baselineWater);
  const hasProgram = bool(inputs.hasEfficiencyProgram);

  let points = 0;
  if (energy > 0 || water > 0) points += 25;
  if (baseEnergy > 0 || baseWater > 0) points += 25;
  const reducedEnergy = baseEnergy > 0 && energy > 0 && energy < baseEnergy;
  const reducedWater = baseWater > 0 && water > 0 && water < baseWater;
  if (reducedEnergy || reducedWater) points += 25;
  if (hasProgram) points += 25;
  return toScale(points);
}

export function computeCalculatorScore(
  type: string,
  inputs: Record<string, unknown>,
): number {
  switch (type) {
    case 'scope12':
      return scoreScope12(inputs);
    case 'resource_efficiency':
      return scoreResourceEfficiency(inputs);
    default:
      return 0;
  }
}
