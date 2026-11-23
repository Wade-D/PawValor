import assert from 'node:assert/strict';import test from 'node:test';
const api=await import('../.test-build/core/combat-status.js').catch(()=>({}));
const target={id:2,generation:0};const payload=(damage=4,root=1)=>({attackId:root+10,attacker:{id:1,generation:0},source:{rootAttackId:root,sourceKind:'damage-over-time',depth:1},damage,durationSeconds:3,tickIntervalSeconds:1});
const create=()=>{assert.equal(typeof api.CombatStatusStore,'function');return new api.CombatStatusStore();};
test('灼烧每秒跳伤并在第三秒最后一次后清理',()=>{const s=create();s.applyBurn(target,payload(),0);assert.equal(s.advance(0.9,[target]).length,0);assert.deepEqual([1,2,3].flatMap(now=>s.advance(now,[target])).map(h=>h.damage),[4,4,4]);assert.deepEqual(s.snapshot(target),[]);assert.equal(s.liveRootIds().size,0);});
test('续期不推迟跳伤，强者替换根和伤害，弱者只续期',()=>{const s=create();s.applyBurn(target,payload(),0);s.applyBurn(target,payload(2,2),0.5);assert.equal(s.advance(1,[target])[0].damage,4);s.applyBurn(target,payload(6,3),1.2);s.applyBurn(target,payload(1,4),1.4);const h=s.advance(2,[target])[0];assert.equal(h.damage,6);assert.equal(h.source.rootAttackId,3);assert.equal(s.snapshot(target)[0].expiresAt,4.4);});
test('寒冷不叠乘，代次隔离，快照不泄漏，清理与重置有效',()=>{const s=create();s.applySlow(target,0.3,2,0);s.applySlow(target,0.3,2,1);assert.equal(s.slowFactor(target,1.5),0.7);assert.equal(s.slowFactor(target,3),1);s.applyBurn(target,payload(),0);const a=s.snapshot(target);a[0].expiresAt=999;s.advance(1,[{id:2,generation:1}]);assert.deepEqual(s.snapshot(target),[]);s.applyBurn(target,payload(),0);s.reset();assert.deepEqual(s.snapshot(target),[]);});
test('状态计时和伤害非法时拒绝且不创建状态',()=>{const s=create();for(const p of [{...payload(),damage:NaN},{...payload(),tickIntervalSeconds:0},{...payload(),durationSeconds:Infinity}])assert.throws(()=>s.applyBurn(target,p,0));assert.throws(()=>s.applySlow(target,2,2,0));assert.deepEqual(s.snapshot(target),[]);});
test('可变步跨过到期且先重新施加时，旧灼烧最后一跳仍用旧伤害归属',()=>{
 const s=create();s.applyBurn(target,payload(4,1),0);assert.equal(s.advance(2.999,[target]).length,2);
 s.applyBurn(target,payload(8,2),3.01);assert.ok(s.liveRootIds().has(1));
 const last=s.advance(3.01,[target]);assert.deepEqual(last.map(h=>[h.damage,h.source.rootAttackId]),[[4,1]]);
 assert.deepEqual([...s.liveRootIds()],[2]);assert.equal(s.advance(4.01,[target])[0].damage,8);
});
