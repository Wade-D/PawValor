import {fixtureConfig} from './growth-fixtures.mjs';import {growthPrototype} from '../../.test-build/config/growth.prototype.js';
export {fixtureConfig};
export const runOptions=(extra={})=>({heroId:'raine',levelCosts:growthPrototype.levelCosts,rewards:growthPrototype.rewards,seed:44,
 world:{initialEnemyPositions:[{x:2,y:0}],tuning:{enemySpeed:0,enemyHealth:1000,contactDamage:0,spawnIntervalSeconds:100}},...extra});
export function selectFirst(run){const s=run.snapshot().growth,c=s.growth.pendingChoice;return run.select(s.token,c.kind==='ordinary'?c.options[0].id:c.kind==='route'?c.routeIds[0]:c.branchIds[0]);}
