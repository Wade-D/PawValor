import assert from 'node:assert/strict';import test from 'node:test';
import {combatWorld,combatBuild,fixtureConfig,advance,hits} from './helpers/combat-fixtures.mjs';import {DemoWorld} from '../.test-build/core/demo-world.js';
test('火焰真实命中后跳三次四点伤害，不递归触发',()=>{
 const w=combatWorld({'fire-enchantment':1},undefined,c=>c.weapons[0].attackIntervalSeconds=100);const events=advance(w,200);
 const dot=hits(events).filter(e=>e.source.sourceKind==='damage-over-time');assert.deepEqual(dot.map(e=>e.damage),[4,4,4]);
 assert.ok(dot.every(e=>!e.critical&&e.source.depth===1&&e.source.rootAttackId===1));
 assert.equal(events.filter(e=>e.type==='effectTriggered').length,1);
});
test('寒冰追加三点并减速，雷追加六点，共鸣仅追加十点',()=>{
 const ice=combatWorld({'ice-enchantment':1});assert.ok(hits(advance(ice,15)).some(e=>e.source.sourceKind==='element'&&e.damage===3));
 const lightning=combatWorld({'lightning-enchantment':1});assert.ok(hits(advance(lightning,15)).some(e=>e.source.sourceKind==='element'&&e.damage===6));
 const c=fixtureConfig();c.heroes[0].baseStats.critChance=0;
 const w=new DemoWorld(c,{effects:{build:combatBuild({'lightning-enchantment':1},'thunder')},initialEnemyPositions:[{x:2,y:0}],tuning:{enemySpeed:0,enemyHealth:200,contactDamage:0}});w.start();
 assert.deepEqual(hits(advance(w,15)).filter(e=>e.source.sourceKind==='element').map(e=>e.damage),[10]);
});
test('火冰雷各自触发，暂停冻结，旧灼烧快照不追溯增强',()=>{
 const w=combatWorld({'fire-enchantment':1,'ice-enchantment':1},undefined,c=>c.weapons[0].attackIntervalSeconds=100);
 advance(w,15);assert.equal(w.snapshot().enemies[0].statuses.length,2);w.pause();const before=w.snapshot();advance(w,200);assert.deepEqual(w.snapshot(),before);
 w.applyBuild(combatBuild({'fire-enchantment':3,'attack-up':5}),0);w.resume();assert.deepEqual(hits(advance(w,200)).filter(e=>e.source.sourceKind==='damage-over-time').map(e=>e.damage),[4,4,4]);
 w.reset();w.start();assert.deepEqual(w.snapshot().enemies[0].statuses,[]);
});
