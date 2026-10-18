import type { GrowthOption, GrowthRewardId } from './build';
import type { TalentConfig } from './config';
import type { RandomSource } from './contracts';
import type { GrowthRewardConfig } from './growth-model';

/** 核心仅校验规则，不反向读取配置目录的数据。 */
export function validateGrowthRewards(rewards: readonly GrowthRewardConfig[]): void {
  const expected = new Map<GrowthRewardId, string>([
    ['base-attack', 'attackDamage'], ['base-health', 'maxHealth'], ['base-move-speed', 'moveSpeed'],
  ]);
  if (!Array.isArray(rewards) || rewards.length !== 3) throw new Error('基础强化奖励必须恰好配置三种。');
  const seen = new Set<string>();
  for (const reward of rewards) {
    if (!reward || !expected.has(reward.id) || seen.has(reward.id) || expected.get(reward.id) !== reward.stat
      || reward.baselineFraction !== 0.01 || typeof reward.name !== 'string' || !reward.name.trim()
      || typeof reward.description !== 'string' || !reward.description.trim()) throw new Error('基础强化奖励配置无效。');
    seen.add(reward.id);
  }
}

function nextRandom(random: RandomSource): number {
  const value = random.next();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('成长随机数必须是 [0, 1) 内的有限数。');
  return value;
}

export function drawOrdinaryOptions(candidates: readonly TalentConfig[], random: RandomSource, rewards: readonly GrowthRewardConfig[]): readonly GrowthOption[] {
  validateGrowthRewards(rewards);
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.id) || !Number.isFinite(candidate.weight) || candidate.weight < 0) {
      throw new Error('天赋候选不可重复，权重必须是有限非负数。');
    }
    seen.add(candidate.id);
  }
  const pool = candidates.filter(talent => talent.weight > 0);
  const result: GrowthOption[] = [];
  while (pool.length && result.length < 3) {
    const maximum = pool.reduce((max, talent) => Math.max(max, talent.weight), 0);
    const total = pool.reduce((sum, talent) => sum + talent.weight / maximum, 0);
    let remaining = nextRandom(random) * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      remaining -= pool[i].weight / maximum;
      if (remaining < 0) { index = i; break; }
    }
    const [talent] = pool.splice(index, 1);
    result.push({ kind: 'talent', id: `talent:${talent.id}`, talentId: talent.id, name: talent.name });
  }
  const remainingRewards = [...rewards];
  while (result.length < 3) {
    const index = Math.floor(nextRandom(random) * remainingRewards.length);
    const [reward] = remainingRewards.splice(index, 1);
    result.push({ kind: 'reward', id: `reward:${reward.id}`, rewardId: reward.id, name: reward.name, description: reward.description });
  }
  return result;
}
