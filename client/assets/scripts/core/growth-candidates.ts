import type { BuildState } from './build';
import type { BuildPrerequisite, GameConfig, TalentConfig } from './config';
import type { GrowthReadonly } from './growth-model';

export type TalentRejection = 'unsupported-category' | 'prerequisites' | 'max-level' | 'exclusive';

/** 字典只读取自有属性，配置标识不能意外命中原型成员。 */
function rank(build: GrowthReadonly<BuildState>, id: string): number {
  return Object.prototype.hasOwnProperty.call(build.talentLevels, id) ? build.talentLevels[id] : 0;
}

export function meetsPrerequisites(requirements: readonly BuildPrerequisite[], build: GrowthReadonly<BuildState>): boolean {
  return requirements.every(requirement => {
    switch (requirement.kind) {
      case 'hero': return build.heroId === requirement.heroId;
      case 'talent': return rank(build, requirement.talentId) >= requirement.minLevel;
      case 'route': return build.routeId === requirement.routeId;
      case 'branch': return build.branchId === requirement.branchId;
      case 'synergy': return build.activeSynergyIds.includes(requirement.synergyId);
    }
  });
}

export function evaluateTalent(talent: TalentConfig, config: GameConfig, build: GrowthReadonly<BuildState>): { eligible: boolean; reasons: readonly TalentRejection[] } {
  const reasons: TalentRejection[] = [];
  if (talent.category !== 'general') reasons.push('unsupported-category');
  if (!meetsPrerequisites(talent.prerequisites, build)) reasons.push('prerequisites');
  if (rank(build, talent.id) >= talent.maxLevel) reasons.push('max-level');
  if (config.talents.some(owned => owned.id !== talent.id && rank(build, owned.id) > 0
    && owned.exclusiveTags.some(tag => talent.exclusiveTags.includes(tag)))) reasons.push('exclusive');
  return { eligible: reasons.length === 0, reasons };
}

export function eligibleTalents(config: GameConfig, build: GrowthReadonly<BuildState>): readonly TalentConfig[] {
  return config.talents.filter(talent => evaluateTalent(talent, config, build).eligible);
}
