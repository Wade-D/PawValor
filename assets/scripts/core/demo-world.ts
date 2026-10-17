import type { GameConfig } from './config';
import type { RandomSource, RunState, Vec2 } from './contracts';
import { validateGameConfig } from './validate-config';
import { assertFiniteVector, clampToArena, normalizeIntent } from './demo-geometry';
import { DEFAULT_DEMO_TUNING, FIXED_STEP_SECONDS } from './demo-model';
import type { DemoEvent, DemoSnapshot, DemoTuning, DemoWorldOptions } from './demo-model';

/** Small deterministic unsigned 32-bit generator for reproducible demo runs. */
export class SeededRandom implements RandomSource {
  private state: number;
  constructor(private readonly seed: number) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new Error('seed must be an unsigned 32-bit integer.');
    }
    this.state = seed;
  }
  next(): number {
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
  reset(): void { this.state = this.seed; }
}

export class DemoWorld {
  private state: RunState = 'idle';
  private elapsedSeconds = 0;
  private position: Vec2 = { x: 0, y: 0 };
  private generation = 0;
  private readonly maxHealth: number;
  private readonly moveSpeed: number;
  private readonly random: SeededRandom;
  private readonly tuning: DemoTuning;

  constructor(config: GameConfig, options: DemoWorldOptions = {}) {
    let issues;
    try { issues = validateGameConfig(config); }
    catch { throw new Error('Invalid config: malformed GameConfig structure.'); }
    if (issues.length) throw new Error(`Invalid config: ${issues.map(issue => `${issue.path}: ${issue.message}`).join('; ')}`);
    const hero = config.heroes.find(item => item.id === 'raine');
    if (!hero) throw new Error('Invalid config: DemoWorld requires hero raine.');
    this.maxHealth = hero.baseStats.maxHealth;
    this.moveSpeed = hero.baseStats.moveSpeed;
    this.random = new SeededRandom(options.seed ?? 1);
    this.tuning = { ...DEFAULT_DEMO_TUNING, ...options.tuning };
    for (const [key, value] of Object.entries(this.tuning)) {
      if (!Number.isFinite(value) || value < 0) throw new Error(`tuning.${key} must be finite and non-negative.`);
    }
    for (const position of options.initialEnemyPositions ?? []) assertFiniteVector(position, 'initialEnemyPositions');
  }

  start(): void { if (this.state === 'idle') this.state = 'running'; }
  pause(): void { if (this.state === 'running') this.state = 'paused'; }
  resume(): void { if (this.state === 'paused') this.state = 'running'; }
  reset(): void {
    this.state = 'idle';
    this.elapsedSeconds = 0;
    this.position = { x: 0, y: 0 };
    this.random.reset();
    this.generation++;
  }

  step(dtSeconds: number, input: Vec2): readonly DemoEvent[] {
    if (!Number.isFinite(dtSeconds) || dtSeconds < 0 || dtSeconds > FIXED_STEP_SECONDS) {
      throw new Error('dt must be finite and between 0 and 1/60 seconds.');
    }
    const intent = normalizeIntent(input);
    if (this.state !== 'running' || dtSeconds === 0) return [];
    this.position = clampToArena({
      x: this.position.x + intent.x * this.moveSpeed * dtSeconds,
      y: this.position.y + intent.y * this.moveSpeed * dtSeconds,
    });
    this.elapsedSeconds += dtSeconds;
    return [];
  }

  snapshot(): DemoSnapshot {
    return {
      state: this.state, elapsedSeconds: this.elapsedSeconds,
      hero: { handle: { id: 1, generation: this.generation }, position: { ...this.position }, health: this.maxHealth, maxHealth: this.maxHealth },
      enemies: [], projectiles: [], orbs: [], level: 1, xp: 0, xpCapped: false, kills: 0,
    };
  }
}
