import type { GameConfig } from '../core/config';
import type { BuildState } from '../core/build';
import type { DemoWorldOptions } from '../core/demo-model';
import { rainePrototypeConfig } from './raine.prototype';

export type CombatPresetId = 'basic' | 'general' | 'elements' | 'resonance' | 'secondary';
export const combatPresetIds: readonly CombatPresetId[] = ['basic', 'general', 'elements', 'resonance', 'secondary'];
const names: Record<CombatPresetId, string> = { basic: '基础', general: '通用强化', elements: '火冰雷', resonance: '雷电共鸣', secondary: '副机制' };

/** 诊断构筑直接注入，不代表二级升级所得奖励。 */
export function createCombatPreset(id: CombatPresetId): { id: CombatPresetId; name: string; summary: string; config: GameConfig; options: DemoWorldOptions } {
  if (!combatPresetIds.includes(id)) throw new Error('未知战斗预设');
  const config = JSON.parse(JSON.stringify(rainePrototypeConfig)) as GameConfig;
  const build: BuildState = { heroId: 'raine', level: 1, routeId: null, branchId: null, talentLevels: {},
    bonusRewardCounts: { 'base-attack': 0, 'base-health': 0, 'base-move-speed': 0 }, ultimateEvolution: null,
    secondaryMechanismIds: [], enchantmentIds: [], pendingSynergies: [], activeSynergyIds: [] };
  const summaries: Record<CombatPresetId, string> = {
    basic: '原第二阶段参数：敌人生命30、移速2', general: '攻击/攻速/暴击率二级，其余非范围通用一级',
    elements: '固有雷 + 火冰附魔各一级', resonance: '固有雷 + 雷附魔一级，共鸣替换', secondary: '追踪/爆裂/范围增幅各一级',
  };
  if (id === 'general') for (const talent of config.talents.filter(t => t.category === 'general' && t.id !== 'area-size-up'))
    build.talentLevels[talent.id] = ['attack-up', 'attack-speed-up', 'crit-chance-up'].includes(talent.id) ? 2 : 1;
  if (id === 'elements' || id === 'resonance') { build.routeId = 'thunder'; build.level = 3; }
  if (id === 'elements') build.talentLevels = { 'fire-enchantment': 1, 'ice-enchantment': 1 };
  if (id === 'resonance') build.talentLevels = { 'lightning-enchantment': 1 };
  if (id === 'secondary') build.talentLevels = { 'secondary-seeking': 1, 'secondary-burst': 1, 'area-size-up': 1 };
  build.enchantmentIds = config.talents.filter(t => t.category === 'enchantment' && build.talentLevels[t.id]).map(t => t.id);
  build.secondaryMechanismIds = config.talents.filter(t => t.category === 'secondary-mechanism' && build.talentLevels[t.id]).map(t => t.id);
  const options: DemoWorldOptions = id === 'basic' ? {} : { effects: { build }, tuning: { enemyHealth: 200, enemySpeed: 1 } };
  return { id, name: names[id], summary: summaries[id], config, options };
}
