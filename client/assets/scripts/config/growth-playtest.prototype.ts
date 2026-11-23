import type { DemoWorldOptions } from '../core/demo-model';

export type GrowthPlaytestCommand = { kind: 'grantXp'; amount: number } | { kind: 'select'; optionId: string } | { kind: 'reroll' };
/** 仅显式测试入口使用，所有状态通过正常经验、抽卡及选择命令获得。 */
export const growthPlaytestPrototype: { readonly seed: number; readonly world: Omit<DemoWorldOptions, 'effects' | 'seed' | 'experienceMode'>; readonly commands: readonly GrowthPlaytestCommand[] } = {
  seed: 44,
  world: { initialEnemyPositions: [{ x: 2, y: 0 }, { x: 3, y: -1 }, { x: 3, y: 1 }], tuning: { enemyHealth: 200, enemySpeed: 0, contactDamage: 0, spawnIntervalSeconds: 100 } },
  commands: [{ kind: 'grantXp', amount: 20 }, { kind: 'select', optionId: 'talent:attack-up' }, { kind: 'select', optionId: 'wanjian' },
    { kind: 'reroll' }, { kind: 'select', optionId: 'talent:attack-up' }, { kind: 'select', optionId: 'talent:lightning-enchantment' }],
};
