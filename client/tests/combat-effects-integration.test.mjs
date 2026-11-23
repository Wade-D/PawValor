import assert from 'node:assert/strict';import test from 'node:test';
import {combatWorld,advance,hits} from './helpers/combat-fixtures.mjs';
test('直接击杀后仍产生位置副机制，每个敌人仅掉落一次经验',()=>{
 const w=combatWorld({'secondary-burst':1,'secondary-seeking':1},[{x:2,y:0},{x:2.3,y:0.3}],c=>c.weapons[0].attackIntervalSeconds=100,{tuning:{enemyHealth:20,enemySpeed:0,contactDamage:0,spawnIntervalSeconds:100}});
 const events=advance(w,100);assert.equal(events.filter(e=>e.type==='effectTriggered').length,2);assert.equal(events.filter(e=>e.type==='kill').length,1);assert.equal(events.filter(e=>e.type==='xpDrop').length,1);
 assert.ok(hits(events).some(e=>e.source.sourceKind==='split'));assert.ok(hits(events).some(e=>e.source.sourceKind==='explosion'));
});
test('额外弹体和穿透共享预算，衍生不再触发附魔或副机制',()=>{
 const w=combatWorld({'extra-projectile':1,'pierce-up':2,'secondary-burst':1,'secondary-seeking':1,'fire-enchantment':1,'ice-enchantment':1},[{x:2,y:0},{x:2.3,y:0.3},{x:3,y:0}],c=>{c.weapons[0].attackIntervalSeconds=100;c.projectiles[0].speed=300;});
 const events=advance(w,100);const ids=events.filter(e=>e.type==='effectTriggered').map(e=>e.effectId);assert.equal(new Set(ids).size,ids.length);assert.equal(ids.length,4);
 assert.ok(hits(events).filter(e=>e.source.sourceKind!=='direct').every(e=>e.source.rootAttackId===1&&e.source.depth===1&&!e.critical));
 w.reset();w.start();assert.deepEqual(w.snapshot().enemies.flatMap(e=>e.statuses),[]);assert.deepEqual(w.snapshot().projectiles,[]);
});
