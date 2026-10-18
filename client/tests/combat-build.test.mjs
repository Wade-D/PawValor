import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureConfig, combatBuild } from './helpers/combat-fixtures.mjs';
const api = await import('../.test-build/core/combat-build.js').catch(() => ({}));
const compile = (build, config = fixtureConfig()) => { assert.equal(typeof api.compileCombatBuild, 'function'); return api.compileCombatBuild(config, build); };
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} 应为 ${b}`);

test('百分比与独立奖励按基础值加算，满级属性符合原设计', () => {
  const b = combatBuild({'attack-up':2}); b.bonusRewardCounts['base-attack']=3;
  close(compile(b).stats.attackDamage,24.6);
  const config=fixtureConfig(); const talents=Object.fromEntries(config.talents.filter(t=>t.category==='general').map(t=>[t.id,t.maxLevel]));
  const c=compile(combatBuild({...talents,'secondary-burst':1})); const s=c.stats;
  close(s.attackDamage,30); close(s.attackIntervalSeconds,0.8/1.4); close(s.critChance,0.25); close(s.critDamageMultiplier,2.1);
  assert.equal(s.pierceCount,2); close(s.projectileSize.x,0.39); close(s.range,10.88); close(s.areaScale,1.3);
  close(s.maxHealth,136); close(s.moveSpeed,5.9); close(s.damageReduction,0.18);
  assert.equal(c.extraProjectiles[0].damageMultiplier,0.6);
});

test('固有雷加火冰合法，同属性共鸣只解析替代后的雷', () => {
  const a=compile(combatBuild({'fire-enchantment':1,'ice-enchantment':1},'thunder'));
  assert.deepEqual(a.elements.map(e=>e.element).sort(),['fire','ice','lightning']);
  const b=compile(combatBuild({'lightning-enchantment':2},'thunder'));
  assert.equal(b.elements.length,1); close(b.elements[0].damageMultiplier,1);
  assert.equal(compile(combatBuild({},'thunder')).elements[0].damageMultiplier,0.4);
});

test('两种副机制三级倍率与独立槽位有效，解析数据与输入隔离', () => {
  const build=combatBuild({'secondary-seeking':3,'secondary-burst':3,'fire-enchantment':1,'ice-enchantment':1});
  const before=structuredClone(build); const compiled=compile(build);
  close(compiled.secondary.find(s=>s.behavior.kind==='homing').damageMultiplier,1.05);
  close(compiled.secondary.find(s=>s.behavior.kind==='explosion').damageMultiplier,0.9);
  compiled.build.talentLevels['secondary-seeking']=1;
  assert.deepEqual(build,before);
});

test('非法构筑、槽位、前置、互斥与未支持效果不得静默执行', () => {
  const bad=[];
  bad.push(combatBuild({'fire-enchantment':1,'ice-enchantment':1,'lightning-enchantment':1}));
  bad.push(combatBuild({'attack-up':6}),combatBuild({'attack-up':0.5}),combatBuild({unknown:1}),combatBuild({'area-size-up':1}));
  const mismatched=combatBuild({'fire-enchantment':1}); mismatched.enchantmentIds=[]; bad.push(mismatched);
  const reward=combatBuild();reward.bonusRewardCounts['base-health']=NaN;bad.push(reward);
  for(const build of bad) assert.throws(()=>compile(build));
  const cfg=fixtureConfig();cfg.elementPolicy.usage='test-only';assert.throws(()=>compile(combatBuild(),cfg));
  const unsupported=fixtureConfig();unsupported.talents[0].effectIds=['returning-entry'];assert.throws(()=>compile(combatBuild({'attack-up':1}),unsupported));
  const prior=fixtureConfig();prior.talents[0].prerequisites=[{kind:'route',routeId:'thunder'}];assert.throws(()=>compile(combatBuild({'attack-up':1}),prior));
  const exclusive=fixtureConfig();exclusive.talents[0].exclusiveTags=['one'];exclusive.talents[1].exclusiveTags=['one'];assert.throws(()=>compile(combatBuild({'attack-up':1,'attack-speed-up':1}),exclusive));
});

test('概率钳制，非法计算溢出拒绝，配置与构筑不被修改', () => {
  const cfg=fixtureConfig();cfg.effects.find(e=>e.id==='crit-chance-up-stat').value=2;
  assert.equal(compile(combatBuild({'crit-chance-up':1}),cfg).stats.critChance,1);
  cfg.effects.find(e=>e.id==='crit-chance-up-stat').value=-2;
  assert.equal(compile(combatBuild({'crit-chance-up':1}),cfg).stats.critChance,0);
  cfg.effects.find(e=>e.id==='attack-up-stat').value=Number.MAX_VALUE;
  assert.throws(()=>compile(combatBuild({'attack-up':5}),cfg));
  const c=fixtureConfig();const b=combatBuild({'attack-up':1}); const before=structuredClone([c,b]);compile(b,c);assert.deepEqual([c,b],before);
});
