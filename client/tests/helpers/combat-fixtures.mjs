import { fixtureConfig, emptyBuild } from './growth-fixtures.mjs';
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
