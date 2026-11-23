import test from 'node:test';import assert from 'node:assert/strict';
import {GrowthSession} from '../.test-build/core/growth-session.js';
import {fixtureConfig,sessionOptions,firstOption} from './helpers/growth-fixtures.mjs';
const choose=s=>{const x=s.snapshot();return s.select(x.token,firstOption(x));};
test('十一自动激活之后十二抽取失败，整个选择不提交',()=>{
 const c=fixtureConfig();c.talents.forEach(t=>t.weight=t.id==='attack-up'?1:0);c.talents[0].maxLevel=12;
 c.synergies=[{id:'late',name:'晚期组合',usage:'test-only',prerequisites:[{kind:'talent',talentId:'attack-up',minLevel:6}],effectIds:['test-thunder-sword-rain-attack'],activation:'next-level'}];
 let bad=false,commits=0;const s=new GrowthSession(c,{...sessionOptions(),random:{next:()=>{if(bad)throw Error('抽取异常');return 0;}},commitBuild:()=>commits++});
 s.grantXp(45);while(s.snapshot().build.level<9)choose(s);s.grantXp(10);const before=s.snapshot(),count=commits;bad=true;
 assert.throws(()=>choose(s));assert.deepEqual(s.snapshot(),before);assert.equal(commits,count);bad=false;
 const r=choose(s);assert.equal(r.events.filter(e=>e.type==='synergyActivated').length,1);assert.equal(r.events.filter(e=>e.type==='ultimateEvolution').length,1);assert.equal(s.snapshot().growth.pendingChoice.targetLevel,12);
});
test('校验/提交失败保持原状态，回调隔离且所有修改均禁止重入',()=>{
 for(const hook of ['validateBuild','commitBuild']){
  let s,fail=false;const options={...sessionOptions(),[hook]:build=>{
   if(s){const x=s.snapshot();for(const f of [()=>s.grantXp(0),()=>s.select(x.token,'x'),()=>s.reroll(x.token),()=>s.reset(sessionOptions().random)])assert.throws(f);}
   build.talentLevels['attack-up']=99;if(fail)throw Error('提交异常');
  }};
  s=new GrowthSession(fixtureConfig(),options);s.grantXp(5);const before=s.snapshot();fail=true;assert.throws(()=>choose(s));assert.deepEqual(s.snapshot(),before);fail=false;choose(s);assert.equal(s.snapshot().build.talentLevels['attack-up'],1);
 }
});
