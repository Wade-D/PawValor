import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureConfig, fixtureRewards, sequenceRandom } from './helpers/growth-fixtures.mjs';
const api = await import('../.test-build/core/growth-draw.js').catch(() => ({}));
const candidates = () => fixtureConfig().talents.filter(t => t.category === 'general').slice(0, 4);
const draw = (pool, rng = sequenceRandom().random, rewards = fixtureRewards()) => api.drawOrdinaryOptions(pool, rng, rewards);

for (const [value, expected] of [[0, 'attack-up'], [0.249999, 'attack-up'], [0.25, 'attack-speed-up'], [1 - Number.EPSILON, 'attack-speed-up']]) {
  test(`权重一比三在随机值 ${value} 时选中正确区间`, () => {
    assert.equal(typeof api.drawOrdinaryOptions, 'function');
    const pool = candidates().slice(0, 2); pool[0].weight = 1; pool[1].weight = 3;
    assert.equal(draw(pool, sequenceRandom([value, 0, 0]).random)[0].talentId, expected);
  });
}

test('加权不放回抽三张，不混奖励，固定序列可复现且输入不变', () => {
  const pool = candidates(); const before = structuredClone(pool);
  const a = draw(pool, sequenceRandom([0.7, 0.2, 0.8]).random);
  assert.deepEqual(a, draw(pool, sequenceRandom([0.7, 0.2, 0.8]).random));
  assert.equal(a.length, 3); assert.equal(new Set(a.map(t => t.id)).size, 3);
  assert.ok(a.every(t => t.kind === 'talent')); assert.deepEqual(pool, before);
});

for (const count of [0, 1, 2]) test(`${count} 张天赋时用不同的独立奖励补齐三张`, () => {
  const pool = candidates().slice(0, count); const options = draw(pool);
  assert.equal(options.length, 3); assert.equal(new Set(options.map(t => t.id)).size, 3);
  assert.deepEqual(options.filter(o => o.kind === 'talent').map(o => o.talentId).sort(), pool.map(t => t.id).sort());
  for (const r of options.filter(o => o.kind === 'reward')) { assert.match(r.name, /基础/); assert.match(r.description, /1%/); }
});

test('奖励补齐按等概率区间选择且不放回', () => {
  for (const [value, id] of [[0, 'base-attack'], [1/3, 'base-health'], [2/3, 'base-move-speed']]) {
    const options = draw([], sequenceRandom([value, 0, 0]).random);
    assert.equal(options[0].rewardId, id);
    assert.equal(new Set(options.map(o => o.rewardId)).size, 3);
  }
});

test('零权重从不抽中，有限大权重不溢出，极小权重在后续仍能抽取', () => {
  const pool = candidates(); pool[0].weight = 0; pool[1].weight = Number.MAX_VALUE;
  pool[2].weight = Number.MAX_VALUE; pool[3].weight = Number.MIN_VALUE;
  assert.deepEqual(draw(pool).map(o => o.talentId), pool.slice(1).map(t => t.id));
});

test('非法权重、重复候选和非法随机数必须拒绝', () => {
  for (const weight of [-1, NaN, Infinity]) { const pool = candidates(); pool[0].weight = weight; assert.throws(() => draw(pool)); }
  const [talent] = candidates(); assert.throws(() => draw([talent, talent]));
  for (const value of [-0.1, 1, NaN, Infinity]) assert.throws(() => draw(candidates(), sequenceRandom([value]).random));
});

test('奖励表缺项、重复、未知标识、空文案和错误效果必须拒绝', () => {
  const invalid = [];
  invalid.push(fixtureRewards().slice(0, 2));
  const duplicate = fixtureRewards(); duplicate[1] = duplicate[0]; invalid.push(duplicate);
  for (const patch of [{id:'unknown'}, {name:''}, {description:' '}, {stat:'moveSpeed'}, {baselineFraction:0.02}]) {
    const rewards = fixtureRewards(); Object.assign(rewards[0], patch); invalid.push(rewards);
  }
  for (const rewards of invalid) assert.throws(() => draw([], sequenceRandom().random, rewards));
});
