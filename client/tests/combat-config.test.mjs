import assert from 'node:assert/strict';import test from 'node:test';
import {fixtureConfig} from './helpers/combat-fixtures.mjs';
import {validateGameConfig} from '../.test-build/core/validate-config.js';
test('原型具有已确认槽位、可执行附魔和两个副机制配置',()=>{
 const c=fixtureConfig();assert.equal(c.elementPolicy.usage,'confirmed');
 assert.equal(c.talents.filter(t=>t.category==='secondary-mechanism').length,2);
 assert.deepEqual(validateGameConfig(c),[]);
 assert.equal(c.effects.find(e=>e.id==='fire-hit').execution.kind,'burn');
});
test('新增效果执行参数与能力声明必须验证',()=>{
 for(const mutate of [c=>c.elementPolicy.innateElementCounts=true,
  c=>c.effects.find(e=>e.id==='fire-hit').execution={kind:'burn',tickIntervalSeconds:0},
  c=>c.effects.find(e=>e.id==='ice-hit').execution={kind:'slow-hit',slowRatio:Infinity},
  c=>c.talents[0].requiredCapabilities=['unknown']]){
   const c=fixtureConfig();mutate(c);assert.ok(validateGameConfig(c).length>0);
 }
});
