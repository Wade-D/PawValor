import test from 'node:test';import assert from 'node:assert/strict';
import {DemoWorld} from '../.test-build/core/demo-world.js';import {combatBuild,advance} from './helpers/combat-fixtures.mjs';
import {fixtureConfig,runOptions,selectFirst} from './helpers/growth-integration-fixtures.mjs';
const api=await import('../.test-build/core/growth-combat-run.js').catch(()=>({}));
const create=(options=runOptions(),config=fixtureConfig())=>{assert.equal(typeof api.GrowthCombatRun,'function');return new api.GrowthCombatRun(config,options);};
test('外部经验模式每球原值入账，多球不触发旧二级封顶逻辑',()=>{
 const c=fixtureConfig();c.projectiles[0].speed=300;const w=new DemoWorld(c,{experienceMode:'external',effects:{build:combatBuild({'pierce-up':1})},initialEnemyPositions:[{x:0.2,y:0},{x:0.3,y:0}],tuning:{enemyHealth:1,enemySpeed:0,contactDamage:0,xpPerOrb:10}});w.start();const e=advance(w,1);
 assert.equal(e.filter(e=>e.type==='xpPickup').reduce((n,e)=>n+e.value,0),20);assert.equal(e.filter(e=>e.type==='levelUp').length,0);assert.equal(w.snapshot().xp,0);assert.equal(w.snapshot().level,1);
});
test('经验五点出现真实选择，等待冻结，选完应用构筑且继续到三级',()=>{
 const r=create();r.start();r.grantXp(5);let s=r.snapshot();assert.equal(s.growth.build.level,1);assert.equal(s.growth.growth.pendingChoice.options.length,3);assert.equal(s.pauseReason,'growth');
 for(let i=0;i<300;i++)r.step(1/60,{x:1,y:0});assert.deepEqual(r.snapshot(),s);const choice=s.growth.growth.pendingChoice;const id=choice.options[0].id;
 assert.equal(r.select(s.growth.token,id).ok,true);assert.equal(r.snapshot().growth.build.level,2);assert.equal(r.snapshot().world.effects.build.level,2);assert.equal(r.snapshot().pauseReason,'none');
 r.grantXp(5);assert.equal(r.snapshot().growth.growth.pendingChoice.kind,'route');assert.equal(r.snapshot().experience.total,10);
});
test('跨级经验逐项提交，继续不能越过选择，手动暂停独立且封顶准确',()=>{
 const r=create();r.start();r.pause();r.grantXp(55);const s=r.snapshot();assert.equal(s.experience.current,5);assert.equal(s.growth.earnedLevel,12);assert.equal(s.growth.build.level,1);
 selectFirst(r);assert.equal(r.snapshot().pauseReason,'growth');const events=[];while(r.snapshot().growth.growth.pendingChoice)events.push(...selectFirst(r).events);
 assert.equal(r.snapshot().growth.build.level,12);assert.equal(r.snapshot().pauseReason,'manual');assert.equal(r.snapshot().experience.nextCost,null);assert.equal(events.filter(e=>e.type==='ultimateEvolution').length,1);
 r.resume();assert.equal(r.snapshot().pauseReason,'none');r.reset();r.start();r.grantXp(5);const before=r.snapshot();r.resume();assert.deepEqual(r.snapshot(),before);
});
test('拾取后成长失败保留经验，重试不重复入账，原选择令牌与局次隔离',()=>{
 let bad=true;const c=fixtureConfig();const options=runOptions({createGrowthRandom:()=>({next:()=>{if(bad)throw Error('随机源暂不可用');return 0;}}),world:{initialEnemyPositions:[{x:0.2,y:0}],tuning:{enemyHealth:1,enemySpeed:0,contactDamage:0,xpPerOrb:5}}});
 const r=create(options,c);r.start();r.step(1/60,{x:0,y:0});let s=r.snapshot();assert.equal(s.pauseReason,'error');assert.equal(s.queuedXp,5);assert.equal(s.growth.xp,0);assert.equal(s.world.orbs.length,0);
 bad=false;r.retryGrowth();s=r.snapshot();assert.equal(s.queuedXp,0);assert.equal(s.growth.xp,5);const token=s.growth.token;assert.deepEqual(r.retryGrowth(),[]);
 const revision=s.inputRevision;assert.equal(r.select({...token,revision:999},'x').ok,false);assert.equal(r.snapshot().inputRevision,revision);
 for(let i=0;i<5;i++){r.reset();r.start();assert.equal(r.snapshot().growth.xp,0);assert.equal(r.select(token,'talent:attack-up').ok,false);assert.equal(r.snapshot().queuedXp,0);}
 assert.throws(()=>r.grantXp(Infinity));assert.throws(()=>r.grantXp(-1));
});
test('刷新失败可以重试同一动作，重复回调不消耗次数',()=>{
 let bad=false;const r=create(runOptions({createGrowthRandom:()=>({next:()=>{if(bad)throw Error('抽取异常');return 0;}})}));r.start();r.grantXp(5);const before=r.snapshot();bad=true;
 assert.equal(r.reroll(before.growth.token).reason,'transaction-failed');assert.equal(r.snapshot().growth.rerollsRemaining,2);bad=false;r.retryGrowth();assert.equal(r.snapshot().growth.rerollsRemaining,1);
 assert.equal(r.reroll(before.growth.token).ok,false);assert.equal(r.snapshot().growth.rerollsRemaining,1);
});
test('接触阵亡先于拾取，结束后不获得成长或复活，输入及配置隔离',()=>{
 const options=runOptions({world:{initialEnemyPositions:[{x:0.2,y:0}],tuning:{contactDamage:100}}});const c=fixtureConfig();const r=create(options,c);c.heroes[0].baseStats.maxHealth=999;r.start();const e=r.step(1/60,{x:0,y:0});assert.equal(e.combatEvents.at(-1).type,'runEnded');assert.equal(r.snapshot().pauseReason,'ended');assert.equal(r.snapshot().growth.xp,0);
 assert.equal(r.select({sessionId:1,generation:0,revision:1},'x').ok,false);r.resume();assert.equal(r.snapshot().world.hero.health,0);
 const s=r.snapshot();s.world.hero.health=99;assert.equal(r.snapshot().world.hero.health,0);assert.throws(()=>create(runOptions({heroId:'other'})));
});
test('不可执行构筑选择不半提交，经验极值安全封顶',()=>{
 const c=fixtureConfig();c.heroes[0].baseStats.critChance=0;c.heroes[0].baseStats.attackPower=0;c.weapons[0].baseDamage=1.6e308;c.talents.forEach(t=>t.weight=t.id==='attack-up'?1:0);
 const r=create(runOptions(),c);r.start();r.grantXp(5);selectFirst(r);r.grantXp(5);selectFirst(r);r.grantXp(5);const before=r.snapshot();const result=selectFirst(r);
 assert.equal(result.reason,'transaction-failed');assert.deepEqual(r.snapshot().growth,before.growth);assert.deepEqual(r.snapshot().world,before.world);assert.equal(r.snapshot().pauseReason,'error');
 const cap=create();cap.start();cap.grantXp(Number.MAX_VALUE);assert.equal(cap.snapshot().growth.xp,55);assert.equal(cap.snapshot().queuedXp,0);
});
test('成长抽取独立于刷怪，重开按同种子复现且阻止回调重入',()=>{
 const options=runOptions({world:{initialEnemyPositions:[{x:8,y:0}],tuning:{enemyHealth:1e6,enemySpeed:0,contactDamage:0,spawnIntervalSeconds:0.1}}});
 const a=create(options),b=create(options);a.start();b.start();a.grantXp(5);a.reroll(a.snapshot().growth.token);selectFirst(a);
 for(let i=0;i<100;i++){a.step(1/60,{x:0,y:0});b.step(1/60,{x:0,y:0});}
 assert.deepEqual(a.snapshot().world.enemies.map(e=>e.position),b.snapshot().world.enemies.map(e=>e.position));
 let r;const reentrant=create(runOptions({createGrowthRandom:()=>({next:()=>{if(r)assert.throws(()=>r.pause());return 0;}})}));r=reentrant;r.start();r.grantXp(5);assert.equal(r.snapshot().pauseReason,'growth');
});
