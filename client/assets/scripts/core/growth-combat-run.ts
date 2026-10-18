import type { BuildState } from './build';
import type { GameConfig } from './config';
import type { RandomSource, Vec2 } from './contracts';
import type { DemoEvent } from './demo-model';
import type { GrowthEvent, GrowthToken } from './growth-model';
import type { GrowthCombatRunOptions, GrowthRunCommandResult, GrowthRunSnapshot } from './growth-combat-model';
import { DemoWorld, SeededRandom } from './demo-world';
import { GrowthSession } from './growth-session';
import { compileCombatBuild } from './combat-build';
import { experienceThresholds } from './growth-experience';

type FailedAction = { kind: 'experience' } | { kind: 'select'; token: GrowthToken; id: string } | { kind: 'reroll'; token: GrowthToken };
const reject = (reason: 'run-not-active' | 'transaction-failed', message: string): GrowthRunCommandResult => ({ ok: false, reason, message, events: [] });

/** 同步协调经验事务与战斗，不让引擎维护另一份等级或组合状态。 */
export class GrowthCombatRun {
  private readonly world: DemoWorld;
  private readonly growth: GrowthSession;
  private readonly thresholds: readonly number[];
  private readonly growthSeed: number;
  private readonly randomFactory: (seed: number) => RandomSource;
  private manual = false;
  private started = false;
  private queuedXp = 0;
  private error: string | null = null;
  private failed: FailedAction | null = null;
  private inputRevision = 0;
  private busy = false;

  constructor(config: GameConfig, options: GrowthCombatRunOptions) {
    if (options.heroId !== 'raine') throw new Error('当前成长战斗仅支持雷恩。');
    const internal = JSON.parse(JSON.stringify(config)) as GameConfig;
    const build: BuildState = { heroId: options.heroId, level: 1, routeId: null, branchId: null, talentLevels: {},
      bonusRewardCounts: { 'base-attack': 0, 'base-health': 0, 'base-move-speed': 0 }, ultimateEvolution: null,
      secondaryMechanismIds: [], enchantmentIds: [], pendingSynergies: [], activeSynergyIds: [] };
    this.thresholds = experienceThresholds(options.levelCosts);
    this.world = new DemoWorld(internal, { ...options.world, seed: options.seed ?? 1, effects: { build }, experienceMode: 'external' });
    this.growthSeed = ((options.seed ?? 1) ^ 0x85ebca6b) >>> 0;
    this.randomFactory = options.createGrowthRandom ?? (seed => new SeededRandom(seed));
    this.busy = true;
    try {
      this.growth = new GrowthSession(internal, { heroId: options.heroId, levelCosts: options.levelCosts, rewards: options.rewards,
        enabledTalentCategories: ['general', 'enchantment', 'secondary-mechanism'], random: this.randomFactory(this.growthSeed),
        validateBuild: next => { compileCombatBuild(internal, next); },
        commitBuild: next => this.world.applyBuild(next, this.world.snapshot().hero.handle.generation) });
    } finally { this.busy = false; }
  }

  start(): void { this.mutate(() => { if (this.world.snapshot().state === 'ended' || this.started) return; this.started = true; this.settle(); this.bump(); }); }
  pause(): void { this.mutate(() => { if (this.manual || this.world.snapshot().state === 'ended') return; this.manual = true; this.settle(); this.bump(); }); }
  resume(): void { this.mutate(() => { if (!this.manual || this.world.snapshot().state === 'ended') return; this.manual = false; this.settle(); this.bump(); }); }
  reset(): void {
    this.mutate(() => {
      const random = this.randomFactory(this.growthSeed);
      this.world.reset(); this.growth.reset(random); this.manual = false; this.started = false;
      this.queuedXp = 0; this.error = null; this.failed = null; this.bump();
    });
  }

  step(dt: number, input: Vec2): { combatEvents: readonly DemoEvent[]; growthEvents: readonly GrowthEvent[] } {
    return this.mutate(() => {
      const combatEvents = this.world.step(dt, input);
      if (this.world.snapshot().state === 'ended') { if (combatEvents.length) this.bump(); return { combatEvents, growthEvents: [] }; }
      const amount = combatEvents.reduce((total, event) => event.type === 'xpPickup' ? total + event.value : total, 0);
      let growthEvents: readonly GrowthEvent[] = [];
      if (amount > 0) { this.enqueue(amount); growthEvents = this.processExperience(); }
      return { combatEvents, growthEvents };
    });
  }

