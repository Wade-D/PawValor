import assert from 'node:assert/strict';
import test from 'node:test';

const validator = await import('../.test-build/core/validate-config.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

// This complete, hand-authored fixture is intentionally test-only.
function validConfig() {
  return {
    calibration: 'prototype',
    heroes: [{
      id: 'hero', name: 'Hero', weaponId: 'weapon',
      baseStats: { maxHealth: 100, moveSpeed: 5, attackPower: 10, critChance: 0.1, critDamageMultiplier: 1.5 },
      routeIds: ['route-a', 'route-b', 'route-c'],
    }],
    weapons: [{
      id: 'weapon', name: 'Weapon', heroId: 'hero', kind: 'longsword',
      attackIntervalSeconds: 1, range: 10, projectileId: 'projectile', baseDamage: 10, attackPowerScaling: 1,
    }],
    projectiles: [{
      id: 'projectile', movement: 'straight', speed: 5, size: { x: 1, y: 1 }, lifetimeSeconds: 2, pierceCount: 0,
      inheritance: { stats: ['attackDamage'], enchantments: true, secondaryMechanisms: false },
    }],
    talents: [{
      id: 'talent', name: 'Talent', category: 'general', maxLevel: 3,
      prerequisites: [], exclusiveTags: [], effectIds: ['stat'], weight: 1,
    }],
    routes: ['a', 'b', 'c'].map(letter => ({
      id: `route-${letter}`, name: 'Route', heroId: 'hero', entryEffectIds: ['attack'],
      branches: [
        { id: `${letter}-one`, name: 'One', effectIds: ['stat'], ultimateBehaviorEffectId: 'ultimate' },
        { id: `${letter}-two`, name: 'Two', effectIds: ['element'], ultimateBehaviorEffectId: 'ultimate' },
      ],
      ultimate: { name: 'Evolution', effectId: 'attack' },
    })),
    effects: [
      { id: 'stat', kind: 'stat-modifier', stat: 'attackDamage', operation: 'add', value: -1 },
      { id: 'attack', kind: 'attack-pattern', pattern: 'multishot', projectileId: 'projectile', projectileCount: 2, damageMultiplier: 0.8, triggerPolicyId: 'trigger' },
      { id: 'element', kind: 'element', element: 'fire', damageMultiplier: 0.2, durationSeconds: 1, triggerPolicyId: 'trigger' },
      { id: 'ultimate', kind: 'ultimate-behavior', behaviorId: 'sword-array', projectileId: 'projectile', damageMultiplier: 2, triggerPolicyId: 'trigger' },
    ],
    synergies: [{ id: 'synergy', name: 'Synergy', usage: 'test-only', prerequisites: [], effectIds: ['element'], activation: 'next-level' }],
    elementPolicy: {
      usage: 'test-only', maxEnchantments: 2, maxSecondaryMechanisms: 2,
      innateElementCounts: true, enchantmentsUseSecondarySlots: false, resonanceEffectIds: ['element'],
    },
    triggerPolicies: [{
      id: 'trigger', allowedSources: ['direct'], maxDepth: 0, maxTriggersPerRoot: 1,
      cooldownSeconds: 0, targetHitIntervalSeconds: 0,
    }],
    growth: { routeLevel: 3, branchLevel: 7, ultimateLevel: 11, freeRerolls: 2, ordinaryChoiceCount: 3 },
  };
}

function validate(config) {
  assert.equal(typeof validator.validateGameConfig, 'function', 'validateGameConfig must be exported');
  const issues = validator.validateGameConfig(config);
  assert.ok(Array.isArray(issues));
  for (const issue of issues) {
    assert.equal(typeof issue.code, 'string');
    assert.ok(issue.code.length > 0);
    assert.equal(typeof issue.path, 'string');
    assert.ok(issue.path.length > 0);
    assert.equal(typeof issue.message, 'string');
    assert.ok(issue.message.trim().length > 0);
  }
  return issues;
}

function hasIssue(issues, code, path) {
  assert.ok(issues.some(issue => issue.code === code && issue.path === path),
    `Expected ${code} at ${path}; received ${JSON.stringify(issues)}`);
}

function setPath(config, path, value) {
  const keys = path.replaceAll('[', '.').replaceAll(']', '').split('.');
  const last = keys.pop();
  let target = config;
  for (const key of keys) target = target[key];
  target[last] = value;
}

test('accepts the complete minimum configuration', () => {
  assert.deepEqual(validate(validConfig()), []);
});

for (const innateElementCounts of [true, false]) {
  for (const enchantmentsUseSecondarySlots of [true, false]) {
    test(`accepts explicit element policies innate=${innateElementCounts}, sharedSlots=${enchantmentsUseSecondarySlots}`, () => {
      const config = validConfig();
      Object.assign(config.elementPolicy, { innateElementCounts, enchantmentsUseSecondarySlots });
      assert.deepEqual(validate(config), []);
    });
  }
}

for (const collection of ['heroes', 'weapons', 'projectiles', 'talents', 'routes', 'effects', 'synergies', 'triggerPolicies']) {
  test(`reports duplicate ${collection} IDs at the duplicate entry`, () => {
    const config = validConfig();
    const index = config[collection].length;
    config[collection].push(structuredClone(config[collection][0]));
    hasIssue(validate(config), 'duplicate-id', `${collection}[${index}].id`);
  });
  for (const id of ['', '  ']) {
    test(`rejects ${JSON.stringify(id)} ${collection} ID at its field`, () => {
      const config = validConfig();
      config[collection][0].id = id;
      hasIssue(validate(config), 'invalid-id', `${collection}[0].id`);
    });
  }
}

test('branch IDs must be nonempty and globally unique across routes', () => {
  const config = validConfig();
  config.routes[0].branches[0].id = '';
  config.routes[1].branches[0].id = 'a-two';
  config.routes[2].branches[1].id = 'c-one';
  const issues = validate(config);
  hasIssue(issues, 'invalid-id', 'routes[0].branches[0].id');
  hasIssue(issues, 'duplicate-id', 'routes[1].branches[0].id');
  hasIssue(issues, 'duplicate-id', 'routes[2].branches[1].id');
});

const referencePaths = [
  'heroes[0].weaponId', 'heroes[0].routeIds[0]', 'weapons[0].heroId', 'weapons[0].projectileId',
  'routes[0].heroId', 'routes[0].entryEffectIds[0]', 'routes[0].branches[0].effectIds[0]',
  'routes[0].branches[0].ultimateBehaviorEffectId', 'routes[0].ultimate.effectId',
  'talents[0].effectIds[0]', 'synergies[0].effectIds[0]', 'elementPolicy.resonanceEffectIds[0]',
  'effects[1].projectileId', 'effects[1].triggerPolicyId', 'effects[2].triggerPolicyId',
  'effects[3].projectileId', 'effects[3].triggerPolicyId',
];
for (const path of referencePaths) {
  test(`rejects a dangling reference at ${path}`, () => {
    const config = validConfig();
    setPath(config, path, 'missing');
    hasIssue(validate(config), 'dangling-reference', path);
  });
}

const prerequisites = [
  [{ kind: 'hero', heroId: 'hero' }, 'heroId'],
  [{ kind: 'talent', talentId: 'talent', minLevel: 2 }, 'talentId'],
  [{ kind: 'route', routeId: 'route-a' }, 'routeId'],
  [{ kind: 'branch', branchId: 'a-one' }, 'branchId'],
  [{ kind: 'synergy', synergyId: 'synergy' }, 'synergyId'],
];
for (const collection of ['talents', 'synergies']) {
  test(`accepts every supported ${collection} prerequisite kind`, () => {
    const config = validConfig();
    config[collection][0].prerequisites = prerequisites.map(([entry]) => ({ ...entry }));
    assert.deepEqual(validate(config), []);
  });
  for (const [entry, field] of prerequisites) {
    test(`resolves ${collection} ${entry.kind} prerequisites using the proper collection`, () => {
      const config = validConfig();
      config[collection][0].prerequisites = [{ ...entry, [field]: 'missing' }];
      hasIssue(validate(config), 'dangling-reference', `${collection}[0].prerequisites[0].${field}`);
    });
  }
  test(`reports unsupported ${collection} prerequisite kinds instead of ignoring them`, () => {
    const config = validConfig();
    config[collection][0].prerequisites = [{ kind: 'unknown', heroId: 'hero' }];
    hasIssue(validate(config), 'invalid-kind', `${collection}[0].prerequisites[0].kind`);
  });
  test(`rejects ${collection} prerequisites above the referenced talent maximum`, () => {
    const config = validConfig();
    config[collection][0].prerequisites = [{ kind: 'talent', talentId: 'talent', minLevel: 4 }];
    hasIssue(validate(config), 'prerequisite-level', `${collection}[0].prerequisites[0].minLevel`);
  });
}

function addOtherHero(config) {
  config.heroes.push({ ...structuredClone(config.heroes[0]), id: 'other', weaponId: 'other-weapon', routeIds: ['other-a', 'other-b', 'other-c'] });
  config.weapons.push({ ...structuredClone(config.weapons[0]), id: 'other-weapon', heroId: 'other' });
  for (const [i, letter] of ['a', 'b', 'c'].entries()) {
    const route = structuredClone(config.routes[i]);
    route.id = `other-${letter}`;
    route.heroId = 'other';
    route.branches.forEach(branch => { branch.id = `other-${branch.id}`; });
    config.routes.push(route);
  }
}

test('accepts multiple hero definitions with independently bound weapons and routes', () => {
  const config = validConfig();
  addOtherHero(config);
  assert.deepEqual(validate(config), []);
});

for (const [path, value] of [
  ['heroes[0].weaponId', 'other-weapon'], ['weapons[0].heroId', 'other'],
  ['heroes[0].routeIds[0]', 'other-a'], ['routes[0].heroId', 'other'],
]) {
  test(`rejects inconsistent hero ownership at ${path}`, () => {
    const config = validConfig();
    addOtherHero(config);
    setPath(config, path, value);
    hasIssue(validate(config), 'hero-ownership', path);
  });
}

for (const count of [0, 1, 3]) {
  test(`rejects a route with ${count} branches`, () => {
    const config = validConfig();
    config.routes[0].branches = Array.from({ length: count }, (_, i) => ({ ...config.routes[0].branches[i % 2], id: `test-${i}` }));
    hasIssue(validate(config), 'invalid-count', 'routes[0].branches');
  });
}

test('heroes must list three distinct routes', () => {
  const config = validConfig();
  config.heroes[0].routeIds = ['route-a', 'route-a'];
  const issues = validate(config);
  hasIssue(issues, 'invalid-count', 'heroes[0].routeIds');
  hasIssue(issues, 'duplicate-reference', 'heroes[0].routeIds[1]');
});

test('requires ultimate declarations and branch behavior effects of the correct kind', () => {
  const config = validConfig();
  delete config.routes[0].ultimate;
  delete config.routes[0].branches[0].ultimateBehaviorEffectId;
  config.routes[0].branches[1].ultimateBehaviorEffectId = 'stat';
  const issues = validate(config);
  hasIssue(issues, 'invalid-value', 'routes[0].ultimate');
  hasIssue(issues, 'invalid-id', 'routes[0].branches[0].ultimateBehaviorEffectId');
  hasIssue(issues, 'invalid-effect-kind', 'routes[0].branches[1].ultimateBehaviorEffectId');
});

const numericPaths = [
  'heroes[0].baseStats.maxHealth', 'heroes[0].baseStats.moveSpeed', 'heroes[0].baseStats.attackPower',
  'heroes[0].baseStats.critChance', 'heroes[0].baseStats.critDamageMultiplier',
  'weapons[0].attackIntervalSeconds', 'weapons[0].range', 'weapons[0].baseDamage', 'weapons[0].attackPowerScaling',
  'projectiles[0].speed', 'projectiles[0].size.x', 'projectiles[0].size.y', 'projectiles[0].lifetimeSeconds', 'projectiles[0].pierceCount',
  'talents[0].maxLevel', 'talents[0].weight', 'effects[0].value', 'effects[1].projectileCount',
  'effects[1].damageMultiplier', 'effects[2].damageMultiplier', 'effects[2].durationSeconds', 'effects[3].damageMultiplier',
  'triggerPolicies[0].maxDepth', 'triggerPolicies[0].maxTriggersPerRoot', 'triggerPolicies[0].cooldownSeconds',
  'triggerPolicies[0].targetHitIntervalSeconds', 'growth.freeRerolls',
  'growth.routeLevel', 'growth.branchLevel', 'growth.ultimateLevel', 'growth.ordinaryChoiceCount',
  'elementPolicy.maxEnchantments', 'elementPolicy.maxSecondaryMechanisms',
];
for (const value of [NaN, Infinity, -Infinity]) {
  test(`rejects ${String(value)} in every numeric parameter and returns all issues`, () => {
    const config = validConfig();
    for (const path of numericPaths) setPath(config, path, value);
    const issues = validate(config);
    for (const path of numericPaths) hasIssue(issues, 'invalid-number', path);
  });
}

for (const [path, values] of [
  ['heroes[0].baseStats.maxHealth', [0, -1]],
  ['heroes[0].baseStats.moveSpeed', [-1]], ['heroes[0].baseStats.attackPower', [-1]],
  ['heroes[0].baseStats.critChance', [-0.1, 1.1]], ['heroes[0].baseStats.critDamageMultiplier', [-1]],
  ['weapons[0].attackIntervalSeconds', [0, -1]], ['weapons[0].range', [-1]],
  ['weapons[0].baseDamage', [-1]], ['weapons[0].attackPowerScaling', [-1]],
  ['projectiles[0].speed', [-1]], ['projectiles[0].size.x', [0, -1]], ['projectiles[0].size.y', [0, -1]],
  ['projectiles[0].lifetimeSeconds', [0, -1]], ['projectiles[0].pierceCount', [-1, 0.5]],
  ['talents[0].maxLevel', [0, -1, 1.5]], ['talents[0].weight', [-1]],
  ['effects[1].projectileCount', [0, -1, 1.5]], ['effects[1].damageMultiplier', [-1]],
  ['effects[2].damageMultiplier', [-1]], ['effects[2].durationSeconds', [-1]], ['effects[3].damageMultiplier', [-1]],
  ['triggerPolicies[0].maxDepth', [-1, 0.5, undefined]],
  ['triggerPolicies[0].maxTriggersPerRoot', [0, -1, 0.5, undefined]],
  ['triggerPolicies[0].cooldownSeconds', [-1]], ['triggerPolicies[0].targetHitIntervalSeconds', [-1]],
  ['growth.freeRerolls', [-1, 0.5]],
]) {
  for (const value of values) {
    test(`rejects invalid numeric value ${String(value)} at ${path}`, () => {
      const config = validConfig();
      setPath(config, path, value);
      hasIssue(validate(config), 'invalid-number', path);
    });
  }
}

test('derived sources require finite integer depth and per-root limits', () => {
  const config = validConfig();
  Object.assign(config.triggerPolicies[0], { allowedSources: ['split', 'bounce', 'explosion', 'element', 'damage-over-time', 'synergy'], maxDepth: 3, maxTriggersPerRoot: 5 });
  assert.deepEqual(validate(config), []);
  config.triggerPolicies[0].maxDepth = Infinity;
  config.triggerPolicies[0].maxTriggersPerRoot = Infinity;
  const issues = validate(config);
  hasIssue(issues, 'invalid-number', 'triggerPolicies[0].maxDepth');
  hasIssue(issues, 'invalid-number', 'triggerPolicies[0].maxTriggersPerRoot');
});

for (const minLevel of [0, -1, 0.5, NaN, Infinity]) {
  test(`rejects invalid prerequisite minimum level ${String(minLevel)}`, () => {
    const config = validConfig();
    config.talents[0].prerequisites = [{ kind: 'talent', talentId: 'talent', minLevel }];
    hasIssue(validate(config), 'invalid-number', 'talents[0].prerequisites[0].minLevel');
  });
}

for (const [path, value, code] of [
  ['calibration', 'production', 'invalid-value'],
  ['growth.routeLevel', 4, 'invalid-value'], ['growth.branchLevel', 6, 'invalid-value'],
  ['growth.ultimateLevel', 12, 'invalid-value'], ['growth.ordinaryChoiceCount', 2, 'invalid-value'],
  ['elementPolicy.usage', 'production', 'invalid-value'], ['elementPolicy.maxEnchantments', 1, 'invalid-value'],
  ['elementPolicy.maxSecondaryMechanisms', 3, 'invalid-value'],
  ['elementPolicy.innateElementCounts', 'yes', 'invalid-value'],
  ['elementPolicy.enchantmentsUseSecondarySlots', undefined, 'invalid-value'],
  ['weapons[0].kind', 'gun', 'invalid-value'], ['projectiles[0].movement', 'teleport', 'invalid-value'],
  ['projectiles[0].inheritance.stats[0]', 'unknown', 'invalid-value'],
  ['projectiles[0].inheritance.enchantments', 'yes', 'invalid-value'],
  ['projectiles[0].inheritance.secondaryMechanisms', undefined, 'invalid-value'],
  ['talents[0].category', 'unknown', 'invalid-value'], ['effects[0].stat', 'unknown', 'invalid-value'],
  ['effects[0].operation', 'divide', 'invalid-value'], ['effects[1].pattern', 'unknown', 'invalid-value'],
  ['effects[2].element', 'unknown', 'invalid-value'], ['effects[3].behaviorId', '', 'invalid-id'],
  ['effects[0].kind', 'unknown', 'invalid-kind'],
  ['synergies[0].usage', 'production', 'invalid-value'], ['synergies[0].activation', 'immediate', 'invalid-value'],
  ['triggerPolicies[0].allowedSources[0]', 'unknown', 'invalid-value'],
]) {
  test(`rejects invalid domain value at ${path}`, () => {
    const config = validConfig();
    setPath(config, path, value);
    hasIssue(validate(config), code, path);
  });
}

test('permits zero weights/cooldowns, boundary probabilities, and signed additive modifiers', () => {
  const config = validConfig();
  config.talents[0].weight = 0;
  config.heroes[0].baseStats.critChance = 1;
  config.effects[0].value = -10;
  assert.deepEqual(validate(config), []);
  config.heroes[0].baseStats.critChance = 0;
  assert.deepEqual(validate(config), []);
});

test('collects independent failures in one call with actionable paths', () => {
  const config = validConfig();
  config.talents[0].maxLevel = 0;
  config.talents[0].weight = -1;
  config.weapons[0].projectileId = 'missing';
  config.growth.routeLevel = 2;
  assert.deepEqual(validate(config).map(({ code, path }) => ({ code, path })).sort((a, b) => a.path.localeCompare(b.path)), [
    { code: 'invalid-value', path: 'growth.routeLevel' },
    { code: 'invalid-number', path: 'talents[0].maxLevel' },
    { code: 'invalid-number', path: 'talents[0].weight' },
    { code: 'dangling-reference', path: 'weapons[0].projectileId' },
  ]);
});

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

for (const invalid of [false, true]) {
  test(`never mutates ${invalid ? 'invalid' : 'valid'} input, including NaN and frozen nested arrays`, () => {
    const config = validConfig();
    if (invalid) {
      config.talents[0].weight = NaN;
      config.routes[1].branches[0].id = 'a-one';
    }
    const before = structuredClone(config);
    deepFreeze(config);
    const issues = validate(config);
    assert.equal(issues.length > 0, invalid);
    assert.deepEqual(config, before);
  });
}
