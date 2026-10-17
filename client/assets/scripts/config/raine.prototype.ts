import type { GameConfig } from '../core/config';

/**
 * Structural example only: calibration covers EVERY nested numeric parameter.
 * No balance validation or combat executor exists for these prototype effects.
 * Talent stacking and the experimental element choices are explained in
 * docs/design/phase-1-foundation.md at the project root.
 */
export const rainePrototypeConfig: GameConfig = {
  calibration: 'prototype',
  heroes: [{
    id: 'raine', name: '雷恩', weaponId: 'raine-longsword',
    baseStats: { maxHealth: 100, moveSpeed: 5, attackPower: 10, critChance: 0.05, critDamageMultiplier: 1.5 },
    routeIds: ['wanjian', 'thunder', 'returning-sword'],
  }],
  weapons: [{
    id: 'raine-longsword', name: '雷恩长剑', heroId: 'raine', kind: 'longsword',
    attackIntervalSeconds: 0.8, range: 8, projectileId: 'sword-qi', baseDamage: 10, attackPowerScaling: 1,
  }],
  projectiles: [
    {
      id: 'sword-qi', movement: 'straight', speed: 12, size: { x: 0.3, y: 0.8 }, lifetimeSeconds: 1,
      pierceCount: 0,
      inheritance: {
        stats: ['attackDamage', 'critChance', 'critDamageMultiplier', 'pierceCount', 'projectileSize', 'range'],
        enchantments: true, secondaryMechanisms: true,
      },
    },
    {
      id: 'returning-blade', movement: 'returning', speed: 10, size: { x: 0.5, y: 0.5 }, lifetimeSeconds: 2,
      pierceCount: 1,
      inheritance: {
        stats: ['attackDamage', 'critChance', 'critDamageMultiplier', 'projectileSize', 'range'],
        enchantments: true, secondaryMechanisms: false,
      },
    },
    {
      id: 'guarding-blade', movement: 'orbiting', speed: 6, size: { x: 0.5, y: 0.5 }, lifetimeSeconds: 3,
      pierceCount: 0,
      inheritance: {
        stats: ['attackDamage', 'critChance', 'critDamageMultiplier', 'projectileSize'],
        enchantments: true, secondaryMechanisms: false,
      },
    },
    {
      id: 'seeking-blade', movement: 'homing', speed: 10, size: { x: 0.4, y: 0.7 }, lifetimeSeconds: 2,
      pierceCount: 0,
      inheritance: {
        stats: ['attackDamage', 'critChance', 'critDamageMultiplier', 'projectileSize', 'range'],
        enchantments: true, secondaryMechanisms: false,
      },
    },
  ],
  talents: [
    {
      id: 'attack-up', name: '攻击强化', category: 'general', maxLevel: 5,
      prerequisites: [], exclusiveTags: [], effectIds: ['attack-up-stat'], weight: 1,
    },
    {
      id: 'attack-speed-up', name: '迅捷攻击', category: 'general', maxLevel: 5,
      prerequisites: [], exclusiveTags: [], effectIds: ['attack-speed-up-stat'], weight: 1,
    },
    {
      id: 'crit-chance-up', name: '精准暴击', category: 'general', maxLevel: 4,
      prerequisites: [], exclusiveTags: [], effectIds: ['crit-chance-up-stat'], weight: 1,
    },
    {
      id: 'crit-damage-up', name: '致命一击', category: 'general', maxLevel: 3,
      prerequisites: [], exclusiveTags: [], effectIds: ['crit-damage-up-stat'], weight: 1,
    },
    {
      id: 'pierce-up', name: '穿透强化', category: 'general', maxLevel: 2,
      prerequisites: [], exclusiveTags: [], effectIds: ['pierce-up-stat'], weight: 1,
    },
    {
      id: 'projectile-size-up', name: '弹道扩大', category: 'general', maxLevel: 3,
      prerequisites: [], exclusiveTags: [], effectIds: ['projectile-size-up-stat'], weight: 1,
    },
    {
      id: 'range-up', name: '射程提升', category: 'general', maxLevel: 3,
      prerequisites: [], exclusiveTags: [], effectIds: ['range-up-stat'], weight: 1,
    },
    {
      id: 'area-size-up', name: '范围增幅', category: 'general', maxLevel: 3,
      prerequisites: [], exclusiveTags: [], effectIds: ['area-size-up-stat'], weight: 1,
    },
    {
      id: 'max-health-up', name: '生命强化', category: 'general', maxLevel: 3,
      prerequisites: [], exclusiveTags: [], effectIds: ['max-health-up-stat'], weight: 1,
    },
    {
      id: 'move-speed-up', name: '轻盈步伐', category: 'general', maxLevel: 3,
      prerequisites: [], exclusiveTags: [], effectIds: ['move-speed-up-stat'], weight: 1,
    },
    {
      id: 'armor-up', name: '坚韧护甲', category: 'general', maxLevel: 3,
      prerequisites: [], exclusiveTags: [], effectIds: ['armor-up-stat'], weight: 1,
    },
    {
      id: 'extra-projectile', name: '额外弹体', category: 'general', maxLevel: 1,
      prerequisites: [], exclusiveTags: [], effectIds: ['extra-projectile-attack'], weight: 1,
    },
    {
      id: 'fire-enchantment', name: '火焰附魔', category: 'enchantment', maxLevel: 3,
      prerequisites: [], exclusiveTags: [], effectIds: ['fire-hit'], weight: 1,
    },
    {
      id: 'ice-enchantment', name: '寒冰附魔', category: 'enchantment', maxLevel: 3,
      prerequisites: [], exclusiveTags: [], effectIds: ['ice-hit'], weight: 1,
    },
    {
      id: 'lightning-enchantment', name: '雷电附魔', category: 'enchantment', maxLevel: 3,
      prerequisites: [], exclusiveTags: [], effectIds: ['lightning-hit'], weight: 1,
    },
  ],
  routes: [
    {
      id: 'wanjian', name: '万剑流', heroId: 'raine', entryEffectIds: ['multishot-entry'],
      branches: [
        { id: 'sanhua', name: '散华', effectIds: ['sanhua-attack'], ultimateBehaviorEffectId: 'ultimate-sanhua' },
        { id: 'jufeng', name: '聚锋', effectIds: ['jufeng-attack'], ultimateBehaviorEffectId: 'ultimate-jufeng' },
      ],
      ultimate: { name: '万剑归宗', effectId: 'wanjian-ultimate' },
    },
    {
      id: 'thunder', name: '雷霆流', heroId: 'raine', entryEffectIds: ['innate-lightning'],
      branches: [
        { id: 'chain-lightning', name: '连锁雷击', effectIds: ['chain-lightning-attack'], ultimateBehaviorEffectId: 'ultimate-chain-lightning' },
        { id: 'piercing-thunder', name: '雷霆贯心', effectIds: ['piercing-thunder-attack'], ultimateBehaviorEffectId: 'ultimate-piercing-thunder' },
      ],
      ultimate: { name: '雷神审判', effectId: 'thunder-ultimate' },
    },
    {
      id: 'returning-sword', name: '回旋剑流', heroId: 'raine', entryEffectIds: ['returning-entry'],
      branches: [
        { id: 'guarding-swords', name: '护体飞剑', effectIds: ['guarding-swords-attack'], ultimateBehaviorEffectId: 'ultimate-guarding-swords' },
        { id: 'seeking-swords', name: '追魂剑', effectIds: ['seeking-swords-attack'], ultimateBehaviorEffectId: 'ultimate-seeking-swords' },
      ],
      ultimate: { name: '无尽剑轮', effectId: 'returning-ultimate' },
    },
  ],
  effects: [
    // Per-rank factors use baseline * (1 + rank * (factor - 1)), never factor ** rank.
    { id: 'attack-up-stat', kind: 'stat-modifier', stat: 'attackDamage', operation: 'multiply', value: 1.10 },
    { id: 'attack-speed-up-stat', kind: 'stat-modifier', stat: 'attackSpeed', operation: 'multiply', value: 1.08 },
    { id: 'crit-chance-up-stat', kind: 'stat-modifier', stat: 'critChance', operation: 'add', value: 0.05 },
    { id: 'crit-damage-up-stat', kind: 'stat-modifier', stat: 'critDamageMultiplier', operation: 'add', value: 0.20 },
    { id: 'pierce-up-stat', kind: 'stat-modifier', stat: 'pierceCount', operation: 'add', value: 1 },
    { id: 'projectile-size-up-stat', kind: 'stat-modifier', stat: 'projectileSize', operation: 'multiply', value: 1.10 },
    { id: 'range-up-stat', kind: 'stat-modifier', stat: 'range', operation: 'multiply', value: 1.12 },
    { id: 'area-size-up-stat', kind: 'stat-modifier', stat: 'areaSize', operation: 'multiply', value: 1.10 },
    { id: 'max-health-up-stat', kind: 'stat-modifier', stat: 'maxHealth', operation: 'multiply', value: 1.12 },
    { id: 'move-speed-up-stat', kind: 'stat-modifier', stat: 'moveSpeed', operation: 'multiply', value: 1.06 },
    { id: 'armor-up-stat', kind: 'stat-modifier', stat: 'damageReduction', operation: 'add', value: 0.06 },
    // Separate extra hit: do not apply its 0.6 factor to the entire weapon output.
    { id: 'extra-projectile-attack', kind: 'attack-pattern', pattern: 'single', projectileId: 'sword-qi', projectileCount: 1, damageMultiplier: 0.6, triggerPolicyId: 'direct-only' },
    { id: 'multishot-entry', kind: 'attack-pattern', pattern: 'multishot', projectileId: 'sword-qi', projectileCount: 3, damageMultiplier: 0.8, triggerPolicyId: 'direct-only' },
    { id: 'sanhua-attack', kind: 'attack-pattern', pattern: 'multishot', projectileId: 'sword-qi', projectileCount: 5, damageMultiplier: 0.65, triggerPolicyId: 'direct-only' },
    { id: 'jufeng-attack', kind: 'attack-pattern', pattern: 'single', projectileId: 'sword-qi', projectileCount: 1, damageMultiplier: 2.4, triggerPolicyId: 'direct-only' },
    { id: 'chain-lightning-attack', kind: 'attack-pattern', pattern: 'chain', projectileId: 'sword-qi', projectileCount: 3, damageMultiplier: 0.7, triggerPolicyId: 'bounded-derived' },
    { id: 'piercing-thunder-attack', kind: 'stat-modifier', stat: 'pierceCount', operation: 'add', value: 2 },
    { id: 'returning-entry', kind: 'attack-pattern', pattern: 'returning', projectileId: 'returning-blade', projectileCount: 1, damageMultiplier: 1, triggerPolicyId: 'direct-only' },
    { id: 'guarding-swords-attack', kind: 'attack-pattern', pattern: 'orbiting', projectileId: 'guarding-blade', projectileCount: 3, damageMultiplier: 0.7, triggerPolicyId: 'direct-only' },
    { id: 'seeking-swords-attack', kind: 'attack-pattern', pattern: 'homing', projectileId: 'seeking-blade', projectileCount: 2, damageMultiplier: 0.8, triggerPolicyId: 'direct-only' },
    { id: 'wanjian-ultimate', kind: 'attack-pattern', pattern: 'multishot', projectileId: 'sword-qi', projectileCount: 10, damageMultiplier: 1.2, triggerPolicyId: 'direct-only' },
    { id: 'thunder-ultimate', kind: 'element', element: 'lightning', damageMultiplier: 3, durationSeconds: 0, triggerPolicyId: 'element-direct-only' },
    { id: 'returning-ultimate', kind: 'attack-pattern', pattern: 'orbiting', projectileId: 'guarding-blade', projectileCount: 6, damageMultiplier: 1.1, triggerPolicyId: 'direct-only' },
    // Symbolic planned differences only; these IDs have no executable implementation.
    { id: 'ultimate-sanhua', kind: 'ultimate-behavior', behaviorId: 'planned-wanjian-fan-array', projectileId: 'sword-qi', damageMultiplier: 1.2, triggerPolicyId: 'direct-only' },
    { id: 'ultimate-jufeng', kind: 'ultimate-behavior', behaviorId: 'planned-wanjian-focused-array', projectileId: 'sword-qi', damageMultiplier: 2.4, triggerPolicyId: 'direct-only' },
    { id: 'ultimate-chain-lightning', kind: 'ultimate-behavior', behaviorId: 'planned-thunder-chain-judgment', projectileId: 'sword-qi', damageMultiplier: 1.5, triggerPolicyId: 'bounded-derived' },
    { id: 'ultimate-piercing-thunder', kind: 'ultimate-behavior', behaviorId: 'planned-thunder-piercing-judgment', projectileId: 'sword-qi', damageMultiplier: 3, triggerPolicyId: 'direct-only' },
    { id: 'ultimate-guarding-swords', kind: 'ultimate-behavior', behaviorId: 'planned-endless-guarding-wheel', projectileId: 'guarding-blade', damageMultiplier: 1.1, triggerPolicyId: 'direct-only' },
    { id: 'ultimate-seeking-swords', kind: 'ultimate-behavior', behaviorId: 'planned-endless-seeking-wheel', projectileId: 'seeking-blade', damageMultiplier: 1.4, triggerPolicyId: 'direct-only' },
    { id: 'innate-lightning', kind: 'element', element: 'lightning', damageMultiplier: 0.4, durationSeconds: 0, triggerPolicyId: 'element-direct-only' },
    { id: 'fire-hit', kind: 'element', element: 'fire', damageMultiplier: 0.2, durationSeconds: 3, triggerPolicyId: 'element-direct-only' },
    { id: 'ice-hit', kind: 'element', element: 'ice', damageMultiplier: 0.15, durationSeconds: 2, triggerPolicyId: 'element-direct-only' },
    { id: 'lightning-hit', kind: 'element', element: 'lightning', damageMultiplier: 0.3, durationSeconds: 0, triggerPolicyId: 'element-direct-only' },
    { id: 'fire-resonance', kind: 'element', element: 'fire', damageMultiplier: 0.3, durationSeconds: 3, triggerPolicyId: 'element-direct-only' },
    { id: 'ice-resonance', kind: 'element', element: 'ice', damageMultiplier: 0.25, durationSeconds: 2, triggerPolicyId: 'element-direct-only' },
    { id: 'lightning-resonance', kind: 'element', element: 'lightning', damageMultiplier: 0.5, durationSeconds: 0, triggerPolicyId: 'element-direct-only' },
    { id: 'test-thunder-sword-rain-attack', kind: 'attack-pattern', pattern: 'multishot', projectileId: 'sword-qi', projectileCount: 4, damageMultiplier: 0.5, triggerPolicyId: 'direct-only' },
  ],
  synergies: [{
    id: 'test-thunder-sword-rain', name: '雷霆剑雨（测试前置示例）', usage: 'test-only',
    prerequisites: [
      { kind: 'hero', heroId: 'raine' },
      { kind: 'route', routeId: 'wanjian' },
      { kind: 'talent', talentId: 'lightning-enchantment', minLevel: 1 },
      { kind: 'talent', talentId: 'attack-up', minLevel: 2 },
    ],
    effectIds: ['test-thunder-sword-rain-attack'], activation: 'next-level',
  }],
  // Experimental test selection: innate lightning plus fire/ice can yield three attributes.
  // These booleans MUST be decided again before real growth uses the policy in phase 3.
  elementPolicy: {
    usage: 'test-only', maxEnchantments: 2, maxSecondaryMechanisms: 2,
    innateElementCounts: false, enchantmentsUseSecondarySlots: false,
    resonanceEffectIds: ['fire-resonance', 'ice-resonance', 'lightning-resonance'],
  },
  triggerPolicies: [
    {
      id: 'direct-only', allowedSources: ['direct'], maxDepth: 0, maxTriggersPerRoot: 1,
      cooldownSeconds: 0, targetHitIntervalSeconds: 0.1,
    },
    {
      id: 'element-direct-only', allowedSources: ['direct'], maxDepth: 0, maxTriggersPerRoot: 1,
      cooldownSeconds: 0.25, targetHitIntervalSeconds: 0.25,
    },
    {
      id: 'bounded-derived', allowedSources: ['direct', 'bounce'], maxDepth: 2, maxTriggersPerRoot: 3,
      cooldownSeconds: 0.2, targetHitIntervalSeconds: 0.2,
    },
  ],
  growth: { routeLevel: 3, branchLevel: 7, ultimateLevel: 11, freeRerolls: 2, ordinaryChoiceCount: 3 },
};
