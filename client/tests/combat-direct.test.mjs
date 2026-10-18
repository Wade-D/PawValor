import assert from 'node:assert/strict';import test from 'node:test';
import {combatWorld,advance,hits} from './helpers/combat-fixtures.mjs';
test('攻击强化与额外弹体分别结算，额外弹体共享根且横向偏移',()=>{
 const w=combatWorld({'attack-up':1,'extra-projectile':1});const events=advance(w,15);const attacks=events.filter(e=>e.type==='attack');
 assert.equal(attacks.length,2);assert.notEqual(attacks[0].attackId,attacks[1].attackId);
 assert.equal(attacks[0].source.rootAttackId,attacks[1].source.rootAttackId);assert.equal(attacks[1].origin.y,0.2);
 assert.deepEqual(hits(events).map(e=>e.damage),[22,13.2]);
});
test('每次直接命中暴击并使用独立随机源，不改变刷怪序列',()=>{
 const w=combatWorld({},undefined,c=>c.heroes[0].baseStats.critChance=1);
 assert.equal(hits(advance(w,15))[0].damage,30);assert.equal(hits(advance(combatWorld(),15))[0].critical,false);
 const a=combatWorld({},undefined,()=>{},{seed:3,tuning:{enemySpeed:0,enemyHealth:1000,contactDamage:0,spawnIntervalSeconds:1}});
 const b=combatWorld({'crit-chance-up':4},undefined,()=>{},{seed:3,tuning:{enemySpeed:0,enemyHealth:1000,contactDamage:0,spawnIntervalSeconds:1}});
 advance(a,125);advance(b,125);assert.deepEqual(a.snapshot().enemies.map(e=>e.position),b.snapshot().enemies.map(e=>e.position));
});
test('穿透按扫掠顺序命中两个不同敌人，不反复命中',()=>{
 const w=combatWorld({'pierce-up':1},[{x:2,y:0},{x:3,y:0},{x:4,y:0}],c=>c.projectiles[0].speed=300);
 assert.deepEqual(hits(advance(w,1)).map(e=>e.target.id),[2,3]);assert.equal(w.snapshot().projectiles.length,0);
 assert.equal(hits(advance(w,5)).length,0);
});
test('弹道尺寸影响命中宽度，增幅影响射程且寿命仍限制飞行',()=>{
 const w=combatWorld({'projectile-size-up':3,'range-up':1},[{x:7,y:0}]);advance(w,1);
 assert.ok(w.snapshot().projectiles[0].size.x>0.3);
 w.enemies[0].position={x:2,y:0.53};assert.equal(hits(advance(w,15)).length,1);
 const no=combatWorld({},[{x:7,y:0}]);advance(no,1);no.enemies[0].position={x:2,y:0.53};assert.equal(hits(advance(no,15)).length,0);
});
test('攻速移动和护甲实际作用于间隔位移与接触伤害',()=>{
 const w=combatWorld({'attack-speed-up':2,'move-speed-up':1,'armor-up':1},[{x:0.5,y:0}],()=>{},{tuning:{enemySpeed:0,enemyHealth:1000,contactDamage:10,spawnIntervalSeconds:100}});
 const first=w.step(1/60,{x:1,y:0});assert.ok(Math.abs(w.snapshot().hero.position.x-5.3/60)<1e-9);
 assert.ok(Math.abs(first.find(e=>e.type==='heroDamaged').damage-9.4)<1e-9);
 const attacks=[...first,...advance(w,100)].filter(e=>e.type==='attack');assert.ok(attacks.length>=3);assert.ok(attacks[1].elapsedSeconds-attacks[0].elapsedSeconds<0.8);
});
