import assert from 'node:assert/strict';
import test from 'node:test';
import { GrowthSession } from '../.test-build/core/growth-session.js';
import { fixtureConfig, sessionOptions, sequenceRandom, firstOption } from './helpers/growth-fixtures.mjs';

test('相同局次和版本的跨实例令牌不能互用', () => {
  const a = new GrowthSession(fixtureConfig(), sessionOptions()); const b = new GrowthSession(fixtureConfig(), sessionOptions());
  a.grantXp(5); b.grantXp(5); const before = b.snapshot(); const token = a.snapshot().token;
  assert.equal(token.generation, before.token.generation); assert.equal(token.revision, before.token.revision);
  assert.notEqual(token.sessionId, before.token.sessionId);
  assert.equal(b.select(token, firstOption(before)).reason, 'stale-token');
  assert.equal(b.reroll(token).reason, 'stale-token'); assert.deepEqual(b.snapshot(), before);
});

test('普通选择与构筑快照的所有嵌套修改均不影响会话', () => {
  const s = new GrowthSession(fixtureConfig(), sessionOptions()); s.grantXp(15);
  const before = s.snapshot(); const view = s.snapshot();
  view.build.talentLevels.fake = 99; view.build.bonusRewardCounts['base-attack'] = 99;
  view.build.pendingSynergies.push({ synergyId:'fake', eligibleAtLevel:1, activateAtLevel:2 });
  view.build.activeSynergyIds.push('fake'); view.build.enchantmentIds.push('fake'); view.build.secondaryMechanismIds.push('fake');
  view.growth.pendingChoice.options[0].id = 'fake'; view.growth.pendingChoice.options.pop();
  view.growth.pendingTargetLevels.pop(); view.token.revision = 99;
  assert.deepEqual(s.snapshot(), before);
});

test('路线、分支、终极与事件返回值均不会泄漏内部引用', () => {
  const s = new GrowthSession(fixtureConfig(), sessionOptions()); s.grantXp(55);
  while (s.snapshot().growth.pendingChoice) {
    const before = s.snapshot(); const view = s.snapshot(); const choice = view.growth.pendingChoice;
    if (choice.kind === 'route') choice.routeIds[0] = 'fake';
    if (choice.kind === 'branch') choice.branchIds[0] = 'fake';
    assert.deepEqual(s.snapshot(), before);
    const result = s.select(before.token, firstOption(before));
    if (result.events.length) {
      const finalBefore = s.snapshot(); result.events[0].effectId = 'fake';
      const finalView = s.snapshot(); finalView.build.ultimateEvolution.branchId = 'fake';
      assert.deepEqual(s.snapshot(), finalBefore);
    }
  }
});

test('构造后修改配置、曲线与奖励表不影响已创建会话', () => {
  const config = fixtureConfig(); const options = sessionOptions();
  const control = new GrowthSession(fixtureConfig(), sessionOptions()); const s = new GrowthSession(config, options);
  config.heroes[0].routeIds[0] = 'fake'; config.heroes[0].id = 'fake';
  for (const t of config.talents) { t.name = 'fake'; t.weight = 0; t.prerequisites.push({kind:'hero',heroId:'fake'}); }
  for (const r of config.routes) { r.id = 'fake'; r.branches[0].id = 'fake'; r.ultimate.effectId = 'fake'; }
  for (const e of config.effects) e.id = 'fake';
  options.levelCosts.fill(100); options.rewards[0].name = 'fake'; options.rewards[0].baselineFraction = 0.9;
  control.grantXp(55); s.grantXp(55);
  while (control.snapshot().growth.pendingChoice) {
    const a = control.snapshot(); const b = s.snapshot();
    assert.deepEqual(b.build, a.build); assert.deepEqual(b.growth, a.growth);
    assert.equal(b.earnedLevel, 12); assert.equal(b.xp, 55);
    const x = control.select(a.token, firstOption(a)); const y = s.select(b.token, firstOption(b));
    assert.deepEqual(y, x);
  }
});

test('配置 ID 为 __proto__ 时不会继承或更改字典原型', () => {
  const config = fixtureConfig(); config.synergies = [];
  config.talents[0].id = '__proto__'; config.talents[0].maxLevel = 1;
  const s = new GrowthSession(config, sessionOptions()); s.grantXp(15);
  const a = s.snapshot(); assert.equal(firstOption(a), 'talent:__proto__');
  s.select(a.token, firstOption(a));
  const b = s.snapshot(); assert.equal(b.build.talentLevels.__proto__, 1);
  assert.equal(Object.getPrototypeOf(b.build.talentLevels), Object.prototype);
  s.select(b.token, firstOption(b));
  assert.ok(s.snapshot().growth.pendingChoice.options.every(o => o.talentId !== '__proto__'));
});
