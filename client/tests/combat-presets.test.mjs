import test from 'node:test';
import assert from 'node:assert/strict';
import { compileCombatBuild } from '../.test-build/core/combat-build.js';
import { DemoWorld } from '../.test-build/core/demo-world.js';
const api = await import('../.test-build/config/combat-presets.prototype.js').catch(() => ({}));
test('五个中文预设独立且使用已批准的测试构筑', () => {
  assert.equal(typeof api.createCombatPreset, 'function');
  const ids=['basic','general','elements','resonance','secondary'];
  const presets=ids.map(api.createCombatPreset);
  assert.deepEqual(presets.map(p=>p.name),['基础','通用强化','火冰雷','雷电共鸣','副机制']);
  assert.equal(presets[0].options.effects,undefined);
  for(const p of presets.slice(1)) {
    assert.equal(p.options.tuning.enemyHealth,200);assert.equal(p.options.tuning.enemySpeed,1);
    compileCombatBuild(p.config,p.options.effects.build);
  }
  const general=presets[1].options.effects.build.talentLevels;
  for(const t of presets[1].config.talents.filter(t=>t.category==='general' && t.id!=='area-size-up'))
    assert.equal(general[t.id],['attack-up','attack-speed-up','crit-chance-up'].includes(t.id)?2:1,t.id);
  assert.equal(general['area-size-up'],undefined);
  assert.deepEqual(compileCombatBuild(presets[2].config,presets[2].options.effects.build).elements.map(e=>e.element),['fire','ice','lightning']);
  assert.equal(compileCombatBuild(presets[3].config,presets[3].options.effects.build).elements.length,1);
  assert.deepEqual(presets[4].options.effects.build.talentLevels,{'secondary-seeking':1,'secondary-burst':1,'area-size-up':1});
  presets[1].config.heroes[0].baseStats.maxHealth=999;
  assert.equal(api.createCombatPreset('general').config.heroes[0].baseStats.maxHealth,100);
});
test('预设重开复现，战斗入口仍沿用二级封顶经验',()=>{
  assert.equal(typeof api.createCombatPreset,'function');
  for(const id of ['basic','general','elements','resonance','secondary']) {
    const p=api.createCombatPreset(id);const w=new DemoWorld(p.config,p.options);w.start();
    const first=Array.from({length:60},()=>w.step(1/60,{x:0,y:0}));
    w.reset();w.start();const second=Array.from({length:60},()=>w.step(1/60,{x:0,y:0}));
    assert.deepEqual(first.map(es=>es.map(e=>e.type)),second.map(es=>es.map(e=>e.type)));
    assert.equal(w.snapshot().level,1);
  }
});