  grantXp(amount: number): readonly GrowthEvent[] {
    return this.mutate(() => {
      if (!Number.isFinite(amount) || amount < 0) throw new Error('经验必须为有限非负数。');
      if (this.world.snapshot().state === 'ended') throw new Error('阵亡后不能获得经验。');
      if (this.error) throw new Error('请先重试成长或重开。');
      this.enqueue(amount); return this.processExperience();
    });
  }
  select(token: GrowthToken, id: string): GrowthRunCommandResult { return this.mutate(() => this.command({ kind: 'select', token, id })); }
  reroll(token: GrowthToken): GrowthRunCommandResult { return this.mutate(() => this.command({ kind: 'reroll', token })); }
  retryGrowth(): readonly GrowthEvent[] {
    return this.mutate(() => {
      if (!this.failed || this.world.snapshot().state === 'ended') return [];
      return this.failed.kind === 'experience' ? this.processExperience() : this.command(this.failed, true).events;
    });
  }

  snapshot(): GrowthRunSnapshot {
    const world = this.world.snapshot(), growth = this.growth.snapshot();
    const level = growth.build.level; const previous = level <= 1 ? 0 : this.thresholds[level - 2];
    const cost = this.thresholds[level - 1] === undefined ? null : this.thresholds[level - 1] - previous;
    const pauseReason = world.state === 'ended' ? 'ended' : this.error ? 'error' : growth.growth.pendingTargetLevels.length ? 'growth' : this.manual ? 'manual' : 'none';
    return { world, growth, pauseReason, queuedXp: this.queuedXp, error: this.error, inputRevision: this.inputRevision,
      experience: { total: growth.xp, current: cost === null ? 0 : Math.min(cost, Math.max(0, growth.xp - previous)), nextCost: cost, capped: growth.xpCapped } };
  }

  private mutate<T>(action: () => T): T {
    if (this.busy) throw new Error('战斗成长事务不能重入。'); this.busy = true;
    try { return action(); } finally { this.busy = false; }
  }
  private bump(): void { if (!Number.isSafeInteger(this.inputRevision + 1)) throw new Error('输入版本超出范围。'); this.inputRevision++; }
  private enqueue(amount: number): void {
    const remaining = this.thresholds[this.thresholds.length - 1] - this.growth.snapshot().xp;
    this.queuedXp = amount >= remaining - this.queuedXp ? remaining : this.queuedXp + amount;
  }
  private processExperience(): readonly GrowthEvent[] {
    if (!this.queuedXp) return [];
    this.world.pause();
    try {
      const before = this.growth.snapshot(); const events = this.growth.grantXp(this.queuedXp);
      this.queuedXp = 0; this.error = null; this.failed = null; this.settle();
      const after = this.growth.snapshot(); if (after.token?.revision !== before.token?.revision || after.build.level !== before.build.level) this.bump();
      return events;
    } catch (error) { this.fail({ kind: 'experience' }, error); return []; }
  }
  private command(action: Exclude<FailedAction, { kind: 'experience' }>, retry = false): GrowthRunCommandResult {
    if (this.world.snapshot().state === 'ended' || (this.error && !retry)) return reject('run-not-active', '当前不能提交成长，请重试或重开。');
    this.world.pause();
    try {
      const result = action.kind === 'select' ? this.growth.select(action.token, action.id) : this.growth.reroll(action.token);
      if (result.ok) { this.error = null; this.failed = null; this.bump(); }
      this.settle(); return result;
    } catch (error) { this.fail({ ...action, token: { ...action.token } }, error); return reject('transaction-failed', this.error!); }
  }
  private fail(action: FailedAction, error: unknown): void {
    this.failed = action; this.error = '成长处理失败，请重试或重开。'; this.world.pause(); this.bump();
  }
  private settle(): void {
    if (this.world.snapshot().state === 'ended') return;
    if (this.manual || this.error || this.growth.snapshot().growth.pendingTargetLevels.length) this.world.pause();
    else if (this.started) { if (this.world.snapshot().state === 'idle') this.world.start(); else this.world.resume(); }
  }
}
