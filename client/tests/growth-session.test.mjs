import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureConfig, sessionOptions, firstOption, sequenceRandom } from './helpers/growth-fixtures.mjs';
const api = await import('../.test-build/core/growth-session.js').catch(() => ({}));
const create = (config = fixtureConfig(), options = sessionOptions()) => {
  assert.equal(typeof api.GrowthSession, 'function', '必须提供成长会话');
  return new api.GrowthSession(config, options);
};
function chooseFirst(session) { const s = session.snapshot(); return session.select(s.token, firstOption(s)); }

test('经验先产生待选，提交后才改变构筑，待选期间只扩展队列', () => {
  const session = create(); assert.equal(session.snapshot().build.level, 1);
  assert.deepEqual(session.grantXp(5), []);
  const before = session.snapshot();
  assert.equal(before.build.level, 1); assert.equal(before.earnedLevel, 2);
  assert.equal(before.growth.pendingChoice.kind, 'ordinary'); assert.equal(before.growth.pendingChoice.options.length, 3);
  assert.deepEqual(before.growth.pendingTargetLevels, [2]);
  session.grantXp(10);
  const waiting = session.snapshot();
  assert.deepEqual(waiting.token, before.token); assert.deepEqual(waiting.growth.pendingChoice, before.growth.pendingChoice);
  assert.deepEqual(waiting.growth.pendingTargetLevels, [2, 3, 4]);
  assert.equal(session.select(before.token, 'not-offered').reason, 'invalid-option');
  assert.equal(chooseFirst(session).ok, true);
  const after = session.snapshot();
  assert.equal(after.build.level, 2); assert.equal(after.build.talentLevels['attack-up'], 1);
  assert.equal(after.growth.pendingChoice.kind, 'route'); assert.deepEqual(after.growth.pendingTargetLevels, [3, 4]);
});

for (const routeId of ['wanjian', 'thunder', 'returning-sword']) for (const branchIndex of [0, 1]) {
  test(`${routeId} 第 ${branchIndex + 1} 分支跨级时按序选择，终极只授予一次`, () => {
    const config = fixtureConfig(); const route = config.routes.find(r => r.id === routeId);
    const session = create(config); session.grantXp(55);
    assert.equal(session.snapshot().xpCapped, true);
    const order = []; const events = [];
    let oldToken; let oldOption;
    while (session.snapshot().growth.pendingChoice) {
      const snap = session.snapshot(); const choice = snap.growth.pendingChoice;
      order.push(choice.targetLevel);
      let selected = firstOption(snap);
      if (choice.kind === 'route') {
        assert.deepEqual(choice.routeIds, config.heroes[0].routeIds); selected = routeId;
        assert.equal(session.reroll(snap.token).reason, 'fixed-node');
      }
      if (choice.kind === 'branch') {
        assert.deepEqual(choice.branchIds, route.branches.map(b => b.id)); selected = route.branches[branchIndex].id;
        assert.equal(session.select(snap.token, 'foreign-branch').reason, 'invalid-option');
        assert.equal(session.reroll(snap.token).reason, 'fixed-node');
      }
      oldToken = snap.token; oldOption = selected;
      const result = session.select(snap.token, selected); assert.equal(result.ok, true);
      for (const event of result.events) { order.push(event.targetLevel); events.push(event); }
    }
    assert.deepEqual(order, [2,3,4,5,6,7,8,9,10,11,12]);
    assert.deepEqual(events, [{ type: 'ultimateEvolution', targetLevel: 11, routeId, branchId: route.branches[branchIndex].id,
      effectId: route.ultimate.effectId, ultimateBehaviorEffectId: route.branches[branchIndex].ultimateBehaviorEffectId }]);
    const final = session.snapshot();
    assert.equal(final.build.level, 12); assert.equal(final.build.routeId, routeId);
    assert.equal(final.build.branchId, route.branches[branchIndex].id); assert.deepEqual(final.build.ultimateEvolution, events[0]);
    assert.equal(final.rerollsRemaining, 2); assert.equal(final.token, null);
    assert.equal(session.select(oldToken, oldOption).reason, 'no-choice');
    assert.deepEqual(session.grantXp(0), []); assert.deepEqual(session.grantXp(100), []);
    assert.deepEqual(session.snapshot(), final);
  });
}

