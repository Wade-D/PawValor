import { DEFAULT_DEMO_TUNING } from './demo-model';

/** 试玩累计经验在二级阈值处封顶。 */
export function applyDemoXp(
  current: { level: 1 | 2; xp: number }, amount: number,
  level2Xp: number = DEFAULT_DEMO_TUNING.level2Xp,
): { level: 1 | 2; xp: number; leveledUp: boolean } {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('XP amount must be finite and non-negative.');
  if (!Number.isFinite(level2Xp) || level2Xp <= 0) throw new Error('Level-2 XP threshold must be finite and positive.');
  if (!Number.isFinite(current.xp) || current.xp < 0 || (current.level !== 1 && current.level !== 2)) {
    throw new Error('Invalid Demo XP progress.');
  }
  const xp = current.level === 2 ? level2Xp : Math.min(level2Xp, current.xp + amount);
  const level = xp >= level2Xp ? 2 : 1;
  return { level, xp, leveledUp: current.level === 1 && level === 2 };
}
