import type { BuildState, GrowthOption, GrowthState, UltimateEvolutionEvent, SynergyActivatedEvent } from './build';
import type { GameConfig, TalentCategory } from './config';
import type { RandomSource } from './contracts';
import { eligibleTalents } from './growth-candidates';
import { talentRank } from './build-prerequisites';
import { drawOrdinaryOptions, validateGrowthRewards } from './growth-draw';
import { applyExperience, experienceThresholds } from './growth-experience';
import { prepareSynergyLevel, queueEligibleSynergies } from './growth-synergies';
import type { GrowthEvent, GrowthReadonly, ExperienceProgress, GrowthCommandResult, GrowthRejection, GrowthRewardConfig, GrowthSessionOptions, GrowthSnapshot, GrowthToken } from './growth-model';
import { validateGameConfig } from './validate-config';

interface SessionData extends ExperienceProgress {
  build: BuildState;
  growth: GrowthState;
  rerollsRemaining: number;
  token: GrowthToken | null;
  revision: number;
  transaction: { targetLevel: number; preparedBuild: BuildState; events: readonly SynergyActivatedEvent[] } | null;
}

let nextSessionId = 1;

/** 配置和快照均为可序列化数据，复制后不保留外部可变引用。 */
function copy<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function increment(value: number): number {
  if (!Number.isSafeInteger(value) || value >= Number.MAX_SAFE_INTEGER) throw new Error('成长标识已达安全整数上限。');
  return value + 1;
}

function assertRandom(random: RandomSource): void {
  if (!random || typeof random.next !== 'function') throw new Error('必须提供有效的成长随机源。');
}

const rejectionMessages: Record<GrowthRejection, string> = {
  'no-choice': '当前没有待提交的成长选择。',
  'stale-token': '该选择已过期，请使用当前局次的最新选项。',
  'invalid-option': '该选项不属于当前成长选择。',
  'fixed-node': '固定进化节点不能刷新。',
  'no-rerolls': '本局免费刷新次数已用完。',
};

function reject(reason: GrowthRejection): GrowthCommandResult {
  return { ok: false, reason, message: rejectionMessages[reason], events: [] };
}

export class GrowthSession {
  private readonly config: GameConfig;
  private readonly enabledCategories: readonly TalentCategory[];
  private readonly heroId: string;
  private readonly thresholds: readonly number[];
  private readonly rewards: readonly GrowthRewardConfig[];
  private readonly sessionId: number;
  private generation = 0;
  private drawing = false;
  private busy = false;
  private readonly validateBuild: GrowthSessionOptions['validateBuild'];
  private readonly commitBuild: GrowthSessionOptions['commitBuild'];
  private random: RandomSource;
  private data: SessionData;

  constructor(config: GameConfig, options: GrowthSessionOptions) {
    let issues;
    try { issues = validateGameConfig(config); }
    catch { throw new Error('成长配置结构无效。'); }
    if (issues.length) throw new Error(`成长配置无效：${issues.map(issue => `${issue.path}: ${issue.message}`).join('；')}`);
    if (!config.heroes.some(hero => hero.id === options.heroId)) throw new Error('成长英雄不存在。');
    if (!Number.isSafeInteger(config.growth.freeRerolls)) throw new Error('刷新次数必须为安全整数。');
    assertRandom(options.random);
    validateGrowthRewards(options.rewards);
    this.config = copy(config);
    this.validateBuild = options.validateBuild; this.commitBuild = options.commitBuild;
    this.enabledCategories = [...(options.enabledTalentCategories ?? ['general'])];
    if (this.enabledCategories.some(c => !['general', 'enchantment', 'secondary-mechanism'].includes(c))) throw new Error('启用的天赋分类无效。');
    this.heroId = options.heroId;
    this.thresholds = experienceThresholds(options.levelCosts);
    this.rewards = copy(options.rewards);
    this.random = options.random;
    this.sessionId = nextSessionId;
    nextSessionId = increment(nextSessionId);
    this.data = this.initialData();
    this.mutate(() => { this.validateBuild?.(copy(this.data.build)); this.commitBuild?.(copy(this.data.build)); });
  }

