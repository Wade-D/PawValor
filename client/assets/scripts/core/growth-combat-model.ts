import type { RandomSource } from './contracts';
import type { DemoSnapshot, DemoWorldOptions } from './demo-model';
import type { GrowthCommandResult, GrowthReadonly, GrowthRewardConfig, GrowthSnapshot } from './growth-model';

export interface GrowthCombatRunOptions {
  heroId: string; levelCosts: readonly number[]; rewards: readonly GrowthRewardConfig[]; seed?: number;
  createGrowthRandom?: (seed: number) => RandomSource;
  world?: Omit<DemoWorldOptions, 'effects' | 'experienceMode' | 'seed'>;
}
export type GrowthRunCommandResult = GrowthCommandResult
  | { ok: false; reason: 'run-not-active' | 'transaction-failed'; message: string; events: readonly [] };
export type GrowthRunSnapshot = GrowthReadonly<{
  world: DemoSnapshot; growth: GrowthSnapshot; pauseReason: 'none' | 'manual' | 'growth' | 'error' | 'ended';
  queuedXp: number; error: string | null; inputRevision: number;
  experience: { total: number; current: number; nextCost: number | null; capped: boolean };
}>;
