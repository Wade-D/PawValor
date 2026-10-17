import assert from 'node:assert/strict';
import test from 'node:test';
import { validateGameConfig } from '../.test-build/core/validate-config.js';

const module = await import('../.test-build/config/raine.prototype.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND'
    && error.url === new URL('../.test-build/config/raine.prototype.js', import.meta.url).href) return {};
  throw error;
});

function config() {
  assert.ok(module.rainePrototypeConfig, 'rainePrototypeConfig must be exported');
  return module.rainePrototypeConfig;
}

function effectFor(talent) {
  assert.equal(talent.effectIds.length, 1, `${talent.name} has one declarative effect`);
  const effect = config().effects.find(item => item.id === talent.effectIds[0]);
  assert.ok(effect, `${talent.name} must reference an existing effect`);
  return effect;
}

test('Raine binds only a longsword with a ranged projectile', () => {
  const data = config();
  assert.equal(data.heroes.length, 1);
  const [hero] = data.heroes;
  assert.equal(hero.id, 'raine');
  assert.equal(hero.name, '雷恩');
  assert.equal(data.weapons.length, 1);
  const [weapon] = data.weapons;
  assert.equal(hero.weaponId, 'raine-longsword');
  assert.equal(weapon.id, hero.weaponId);
  assert.equal(weapon.heroId, hero.id);
  assert.equal(weapon.kind, 'longsword');
  assert.ok(weapon.range > 0);
  const projectile = data.projectiles.find(item => item.id === weapon.projectileId);
  assert.equal(projectile?.movement, 'straight');
  assert.ok(projectile.speed > 0);
});

const evolutionPaths = [
  ['wanjian', '万剑流', ['散华', '聚锋'], '万剑归宗'],
  ['thunder', '雷霆流', ['连锁雷击', '雷霆贯心'], '雷神审判'],
  ['returning-sword', '回旋剑流', ['护体飞剑', '追魂剑'], '无尽剑轮'],
];

for (const [id, name, branches, ultimate] of evolutionPaths) {
  test(`${name} keeps its two branches and corresponding ultimate`, () => {
    const data = config();
    const route = data.routes.find(item => item.id === id);
    assert.ok(route, `${name} must exist`);
    assert.ok(data.heroes[0].routeIds.includes(id));
    assert.equal(route.heroId, 'raine');
    assert.equal(route.name, name);
    assert.deepEqual(route.branches.map(item => item.name), branches);
    assert.equal(route.ultimate.name, ultimate);
    const behaviors = route.branches.map(branch => {
      const effect = data.effects.find(item => item.id === branch.ultimateBehaviorEffectId);
      assert.equal(effect?.kind, 'ultimate-behavior');
      return effect.behaviorId;
    });
    assert.equal(new Set(behaviors).size, 2, 'branch differences need separate planned behavior references');
  });
}

test('only three bound evolution routes exist', () => {
  assert.equal(config().routes.length, 3);
  assert.deepEqual([...config().heroes[0].routeIds].sort(), ['returning-sword', 'thunder', 'wanjian']);
});

// Independent expectations transcribed from original design section 6.
const generalTalents = [
  ['attack-up', '攻击强化', 5, 'attackDamage', 'multiply', 1.10],
  ['attack-speed-up', '迅捷攻击', 5, 'attackSpeed', 'multiply', 1.08],
  ['crit-chance-up', '精准暴击', 4, 'critChance', 'add', 0.05],
  ['crit-damage-up', '致命一击', 3, 'critDamageMultiplier', 'add', 0.20],
  ['pierce-up', '穿透强化', 2, 'pierceCount', 'add', 1],
  ['projectile-size-up', '弹道扩大', 3, 'projectileSize', 'multiply', 1.10],
  ['range-up', '射程提升', 3, 'range', 'multiply', 1.12],
  ['area-size-up', '范围增幅', 3, 'areaSize', 'multiply', 1.10],
  ['max-health-up', '生命强化', 3, 'maxHealth', 'multiply', 1.12],
  ['move-speed-up', '轻盈步伐', 3, 'moveSpeed', 'multiply', 1.06],
  ['armor-up', '坚韧护甲', 3, 'damageReduction', 'add', 0.06],
];

