import type { TriggerPolicy } from './config';
import type { AttackSource, EntityHandle } from './contracts';

export class CombatTriggerGuard {
  private readonly roots = new Map<string, Map<number, Map<string, number>>>();
  private readonly cooldowns = new Map<string, number>();
  private readonly targets = new Map<string, number>();

  tryConsume(effectId: string, policy: TriggerPolicy, source: AttackSource, target: EntityHandle, generation: number, now: number): boolean {
    if (!Number.isFinite(now) || now < 0 || !Number.isSafeInteger(generation) || generation < 0
      || !Number.isSafeInteger(source.rootAttackId) || source.rootAttackId < 1 || !Number.isSafeInteger(source.depth) || source.depth < 0
      || !Number.isSafeInteger(policy.maxDepth) || policy.maxDepth < 0 || !Number.isSafeInteger(policy.maxTriggersPerRoot) || policy.maxTriggersPerRoot < 1
      || !Number.isFinite(policy.cooldownSeconds) || policy.cooldownSeconds < 0
      || !Number.isFinite(policy.targetHitIntervalSeconds) || policy.targetHitIntervalSeconds < 0) throw new Error('触发参数必须是有效有限数。');
    if (target.generation !== generation || !policy.allowedSources.includes(source.sourceKind) || source.depth > policy.maxDepth) return false;
    const generationKey = String(generation);
    const root = this.roots.get(generationKey)?.get(source.rootAttackId);
    const effectKey = `${generation}:${effectId}`;
    const targetKey = `${effectKey}:${target.generation}:${target.id}`;
    if ((root?.get(effectId) ?? 0) >= policy.maxTriggersPerRoot
      || now + 1e-10 < (this.cooldowns.get(effectKey) ?? 0) || now + 1e-10 < (this.targets.get(targetKey) ?? 0)) return false;
    const cooldown = now + policy.cooldownSeconds; const interval = now + policy.targetHitIntervalSeconds;
    if (!Number.isFinite(cooldown) || !Number.isFinite(interval)) throw new Error('触发到期时间溢出。');
    let roots = this.roots.get(generationKey);
    if (!roots) { roots = new Map(); this.roots.set(generationKey, roots); }
    let counts = roots.get(source.rootAttackId);
    if (!counts) { counts = new Map(); roots.set(source.rootAttackId, counts); }
    counts.set(effectId, (counts.get(effectId) ?? 0) + 1);
    this.cooldowns.set(effectKey, cooldown); this.targets.set(targetKey, interval);
    return true;
  }

  retainRoots(rootIds: ReadonlySet<number>, generation: number, now: number): void {
    for (const [key, roots] of this.roots) {
      if (key !== String(generation)) { this.roots.delete(key); continue; }
      for (const id of roots.keys()) if (!rootIds.has(id)) roots.delete(id);
    }
    // 根生命结束不能提前释放全局冷却，只清理真正到期的记录。
    for (const [key, until] of this.cooldowns) if (until <= now) this.cooldowns.delete(key);
    for (const [key, until] of this.targets) if (until <= now) this.targets.delete(key);
  }
  reset(): void { this.roots.clear(); this.cooldowns.clear(); this.targets.clear(); }
}