test('普通刷新可出现相同卡组，两次后拒绝，旧卡版本失效', () => {
  const session = create(); session.grantXp(5);
  let snap = session.snapshot(); const original = snap;
  assert.equal(session.reroll(snap.token).ok, true);
  snap = session.snapshot();
  assert.deepEqual(snap.growth.pendingChoice, original.growth.pendingChoice);
  assert.notDeepEqual(snap.token, original.token); assert.equal(snap.rerollsRemaining, 1);
  assert.equal(session.select(original.token, firstOption(original)).reason, 'stale-token');
  assert.equal(session.reroll(original.token).reason, 'stale-token');
  assert.equal(session.reroll(snap.token).ok, true); snap = session.snapshot();
  assert.equal(session.reroll(snap.token).reason, 'no-rerolls'); assert.equal(session.snapshot().rerollsRemaining, 0);
});

test('独立奖励重复累计且不突破普通天赋上限', () => {
  const config = fixtureConfig(); config.synergies = [];
  config.talents.forEach(t => { t.maxLevel = 1; t.weight = t.id === 'attack-up' ? 1 : 0; });
  const session = create(config); session.grantXp(55); chooseFirst(session);
  while (session.snapshot().growth.pendingChoice) {
    const snap = session.snapshot(); const choice = snap.growth.pendingChoice;
    const option = choice.kind === 'ordinary' ? 'reward:base-attack' : firstOption(snap);
    assert.equal(session.select(snap.token, option).ok, true);
  }
  assert.deepEqual(session.snapshot().build.talentLevels, { 'attack-up': 1 });
  assert.deepEqual(session.snapshot().build.bonusRewardCounts, { 'base-attack': 7, 'base-health': 0, 'base-move-speed': 0 });
});

test('重复提交被拒绝，拒绝结果中文且状态不变', () => {
  const session = create(); session.grantXp(10); const snap = session.snapshot();
  session.select(snap.token, firstOption(snap)); const after = session.snapshot();
  const result = session.select(snap.token, firstOption(snap));
  assert.equal(result.ok, false); assert.equal(result.reason, 'stale-token'); assert.match(result.message, /[\u4e00-\u9fff]/);
  assert.deepEqual(session.snapshot(), after);
});

test('无选择与非法配置、经验输入均明确拒绝', () => {
  const session = create(); const snap = session.snapshot();
  assert.equal(session.select({sessionId:0,generation:0,revision:0}, '').reason, 'no-choice');
  assert.equal(session.reroll({sessionId:0,generation:0,revision:0}).reason, 'no-choice');
  for (const amount of [-1, NaN, Infinity]) { assert.throws(() => session.grantXp(amount)); assert.deepEqual(session.snapshot(), snap); }
  assert.throws(() => create(fixtureConfig(), {...sessionOptions(), heroId:'unknown'}));
  const bad = fixtureConfig(); bad.talents[0].weight = -1; assert.throws(() => create(bad));
  assert.throws(() => create(fixtureConfig(), {...sessionOptions(), levelCosts:[5]}));
  assert.throws(() => create(fixtureConfig(), {...sessionOptions(), rewards:[]}));
});

test('注入不同经验曲线，并读取配置刷新次数', () => {
  const config = fixtureConfig(); config.growth.freeRerolls = 0;
  const session = create(config, {...sessionOptions(), levelCosts:[1,2,3,4,5,6,7,8,9,10]});
  session.grantXp(1); assert.equal(session.snapshot().earnedLevel, 2);
  assert.equal(session.reroll(session.snapshot().token).reason, 'no-rerolls');
});
