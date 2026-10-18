import type { BuildState } from './build';
import type { ElementId, ProjectileConfig, ProjectileInheritance, TriggerPolicy } from './config';
import type { AttackSource, EntityHandle, Vec2 } from './contracts';
import type { GrowthReadonly } from './growth-model';

export interface ResolvedCombatStats {
  attackDamage: number; attackIntervalSeconds: number; critChance: number; critDamageMultiplier: number;
  pierceCount: number; projectileSize: Vec2; range: number; areaScale: number;
  maxHealth: number; moveSpeed: number; damageReduction: number;
}
export interface ResolvedElement {
  effectId: string; name: string; element: ElementId; kind: 'burn' | 'slow-hit' | 'bonus-hit';
  rank: number; damageMultiplier: number; durationSeconds: number; tickIntervalSeconds: number; slowRatio: number; policy: TriggerPolicy;
}
export interface ResolvedSecondary {
  effectId: string; name: string; damageMultiplier: number; policy: TriggerPolicy;
  inheritance: ProjectileInheritance;
  behavior: { kind: 'homing'; projectileId: string } | { kind: 'explosion'; radius: number };
  projectile?: ProjectileConfig;
}
export interface ResolvedExtraProjectile {
  effectId: string; name: string; damageMultiplier: number; lateralOffset: number; projectile: ProjectileConfig;
}
export interface CompiledCombatBuild {
  synergyVolleys: readonly ResolvedSynergyVolley[];
  build: GrowthReadonly<BuildState>; stats: ResolvedCombatStats; baseDamage: number;
  elements: readonly ResolvedElement[]; secondary: readonly ResolvedSecondary[]; extraProjectiles: readonly ResolvedExtraProjectile[];
}
export interface ResolvedSynergyVolley {
  synergyId: string; effectId: string; name: string; projectileCount: number; spreadDegrees: number;
  damageMultiplier: number; inheritance: ProjectileInheritance; projectile: ProjectileConfig; policy: TriggerPolicy;
}
export interface DamageRequest {
  attackId: number; attacker: EntityHandle; target: EntityHandle; source: AttackSource; damage: number; critical: boolean;
}
export interface CombatStatusSnapshot { kind: 'burn' | 'slow'; expiresAt: number; nextTickAt?: number; slowRatio?: number }
export type BurnPayload = Omit<DamageRequest, 'target' | 'critical'> & { durationSeconds: number; tickIntervalSeconds: number };
export interface DirectHitContext {
  attackId: number; attacker: EntityHandle; source: AttackSource; target: EntityHandle; position: Vec2;
  damage: number; baseDamage: number; elements: readonly ResolvedElement[]; secondary: readonly ResolvedSecondary[]; compiled: CompiledCombatBuild;
}
