import test from 'node:test';import assert from 'node:assert/strict';
import {fixtureConfig,combatBuild} from './helpers/combat-fixtures.mjs';import {compileCombatBuild,executableTalent} from '../.test-build/core/combat-build.js';
const api=await import('../.test-build/core/combat-volley.js').catch(()=>({}));
export function rainBuild(){const b=combatBuild({'attack-up':2,'lightning-enchantment':1},'wanjian');b.level=6;b.activeSynergyIds=['test-thunder-sword-rain'];return b;}
test('只有合法active组合编译四枚36度半伤害剑气',()=>{
 const c=fixtureConfig(),b=rainBuild(),copy=structuredClone(b);const result=compileCombatBuild(c,b);
 assert.equal(result.synergyVolleys.length,1);const v=result.synergyVolleys[0];assert.equal(v.projectileCount,4);assert.equal(v.spreadDegrees,36);assert.equal(v.damageMultiplier,0.5);assert.equal(v.name,'雷霆剑雨');assert.deepEqual(b,copy);
 b.activeSynergyIds=[];b.pendingSynergies=[{synergyId:'test-thunder-sword-rain',eligibleAtLevel:5,activateAtLevel:6}];assert.deepEqual(compileCombatBuild(c,b).synergyVolleys,[]);
});
test('非法组合引用、前置、重复与不可执行配置均拒绝',()=>{
 for(const mutate of [b=>b.activeSynergyIds.push(b.activeSynergyIds[0]),b=>b.activeSynergyIds=['unknown'],b=>b.talentLevels['attack-up']=1]){const b=rainBuild();mutate(b);assert.throws(()=>compileCombatBuild(fixtureConfig(),b));}
 for(const mutate of [e=>delete e.execution,e=>e.execution.spreadDegrees=361,e=>e.projectileCount=65,e=>e.execution.inheritance.stats.push('critChance')]){
  const c=fixtureConfig(),e=c.effects.find(e=>e.id==='test-thunder-sword-rain-attack');mutate(e);assert.throws(()=>compileCombatBuild(c,rainBuild()));
 }
 const c=fixtureConfig();c.projectiles.find(p=>p.id==='synergy-sword-rain').movement='homing';assert.throws(()=>compileCombatBuild(c,rainBuild()));
 const ordinary=fixtureConfig();ordinary.talents[0].effectIds=['test-thunder-sword-rain-attack'];assert.equal(executableTalent(ordinary.talents[0],ordinary),false);
});
test('扇形方向均匀归一，非法执行预算明确拒绝',()=>{
 assert.equal(typeof api.volleyDirections,'function');const dirs=api.volleyDirections({x:2,y:0},4,36);
 dirs.forEach((d,i)=>{assert.ok(Math.abs(Math.hypot(d.x,d.y)-1)<1e-9);assert.ok(Math.abs(Math.atan2(d.y,d.x)*180/Math.PI-[-18,-6,6,18][i])<1e-9);});
 assert.deepEqual(api.volleyDirections({x:2,y:0},1,36),[{x:1,y:0}]);for(const args of [[{x:0,y:0},4,36],[{x:NaN,y:0},4,36],[{x:1,y:0},0,36],[{x:1,y:0},65,36],[{x:1,y:0},4,Infinity]])assert.throws(()=>api.volleyDirections(...args));
});
test('组合伤害及尺寸乘积在静止编译阶段拒绝溢出，声明不能冒充已支持能力',()=>{
 const c=fixtureConfig();c.weapons[0].baseDamage=1e308;c.heroes[0].baseStats.attackPower=0;c.heroes[0].baseStats.critChance=0;c.effects.find(e=>e.id==='test-thunder-sword-rain-attack').damageMultiplier=2;
 assert.throws(()=>compileCombatBuild(c,rainBuild()));
 const size=fixtureConfig();size.projectiles.find(p=>p.id==='synergy-sword-rain').size.x=1.7e308;const b=rainBuild();b.talentLevels['projectile-size-up']=3;assert.throws(()=>compileCombatBuild(size,b));
 for(const mutate of [x=>x.effects.find(e=>e.id==='test-thunder-sword-rain-attack').projectileId='missing',x=>x.projectiles.find(p=>p.id==='synergy-sword-rain').inheritance.enchantments=true,x=>x.triggerPolicies.find(p=>p.id==='synergy-on-fire').maxDepth=1]){const cfg=fixtureConfig();mutate(cfg);assert.throws(()=>compileCombatBuild(cfg,rainBuild()));}
});
