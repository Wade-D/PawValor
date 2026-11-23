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
 const events=advance(w,75);const damages=hits(events).map(e=>e.damage);assert.equal(damages[0],20);assert.ok(Math.abs(damages[1]-30)<1e-9);
 assert.equal(events.filter(e=>e.type==='attack').length,1);
});
test('效果构筑输入与快照隔离，非法暴击种子不能启动',()=>{
 const config=fixtureConfig();const build=combatBuild({'attack-up':1});const w=new DemoWorld(config,{effects:{build}});build.talentLevels['attack-up']=5;
 assert.equal(w.snapshot().effects.stats.attackDamage,22);const snap=w.snapshot();snap.effects.stats.attackDamage=99;assert.equal(w.snapshot().effects.stats.attackDamage,22);
 assert.throws(()=>new DemoWorld(config,{effects:{build,criticalSeed:-1}}));
});
test('构造后修改原配置的嵌套继承和尺寸不能影响已发射弹体',()=>{
 const config=fixtureConfig();config.heroes[0].baseStats.critChance=0;config.weapons[0].attackIntervalSeconds=100;
 const w=new DemoWorld(config,{effects:{build:combatBuild({'fire-enchantment':1})},initialEnemyPositions:[{x:4,y:0}],tuning:{enemySpeed:0,enemyHealth:200,spawnIntervalSeconds:100}});
 w.start();advance(w,1);config.projectiles[0].inheritance.enchantments=false;config.projectiles[0].size.x=99;
 const damage=hits(advance(w,220));assert.deepEqual(damage.filter(e=>e.source.sourceKind==='damage-over-time').map(e=>e.damage),[4,4,4]);
 assert.equal(w.projectile.size.x,0.3);
});
test('有限配置产生暴击溢出时在应用前拒绝，世界保持原状态',()=>{
 const config=fixtureConfig();config.weapons[0].baseDamage=1e308;config.heroes[0].baseStats.attackPower=0;config.heroes[0].baseStats.critChance=1;
 const w=new DemoWorld(config,{effects:{build:combatBuild()}});const before=w.snapshot();
 assert.throws(()=>w.applyBuild(combatBuild({'crit-damage-up':2}),0));assert.deepEqual(w.snapshot(),before);
 assert.throws(()=>new DemoWorld(config,{effects:{build:combatBuild({'secondary-seeking':3,'attack-up':5})}}));
});
