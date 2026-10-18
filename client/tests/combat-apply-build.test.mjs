import assert from 'node:assert/strict';import test from 'node:test';
import {combatWorld,combatBuild,advance,hits,fixtureConfig} from './helpers/combat-fixtures.mjs';
import {DemoWorld} from '../.test-build/core/demo-world.js';
test('静止边界应用构筑保持生命比例，重复应用不加血，错误代次或运行中拒绝',()=>{
 const w=combatWorld({},[{x:0.5,y:0}],()=>{},{tuning:{enemySpeed:0,enemyHealth:200,contactDamage:50,spawnIntervalSeconds:100}});
 advance(w,1);assert.equal(w.snapshot().hero.health,50);w.pause();assert.equal(typeof w.applyBuild,'function');
 const b=combatBuild({'max-health-up':1});w.applyBuild(b,0);assert.ok(Math.abs(w.snapshot().hero.health-56)<1e-9);assert.ok(Math.abs(w.snapshot().hero.maxHealth-112)<1e-9);
 w.applyBuild(b,0);assert.ok(Math.abs(w.snapshot().hero.health-56)<1e-9);const before=w.snapshot();
 assert.throws(()=>w.applyBuild(combatBuild({unknown:1}),0));assert.throws(()=>w.applyBuild(b,999));assert.deepEqual(w.snapshot(),before);
 w.resume();assert.throws(()=>w.applyBuild(b,0));w.reset();assert.equal(w.snapshot().hero.maxHealth,100);
});
test('旧弹体保持发射快照，重算不重置发射冷却',()=>{
 const w=combatWorld({},[{x:4,y:0}]);advance(w,1);w.pause();
 assert.equal(typeof w.applyBuild,'function');w.applyBuild(combatBuild({'attack-up':5,'pierce-up':2,'projectile-size-up':3}),0);w.resume();
 const events=advance(w,75);const damages=hits(events).map(e=>e.damage);assert.equal(damages[0],20);assert.equal(damages[1],30);
 assert.equal(events.filter(e=>e.type==='attack').length,1);
});
test('效果构筑输入与快照隔离，非法暴击种子不能启动',()=>{
 const config=fixtureConfig();const build=combatBuild({'attack-up':1});const w=new DemoWorld(config,{effects:{build}});build.talentLevels['attack-up']=5;
 assert.equal(w.snapshot().effects.stats.attackDamage,22);const snap=w.snapshot();snap.effects.stats.attackDamage=99;assert.equal(w.snapshot().effects.stats.attackDamage,22);
 assert.throws(()=>new DemoWorld(config,{effects:{build,criticalSeed:-1}}));
});
