export interface PendingSynergy {
  eligibleAtLevel: number;
  /** Exactly the next processed level, never the level of eligibility. */
  activateAtLevel: number;
  synergyId: string;
}

export interface BuildState {
  heroId: string;
  level: number;
  routeId: string | null;
  branchId: string | null;
  talentLevels: Record<string, number>;
  /** IDs reference talents in the secondary-mechanism category. */
  secondaryMechanismIds: string[];
  /** IDs reference talents in the enchantment category. */
  enchantmentIds: string[];
  pendingSynergies: PendingSynergy[];
  activeSynergyIds: string[];
}

export type PendingGrowthChoice =
  | { kind: 'ordinary'; targetLevel: number; talentIds: string[] }
  | { kind: 'route'; targetLevel: number; routeIds: [string, string, string] }
  | { kind: 'branch'; targetLevel: number; routeId: string; branchIds: [string, string] };

export interface GrowthState {
  /** Ascending levels processed one at a time, including fixed evolution levels. */
  pendingTargetLevels: number[];
  /** Processing waits here until this one choice is committed. */
  pendingChoice: PendingGrowthChoice | null;
}

/** Automatic evolution is distinct from both ordinary and fixed-node choices. */
export interface UltimateEvolutionEvent {
  type: 'ultimateEvolution';
  targetLevel: number;
  routeId: string;
  branchId: string;
  effectId: string;
  ultimateBehaviorEffectId: string;
}