for (const [id, name, cap, stat, operation, value] of generalTalents) {
  test(`${name} preserves its original per-rank value and cap`, () => {
    const talent = config().talents.find(item => item.id === id);
    assert.ok(talent, `${name} must exist`);
    assert.equal(talent.name, name);
    assert.equal(talent.category, 'general');
    assert.equal(talent.maxLevel, cap);
    const effect = effectFor(talent);
    assert.equal(effect.kind, 'stat-modifier');
    assert.equal(effect.stat, stat);
    assert.equal(effect.operation, operation);
    assert.equal(effect.value, value);
  });
}

test('the twelfth general talent adds one separately weakened projectile', () => {
  const talent = config().talents.find(item => item.id === 'extra-projectile');
  assert.ok(talent);
  assert.equal(talent.name, '额外弹体');
  assert.equal(talent.category, 'general');
  assert.equal(talent.maxLevel, 1);
  const effect = effectFor(talent);
  assert.equal(effect.kind, 'attack-pattern');
  assert.equal(effect.projectileCount, 1);
  assert.ok(effect.damageMultiplier > 0 && effect.damageMultiplier < 1);
  assert.ok(config().projectiles.some(item => item.id === effect.projectileId));
});

test('the twelve general talent caps match the baseline in design order', () => {
  const talents = config().talents.filter(item => item.category === 'general');
  assert.equal(talents.length, 12);
  const ids = [...generalTalents.map(([id]) => id), 'extra-projectile'];
  assert.deepEqual(ids.map(id => talents.find(item => item.id === id)?.maxLevel),
    [5, 5, 4, 3, 2, 3, 3, 3, 3, 3, 3, 1]);
});

test('fixed evolution levels and ordinary three-choice growth remain distinct', () => {
  assert.deepEqual(config().growth, {
    routeLevel: 3, branchLevel: 7, ultimateLevel: 11, freeRerolls: 2, ordinaryChoiceCount: 3,
  });
});

test('fire, ice and lightning each have a usable enchantment reference', () => {
  const elements = config().talents.filter(item => item.category === 'enchantment').map(talent => {
    const effect = effectFor(talent);
    assert.equal(effect.kind, 'element');
    return effect.element;
  });
  assert.deepEqual(elements.sort(), ['fire', 'ice', 'lightning']);
});

test('the example synergy declares real prerequisites and next-level test-only activation', () => {
  assert.equal(config().synergies.length, 1);
  const [synergy] = config().synergies;
  assert.equal(synergy.id, 'test-thunder-sword-rain');
  assert.match(synergy.name, /测试/);
  assert.equal(synergy.usage, 'test-only');
  assert.equal(synergy.activation, 'next-level');
  assert.ok(synergy.prerequisites.some(item => item.kind === 'route' && item.routeId === 'wanjian'));
  assert.ok(synergy.prerequisites.some(item => item.kind === 'talent' && item.talentId === 'lightning-enchantment' && item.minLevel === 1));
  assert.ok(synergy.prerequisites.some(item => item.kind === 'talent' && item.talentId === 'attack-up' && item.minLevel === 2));
  assert.ok(synergy.effectIds.length > 0);
});

test('all numbers and experimental element decisions are explicitly prototype data', () => {
  const data = config();
  assert.equal(data.calibration, 'prototype');
  assert.deepEqual(data.elementPolicy, {
    usage: 'test-only', maxEnchantments: 2, maxSecondaryMechanisms: 2,
    innateElementCounts: false, enchantmentsUseSecondarySlots: false,
    resonanceEffectIds: ['fire-resonance', 'ice-resonance', 'lightning-resonance'],
  });
  for (const effect of data.effects.filter(item => item.kind === 'element')) {
    const policy = data.triggerPolicies.find(item => item.id === effect.triggerPolicyId);
    assert.ok(policy);
    assert.deepEqual(policy.allowedSources, ['direct'], 'derived hits cannot recursively retrigger elements');
    assert.ok(Number.isFinite(policy.maxDepth));
    assert.ok(Number.isFinite(policy.maxTriggersPerRoot));
  }
  const assertDataOnly = value => {
    assert.notEqual(typeof value, 'function', 'configuration cannot contain executors');
    if (value && typeof value === 'object') Object.values(value).forEach(assertDataOnly);
  };
  assertDataOnly(data);
});

test('the complete Raine configuration resolves and passes the real validator', () => {
  assert.deepEqual(validateGameConfig(config()), []);
});
