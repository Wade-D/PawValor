import type { BuildState, GrowthState, UltimateEvolutionEvent } from './build';
import type { GameConfig } from './config';
import type { RandomSource } from './contracts';
import { eligibleTalents } from './growth-candidates';
import { drawOrdinaryOptions, validateGrowthRewards } from './growth-draw';
import { applyExperience, experienceThresholds } from './growth-experience';
import type { ExperienceProgress, GrowthCommandResult, GrowthRejection, GrowthRewardConfig, GrowthSessionOptions, GrowthSnapshot, GrowthToken } from './growth-model';
import { validateGameConfig } from './validate-config';

interface SessionData extends ExperienceProgress {
  build: BuildState;
  growth: GrowthState;
  rerollsRemaining: number;
  token: GrowthToken | null;
  revision: number;
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
  private readonly heroId: string;
  private readonly thresholds: readonly number[];
  private readonly rewards: readonly GrowthRewardConfig[];
  private readonly sessionId: number;
  private generation = 0;
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
    this.heroId = options.heroId;
    this.thresholds = experienceThresholds(options.levelCosts);
    this.rewards = copy(options.rewards);
    this.random = options.random;
    this.sessionId = nextSessionId;
    nextSessionId = increment(nextSessionId);
    this.data = this.initialData();
  }

  grantXp(amount: number): readonly UltimateEvolutionEvent[] {
    const progress = applyExperience(this.data.xp, amount, this.thresholds);
    const staged = copy(this.data);
    for (let level = staged.earnedLevel + 1; level <= progress.earnedLevel; level++) {
      staged.growth.pendingTargetLevels.push(level);
    }
    Object.assign(staged, progress);
    const events = this.advance(staged);
    this.data = staged;
    return copy(events);
  }

  select(token: GrowthToken, optionId: string): GrowthCommandResult {
    const failure = this.checkToken(token);
    if (failure) return reject(failure);
    const choice = this.data.growth.pendingChoice!;
    const staged = copy(this.data);
    if (choice.kind === 'ordinary') {
      const option = choice.options.find(item => item.id === optionId);
      if (!option) return reject('invalid-option');
      if (option.kind === 'talent') {
        const ranks = staged.build.talentLevels;
        const previous = Object.prototype.hasOwnProperty.call(ranks, option.talentId) ? ranks[option.talentId] : 0;
        // defineProperty 避免 __proto__ 等配置标识触发普通对象的原型写入器。
        Object.defineProperty(ranks, option.talentId, { value: previous + 1, enumerable: true, configurable: true, writable: true });
      } else staged.build.bonusRewardCounts[option.rewardId]++;
    } else if (choice.kind === 'route') {
      if (!choice.routeIds.includes(optionId)) return reject('invalid-option');
      if (staged.build.routeId !== null) throw new Error('主路线已锁定，不能重复选择。');
      staged.build.routeId = optionId;
    } else {
      if (!choice.branchIds.includes(optionId)) return reject('invalid-option');
      if (staged.build.branchId !== null) throw new Error('路线分支已锁定，不能重复选择。');
      staged.build.branchId = optionId;
    }
    staged.build.level = choice.targetLevel;
    staged.growth.pendingTargetLevels.shift();
    staged.growth.pendingChoice = null;
    staged.token = null;
    const events = this.advance(staged);
    this.data = staged;
    return { ok: true, events: copy(events) };
  }

  reroll(token: GrowthToken): GrowthCommandResult {
    const failure = this.checkToken(token);
    if (failure) return reject(failure);
    const choice = this.data.growth.pendingChoice!;
    if (choice.kind !== 'ordinary') return reject('fixed-node');
    if (this.data.rerollsRemaining === 0) return reject('no-rerolls');
    const staged = copy(this.data);
    staged.growth.pendingChoice = { kind: 'ordinary', targetLevel: choice.targetLevel,
      options: [...drawOrdinaryOptions(eligibleTalents(this.config, staged.build), this.random, this.rewards)] };
    staged.rerollsRemaining--;
    this.issueToken(staged);
    this.data = staged;
    return { ok: true, events: [] };
  }

  snapshot(): GrowthSnapshot {
    const { revision: _revision, ...snapshot } = this.data;
    return copy(snapshot);
  }

  reset(random: RandomSource): void {
    assertRandom(random);
    const generation = increment(this.generation);
    this.random = random;
    this.generation = generation;
    this.data = this.initialData();
  }

  private initialData(): SessionData {
    return {
      xp: 0, earnedLevel: 1, xpCapped: false, rerollsRemaining: this.config.growth.freeRerolls,
      token: null, revision: 0,
      build: { heroId: this.heroId, level: 1, routeId: null, branchId: null, talentLevels: {},
        bonusRewardCounts: { 'base-attack': 0, 'base-health': 0, 'base-move-speed': 0 }, ultimateEvolution: null,
        secondaryMechanismIds: [], enchantmentIds: [], pendingSynergies: [], activeSynergyIds: [] },
      growth: { pendingTargetLevels: [], pendingChoice: null },
    };
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

  private advance(staged: SessionData): UltimateEvolutionEvent[] {
    const events: UltimateEvolutionEvent[] = [];
    while (!staged.growth.pendingChoice && staged.growth.pendingTargetLevels.length) {
      const level = staged.growth.pendingTargetLevels[0];
      const hero = this.config.heroes.find(item => item.id === this.heroId)!;
      const route = this.config.routes.find(item => item.id === staged.build.routeId);
      if (level === this.config.growth.routeLevel) {
        staged.growth.pendingChoice = { kind: 'route', targetLevel: level, routeIds: [...hero.routeIds] };
      } else if (level === this.config.growth.branchLevel) {
        if (!route) throw new Error('分支进化缺少已锁定主路线。');
        staged.growth.pendingChoice = { kind: 'branch', targetLevel: level, routeId: route.id,
          branchIds: [route.branches[0].id, route.branches[1].id] };
      } else if (level === this.config.growth.ultimateLevel) {
        const branch = route?.branches.find(item => item.id === staged.build.branchId);
        if (!route || !branch || staged.build.ultimateEvolution) throw new Error('终极进化的路线或分支状态无效。');
        const event: UltimateEvolutionEvent = { type: 'ultimateEvolution', targetLevel: level, routeId: route.id,
          branchId: branch.id, effectId: route.ultimate.effectId, ultimateBehaviorEffectId: branch.ultimateBehaviorEffectId };
        staged.build.ultimateEvolution = event;
        staged.build.level = level;
        staged.growth.pendingTargetLevels.shift();
        events.push(event);
        continue;
      } else {
        staged.growth.pendingChoice = { kind: 'ordinary', targetLevel: level,
          options: [...drawOrdinaryOptions(eligibleTalents(this.config, staged.build), this.random, this.rewards)] };
      }
      this.issueToken(staged);
    }
    return events;
  }
}
