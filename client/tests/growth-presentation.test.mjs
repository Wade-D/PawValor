import test from 'node:test';import assert from 'node:assert/strict';
import {GrowthCombatRun} from '../.test-build/core/growth-combat-run.js';import {fixtureConfig,runOptions,selectFirst} from './helpers/growth-integration-fixtures.mjs';
const api=await import('../.test-build/core/growth-presentation.js').catch(()=>({}));const data=await import('../.test-build/config/growth-copy.prototype.js').catch(()=>({}));
function view(run,c=fixtureConfig()){assert.equal(typeof api.presentGrowth,'function');return api.presentGrowth(c,data.growthCopyPrototype,run.snapshot());}
const create=()=>{const r=new GrowthCombatRun(fixtureConfig(),runOptions({createGrowthRandom:()=>({next:()=>0})}));r.start();return r;};

test('元素候选预览溢出不阻断其他合法卡片及重开路径',()=>{
 const c=fixtureConfig();c.weapons[0].baseDamage=1e308;c.heroes[0].baseStats.attackPower=0;c.heroes[0].baseStats.critChance=0;
 c.effects.find(e=>e.id==='fire-hit').damageMultiplier=1;c.talents.forEach(t=>t.weight=t.id==='fire-enchantment'?1:0);
 const r=new GrowthCombatRun(c,runOptions({createGrowthRandom:()=>({next:()=>0})}));r.start();r.grantXp(5);
 assert.equal(r.select(r.snapshot().growth.token,'talent:fire-enchantment').ok,true);r.grantXp(5);assert.equal(r.select(r.snapshot().growth.token,'wanjian').ok,true);r.grantXp(5);
 const before=r.snapshot();const v=view(r,c);assert.equal(v.cards.length,3);assert.match(v.cards.find(x=>x.optionId==='talent:fire-enchantment').description,/超出.*范围/);
 assert.deepEqual(r.snapshot(),before);assert.equal(r.select(v.token,'reward:base-health').ok,true);assert.equal(r.snapshot().growth.build.level,4);assert.equal(r.snapshot().error,null);
});
test('普通卡显示中文类别、等级、真实数值及刷新状态，令牌与输入隔离',()=>{
 const r=create();r.grantXp(5);let v=view(r);assert.equal(v.cards.length,3);assert.equal(new Set(v.cards.map(c=>c.optionId)).size,3);assert.match(v.cards[0].name,/攻击强化/);assert.match(v.cards[0].description,/10.0%/);assert.match(v.cards[0].rankText,/0.*1/);assert.equal(v.refresh.enabled,true);
 const snapshot=r.snapshot();v.token.revision=999;assert.notEqual(snapshot.growth.token.revision,999);
 r.reroll(r.snapshot().growth.token);r.reroll(r.snapshot().growth.token);assert.equal(view(r).refresh.enabled,false);selectFirst(r);r.grantXp(5);v=view(r);assert.equal(v.cards.length,3);assert.equal(v.refresh.visible,false);assert.match(v.cards[0].description,/招式效果在第四阶段实现/);assert.match(v.cards[1].description,/固有雷/);
});
test('跨级和固定节点显示已提交等级，终极/分支说明和封顶不误导',()=>{
 const r=create();r.grantXp(55);let v=view(r);assert.match(v.hud,/等级 1/);assert.match(v.hud,/5.*5/);assert.doesNotMatch(v.hud,/等级 12/);
 while(r.snapshot().growth.growth.pendingChoice){if(r.snapshot().growth.growth.pendingChoice.kind==='branch'){v=view(r);assert.equal(v.cards.length,2);assert.ok(v.cards.every(c=>/第四阶段/.test(c.description)));}selectFirst(r);}
 v=view(r);assert.match(v.hud,/等级 12/);assert.match(v.hud,/封顶/);assert.ok(v.buildLines.some(s=>/万剑归宗.*第四阶段/.test(s)));
});
test('基础奖励、组合pending与本级将激活均有中文说明，不展示代码ID',()=>{
 const c=fixtureConfig();c.talents.forEach(t=>t.weight=0);const r=new GrowthCombatRun(c,runOptions());r.start();r.grantXp(5);let v=view(r,c);assert.ok(v.cards.every(x=>/独立累计.*1%/.test(x.description)));
 const s=r.snapshot();s.growth.activatingSynergyIds=['test-thunder-sword-rain'];s.growth.build.pendingSynergies=[{synergyId:'test-thunder-sword-rain',eligibleAtLevel:5,activateAtLevel:6}];
 v=api.presentGrowth(c,data.growthCopyPrototype,s);assert.match(v.activatingLines.join(''),/本级.*雷霆剑雨/);assert.doesNotMatch(v.buildLines.join(''),/test-thunder/);assert.match(v.buildLines.join(''),/待.*6/);
 assert.throws(()=>api.presentGrowth(c,{...data.growthCopyPrototype,routeDescriptions:{}},{...s,growth:{...s.growth,growth:{...s.growth.growth,pendingChoice:{kind:'route',targetLevel:3,routeIds:['wanjian','thunder','returning-sword']}}}}));
});
