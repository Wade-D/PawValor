import type { EntityHandle, Vec2 } from './contracts';
import { assertFiniteVector } from './demo-geometry';

export interface SecondaryTarget { readonly handle: EntityHandle; readonly position: Vec2; readonly health: number }
const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export function explosionTargets(origin: Vec2, radius: number, enemies: readonly SecondaryTarget[]): readonly EntityHandle[] {
  assertFiniteVector(origin);
  if (!Number.isFinite(radius) || radius < 0) throw new Error('范围半径无效。');
  return enemies.filter(e => e.health > 0 && distance(origin,e.position) <= radius + 1e-10)
    .sort((a,b) => distance(origin,a.position) - distance(origin,b.position) || a.handle.id - b.handle.id).map(e => ({ ...e.handle }));
}
export function selectSecondaryTarget(origin: Vec2, range: number, excluded: EntityHandle, enemies: readonly SecondaryTarget[]): EntityHandle | null {
  return explosionTargets(origin, range, enemies.filter(e => e.handle.id !== excluded.id || e.handle.generation !== excluded.generation))[0] ?? null;
}
export function homingDirection(origin: Vec2, target: Vec2, previous: Vec2): Vec2 {
  assertFiniteVector(origin); assertFiniteVector(target); assertFiniteVector(previous);
  const length = distance(origin,target);
  return length === 0 ? { ...previous } : { x: (target.x-origin.x)/length, y: (target.y-origin.y)/length };
}
