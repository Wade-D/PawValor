import { rainePrototypeConfig } from '../../.test-build/config/raine.prototype.js';
import { growthPrototype } from '../../.test-build/config/growth.prototype.js';

export const fixtureConfig = () => structuredClone(rainePrototypeConfig);
export const fixtureRewards = () => structuredClone(growthPrototype.rewards);
export function sequenceRandom(values = [0]) {
  let calls = 0;
  return { random: { next: () => values[calls++ % values.length] }, get calls() { return calls; } };
}
export function emptyBuild() {
  return { heroId: 'raine', level: 1, routeId: null, branchId: null, talentLevels: {},
    bonusRewardCounts: { 'base-attack': 0, 'base-health': 0, 'base-move-speed': 0 }, ultimateEvolution: null,
    secondaryMechanismIds: [], enchantmentIds: [], pendingSynergies: [], activeSynergyIds: [] };
}
export function sessionOptions(random = sequenceRandom().random) {
  return { heroId: 'raine', random, levelCosts: [...growthPrototype.levelCosts], rewards: fixtureRewards() };
}
export function firstOption(snapshot) {
  const choice = snapshot.growth.pendingChoice;
  if (!choice) throw new Error('测试需要当前选择');
  return choice.kind === 'ordinary' ? choice.options[0].id : choice.kind === 'route' ? choice.routeIds[0] : choice.branchIds[0];
}
