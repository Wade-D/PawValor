import assert from 'node:assert/strict';import test from 'node:test';
import {fixtureConfig,combatBuild} from './helpers/combat-fixtures.mjs';
import {eligibleTalents} from '../.test-build/core/growth-candidates.js';
import {GrowthSession} from '../.test-build/core/growth-session.js';
import {sessionOptions,firstOption} from './helpers/growth-fixtures.mjs';
const enabledCategories=['general','enchantment','secondary-mechanism'];
test('能力过滤与满附魔槽升级在抽取前完成',()=>{
 const c=fixtureConfig();const b=combatBuild({'fire-enchantment':1,'ice-enchantment':1});
 const ids=eligibleTalents(c,b,{enabledCategories}).map(t=>t.id);
 assert.ok(ids.includes('fire-enchantment'));assert.ok(!ids.includes('lightning-enchantment'));assert.ok(!ids.includes('area-size-up'));
 b.talentLevels['secondary-burst']=1;b.secondaryMechanismIds=['secondary-burst'];
 assert.ok(eligibleTalents(c,b,{enabledCategories}).some(t=>t.id==='area-size-up'));
});
test('显式启用附魔后首次获得占槽，升级不重复占槽，重置清空',()=>{
 const c=fixtureConfig();c.talents.forEach(t=>t.weight=t.id==='fire-enchantment'?1:0);
 const s=new GrowthSession(c,{...sessionOptions(),enabledTalentCategories:enabledCategories});s.grantXp(15);
 let a=s.snapshot();assert.ok(a.growth.pendingChoice.options.some(o=>o.id==='talent:fire-enchantment'));
 s.select(a.token,'talent:fire-enchantment');a=s.snapshot();s.select(a.token,firstOption(a));a=s.snapshot();
 s.select(a.token,'talent:fire-enchantment');assert.deepEqual(s.snapshot().build.enchantmentIds,['fire-enchantment']);
 assert.equal(s.snapshot().build.talentLevels['fire-enchantment'],2);s.reset(sessionOptions().random);assert.deepEqual(s.snapshot().build.enchantmentIds,[]);
});
