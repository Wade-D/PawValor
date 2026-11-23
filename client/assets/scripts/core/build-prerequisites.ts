import type { BuildState } from './build';
import type { BuildPrerequisite } from './config';
import type { GrowthReadonly } from './growth-model';

export function talentRank(build: GrowthReadonly<BuildState>, id: string): number {
  return Object.prototype.hasOwnProperty.call(build.talentLevels, id) ? build.talentLevels[id] : 0;
}
export function meetsPrerequisites(requirements: readonly BuildPrerequisite[], build: GrowthReadonly<BuildState>): boolean {
  return requirements.every(requirement => {
    switch (requirement.kind) {
      case 'hero': return build.heroId === requirement.heroId;
      case 'talent': return talentRank(build, requirement.talentId) >= requirement.minLevel;
      case 'route': return build.routeId === requirement.routeId;
      case 'branch': return build.branchId === requirement.branchId;
      case 'synergy': return build.activeSynergyIds.includes(requirement.synergyId);
    }
  });
}
