import type { CombatEvent, EntityHandle, RunState, Vec2 } from './contracts';

export const FIXED_STEP_SECONDS = 1 / 60;
export const PIXELS_PER_UNIT = 64;
export const ARENA_WIDTH = 20;
export const ARENA_HEIGHT = 11.25;

/** 仅供原型使用的参数，不修改正式 GameConfig。 */
export interface DemoTuning {
  enemyHealth: number;
  enemySpeed: number;
  contactDamage: number;
  contactIntervalSeconds: number;
  heroRadius: number;
  enemyRadius: number;
  spawnIntervalSeconds: number;
  minSpawnDistance: number;
  maxEnemies: number;
  xpPerOrb: number;
  pickupRadius: number;
  level2Xp: number;
}

export const DEFAULT_DEMO_TUNING: Readonly<DemoTuning> = Object.freeze({
  enemyHealth: 30, enemySpeed: 2, contactDamage: 10, contactIntervalSeconds: 1,
  heroRadius: 0.35, enemyRadius: 0.35, spawnIntervalSeconds: 2,
  minSpawnDistance: 4, maxEnemies: 12, xpPerOrb: 1, pickupRadius: 0.45, level2Xp: 5,
});

export interface DemoEntitySnapshot {
  readonly handle: EntityHandle;
  readonly position: Vec2;
}
export interface DemoHeroSnapshot extends DemoEntitySnapshot {
  readonly health: number;
  readonly maxHealth: number;
}
export interface DemoEnemySnapshot extends DemoEntitySnapshot {
  readonly health: number;
}
export interface DemoProjectileSnapshot extends DemoEntitySnapshot {
  readonly direction: Vec2;
}
export interface DemoOrbSnapshot extends DemoEntitySnapshot {
  readonly value: number;
}
export interface DemoSnapshot {
  readonly state: RunState;
  readonly elapsedSeconds: number;
  readonly hero: DemoHeroSnapshot;
  readonly enemies: readonly DemoEnemySnapshot[];
  readonly projectiles: readonly DemoProjectileSnapshot[];
  readonly orbs: readonly DemoOrbSnapshot[];
  readonly level: 1 | 2;
  readonly xp: number;
  readonly xpCapped: boolean;
  readonly kills: number;
}
export type DemoEvent = CombatEvent
  | { type: 'enemySpawn'; elapsedSeconds: number; handle: EntityHandle; position: Vec2 }
  | { type: 'xpDrop'; elapsedSeconds: number; handle: EntityHandle; position: Vec2; value: number }
  | { type: 'xpPickup'; elapsedSeconds: number; handle: EntityHandle; value: number }
  | { type: 'levelUp'; elapsedSeconds: number; level: 2 }
  | { type: 'heroDamaged'; elapsedSeconds: number; attacker: EntityHandle; target: EntityHandle; damage: number };

export interface DemoWorldOptions {
  seed?: number;
  tuning?: Partial<DemoTuning>;
  initialEnemyPositions?: readonly Vec2[];
}
