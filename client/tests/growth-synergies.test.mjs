import test from 'node:test';import assert from 'node:assert/strict';
import {GrowthSession} from '../.test-build/core/growth-session.js';
import {fixtureConfig,sessionOptions,firstOption} from './helpers/growth-fixtures.mjs';
const combo=(id,prerequisites)=>({id,name:id==='a'?'测试甲':'测试乙',usage:'test-only',prerequisites,effectIds:['test-thunder-sword-rain-attack'],activation:'next-level'});
const select=s=>{const x=s.snapshot();return s.select(x.token,firstOption(x));};
test('组合下级免费激活，待确认构筑不提前改变，刷新不重放',()=>{
 const c=fixtureConfig();c.synergies=[combo('a',[{kind:'talent',talentId:'attack-up',minLevel:1}]),combo('b',[{kind:'synergy',synergyId:'a'}])];
 const s=new GrowthSession(c,sessionOptions());s.grantXp(5);select(s);
 assert.deepEqual(s.snapshot().build.pendingSynergies,[{synergyId:'a',eligibleAtLevel:2,activateAtLevel:3}]);
 s.grantXp(5);let x=s.snapshot();assert.deepEqual(x.activatingSynergyIds,['a']);assert.deepEqual(x.build.activeSynergyIds,[]);assert.equal(x.growth.pendingChoice.kind,'route');
 let r=select(s);assert.deepEqual(r.events.map(e=>e.type),['synergyActivated']);assert.deepEqual(s.snapshot().build.activeSynergyIds,['a']);
 assert.deepEqual(s.snapshot().build.pendingSynergies,[{synergyId:'b',eligibleAtLevel:3,activateAtLevel:4}]);assert.equal(s.snapshot().rerollsRemaining,2);
 s.grantXp(5);x=s.snapshot();assert.deepEqual(x.activatingSynergyIds,['b']);assert.equal(s.reroll(x.token).ok,true);assert.deepEqual(s.snapshot().activatingSynergyIds,['b']);
 r=select(s);assert.equal(r.events.length,1);assert.deepEqual(s.grantXp(0),[]);assert.equal(s.snapshot().build.activeSynergyIds.length,2);
 const old=s.snapshot();old.build.activeSynergyIds.length=0;assert.equal(s.snapshot().build.activeSynergyIds.length,2);
 s.reset(sessionOptions().random);assert.deepEqual(s.snapshot().build.activeSynergyIds,[]);
});
test('初始满足排二级，七/十一级及封顶仍按事务调度',()=>{
 const c=fixtureConfig();c.talents.forEach(t=>t.weight=t.id==='attack-up'?1:0);c.talents[0].maxLevel=12;
 c.synergies=[combo('initial',[{kind:'hero',heroId:'raine'}]),combo('seven',[{kind:'talent',talentId:'attack-up',minLevel:4}]),combo('eleven',[{kind:'talent',talentId:'attack-up',minLevel:7}]),combo('cap',[{kind:'talent',talentId:'attack-up',minLevel:8}])];
 const s=new GrowthSession(c,sessionOptions());assert.equal(s.snapshot().build.pendingSynergies[0].activateAtLevel,2);s.grantXp(55);const events=[];
 while(s.snapshot().growth.pendingChoice)events.push(...select(s).events);
 assert.deepEqual(events.filter(e=>e.type==='synergyActivated').map(e=>e.targetLevel),[2,7,11]);assert.equal(events.filter(e=>e.type==='ultimateEvolution').length,1);
 assert.equal(s.snapshot().build.level,12);assert.deepEqual(s.snapshot().build.pendingSynergies,[{synergyId:'cap',eligibleAtLevel:12,activateAtLevel:13}]);
});
