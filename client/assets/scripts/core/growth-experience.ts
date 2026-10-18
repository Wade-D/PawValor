import type { ExperienceProgress } from './growth-model';

/** 显式经验曲线至少包含升至十一级的十段消耗。 */
export function experienceThresholds(levelCosts: readonly number[]): readonly number[] {
  if (!Array.isArray(levelCosts) || levelCosts.length < 10) throw new Error('经验曲线必须覆盖十一级。');
  const thresholds: number[] = [];
  let total = 0;
  for (const cost of levelCosts) {
    const next = total + cost;
    if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(next) || next <= total) {
      throw new Error('经验消耗必须为有限正数，累计门槛必须有限且严格递增。');
    }
    thresholds.push(next);
    total = next;
  }
  return thresholds;
}

export function applyExperience(xp: number, amount: number, thresholds: readonly number[]): ExperienceProgress {
  let previous = 0;
  if (!Array.isArray(thresholds) || thresholds.length < 10) throw new Error('累计门槛必须覆盖十一级。');
  for (const threshold of thresholds) {
    if (!Number.isFinite(threshold) || threshold <= previous) throw new Error('累计经验门槛必须有限且严格递增。');
    previous = threshold;
  }
  const cap = previous;
  if (!Number.isFinite(xp) || xp < 0 || xp > cap || !Number.isFinite(amount) || amount < 0) {
    throw new Error('经验必须为有限非负数，当前经验不能超过上限。');
  }
  // 先比较剩余量，避免两个有限大数相加溢出。
  const result = amount >= cap - xp ? cap : xp + amount;
  let earnedLevel = 1;
  for (const threshold of thresholds) if (result >= threshold) earnedLevel++;
  return { xp: result, earnedLevel, xpCapped: result === cap };
}
