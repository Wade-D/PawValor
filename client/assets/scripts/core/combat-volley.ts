import type { Vec2 } from './contracts';

export function volleyDirections(direction: Vec2, count: number, spreadDegrees: number): readonly Vec2[] {
  const length = Math.hypot(direction.x, direction.y);
  if (!Number.isFinite(length) || length <= 0 || !Number.isSafeInteger(count) || count < 1 || count > 64
    || !Number.isFinite(spreadDegrees) || spreadDegrees < 0 || spreadDegrees > 360) throw new Error('扇形弹体执行参数无效。');
  const x = direction.x / length, y = direction.y / length;
  return Array.from({ length: count }, (_, i) => {
    const radians = (count === 1 ? 0 : -spreadDegrees / 2 + spreadDegrees * i / (count - 1)) * Math.PI / 180;
    return { x: x * Math.cos(radians) - y * Math.sin(radians), y: x * Math.sin(radians) + y * Math.cos(radians) };
  });
}
