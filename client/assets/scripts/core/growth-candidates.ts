import type { BuildState } from './build';
import type { GameConfig, TalentConfig, TalentCategory } from './config';
import type { GrowthReadonly } from './growth-model';

export type TalentRejection = 'unsupported-category' | 'prerequisites' | 'max-level' | 'exclusive' | 'slot-full' | 'capability' | 'unsupported-effect';

import { talentRank as rank, meetsPrerequisites } from './build-prerequisites';
import { combatCapabilities, executableTalent } from './combat-build';
export { meetsPrerequisites } from './build-prerequisites';
export interface CandidateOptions { enabledCategories: readonly TalentCategory[] }

export function evaluateTalent(talent: TalentConfig, config: GameConfig, build: GrowthReadonly<BuildState>, options?: CandidateOptions): { eligible: boolean; reasons: readonly TalentRejection[] } {
  const reasons: TalentRejection[] = [];
  if (!(options?.enabledCategories ?? ['general']).includes(talent.category)) reasons.push('unsupported-category');
  if (!meetsPrerequisites(talent.prerequisites, build)) reasons.push('prerequisites');
  if (rank(build, talent.id) >= talent.maxLevel) reasons.push('max-level');
  if (config.talents.some(owned => owned.id !== talent.id && rank(build, owned.id) > 0
    && owned.exclusiveTags.some(tag => talent.exclusiveTags.includes(tag)))) reasons.push('exclusive');
  if (!executableTalent(talent, config)) reasons.push('unsupported-effect');
  if (!(talent.requiredCapabilities ?? []).every(c => combatCapabilities(config, build).includes(c))) reasons.push('capability');
  const ids = talent.category === 'enchantment' ? build.enchantmentIds : talent.category === 'secondary-mechanism' ? build.secondaryMechanismIds : [];
  if (talent.category !== 'general' && rank(build, talent.id) === 0 && ids.length >= 2) reasons.push('slot-full');
  return { eligible: reasons.length === 0, reasons };
}

export function eligibleTalents(config: GameConfig, build: GrowthReadonly<BuildState>, options?: CandidateOptions): readonly TalentConfig[] {
  return config.talents.filter(talent => evaluateTalent(talent, config, build, options).eligible);
}
