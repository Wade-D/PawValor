import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureConfig, emptyBuild, sequenceRandom } from './helpers/growth-fixtures.mjs';
const api = await import('../.test-build/core/growth-candidates.js').catch(() => ({}));

test('全部前置类型按已提交构筑逐项检查且要求同时满足', () => {
  assert.equal(typeof api.meetsPrerequisites, 'function');
  const build = { ...emptyBuild(), routeId: 'wanjian', branchId: 'sanhua', talentLevels: { 'attack-up': 2 }, activeSynergyIds: ['test-thunder-sword-rain'] };
  const entries = [{ kind:'hero', heroId:'raine' }, { kind:'talent', talentId:'attack-up', minLevel:2 },
    { kind:'route', routeId:'wanjian' }, { kind:'branch', branchId:'sanhua' }, { kind:'synergy', synergyId:'test-thunder-sword-rain' }];
  assert.equal(api.meetsPrerequisites(entries, build), true);
  for (const entry of entries) assert.equal(api.meetsPrerequisites([entry], emptyBuild()), entry.kind === 'hero');
  assert.equal(api.meetsPrerequisites([...entries, { kind:'talent', talentId:'attack-up', minLevel:3 }], build), false);
  assert.equal(api.meetsPrerequisites([{ kind:'hero', heroId:'other' }], build), false);
  assert.equal(api.meetsPrerequisites([{ kind:'talent', talentId:'toString', minLevel:1 }], emptyBuild()), false);
});

test('只开放通用分类，满级和前置不符会被过滤，顺序稳定且无随机读取', () => {
  const config = fixtureConfig(); const build = emptyBuild(); const rng = sequenceRandom();
  build.talentLevels['attack-up'] = 5;
  config.talents[1].prerequisites = [{ kind:'route', routeId:'wanjian' }];
  const eligible = api.eligibleTalents(config, build);
  assert.deepEqual(eligible.map(t => t.id), config.talents.filter(t => t.category === 'general').slice(2).filter(t => t.id !== 'area-size-up').map(t => t.id));
  assert.deepEqual(api.evaluateTalent(config.talents[0], config, build).reasons, ['max-level']);
  assert.deepEqual(api.evaluateTalent(config.talents[1], config, build).reasons, ['prerequisites']);
  assert.ok(api.evaluateTalent(config.talents.at(-1), config, build).reasons.includes('unsupported-category'));
  assert.equal(rng.calls, 0);
});

test('互斥比较其他已拥有天赋，自身升级不会被自己的标签排除', () => {
  const config = fixtureConfig(); const build = emptyBuild();
  config.talents[0].exclusiveTags = ['damage']; config.talents[1].exclusiveTags = ['damage'];
  build.talentLevels['attack-up'] = 1;
  assert.equal(api.evaluateTalent(config.talents[0], config, build).eligible, true);
  assert.deepEqual(api.evaluateTalent(config.talents[1], config, build).reasons, ['exclusive']);
  build.talentLevels['attack-up'] = 0;
  assert.equal(api.evaluateTalent(config.talents[1], config, build).eligible, true);
});
