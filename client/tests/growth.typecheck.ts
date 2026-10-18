import type { GrowthOption } from '../assets/scripts/core/build';
import type { GrowthSnapshot } from '../assets/scripts/core/growth-model';
import { meetsPrerequisites, evaluateTalent, eligibleTalents } from '../assets/scripts/core/growth-candidates';
import { rainePrototypeConfig } from '../assets/scripts/config/raine.prototype';
import { compileCombatBuild, combatCapabilities } from '../assets/scripts/core/combat-build';

declare const snapshot: GrowthSnapshot;
// 公开查询接口应直接接受成长快照，无需调用方去掉只读保护。
meetsPrerequisites([], snapshot.build);
evaluateTalent(rainePrototypeConfig.talents[0], rainePrototypeConfig, snapshot.build);
eligibleTalents(rainePrototypeConfig, snapshot.build);
compileCombatBuild(rainePrototypeConfig, snapshot.build);
combatCapabilities(rainePrototypeConfig, snapshot.build);
eligibleTalents(rainePrototypeConfig, snapshot.build, { enabledCategories: ['general', 'enchantment', 'secondary-mechanism'] });
// @ts-expect-error 快照的嵌套字典只读。
snapshot.build.talentLevels.attack = 2;
// @ts-expect-error 快照的经验队列只读。
snapshot.growth.pendingTargetLevels.push(3);
// @ts-expect-error 独立奖励不能用天赋字段冒充。
const invalid: GrowthOption = { kind: 'reward', id: 'reward:base-attack', talentId: 'attack' };
void invalid;
