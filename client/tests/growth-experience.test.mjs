import assert from 'node:assert/strict';
import test from 'node:test';

const api = await import('../.test-build/core/growth-experience.js').catch(() => ({}));
const data = await import('../.test-build/config/growth.prototype.js').catch(() => ({}));

test('成长原型保留十一段五点经验与三种独立奖励', () => {
  assert.ok(data.growthPrototype, '必须导出成长原型');
  assert.equal(data.growthPrototype.calibration, 'prototype');
  assert.deepEqual(data.growthPrototype.levelCosts, Array(11).fill(5));
  assert.deepEqual(data.growthPrototype.rewards.map(r => [r.id, r.stat, r.baselineFraction]), [
    ['base-attack', 'attackDamage', 0.01], ['base-health', 'maxHealth', 0.01], ['base-move-speed', 'moveSpeed', 0.01],
  ]);
  for (const reward of data.growthPrototype.rewards) {
    assert.match(reward.name, /[\u4e00-\u9fff]/);
    assert.match(reward.description, /1%/);
  }
});

test('经验逐级累计，已达等级与尚未提交的构筑独立', () => {
  assert.equal(typeof api.experienceThresholds, 'function');
  const thresholds = api.experienceThresholds(Array(11).fill(5));
  assert.deepEqual(thresholds, [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
  for (const [xp, level] of [[4, 1], [5, 2], [50, 11], [55, 12]]) {
    assert.deepEqual(api.applyExperience(0, xp, thresholds), { xp, earnedLevel: level, xpCapped: xp === 55 });
  }
  assert.deepEqual(api.applyExperience(0.25, 0.25, thresholds), { xp: 0.5, earnedLevel: 1, xpCapped: false });
  assert.equal(api.applyExperience(0, 55, api.experienceThresholds([1,2,3,4,5,6,7,8,9,10])).earnedLevel, 11);
});

test('巨量有限经验安全封顶，封顶后不再累加', () => {
  const thresholds = api.experienceThresholds(Array(11).fill(5));
  assert.deepEqual(api.applyExperience(54, Number.MAX_VALUE, thresholds), { xp: 55, earnedLevel: 12, xpCapped: true });
  assert.equal(api.applyExperience(55, Number.MAX_VALUE, thresholds).xp, 55);
  assert.equal(api.applyExperience(4, 0, thresholds).xp, 4);
});

test('无效或不可严格累计的经验曲线必须拒绝', () => {
  assert.equal(typeof api.experienceThresholds, 'function');
  for (const costs of [[], Array(9).fill(5), ...[0, -1, NaN, Infinity].map(v => [v, ...Array(10).fill(5)]),
    [Number.MAX_VALUE, ...Array(10).fill(Number.MAX_VALUE)], [1e20, ...Array(10).fill(1)]]) {
    assert.throws(() => api.experienceThresholds(costs));
  }
});

test('无效经验与非法累计门槛不能进入运算', () => {
  const thresholds = api.experienceThresholds(Array(11).fill(5));
  for (const value of [-1, NaN, Infinity]) {
    assert.throws(() => api.applyExperience(0, value, thresholds));
    assert.throws(() => api.applyExperience(value, 0, thresholds));
  }
  assert.throws(() => api.applyExperience(56, 0, thresholds));
  for (const bad of [[], [1, 1], [2, 1], [Infinity]]) assert.throws(() => api.applyExperience(0, 1, bad));
});
