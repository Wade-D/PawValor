import assert from 'node:assert/strict';import test from 'node:test';
import {combatWorld,advance,hits} from './helpers/combat-fixtures.mjs';
const api=await import('../.test-build/core/combat-secondary.js').catch(()=>({}));
test('副机制目标按距离和标识排序，排除原目标，爆裂边界包含',()=>{
 assert.equal(typeof api.selectSecondaryTarget,'function');const enemy=(id,x,y=0)=>({handle:{id,generation:0},position:{x,y},health:20});
 const a=enemy(2,1),b=enemy(3,-1),c=enemy(4,2);assert.deepEqual(api.selectSecondaryTarget({x:0,y:0},8,a.handle,[b,a,c]),b.handle);
 assert.deepEqual(api.explosionTargets({x:0,y:0},1,[b,a,c]),[a.handle,b.handle]);assert.equal(api.selectSecondaryTarget({x:0,y:0},8,a.handle,[a]),null);
 assert.deepEqual(api.homingDirection({x:0,y:0},{x:0,y:0},{x:1,y:0}),{x:1,y:0});
});
test('追踪剑气下一步才移动，排除原目标碰撞，命中七点且不递归',()=>{
 const w=combatWorld({'secondary-seeking':1},[{x:2,y:0},{x:2.3,y:0.3}],c=>c.weapons[0].attackIntervalSeconds=100);
 let events=[];let created;for(let i=0;i<20&&!created;i++){const step=advance(w,1);events.push(...step);created=step.find(e=>e.type==='effectTriggered');}
 assert.ok(created);const sword=w.snapshot().projectiles.find(p=>p.kind==='homing');assert.ok(sword);assert.deepEqual(sword.position,created.position);
 events.push(...advance(w,100));const derived=hits(events).filter(e=>e.source.sourceKind==='split');assert.equal(derived.length,1);assert.equal(derived[0].target.id,3);assert.equal(derived[0].damage,7);assert.equal(derived[0].critical,false);
 assert.equal(events.filter(e=>e.type==='effectTriggered').length,1);
});
test('爆裂三级十八点，多目标一次预算，范围扩大',()=>{
 const w=combatWorld({'secondary-burst':3,'area-size-up':1},[{x:2,y:0},{x:2.3,y:0.3}],c=>c.weapons[0].attackIntervalSeconds=100);
 const events=advance(w,20);const derived=hits(events).filter(e=>e.source.sourceKind==='explosion');assert.deepEqual(derived.map(e=>e.damage),[18,18]);
 const effect=events.find(e=>e.type==='effectTriggered');assert.ok(Math.abs(effect.radius-1.1)<1e-9);assert.equal(events.filter(e=>e.type==='effectTriggered').length,1);
});
