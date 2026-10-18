import type { EntityHandle } from './contracts';
import type { BurnPayload, CombatStatusSnapshot, DamageRequest } from './combat-model';

interface Burn { target: EntityHandle; payload: BurnPayload; expiresAt: number; nextTickAt: number }
interface Slow { target: EntityHandle; ratio: number; expiresAt: number }
const key = (target: EntityHandle): string => `${target.generation}:${target.id}`;
function expiry(now: number, duration: number): number {
  if (!Number.isFinite(now) || now < 0 || !Number.isFinite(duration) || duration <= 0
    || !Number.isFinite(now + duration) || now + duration <= now) throw new Error('状态时间无效。');
  return now + duration;
}
export class CombatStatusStore {
  private readonly burns = new Map<string, Burn>();
  private readonly slows = new Map<string, Slow>();
  applyBurn(target: EntityHandle, payload: BurnPayload, now: number): void {
    const expiresAt = expiry(now, payload.durationSeconds); const nextTickAt = expiry(now, payload.tickIntervalSeconds);
    if (!Number.isFinite(payload.damage) || payload.damage < 0 || payload.attacker.generation !== target.generation) throw new Error('灼烧伤害或代次无效。');
    const old = this.burns.get(key(target));
    if (old && old.expiresAt + 1e-10 >= now) {
      old.expiresAt = Math.max(old.expiresAt, expiresAt);
      if (payload.damage > old.payload.damage) old.payload = JSON.parse(JSON.stringify(payload)) as BurnPayload;
    } else this.burns.set(key(target), { target: { ...target }, payload: JSON.parse(JSON.stringify(payload)) as BurnPayload, expiresAt, nextTickAt });
  }
  applySlow(target: EntityHandle, slowRatio: number, durationSeconds: number, now: number): void {
    const expiresAt = expiry(now, durationSeconds);
    if (!Number.isFinite(slowRatio) || slowRatio < 0 || slowRatio > 1) throw new Error('减速比例无效。');
    const old = this.slows.get(key(target));
    this.slows.set(key(target), { target: { ...target }, ratio: old && old.expiresAt > now ? Math.max(old.ratio, slowRatio) : slowRatio,
      expiresAt: Math.max(expiresAt, old?.expiresAt ?? expiresAt) });
  }
  slowFactor(target: EntityHandle, now: number): number {
    const slow = this.slows.get(key(target)); return slow && now < slow.expiresAt - 1e-10 ? 1 - slow.ratio : 1;
  }
  advance(now: number, liveTargets: readonly EntityHandle[]): readonly DamageRequest[] {
    if (!Number.isFinite(now) || now < 0) throw new Error('状态推进时间无效。');
    const live = new Set(liveTargets.map(key)); const requests: DamageRequest[] = [];
    for (const [id, burn] of this.burns) {
      if (!live.has(id)) { this.burns.delete(id); continue; }
      while (burn.nextTickAt <= now + 1e-10 && burn.nextTickAt <= burn.expiresAt + 1e-10) {
        const {durationSeconds: _duration, tickIntervalSeconds: interval, ...request} = burn.payload;
        requests.push({ ...request, attacker: { ...request.attacker }, source: { ...request.source }, target: { ...burn.target }, critical: false });
        const next = burn.nextTickAt + interval;
        if (!Number.isFinite(next) || next <= burn.nextTickAt) throw new Error('灼烧跳伤时间无法递增。');
        burn.nextTickAt = next;
      }
      if (burn.expiresAt <= now + 1e-10) this.burns.delete(id);
    }
    for (const [id, slow] of this.slows) if (!live.has(id) || slow.expiresAt <= now + 1e-10) this.slows.delete(id);
    return requests;
  }
  snapshot(target: EntityHandle): readonly CombatStatusSnapshot[] {
    const burn = this.burns.get(key(target)); const slow = this.slows.get(key(target));
    return [...(burn ? [{ kind: 'burn' as const, expiresAt: burn.expiresAt, nextTickAt: burn.nextTickAt }] : []),
      ...(slow ? [{ kind: 'slow' as const, expiresAt: slow.expiresAt, slowRatio: slow.ratio }] : [])];
  }
  liveRootIds(): ReadonlySet<number> { return new Set([...this.burns.values()].map(b => b.payload.source.rootAttackId)); }
  reset(): void { this.burns.clear(); this.slows.clear(); }
}
