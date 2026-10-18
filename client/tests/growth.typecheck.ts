import type { GrowthOption } from '../assets/scripts/core/build';
import type { GrowthSnapshot } from '../assets/scripts/core/growth-model';

declare const snapshot: GrowthSnapshot;
// @ts-expect-error 快照的嵌套字典只读。
snapshot.build.talentLevels.attack = 2;
// @ts-expect-error 快照的经验队列只读。
snapshot.growth.pendingTargetLevels.push(3);
// @ts-expect-error 独立奖励不能用天赋字段冒充。
const invalid: GrowthOption = { kind: 'reward', id: 'reward:base-attack', talentId: 'attack' };
void invalid;
