import type { BuildState } from './build';
import type { CombatCapability, EffectConfig, GameConfig, TalentConfig, StatId } from './config';
import type { CompiledCombatBuild, ResolvedElement, ResolvedSecondary, ResolvedExtraProjectile } from './combat-model';
import type { GrowthReadonly } from './growth-model';
import { meetsPrerequisites, talentRank } from './build-prerequisites';
import { validateGameConfig } from './validate-config';

export function executableTalent(talent: TalentConfig, config: GameConfig): boolean {
  return talent.effectIds.length > 0 && talent.effectIds.every(id => {
    const e = config.effects.find(effect => effect.id === id);
    return !!e && (e.kind === 'stat-modifier' ? e.stat !== 'projectileCount'
      : e.kind === 'element' ? !!e.execution
      : e.kind === 'secondary-mechanism' || (e.kind === 'attack-pattern' && !!e.execution));
  });
}
export function combatCapabilities(config: GameConfig, build: GrowthReadonly<BuildState>): readonly CombatCapability[] {
  return config.talents.some(t => talentRank(build, t.id) > 0 && t.effectIds.some(id => {
    const e = config.effects.find(effect => effect.id === id);
    return e?.kind === 'secondary-mechanism' && e.behavior.kind === 'explosion';
  })) ? ['area-attack'] : [];
}
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function exactIds(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && new Set(actual).size === actual.length && actual.every(id => expected.includes(id));
}
export function compileCombatBuild(config: GameConfig, input: GrowthReadonly<BuildState>): CompiledCombatBuild {
  assert(validateGameConfig(config).length === 0, '战斗配置无效。');
  assert(config.elementPolicy.usage === 'confirmed', '效果模式必须使用已确认的槽位策略。');
  const hero = config.heroes.find(h => h.id === input.heroId);
  assert(hero && Number.isSafeInteger(input.level) && input.level >= 1, '战斗构筑英雄或等级无效。');
  const route = config.routes.find(r => r.id === input.routeId);
  assert(input.routeId === null || (route && route.heroId === hero.id), '战斗构筑路线无效。');
  assert(input.branchId === null || route?.branches.some(b => b.id === input.branchId), '战斗构筑分支无效。');
  if (input.ultimateEvolution) {
    const event = input.ultimateEvolution; const branch = route?.branches.find(b => b.id === input.branchId);
    assert(event.type === 'ultimateEvolution' && event.targetLevel === 11 && event.routeId === route?.id
      && event.branchId === branch?.id && event.effectId === route?.ultimate.effectId
      && event.ultimateBehaviorEffectId === branch?.ultimateBehaviorEffectId, '终极进化记录无效。');
  }
  for (const id of input.activeSynergyIds) assert(config.synergies.some(s => s.id === id), '组合引用无效。');
  for (const pending of input.pendingSynergies) assert(config.synergies.some(s => s.id === pending.synergyId)
    && Number.isSafeInteger(pending.eligibleAtLevel) && pending.activateAtLevel === pending.eligibleAtLevel + 1, '待激活组合记录无效。');
  const owned: TalentConfig[] = [];
  const capabilities = combatCapabilities(config, input);
  for (const [id, rank] of Object.entries(input.talentLevels)) {
    const talent = config.talents.find(t => t.id === id);
    assert(talent && Number.isSafeInteger(rank) && rank >= 0 && rank <= talent.maxLevel, '天赋引用或等级无效。');
    if (!rank) continue;
    assert(executableTalent(talent, config), '构筑包含尚不支持执行的天赋。');
    assert(meetsPrerequisites(talent.prerequisites, input), '已拥有天赋不满足前置。');
    assert((talent.requiredCapabilities ?? []).every(c => capabilities.includes(c)), '天赋所需战斗能力缺失。');
    assert(!owned.some(other => other.exclusiveTags.some(tag => talent.exclusiveTags.includes(tag))), '构筑包含互斥天赋。');
    owned.push(talent);
  }
  const enchantments = owned.filter(t => t.category === 'enchantment');
  const secondaryTalents = owned.filter(t => t.category === 'secondary-mechanism');
  assert(exactIds(input.enchantmentIds, enchantments.map(t => t.id)) && enchantments.length <= 2, '附魔槽或分类记录无效。');
  assert(exactIds(input.secondaryMechanismIds, secondaryTalents.map(t => t.id)) && secondaryTalents.length <= 2, '副机制槽或分类记录无效。');
  const rewardIds = ['base-attack', 'base-health', 'base-move-speed'] as const;
  assert(Object.keys(input.bonusRewardCounts).length === 3 && rewardIds.every(id => Number.isSafeInteger(input.bonusRewardCounts[id]) && input.bonusRewardCounts[id] >= 0), '基础强化次数无效。');
  const weapon = config.weapons.find(w => w.id === hero.weaponId)!;
  const projectile = config.projectiles.find(p => p.id === weapon.projectileId)!;
  const baseDamage = weapon.baseDamage + hero.baseStats.attackPower * weapon.attackPowerScaling;
  const base: Record<StatId, number> = { attackDamage: baseDamage, attackSpeed: 1, critChance: hero.baseStats.critChance,
    critDamageMultiplier: hero.baseStats.critDamageMultiplier, pierceCount: projectile.pierceCount, projectileSize: 1,
    range: weapon.range, areaSize: 1, maxHealth: hero.baseStats.maxHealth, moveSpeed: hero.baseStats.moveSpeed, damageReduction: 0, projectileCount: 1 };
  const percent: Partial<Record<StatId, number>> = { attackDamage: input.bonusRewardCounts['base-attack'] * 0.01,
    maxHealth: input.bonusRewardCounts['base-health'] * 0.01, moveSpeed: input.bonusRewardCounts['base-move-speed'] * 0.01 };
  const add: Partial<Record<StatId, number>> = {};
  const effects: { effect: EffectConfig; rank: number; name: string }[] = [];
  for (const talent of owned) for (const id of talent.effectIds) {
    const effect = config.effects.find(e => e.id === id)!; const rank = talentRank(input, talent.id);
    effects.push({ effect, rank, name: talent.name });
    if (effect.kind === 'stat-modifier') {
      const table = effect.operation === 'multiply' ? percent : add;
      table[effect.stat] = (table[effect.stat] ?? 0) + rank * (effect.operation === 'multiply' ? effect.value - 1 : effect.value);
    }
  }
  const value = (id: StatId): number => {
    const result = base[id] * (1 + (percent[id] ?? 0)) + (add[id] ?? 0);
    assert(Number.isFinite(result) && (result >= 0 || id === 'critChance' || id === 'damageReduction'), `战斗属性 ${id} 计算无效。`); return result;
  };
  const stats = { attackDamage: value('attackDamage'), attackIntervalSeconds: weapon.attackIntervalSeconds / value('attackSpeed'),
    critChance: Math.max(0, Math.min(1, value('critChance'))), critDamageMultiplier: value('critDamageMultiplier'),
    pierceCount: value('pierceCount'), projectileSize: { x: projectile.size.x * value('projectileSize'), y: projectile.size.y * value('projectileSize') },
    range: value('range'), areaScale: value('areaSize'), maxHealth: value('maxHealth'), moveSpeed: value('moveSpeed'), damageReduction: Math.max(0, Math.min(1, value('damageReduction'))) };
  assert(Object.values(stats).filter(v => typeof v === 'number').every(Number.isFinite) && Number.isFinite(stats.projectileSize.x)
    && Number.isFinite(stats.projectileSize.y) && stats.maxHealth > 0 && stats.attackIntervalSeconds > 0
    && stats.projectileSize.x > 0 && stats.projectileSize.y > 0 && Number.isSafeInteger(stats.pierceCount), '有效属性超出可执行范围。');
  const elements: ResolvedElement[] = [];
  const secondary: ResolvedSecondary[] = []; const extraProjectiles: ResolvedExtraProjectile[] = [];
  const elementInputs = [...effects.filter(item => item.effect.kind === 'element')];
  for (const id of route?.entryEffectIds ?? []) {
    const effect = config.effects.find(e => e.id === id)!;
    if (effect.kind === 'element' && effect.execution) elementInputs.push({ effect, rank: 1, name: `${route!.name}固有属性` });
  }
  for (const element of ['fire', 'ice', 'lightning'] as const) {
    const entries = elementInputs.filter(item => item.effect.kind === 'element' && item.effect.element === element);
    if (!entries.length) continue;
    const selected = entries[0]; let effect = selected.effect as Extract<EffectConfig, { kind: 'element' }>;
    const rank = selected.rank; let name = selected.name;
    if (entries.length > 1) {
      const resonance = config.effects.find(e => config.elementPolicy.resonanceEffectIds.includes(e.id) && e.kind === 'element' && e.element === element);
      assert(resonance?.kind === 'element' && resonance.execution, '同属性共鸣缺少执行配置。'); effect = resonance; name += '共鸣';
    }
    assert(effect.execution, '元素缺少执行配置。');
    const multiplier = effect.damageMultiplier * rank; assert(Number.isFinite(multiplier), '元素伤害倍率溢出。');
    elements.push({ effectId: effect.id, name, element, kind: effect.execution.kind, rank, damageMultiplier: multiplier,
      durationSeconds: effect.durationSeconds, tickIntervalSeconds: effect.execution.kind === 'burn' ? effect.execution.tickIntervalSeconds : 0,
      slowRatio: effect.execution.kind === 'slow-hit' ? effect.execution.slowRatio : 0,
      policy: config.triggerPolicies.find(p => p.id === effect.triggerPolicyId)! });
  }
  for (const {effect,rank,name} of effects) {
    if (effect.kind === 'secondary-mechanism') {
      assert(Number.isFinite(effect.damageMultiplier * rank), '副机制倍率溢出。');
      const projectileId = effect.behavior.kind === 'homing' ? effect.behavior.projectileId : null;
      secondary.push({ effectId: effect.id, name, damageMultiplier: effect.damageMultiplier * rank,
        policy: config.triggerPolicies.find(p => p.id === effect.triggerPolicyId)!, inheritance: effect.inheritance, behavior: effect.behavior,
        projectile: projectileId ? config.projectiles.find(p => p.id === projectileId) : undefined });
    } else if (effect.kind === 'attack-pattern' && effect.execution) extraProjectiles.push({ effectId: effect.id, name,
      damageMultiplier: effect.damageMultiplier, lateralOffset: effect.execution.lateralOffset, projectile: config.projectiles.find(p => p.id === effect.projectileId)! });
  }
  return JSON.parse(JSON.stringify({ build: input, stats, baseDamage, elements, secondary, extraProjectiles })) as CompiledCombatBuild;
}
