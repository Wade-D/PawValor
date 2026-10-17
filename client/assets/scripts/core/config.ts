import type { AttackSourceKind, Vec2 } from './contracts';

export type ElementId = 'fire' | 'ice' | 'lightning';

export type StatId =
  | 'attackDamage'
  | 'attackSpeed'
  | 'critChance'
  | 'critDamageMultiplier'
  | 'pierceCount'
  | 'projectileSize'
  | 'range'
  | 'areaSize'
  | 'maxHealth'
  | 'moveSpeed'
  | 'damageReduction'
  | 'projectileCount';

export interface HeroBaseStats {
  maxHealth: number;
  moveSpeed: number;
  attackPower: number;
  critChance: number;
  critDamageMultiplier: number;
}

export interface HeroConfig {
  id: string;
  name: string;
  weaponId: string;
  baseStats: HeroBaseStats;
  routeIds: readonly [string, string, string];
}

export type WeaponKind = 'longsword' | 'staff' | 'hammer' | 'shield' | 'bow' | 'spear';

export interface WeaponConfig {
  id: string;
  name: string;
  heroId: string;
  kind: WeaponKind;
  attackIntervalSeconds: number;
  range: number;
  projectileId: string;
  baseDamage: number;
  attackPowerScaling: number;
}

/** One controller per projectile. Areas/explosions are attack effects, not movement. */
export type ProjectileMovement = 'straight' | 'homing' | 'returning' | 'bouncing' | 'orbiting';

export interface ProjectileInheritance {
  stats: readonly StatId[];
  enchantments: boolean;
  secondaryMechanisms: boolean;
}

export interface ProjectileConfig {
  id: string;
  movement: ProjectileMovement;
  speed: number;
  size: Vec2;
  lifetimeSeconds: number;
  pierceCount: number;
  inheritance: ProjectileInheritance;
}

export type BuildPrerequisite =
  | { kind: 'hero'; heroId: string }
  | { kind: 'talent'; talentId: string; minLevel: number }
  | { kind: 'route'; routeId: string }
  | { kind: 'branch'; branchId: string }
  | { kind: 'synergy'; synergyId: string };

export type TalentCategory = 'general' | 'secondary-mechanism' | 'enchantment';

export interface TalentConfig {
  id: string;
  name: string;
  category: TalentCategory;
  maxLevel: number;
  /** All listed conditions must hold. */
  prerequisites: readonly BuildPrerequisite[];
  exclusiveTags: readonly string[];
  effectIds: readonly string[];
  weight: number;
}

export type AttackPattern = 'single' | 'multishot' | 'chain' | 'returning' | 'orbiting' | 'homing' | 'explosion' | 'area';

/** Declarative parameters only. No callbacks or combat executors belong in data. */
export type EffectConfig =
  | {
      id: string;
      kind: 'stat-modifier';
      stat: StatId;
      operation: 'add' | 'multiply';
      value: number;
    }
  | {
      id: string;
      kind: 'attack-pattern';
      pattern: AttackPattern;
      projectileId: string;
      projectileCount: number;
      damageMultiplier: number;
      triggerPolicyId: string;
    }
  | {
      id: string;
      kind: 'element';
      element: ElementId;
      damageMultiplier: number;
      durationSeconds: number;
      triggerPolicyId: string;
    }
  | {
      id: string;
      kind: 'ultimate-behavior';
      /** Symbolic behavior reference for a future executor, not executable code. */
      behaviorId: string;
      projectileId: string;
      damageMultiplier: number;
      triggerPolicyId: string;
    };

export interface RouteBranchConfig {
  id: string;
  name: string;
  effectIds: readonly string[];
  /** References an effect of kind ultimate-behavior. */
  ultimateBehaviorEffectId: string;
}

export interface RouteConfig {
  id: string;
  name: string;
  heroId: string;
  entryEffectIds: readonly string[];
  branches: readonly [RouteBranchConfig, RouteBranchConfig];
  ultimate: { name: string; effectId: string };
}

export interface SynergyConfig {
  id: string;
  name: string;
  usage: 'test-only';
  prerequisites: readonly BuildPrerequisite[];
  effectIds: readonly string[];
  activation: 'next-level';
}

/** Explicit experimental policy; neither boolean is a production default. */
export interface ElementPolicy {
  usage: 'test-only';
  maxEnchantments: 2;
  maxSecondaryMechanisms: 2;
  innateElementCounts: boolean;
  enchantmentsUseSecondarySlots: boolean;
  resonanceEffectIds: readonly string[];
}

export interface TriggerPolicy {
  id: string;
  allowedSources: readonly AttackSourceKind[];
  /** Non-negative finite integer; direct attacks have depth zero. */
  maxDepth: number;
  /** Positive finite integer, never Infinity or an unlimited sentinel. */
  maxTriggersPerRoot: number;
  cooldownSeconds: number;
  targetHitIntervalSeconds: number;
}

export interface GrowthConfig {
  routeLevel: 3;
  branchLevel: 7;
  ultimateLevel: 11;
  freeRerolls: number;
  ordinaryChoiceCount: 3;
}

/** Calibration labels every numeric parameter in this complete configuration. */
export interface GameConfig {
  calibration: 'prototype';
  heroes: readonly HeroConfig[];
  weapons: readonly WeaponConfig[];
  projectiles: readonly ProjectileConfig[];
  talents: readonly TalentConfig[];
  routes: readonly RouteConfig[];
  effects: readonly EffectConfig[];
  synergies: readonly SynergyConfig[];
  elementPolicy: ElementPolicy;
  triggerPolicies: readonly TriggerPolicy[];
  growth: GrowthConfig;
}
