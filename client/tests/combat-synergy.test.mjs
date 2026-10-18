import test from 'node:test';import assert from 'node:assert/strict';
import {DemoWorld} from '../.test-build/core/demo-world.js';
import {fixtureConfig,combatBuild,advance,hits} from './helpers/combat-fixtures.mjs';
function build(extra={}){const b=combatBuild({'attack-up':2,'lightning-enchantment':1,...extra},'wanjian');b.level=6;b.activeSynergyIds=['test-thunder-sword-rain'];return b;}
function world(extra={},mutate=()=>{},tuning={}){const c=fixtureConfig();c.heroes[0].baseStats.critChance=0;c.weapons[0].attackIntervalSeconds=100;mutate(c);const w=new DemoWorld(c,{effects:{build:build(extra)},initialEnemyPositions:[{x:2,y:0},{x:3,y:-1},{x:3,y:1}],tuning:{enemyHealth:1000,enemySpeed:0,contactDamage:0,spawnIntervalSeconds:100,...tuning}});w.start();return w;}
test('主额外攻击共存只发一组四枚，伤害十二且源独立同根',()=>{
 const w=world({'extra-projectile':1});const events=advance(w,60);const attacks=events.filter(e=>e.type==='attack');const rain=attacks.filter(e=>e.source.sourceKind==='synergy');
 assert.equal(attacks.length,6);assert.equal(rain.length,4);assert.equal(new Set(attacks.map(e=>e.attackId)).size,6);assert.ok(rain.every(e=>e.source.rootAttackId===1&&e.source.depth===1));
 rain.forEach((e,i)=>assert.ok(Math.abs(Math.atan2(e.direction.y,e.direction.x)*180/Math.PI-[-18,-6,6,18][i])<1e-9));
 const damage=hits(events).filter(e=>e.source.sourceKind==='synergy');assert.equal(damage.length,4);assert.ok(damage.every(e=>Math.abs(e.damage-12)<1e-9&&!e.critical&&e.effectName==='雷霆剑雨'));
});
test('组合不暴击穿透或触发派生，暴击随机仅由直接命中消费',()=>{
 const w=world({'pierce-up':2,'fire-enchantment':1,'secondary-seeking':1,'secondary-burst':1},c=>c.heroes[0].baseStats.critChance=1);let calls=0;w.criticalRandom.next=()=>{calls++;return 0;};
 const events=advance(w,100);const rain=hits(events).filter(e=>e.source.sourceKind==='synergy');assert.equal(rain.length,4);assert.ok(rain.every(e=>Math.abs(e.damage-12)<1e-9&&!e.critical));
 assert.equal(calls,hits(events).filter(e=>e.source.sourceKind==='direct').length);assert.equal(events.filter(e=>e.type==='effectTriggered'&&e.effectName==='雷霆剑雨').length,1);
 assert.equal(events.filter(e=>e.type==='attack'&&e.source.sourceKind==='synergy').length,4);
});
test('组合继承取交集并只计算一次，旧弹体保留伤害与尺寸快照',()=>{
 const w=world({'projectile-size-up':1,'range-up':1});advance(w,1);const before=w.snapshot().projectiles.filter(p=>p.kind==='synergy');assert.equal(before.length,4);assert.ok(Math.abs(before[0].size.x-0.33)<1e-9);
 w.pause();w.applyBuild(build({'attack-up':5,'projectile-size-up':3}),0);const snap=w.snapshot();advance(w,200);assert.deepEqual(w.snapshot(),snap);w.resume();assert.ok(hits(advance(w,60)).filter(e=>e.source.sourceKind==='synergy').every(e=>Math.abs(e.damage-12)<1e-9));
 const excluded=world({},c=>c.projectiles.find(p=>p.id==='synergy-sword-rain').inheritance.stats=[]);assert.ok(hits(advance(excluded,60)).filter(e=>e.source.sourceKind==='synergy').every(e=>e.damage===10));
});
test('组内可分别伤害同一目标但死亡只掉一次，死亡优先跳过发射',()=>{
 const w=world({},()=>{},{enemyRadius:1,enemyHealth:30});const events=advance(w,30);const kill=events.filter(e=>e.type==='kill');assert.equal(new Set(kill.map(e=>e.target.id)).size,kill.length);assert.equal(events.filter(e=>e.type==='xpDrop').length,kill.length);
 const dead=world({},()=>{},{contactDamage:100,heroRadius:3});assert.deepEqual(advance(dead,1).map(e=>e.type),['heroDamaged','runEnded']);const before=dead.snapshot();assert.deepEqual(advance(dead,100),[]);assert.deepEqual(dead.snapshot(),before);
 for(let i=0;i<5;i++){w.reset();w.start();assert.deepEqual(w.snapshot().projectiles,[]);assert.equal(advance(w,1).filter(e=>e.type==='attack'&&e.source.sourceKind==='synergy').length,4);}
});
test('无目标不积攒组合，射程和寿命结束释放组合弹体',()=>{
 const w=world();w.enemies=[];assert.equal(advance(w,120).filter(e=>e.type==='attack').length,0);w.addEnemy({x:2,y:0});assert.equal(advance(w,1).filter(e=>e.type==='attack'&&e.source.sourceKind==='synergy').length,4);advance(w,100);assert.deepEqual(w.snapshot().projectiles,[]);
});
