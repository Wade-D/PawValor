import assert from 'node:assert/strict';import test from 'node:test';
const api=await import('../.test-build/core/combat-trigger.js').catch(()=>({}));
const policy={id:'test',allowedSources:['direct'],maxDepth:0,maxTriggersPerRoot:1,cooldownSeconds:0.25,targetHitIntervalSeconds:0.25};
const target={id:2,generation:0};const source=(id=1)=>({rootAttackId:id,sourceKind:'direct',depth:0});
const create=()=>{assert.equal(typeof api.CombatTriggerGuard,'function');return new api.CombatTriggerGuard();};
test('每根每效果预算隔离，来源深度或旧目标代次拒绝不消费',()=>{
 const g=create();assert.equal(g.tryConsume('火',policy,{...source(),sourceKind:'element'},target,0,0),false);
 assert.equal(g.tryConsume('火',policy,{...source(),depth:1},target,0,0),false);
 assert.equal(g.tryConsume('火',policy,source(),{...target,generation:1},0,0),false);
 assert.equal(g.tryConsume('火',policy,source(),target,0,0),true);
 assert.equal(g.tryConsume('火',policy,source(),target,0,0.3),false);
 assert.equal(g.tryConsume('冰',policy,source(),target,0,0),true);
});
test('根清理不清除效果冷却，精确边界允许新根，同目标间隔独立',()=>{
 const g=create();assert.equal(g.tryConsume('火',policy,source(),target,0,0),true);
 g.retainRoots(new Set(),0,0.1);
 assert.equal(g.tryConsume('火',policy,source(2),target,0,0.1),false);
 assert.equal(g.tryConsume('火',policy,source(2),target,0,0.25),true);
 const targetPolicy={...policy,cooldownSeconds:0,targetHitIntervalSeconds:1};
 assert.equal(g.tryConsume('雷',targetPolicy,source(3),target,0,0),true);
 assert.equal(g.tryConsume('雷',targetPolicy,source(4),target,0,0.5),false);
 assert.equal(g.tryConsume('雷',targetPolicy,source(4),{id:3,generation:0},0,0.5),true);
 assert.equal(g.tryConsume('雷',targetPolicy,source(5),target,0,1),true);
});
test('存活根保留预算，重置清空，新代次与旧代次隔离',()=>{
 const g=create();g.tryConsume('火',policy,source(),target,0,0);g.retainRoots(new Set([1]),0,1);
 assert.equal(g.tryConsume('火',policy,source(),target,0,1),false);g.reset();
 assert.equal(g.tryConsume('火',policy,source(),{id:2,generation:1},1,0),true);
});
test('非法触发参数必须在消费前拒绝',()=>{
 const g=create();for(const bad of [{...policy,maxTriggersPerRoot:Infinity},{...policy,maxDepth:-1},{...policy,cooldownSeconds:NaN}])assert.throws(()=>g.tryConsume('火',bad,source(),target,0,0));
 assert.throws(()=>g.tryConsume('火',policy,source(),target,0,NaN));
 assert.equal(g.tryConsume('火',policy,source(),target,0,0),true);
});
