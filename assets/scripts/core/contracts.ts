/** Numeric simulation coordinates; independent of engine vector classes. */
export interface Vec2 {
  x: number;
  y: number;
}

/** Generation changes whenever an entity ID is reused by a pool. */
export interface EntityHandle {
  id: number;
  generation: number;
}

export interface RandomSource {
  /** Return a finite value in [0, 1). */
  next(): number;
}

export interface SimulationClock {
  /** Simulation time in seconds. Pausing must not advance this clock. */
  readonly elapsedSeconds: number;
}

export type RunState = 'idle' | 'running' | 'paused' | 'ended';
export type RunEndReason = 'victory' | 'defeat' | 'aborted';

/** Lifecycle contract only; no simulation or lifecycle implementation yet. */
export interface RunController {
  readonly state: RunState;
  start(): void;
  pause(): void;
  resume(): void;
  end(reason: RunEndReason): void;
  /** Clear per-run clocks, queued work, trigger state and event subscriptions. */
  reset(): void;
  /** Non-negative finite delta in seconds; only running advances simulation. */
  update(dtSeconds: number): void;
}

export type AttackSourceKind =
  | 'direct'
  | 'split'
  | 'bounce'
  | 'explosion'
  | 'element'
  | 'damage-over-time'
  | 'synergy';

export interface AttackSource {
  /** Shared by every descendant of the original attack. */
  rootAttackId: number;
  sourceKind: AttackSourceKind;
  /** Direct attacks start at zero; each derived attack increments depth. */
  depth: number;
}

export interface AttackEvent {
  type: 'attack';
  elapsedSeconds: number;
  attackId: number;
  attacker: EntityHandle;
  source: AttackSource;
  projectileId: string;
  origin: Vec2;
  direction: Vec2;
}

export interface HitEvent {
  type: 'hit';
  elapsedSeconds: number;
  attackId: number;
  attacker: EntityHandle;
  target: EntityHandle;
  source: AttackSource;
  damage: number;
  critical: boolean;
}

export interface KillEvent {
  type: 'kill';
  elapsedSeconds: number;
  attackId: number;
  killer: EntityHandle;
  target: EntityHandle;
  source: AttackSource;
}

export interface RunEndedEvent {
  type: 'runEnded';
  elapsedSeconds: number;
  reason: RunEndReason;
}

export type CombatEvent = AttackEvent | HitEvent | KillEvent | RunEndedEvent;

export interface CombatEventBus {
  subscribe<T extends CombatEvent['type']>(
    type: T,
    listener: (event: Extract<CombatEvent, { type: T }>) => void,
  ): () => void;
  emit(event: CombatEvent): void;
  /** Clear queued events and subscriptions before reusing the bus for a run. */
  clear(): void;
}
