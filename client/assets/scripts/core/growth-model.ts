import type { BuildState, GrowthRewardId, GrowthState, UltimateEvolutionEvent, SynergyActivatedEvent } from './build';
import type { TalentCategory } from './config';
import type { RandomSource } from './contracts';

export interface GrowthToken { sessionId: number; generation: number; revision: number }
export type GrowthEvent = UltimateEvolutionEvent | SynergyActivatedEvent;
export interface ExperienceProgress { xp: number; earnedLevel: number; xpCapped: boolean }
export type GrowthReadonly<T> = T extends object ? { readonly [K in keyof T]: GrowthReadonly<T[K]> } : T;
export type GrowthSnapshot = GrowthReadonly<{
  build: BuildState;
  growth: GrowthState;
  xp: number;
  earnedLevel: number;
  xpCapped: boolean;
  rerollsRemaining: number;
  token: GrowthToken | null;
  activatingSynergyIds: readonly string[];
}>;

export type GrowthRejection = 'no-choice' | 'stale-token' | 'invalid-option' | 'fixed-node' | 'no-rerolls';
export type GrowthCommandResult =
  | { ok: true; events: readonly GrowthEvent[] }
  | { ok: false; reason: GrowthRejection; message: string; events: readonly [] };

export interface GrowthRewardConfig {
  id: GrowthRewardId;
  name: string;
  description: string;
  stat: 'attackDamage' | 'maxHealth' | 'moveSpeed';
  baselineFraction: 0.01;
}

export interface GrowthSessionOptions {
  validateBuild?: (build: GrowthReadonly<BuildState>) => void;
  commitBuild?: (build: GrowthReadonly<BuildState>) => void;
  enabledTalentCategories?: readonly TalentCategory[];
  heroId: string;
  random: RandomSource;
  levelCosts: readonly number[];
  rewards: readonly GrowthRewardConfig[];
}
