import test from 'node:test';import assert from 'node:assert/strict';
import {GrowthCombatRun} from '../.test-build/core/growth-combat-run.js';import {fixtureConfig,runOptions} from './helpers/growth-integration-fixtures.mjs';
const api=await import('../.test-build/config/growth-playtest.prototype.js').catch(()=>({}));
test('验收脚本通过合法经验和选择准备五级前置，第六级免费激活',()=>{
 assert.ok(api.growthPlaytestPrototype);const p=api.growthPlaytestPrototype;
 const r=new GrowthCombatRun(fixtureConfig(),runOptions({seed:p.seed,world:p.world}));
 function prepare(){r.start();for(const command of p.commands){const s=r.snapshot().growth;if(command.kind==='grantXp')r.grantXp(command.amount);else {const result=command.kind==='reroll'?r.reroll(s.token):r.select(s.token,command.optionId);assert.equal(result.ok,true);}}}
 prepare();let s=r.snapshot();assert.equal(s.growth.build.level,5);assert.equal(s.growth.build.talentLevels['attack-up'],2);assert.equal(s.growth.build.routeId,'wanjian');assert.equal(s.growth.build.talentLevels['lightning-enchantment'],1);
 assert.deepEqual(s.growth.build.activeSynergyIds,[]);assert.equal(s.growth.build.pendingSynergies[0].activateAtLevel,6);r.grantXp(5);s=r.snapshot();assert.deepEqual(s.growth.activatingSynergyIds,['test-thunder-sword-rain']);
 const card=s.growth.growth.pendingChoice.options.find(c=>c.id!=='talent:attack-up');const result=r.select(s.growth.token,card.id);assert.equal(result.events.filter(e=>e.type==='synergyActivated').length,1);assert.ok(Math.abs(r.snapshot().world.effects.stats.attackDamage-24)<1e-9);
 const token=s.growth.token;r.reset();prepare();assert.equal(r.snapshot().growth.build.level,5);assert.equal(r.select(token,card.id).ok,false);
});