  grantXp(amount: number): readonly GrowthEvent[] {
    return this.mutate(() => {
      const progress = applyExperience(this.data.xp, amount, this.thresholds);
      const staged = copy(this.data);
      for (let level = staged.earnedLevel + 1; level <= progress.earnedLevel; level++) staged.growth.pendingTargetLevels.push(level);
      Object.assign(staged, progress);
      const events = copy(this.advance(staged)); this.commit(staged); return events;
    });
  }

  select(token: GrowthToken, optionId: string): GrowthCommandResult {
    return this.mutate(() => {
      const failure = this.checkToken(token); if (failure) return reject(failure);
      const staged = copy(this.data); const choice = staged.growth.pendingChoice!; const build = staged.transaction!.preparedBuild;
      if (choice.kind === 'ordinary') {
        const option = choice.options.find(item => item.id === optionId); if (!option) return reject('invalid-option');
        if (option.kind === 'talent') {
          const talent = this.config.talents.find(t => t.id === option.talentId)!;
          if (talentRank(build, talent.id) === 0) {
            if (talent.category === 'enchantment') build.enchantmentIds.push(talent.id);
            if (talent.category === 'secondary-mechanism') build.secondaryMechanismIds.push(talent.id);
          }
          Object.defineProperty(build.talentLevels, talent.id, { value: talentRank(build, talent.id) + 1, enumerable: true, configurable: true, writable: true });
        } else build.bonusRewardCounts[option.rewardId]++;
      } else if (choice.kind === 'route') {
        if (!choice.routeIds.includes(optionId)) return reject('invalid-option');
        if (build.routeId !== null) throw new Error('主路线已锁定。'); build.routeId = optionId;
      } else {
        if (!choice.branchIds.includes(optionId)) return reject('invalid-option');
        if (build.branchId !== null) throw new Error('路线分支已锁定。'); build.branchId = optionId;
      }
      const events = [...this.completeLevel(staged), ...this.advance(staged)]; const result = { ok: true as const, events: copy(events) };
      this.commit(staged); return result;
    });
  }

  reroll(token: GrowthToken): GrowthCommandResult {
    return this.mutate(() => {
      const failure = this.checkToken(token); if (failure) return reject(failure);
      const choice = this.data.growth.pendingChoice!; if (choice.kind !== 'ordinary') return reject('fixed-node');
      if (this.data.rerollsRemaining === 0) return reject('no-rerolls');
      const staged = copy(this.data);
      staged.growth.pendingChoice = { kind: 'ordinary', targetLevel: choice.targetLevel, options: this.drawOptions(staged.transaction!.preparedBuild) };
      staged.rerollsRemaining--; this.issueToken(staged); this.commit(staged); return { ok: true, events: [] };
    });
  }

  snapshot(): GrowthSnapshot {
    const { revision: _revision, transaction, ...snapshot } = this.data;
    return copy({ ...snapshot, activatingSynergyIds: transaction?.events.map(e => e.synergyId) ?? [] });
  }

  reset(random: RandomSource): void {
    this.mutate(() => {
      assertRandom(random); const generation = increment(this.generation); const staged = this.initialData();
      this.commit(staged); this.random = random; this.generation = generation;
    });
  }

  private mutate<T>(action: () => T): T {
    this.assertMutationAllowed(); this.busy = true;
    try { return action(); } finally { this.busy = false; }
  }
  private commit(staged: SessionData): void {
    this.validateBuild?.(copy(staged.build));
    if (JSON.stringify(staged.build) !== JSON.stringify(this.data.build)) this.commitBuild?.(copy(staged.build));
    this.data = staged;
  }

