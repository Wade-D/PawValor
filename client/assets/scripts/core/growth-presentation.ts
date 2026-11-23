import type { BuildState } from './build';
import type { GameConfig, StatId, TalentCategory, TalentConfig } from './config';
import type { GrowthToken, GrowthReadonly } from './growth-model';
import type { GrowthRunSnapshot } from './growth-combat-model';
import { talentRank } from './build-prerequisites';
import { compileCombatBuild } from './combat-build';

export interface GrowthCopyConfig {
  statNames: Readonly<Record<StatId, string>>;
  categoryNames: Readonly<Record<TalentCategory, string>>;
  routeDescriptions: Readonly<Record<string, string>>;
  branchDescriptions: Readonly<Record<string, string>>;
  ultimateDescriptions: Readonly<Record<string, string>>;
}
export interface GrowthCardView { optionId: string; name: string; category: string; description: string; rankText: string }
export type GrowthViewModel = GrowthReadonly<{
  title: string; hud: string; status: string; cards: readonly GrowthCardView[]; token: GrowthToken | null;
  refresh: { visible: boolean; enabled: boolean; label: string };
  buildLines: readonly string[]; activatingLines: readonly string[]; error: string | null;
}>;
function text(record: Readonly<Record<string, string>>, id: string): string {
  const value = record[id]; if (typeof value !== 'string' || !value.trim()) throw new Error('中文成长说明缺失。'); return value;
}
function required<T>(item: T | undefined): T { if (!item) throw new Error('成长展示引用无效。'); return item; }
const number = (value: number): string => value.toFixed(1);

function talentDescription(config: GameConfig, copy: GrowthCopyConfig, snapshot: GrowthRunSnapshot, talent: TalentConfig): string {
  const rank = talentRank(snapshot.growth.build, talent.id) + 1;
  return talent.effectIds.map(id => {
    const e = required(config.effects.find(e => e.id === id));
    if (e.kind === 'stat-modifier') {
      const percent = e.operation === 'multiply' || e.stat === 'critChance' || e.stat === 'damageReduction';
      const value = e.operation === 'multiply' ? (e.value - 1) * 100 : e.value * (percent ? 100 : 1);
      return `${text(copy.statNames, e.stat)}每级 +${number(value)}${percent ? '%' : ''}；本次总增幅 ${number(value * rank)}${percent ? '%' : ''}${e.stat === 'maxHealth' ? '，保持生命比例' : ''}`;
    }
    if (e.kind === 'element') {
      const build = JSON.parse(JSON.stringify(snapshot.growth.build)) as BuildState;
      build.talentLevels[talent.id] = rank;
      if (!build.enchantmentIds.includes(talent.id)) build.enchantmentIds.push(talent.id);
      for (const id of snapshot.growth.activatingSynergyIds) if (!build.activeSynergyIds.includes(id)) build.activeSynergyIds.push(id);
      build.pendingSynergies = build.pendingSynergies.filter(p => !build.activeSynergyIds.includes(p.synergyId));
      let preview;
      // 单张候选无法执行时仍保留整组选项，真实提交继续由事务校验。
      try { preview = compileCombatBuild(config, build); }
      catch { return '该升级当前超出可执行范围；请选择其他卡片或刷新。'; }
      const resolved = required(preview.elements.find(element => element.element === e.element));
      const damage = `${number(resolved.damageMultiplier * 100)}%主伤害`;
      return resolved.kind === 'burn' ? `${resolved.name}：每秒${damage}，持续${number(resolved.durationSeconds)}秒`
        : `${resolved.name}：追加${damage}${resolved.kind === 'slow-hit' ? `，减速${number(resolved.slowRatio * 100)}%持续${number(resolved.durationSeconds)}秒` : ''}`;
    }
    if (e.kind === 'secondary-mechanism') return `${e.behavior.kind === 'homing' ? '追踪另一个目标' : '命中位置爆裂'}，本级${number(e.damageMultiplier * rank * 100)}%主伤害；不再触发附魔或副机制`;
    if (e.kind === 'attack-pattern' && e.execution?.kind === 'extra-projectile') return `每次普攻追加一枚剑气，伤害${number(e.damageMultiplier * 100)}%主伤害；不削弱主弹体`;
    throw new Error('卡片包含尚未支持的效果说明。');
  }).join('\n');
}

