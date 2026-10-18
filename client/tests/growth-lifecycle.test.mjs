import assert from 'node:assert/strict';
import test from 'node:test';
import { GrowthSession } from '../.test-build/core/growth-session.js';
import { fixtureConfig, sessionOptions, sequenceRandom, firstOption } from './helpers/growth-fixtures.mjs';

test('重开清空所有成长状态与奖励，恢复刷新并拒绝旧令牌', () => {
  const config = fixtureConfig(); config.talents.forEach(t => t.weight = 0);
  const s = new GrowthSession(config, sessionOptions()); s.grantXp(55);
  const old = s.snapshot(); s.reroll(old.token);
  while (s.snapshot().growth.pendingChoice) { const snap = s.snapshot(); s.select(snap.token, firstOption(snap)); }
  assert.ok(s.snapshot().build.ultimateEvolution); assert.ok(s.snapshot().build.bonusRewardCounts['base-attack'] > 0);
  for (let i = 0; i < 2; i++) {
    s.reset(sequenceRandom().random); const initial = s.snapshot();
    assert.equal(initial.xp, 0); assert.equal(initial.build.level, 1); assert.equal(initial.build.routeId, null);
    assert.equal(initial.build.branchId, null); assert.equal(initial.build.ultimateEvolution, null);
    assert.deepEqual(initial.build.bonusRewardCounts, { 'base-attack':0,'base-health':0,'base-move-speed':0 });
    assert.deepEqual(initial.build.talentLevels, {}); assert.deepEqual(initial.growth.pendingTargetLevels, []);
    assert.equal(initial.token, null); assert.equal(initial.rerollsRemaining, 2);
    s.grantXp(55); const fresh = s.snapshot();
    assert.deepEqual(fresh.growth.pendingChoice, old.growth.pendingChoice);
    assert.ok(fresh.token.generation > old.token.generation);
    assert.equal(s.select(old.token, firstOption(old)).reason, 'stale-token');
  }
});

for (const failure of ['NaN', 'throw']) test(`抽取中途${failure}时，grantXp、刷新与推进下一等级全部回滚`, () => {
  let failAt = 2; let calls = 0;
  const random = { next() { calls++; if (calls === failAt) { if (failure === 'throw') throw new Error('测试随机源故障'); return NaN; } return 0; } };
  const s = new GrowthSession(fixtureConfig(), sessionOptions(random)); const initial = s.snapshot();
  assert.throws(() => s.grantXp(5)); assert.deepEqual(s.snapshot(), initial);
  failAt = Infinity; s.grantXp(15); let before = s.snapshot();
  failAt = calls + 2;
  assert.throws(() => s.reroll(before.token)); assert.deepEqual(s.snapshot(), before);
  failAt = Infinity; s.select(before.token, firstOption(before)); before = s.snapshot();
  assert.equal(before.growth.pendingChoice.kind, 'route'); failAt = calls + 2;
  assert.throws(() => s.select(before.token, firstOption(before))); assert.deepEqual(s.snapshot(), before);
  failAt = Infinity;
  assert.equal(s.select(before.token, firstOption(before)).ok, true);
});

test('零经验与封顶后的奖励不会重复入队，未提交升级仍可完成', () => {
  const s = new GrowthSession(fixtureConfig(), sessionOptions()); s.grantXp(55); const before = s.snapshot();
  s.grantXp(0); s.grantXp(Number.MAX_VALUE); assert.deepEqual(s.snapshot(), before);
  while (s.snapshot().growth.pendingChoice) { const snap = s.snapshot(); s.select(snap.token, firstOption(snap)); }
  assert.equal(s.snapshot().build.level, 12); assert.deepEqual(s.snapshot().growth.pendingTargetLevels, []);
});

test('随机源回调不能重入重置并覆盖正在提交的成长事务', () => {
  let s; let reenter = false;
  const random = { next() { if (reenter) s.reset(sequenceRandom().random); return 0; } };
  s = new GrowthSession(fixtureConfig(), sessionOptions(random)); s.grantXp(5);
  const before = s.snapshot(); reenter = true;
  assert.throws(() => s.reroll(before.token), /事务/);
  assert.deepEqual(s.snapshot(), before);
  reenter = false; assert.equal(s.reroll(before.token).ok, true);
});

test('非法随机源不能重置已有状态', () => {
  const s = new GrowthSession(fixtureConfig(), sessionOptions()); s.grantXp(5); const before = s.snapshot();
  assert.throws(() => s.reset(null)); assert.deepEqual(s.snapshot(), before);
});
