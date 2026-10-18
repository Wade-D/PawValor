import type { BuildState, SynergyActivatedEvent } from './build';
import type { GameConfig } from './config';
import type { GrowthReadonly } from './growth-model';
import { meetsPrerequisites } from './build-prerequisites';

const copy = (build: GrowthReadonly<BuildState>): BuildState => JSON.parse(JSON.stringify(build)) as BuildState;
function level(value: number): void { if (!Number.isSafeInteger(value) || value < 1 || value >= Number.MAX_SAFE_INTEGER) throw new Error('组合等级无效。'); }
export function queueEligibleSynergies(config: GameConfig, input: GrowthReadonly<BuildState>, eligibleAtLevel: number): BuildState {
  level(eligibleAtLevel); const build = copy(input);
  const seen = new Set([...build.activeSynergyIds, ...build.pendingSynergies.map(p => p.synergyId)]);
  for (const synergy of config.synergies) if (!seen.has(synergy.id) && meetsPrerequisites(synergy.prerequisites, build)) {
    build.pendingSynergies.push({ synergyId: synergy.id, eligibleAtLevel, activateAtLevel: eligibleAtLevel + 1 }); seen.add(synergy.id);
  }
  return build;
}
export function prepareSynergyLevel(config: GameConfig, input: GrowthReadonly<BuildState>, targetLevel: number): { build: BuildState; events: readonly SynergyActivatedEvent[] } {
  level(targetLevel); const build = copy(input); const events: SynergyActivatedEvent[] = [];
  for (const pending of build.pendingSynergies) {
    level(pending.eligibleAtLevel);
    if (pending.activateAtLevel !== pending.eligibleAtLevel + 1 || !config.synergies.some(s => s.id === pending.synergyId)) throw new Error('待激活组合记录无效。');
    if (pending.activateAtLevel < targetLevel) throw new Error('组合激活等级已经错过。');
  }
  for (const id of build.activeSynergyIds) {
    const synergy = config.synergies.find(s => s.id === id);
    if (!synergy || !meetsPrerequisites(synergy.prerequisites, build)) throw new Error('已激活组合无效。');
  }
  build.activeSynergyIds = [...new Set(build.activeSynergyIds)];
  for (const synergy of config.synergies) if (build.pendingSynergies.some(p => p.synergyId === synergy.id && p.activateAtLevel === targetLevel) && !build.activeSynergyIds.includes(synergy.id)) {
    if (!meetsPrerequisites(synergy.prerequisites, input)) throw new Error('组合激活前置不满足。');
    build.activeSynergyIds.push(synergy.id); events.push({ type: 'synergyActivated', targetLevel, synergyId: synergy.id, name: synergy.name });
  }
  build.pendingSynergies = build.pendingSynergies.filter(p => p.activateAtLevel !== targetLevel && !build.activeSynergyIds.includes(p.synergyId));
  return { build, events };
}
