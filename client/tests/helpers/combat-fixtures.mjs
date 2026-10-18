import { fixtureConfig, emptyBuild } from './growth-fixtures.mjs';
import { DemoWorld } from '../../.test-build/core/demo-world.js';
export { fixtureConfig } from './growth-fixtures.mjs';
export function combatBuild(talents = {}, routeId = null) {
  const config = fixtureConfig(); const build = emptyBuild();
  build.talentLevels = { ...talents }; build.routeId = routeId;
  if (routeId) build.level = 3;
  build.enchantmentIds = config.talents.filter(t => t.category === 'enchantment' && talents[t.id] > 0).map(t => t.id);
  build.secondaryMechanismIds = config.talents.filter(t => t.category === 'secondary-mechanism' && talents[t.id] > 0).map(t => t.id);
  return build;
}
export function advance(world, count, movement = { x:0, y:0 }) {
  return Array.from({length:count}, () => world.step(1/60, movement)).flat();
}
export const hits = events => events.filter(e => e.type === 'hit');
export function combatWorld(talents = {}, positions = [{x:2,y:0}], mutate = ()=>{}, options={}) {
  const config=fixtureConfig();config.heroes[0].baseStats.critChance=0;mutate(config);
  const world=new DemoWorld(config,{effects:{build:combatBuild(talents)},initialEnemyPositions:positions,
    tuning:{enemySpeed:0,enemyHealth:200,contactDamage:0,spawnIntervalSeconds:100},...options});
  world.start();return world;
}
