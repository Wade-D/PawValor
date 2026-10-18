import test from 'node:test';import assert from 'node:assert/strict';
import {combatWorld,combatBuild,fixtureConfig,advance,hits} from './helpers/combat-fixtures.mjs';
import {DemoWorld} from '../.test-build/core/demo-world.js';
test('元素类型驱动火冰共鸣，二级只增加伤害而不延长状态',()=>{
 for(const [element,damage] of [['fire',6],['ice',5]]) {
  const c=fixtureConfig();c.heroes[0].baseStats.critChance=0;c.weapons[0].attackIntervalSeconds=100;
  const innate=c.effects.find(e=>e.id==='innate-lightning');
  Object.assign(innate,structuredClone(c.effects.find(e=>e.id===`${element}-hit`)),{id:'innate-lightning'});
  const w=new DemoWorld(c,{effects:{build:combatBuild({[`${element}-enchantment`]:1},'thunder')},initialEnemyPositions:[{x:2,y:0}],tuning:{enemySpeed:0,enemyHealth:200,spawnIntervalSeconds:100}});w.start();
  const derived=hits(advance(w,200)).filter(e=>e.source.sourceKind!=='direct');
  assert.ok(derived.length);assert.ok(derived.every(e=>e.damage===damage));
 }
 const w=combatWorld({'fire-enchantment':2},undefined,c=>c.weapons[0].attackIntervalSeconds=100);
 assert.deepEqual(hits(advance(w,200)).filter(e=>e.source.sourceKind==='damage-over-time').map(e=>e.damage),[8,8,8]);
});
test('寒冷在实际敌人移动中生效，过期恢复原移速',()=>{
 const w=combatWorld({'ice-enchantment':1},[{x:6,y:0}],c=>c.weapons[0].attackIntervalSeconds=100,{tuning:{enemySpeed:1,enemyHealth:200,contactDamage:0,spawnIntervalSeconds:100}});
 for(let i=0;i<50&&!w.snapshot().enemies[0].statuses.length;i++) advance(w,1);
 const x=w.snapshot().enemies[0].position.x;advance(w,30);assert.ok(Math.abs(x-w.snapshot().enemies[0].position.x-0.35)<1e-8);
 advance(w,100);const next=w.snapshot().enemies[0].position.x;advance(w,30);assert.ok(Math.abs(next-w.snapshot().enemies[0].position.x-0.5)<1e-8);
});
test('追踪失效目标重新选择，无目标保持方向并在寿命或射程到期清理',()=>{
 const w=combatWorld({'secondary-seeking':3,'projectile-size-up':1,'attack-up':1},[{x:2,y:0},{x:4,y:0},{x:5,y:1}],c=>c.weapons[0].attackIntervalSeconds=100);
 while(!w.snapshot().projectiles.some(p=>p.kind==='homing')) advance(w,1);
 const child=w.swords.find(p=>p.kind==='homing');const before={...child.position};
 assert.equal(child.payload.projectile.speed,10);assert.equal(child.payload.projectile.lifetimeSeconds,2);
 assert.ok(Math.abs(child.payload.damage-23.1)<1e-9);assert.ok(Math.abs(child.payload.size.x-0.44)<1e-9);
 w.enemies=w.enemies.filter(e=>e.handle.id!==child.target.id);advance(w,1);assert.equal(child.target.id,4);
 assert.ok(Math.abs(Math.hypot(child.position.x-before.x,child.position.y-before.y)-10/60)<1e-9);
 w.enemies=w.enemies.filter(e=>e.handle.id===child.excludedTarget.id);const direction={...child.direction};advance(w,1);assert.deepEqual(child.direction,direction);
 advance(w,130);assert.equal(w.snapshot().projectiles.length,0);
 const single=combatWorld({'secondary-seeking':1},undefined,c=>c.weapons[0].attackIntervalSeconds=100);assert.equal(advance(single,30).filter(e=>e.type==='effectTriggered').length,0);
});
test('接触致死优先于全部派生伤害，阵亡冻结且五次重开清空状态',()=>{
 const w=combatWorld({'fire-enchantment':1,'secondary-seeking':1,'secondary-burst':1},[{x:2,y:0},{x:3,y:0}],()=>{},{tuning:{enemySpeed:0,enemyHealth:200,contactDamage:100,spawnIntervalSeconds:100}});
 advance(w,15);w.enemies[0].position={x:0,y:0};const events=advance(w,1);
 assert.equal(w.snapshot().state,'ended');assert.deepEqual(events.map(e=>e.type),['heroDamaged','runEnded']);
 const before=w.snapshot();assert.deepEqual(advance(w,300),[]);assert.deepEqual(w.snapshot(),before);
 assert.throws(()=>w.applyBuild(combatBuild(),0));
 for(let i=0;i<5;i++){w.reset();w.start();assert.deepEqual(w.snapshot().projectiles,[]);assert.deepEqual(w.snapshot().enemies.flatMap(e=>e.statuses),[]);assert.equal(w.snapshot().elapsedSeconds,0);advance(w,15);}
});
