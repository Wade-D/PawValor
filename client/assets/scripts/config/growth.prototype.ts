import type { GrowthRewardConfig } from '../core/growth-model';

/** 只用于规则验证；经验曲线与奖励数值尚未经平衡测试。 */
export const growthPrototype: {
  readonly calibration: 'prototype';
  readonly levelCosts: readonly number[];
  readonly rewards: readonly GrowthRewardConfig[];
} = {
  calibration: 'prototype',
  levelCosts: Array(11).fill(5),
  rewards: [
    { id: 'base-attack', name: '基础攻击强化', description: '基础攻击伤害增加 1%（独立累计）', stat: 'attackDamage', baselineFraction: 0.01 },
    { id: 'base-health', name: '基础生命强化', description: '基础最大生命增加 1%（独立累计）', stat: 'maxHealth', baselineFraction: 0.01 },
    { id: 'base-move-speed', name: '基础移速强化', description: '基础移动速度增加 1%（独立累计）', stat: 'moveSpeed', baselineFraction: 0.01 },
  ],
};
