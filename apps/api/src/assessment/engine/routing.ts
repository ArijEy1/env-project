// SEMS v0.4 applicability / conditional-routing engine (Phase 2).
//
// Replaces the old static sector-list filter. Which questions an entity sees is
// decided by its Profile (PRF-*) and Applicability (APP-*) answers:
//
//   * applicability_trigger === 'All'  -> always active
//       (exactly the 12 Profile + 12 Applicability + 30 CORE-ALL questions)
//   * applicability_rule_id 'ADV-FULL' / 'FULL-OUTCOME' -> only at Full depth
//   * otherwise the rule id names the parent gate(s) (an OR-set of APP-/PRF-ids,
//     or a named flag mapped below); active when ANY parent answered Yes/Unknown.
//
// Pure functions — no DB, no side effects — so they are trivially testable.

import { activatesGate, Canonical } from './answer-types';

export type Depth = 'lite' | 'core' | 'full';

export interface RoutingQuestion {
  id: string;
  category: string | null; // Profile | Applicability | Core | Conditional | Advanced
  applicabilityRuleId: string | null;
  applicabilityTrigger: string | null;
}

/** Canonical answers to the routing questions, keyed by question id. */
export type RoutingAnswers = Map<string, Canonical>;

export interface RoutingProfile {
  size: string | null; // employee bracket or PRF-003 answer
  exposure: string | null; // low | medium | high
  listed: boolean; // PRF-010 = yes
}

// Named flags (used by the v0.4 nature/supply-chain/circularity modules) mapped
// to the Applicability gate(s) that best represent them. Kept explicit so the
// mapping is reviewable rather than guessed at runtime.
const FLAG_GATES: Record<string, string[]> = {
  site_sensitivity_high_or_nature_impact: ['PRF-009', 'APP-007', 'APP-008'],
  restoration_or_mitigation_plan_exists: ['APP-007', 'APP-008'],
  high_risk_suppliers_exist: ['APP-006'],
  high_risk_suppliers_assessed: ['APP-006'],
  high_risk_or_material_suppliers_exist: ['APP-006'],
  supplier_transport_packaging_materiality: ['APP-006'],
  supplier_nonconformities_exist: ['APP-006'],
  circularity_relevant_or_waste_materiality: ['APP-004', 'APP-012'],
  circular_initiatives_exist: ['APP-012', 'APP-004'],
  material_flow_mapping_exists: ['APP-004', 'APP-012'],
  resource_productivity_data_available: ['APP-010', 'APP-012'],
  product_service_process_design_relevant: ['APP-012'],
  waste_or_byproducts_material: ['APP-004'],
  material_inputs_are_material: ['APP-004', 'APP-012'],
};

const DEPTH_RULES = new Set(['ADV-FULL', 'FULL-OUTCOME']);

/** Derives assessment depth from the profile. Full unlocks Advanced questions. */
export function determineDepth(p: RoutingProfile): Depth {
  const large = (p.size ?? '').toLowerCase();
  const isLarge =
    large.includes('كبير') || // Arabic "large"
    large === 'large' ||
    large === '201-500' ||
    large === '501-1000' ||
    large === '1000+';
  if (isLarge || p.exposure === 'high' || p.listed) return 'full';
  const small = large.includes('صغير') || large === 'small' || large === '1-10';
  if (small && p.exposure === 'low' && !p.listed) return 'lite';
  return 'core';
}

/** Extracts the parent gate ids referenced by a rule id (APP-xxx / PRF-xxx). */
export function resolveGates(ruleId: string | null): string[] {
  if (!ruleId) return [];
  const ids = ruleId.match(/(?:APP|PRF)-\d+/g);
  if (ids && ids.length) return ids;
  return FLAG_GATES[ruleId] ?? [];
}

/** Is a single question active given current routing answers + depth? */
export function isActive(
  q: RoutingQuestion,
  answers: RoutingAnswers,
  depth: Depth,
): boolean {
  if (q.category === 'Profile' || q.category === 'Applicability') return true;
  if ((q.applicabilityTrigger ?? '') === 'All') return true;

  const rule = q.applicabilityRuleId ?? '';
  if (DEPTH_RULES.has(rule) || /full/i.test(q.applicabilityTrigger ?? '')) {
    return depth === 'full';
  }

  const gates = resolveGates(rule);
  if (gates.length === 0) {
    // Unmappable conditional: only surface in a Full assessment so we never
    // silently drop it, but don't burden Lite/Core entities with it.
    return depth === 'full';
  }
  return gates.some((g) => activatesGate(answers.get(g) ?? null));
}

/** Returns the set of active question ids for the whole snapshot. */
export function computeActiveSet(
  questions: RoutingQuestion[],
  answers: RoutingAnswers,
  depth: Depth,
): Set<string> {
  const active = new Set<string>();
  for (const q of questions) {
    if (isActive(q, answers, depth)) active.add(q.id);
  }
  return active;
}