export function presentGrowth(config: GameConfig, copy: GrowthCopyConfig, snapshot: GrowthRunSnapshot): GrowthViewModel {
  const g = snapshot.growth, b = g.build, choice = g.growth.pendingChoice;
  const cards: GrowthCardView[] = [];
  if (choice?.kind === 'ordinary') for (const option of choice.options) {
    if (option.kind === 'reward') cards.push({ optionId: option.id, name: option.name, category: '基础奖励', rankText: `已获得 ${b.bonusRewardCounts[option.rewardId]} 次`, description: `${option.description}，独立累计+1%` });
    else {
      const talent = required(config.talents.find(t => t.id === option.talentId)); const rank = talentRank(b, talent.id);
      cards.push({ optionId: option.id, name: option.name, category: text(copy.categoryNames, talent.category), rankText: `${rank} → ${rank + 1}级（上限${talent.maxLevel}）`,
        description: talentDescription(config, copy, snapshot, talent) + (talent.category === 'general' ? '' : rank ? '\n已有槽位升级，不再占位' : '\n首次获得占用一个独立槽位') });
    }
  } else if (choice?.kind === 'route') for (const id of choice.routeIds) cards.push({ optionId: id, name: required(config.routes.find(r => r.id === id)).name,
    category: '主路线', rankText: '本局锁定', description: text(copy.routeDescriptions, id) });
  else if (choice?.kind === 'branch') {
    const route = required(config.routes.find(r => r.id === choice.routeId));
    for (const id of choice.branchIds) cards.push({ optionId: id, name: required(route.branches.find(b => b.id === id)).name, category: '路线分支', rankText: '本局锁定', description: text(copy.branchDescriptions, id) });
  }
  const buildLines: string[] = [];
  const route = config.routes.find(r => r.id === b.routeId);
  buildLines.push(`路线：${route?.name ?? '未选择'}  分支：${route?.branches.find(x => x.id === b.branchId)?.name ?? '未选择'}`);
  for (const talent of config.talents) if (talentRank(b, talent.id)) buildLines.push(`${talent.name} ${talentRank(b, talent.id)}级`);
  const names = (ids: readonly string[]): string => ids.map(id => required(config.talents.find(t => t.id === id)).name).join('、') || '空';
  buildLines.push(`附魔 ${b.enchantmentIds.length}/2：${names(b.enchantmentIds)}`, `副机制 ${b.secondaryMechanismIds.length}/2：${names(b.secondaryMechanismIds)}`);
  for (const [id, count] of Object.entries(b.bonusRewardCounts)) if (count) {
    const rewardName = id === 'base-attack' ? '攻击' : id === 'base-health' ? '生命' : '移速'; buildLines.push(`独立基础${rewardName}强化 ${count}次`);
  }
  for (const id of b.activeSynergyIds) buildLines.push(`已激活：${required(config.synergies.find(s => s.id === id)).name}（测试组合）`);
  for (const pending of b.pendingSynergies) buildLines.push(`待${pending.activateAtLevel}级激活：${required(config.synergies.find(s => s.id === pending.synergyId)).name}${snapshot.experience.nextCost === null ? '（本局已封顶）' : ''}`);
  if (b.ultimateEvolution) buildLines.push(`${required(route).ultimate.name}：${text(copy.ultimateDescriptions, required(route).id)}`);
  const activatingLines = g.activatingSynergyIds.map(id => `本级将免费激活：${required(config.synergies.find(s => s.id === id)).name}，本次选择后生效`);
  const e = snapshot.experience, w = snapshot.world;
  const xp = e.nextCost === null ? '已封顶' : `${number(e.current)}/${number(e.nextCost)}`;
  const status = snapshot.pauseReason === 'growth' ? '升级选择中' : snapshot.pauseReason === 'manual' ? '已暂停' : snapshot.pauseReason === 'error' ? '成长处理暂停' : snapshot.pauseReason === 'ended' ? '已阵亡' : w.state === 'idle' ? '待开始' : '战斗中';
  return { title: choice ? `${choice.targetLevel}级${choice.kind === 'ordinary' ? '成长三选一' : choice.kind === 'route' ? '主路线选择' : '分支选择'}` : '成长试玩',
    hud: `成长试玩（测试参数，原型等级上限12级）\n生命 ${number(w.hero.health)}/${number(w.hero.maxHealth)}  等级 ${b.level}  经验 ${xp}  击杀 ${w.kills}  ${number(w.elapsedSeconds)}秒\n免费刷新 ${g.rerollsRemaining}次  待处理升级 ${g.growth.pendingTargetLevels.length}项`,
    status, cards, token: g.token ? { ...g.token } : null, refresh: { visible: choice?.kind === 'ordinary', enabled: choice?.kind === 'ordinary' && g.rerollsRemaining > 0 && !snapshot.error, label: `刷新（剩余${g.rerollsRemaining}次）` },
    buildLines, activatingLines, error: snapshot.error };
}
