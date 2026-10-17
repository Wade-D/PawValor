import type { Vec2 } from './contracts';
import { ARENA_HEIGHT, ARENA_WIDTH } from './demo-model';

export function assertFiniteVector(value: Vec2, name = 'input'): void {
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    throw new Error(`${name} must have finite numeric x and y coordinates.`);
  }
}

/** Preserve analog magnitude below one; avoid overflow for large finite inputs. */
export function normalizeIntent(input: Vec2): Vec2 {
  assertFiniteVector(input);
  const scale = Math.max(Math.abs(input.x), Math.abs(input.y));
  if (scale === 0) return { x: 0, y: 0 };
  if (scale <= 1 && Math.hypot(input.x, input.y) <= 1) return { ...input };
  const x = input.x / scale;
  const y = input.y / scale;
  const length = Math.hypot(x, y);
  return { x: x / length, y: y / length };
}

export function clampToArena(position: Vec2): Vec2 {
  assertFiniteVector(position, 'position');
  return {
    x: Math.max(-ARENA_WIDTH / 2, Math.min(ARENA_WIDTH / 2, position.x)),
    y: Math.max(-ARENA_HEIGHT / 2, Math.min(ARENA_HEIGHT / 2, position.y)),
  };
}

/** First segment fraction touching the closed circle, including initial overlap. */
export function segmentCircleHit(start: Vec2, end: Vec2, center: Vec2, radius: number): number | null {
  assertFiniteVector(start, 'start'); assertFiniteVector(end, 'end'); assertFiniteVector(center, 'center');
  if (!Number.isFinite(radius) || radius < 0) throw new Error('radius must be finite and non-negative.');
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const ox = start.x - center.x;
  const oy = start.y - center.y;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (ox * dx + oy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const fraction = (-b - Math.sqrt(discriminant)) / (2 * a);
  return fraction >= 0 && fraction <= 1 ? fraction : null;
}