  private initialData(): SessionData {
    const data: SessionData = {
      xp: 0, earnedLevel: 1, xpCapped: false, rerollsRemaining: this.config.growth.freeRerolls,
      token: null, revision: 0, transaction: null,
      build: { heroId: this.heroId, level: 1, routeId: null, branchId: null, talentLevels: {},
        bonusRewardCounts: { 'base-attack': 0, 'base-health': 0, 'base-move-speed': 0 }, ultimateEvolution: null,
        secondaryMechanismIds: [], enchantmentIds: [], pendingSynergies: [], activeSynergyIds: [] },
      growth: { pendingTargetLevels: [], pendingChoice: null },
    };
    data.build = queueEligibleSynergies(this.config, data.build, 1); return data;
  }

  private assertMutationAllowed(): void {
    if (this.busy || this.drawing) throw new Error('成长事务抽取期间不能重入修改会话。');
  }

  private drawOptions(build: BuildState): GrowthOption[] {
    // 外部随机回调可读取快照，但不能重置或再次提交当前事务。
    this.drawing = true;
    try { return [...drawOrdinaryOptions(eligibleTalents(this.config, build, { enabledCategories: this.enabledCategories }), this.random, this.rewards)]; }
    finally { this.drawing = false; }
  }

  private checkToken(token: GrowthToken): GrowthRejection | null {
    if (!this.data.growth.pendingChoice) return 'no-choice';
    const current = this.data.token!;
    return token?.sessionId === current.sessionId && token?.generation === current.generation
      && token?.revision === current.revision ? null : 'stale-token';
  }

  private issueToken(staged: SessionData): void {
    staged.revision = increment(staged.revision);
    staged.token = { sessionId: this.sessionId, generation: this.generation, revision: staged.revision };
  }

  private completeLevel(staged: SessionData): GrowthEvent[] {
    const tx = staged.transaction!; tx.preparedBuild.level = tx.targetLevel;
    staged.build = queueEligibleSynergies(this.config, tx.preparedBuild, tx.targetLevel);
    staged.growth.pendingTargetLevels.shift(); staged.growth.pendingChoice = null; staged.token = null; staged.transaction = null;
    return [...tx.events];
  }

  private advance(staged: SessionData): GrowthEvent[] {
    const events: GrowthEvent[] = [];
    while (!staged.growth.pendingChoice && staged.growth.pendingTargetLevels.length) {
      const level = staged.growth.pendingTargetLevels[0];
      const prepared = prepareSynergyLevel(this.config, staged.build, level);
      staged.transaction = { targetLevel: level, preparedBuild: prepared.build, events: prepared.events };
      const hero = this.config.heroes.find(item => item.id === this.heroId)!;
      const route = this.config.routes.find(item => item.id === prepared.build.routeId);
      if (level === this.config.growth.routeLevel) staged.growth.pendingChoice = { kind: 'route', targetLevel: level, routeIds: [...hero.routeIds] };
      else if (level === this.config.growth.branchLevel) {
        if (!route) throw new Error('分支进化缺少已锁定主路线。');
        staged.growth.pendingChoice = { kind: 'branch', targetLevel: level, routeId: route.id, branchIds: [route.branches[0].id, route.branches[1].id] };
      } else if (level === this.config.growth.ultimateLevel) {
        const branch = route?.branches.find(item => item.id === prepared.build.branchId);
        if (!route || !branch || prepared.build.ultimateEvolution) throw new Error('终极进化状态无效。');
        const event: UltimateEvolutionEvent = { type: 'ultimateEvolution', targetLevel: level, routeId: route.id, branchId: branch.id,
          effectId: route.ultimate.effectId, ultimateBehaviorEffectId: branch.ultimateBehaviorEffectId };
        prepared.build.ultimateEvolution = event; events.push(...this.completeLevel(staged), event); continue;
      } else staged.growth.pendingChoice = { kind: 'ordinary', targetLevel: level, options: this.drawOptions(prepared.build) };
      this.issueToken(staged);
    }
    return events;
  }
}
