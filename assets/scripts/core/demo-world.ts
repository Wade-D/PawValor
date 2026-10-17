import type { GameConfig } from './config';
import type { RandomSource, RunState, Vec2 } from './contracts';
import { validateGameConfig } from './validate-config';
import { assertFiniteVector, clampToArena, normalizeIntent } from './demo-geometry';
import { ARENA_HEIGHT, ARENA_WIDTH, DEFAULT_DEMO_TUNING, FIXED_STEP_SECONDS } from './demo-model';
import type { DemoEnemySnapshot, DemoEvent, DemoSnapshot, DemoTuning, DemoWorldOptions } from './demo-model';

interface EnemyState {
  handle: { id: number; generation: number };
  position: Vec2;
  health: number;
  nextContactSeconds: number;
}

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
  private health: number;
  private enemies: EnemyState[] = [];
  private nextEntityId = 2;
  private nextSpawnSeconds = 0;
  private readonly initialEnemyPositions: readonly Vec2[] | undefined;

  constructor(config: GameConfig, options: DemoWorldOptions = {}) {
    let issues;
    try { issues = validateGameConfig(config); }
    catch { throw new Error('Invalid config: malformed GameConfig structure.'); }
    if (issues.length) throw new Error(`Invalid config: ${issues.map(issue => `${issue.path}: ${issue.message}`).join('; ')}`);
    const hero = config.heroes.find(item => item.id === 'raine');
    if (!hero) throw new Error('Invalid config: DemoWorld requires hero raine.');
    this.maxHealth = hero.baseStats.maxHealth;
    this.health = this.maxHealth;
    this.moveSpeed = hero.baseStats.moveSpeed;
    this.random = new SeededRandom(options.seed ?? 1);
    this.tuning = { ...DEFAULT_DEMO_TUNING, ...options.tuning };
    for (const [key, value] of Object.entries(this.tuning)) {
      if (!Number.isFinite(value) || value < 0) throw new Error(`tuning.${key} must be finite and non-negative.`);
    }
    for (const position of options.initialEnemyPositions ?? []) {
      assertFiniteVector(position, 'initialEnemyPositions');
      if (Math.abs(position.x) > ARENA_WIDTH / 2 || Math.abs(position.y) > ARENA_HEIGHT / 2) {
        throw new Error('initialEnemyPositions must lie inside the arena.');
      }
    }
    this.initialEnemyPositions = options.initialEnemyPositions?.map(position => ({ ...position }));
  }

  start(): void {
    if (this.state !== 'idle') return;
    this.state = 'running';
    for (const position of this.initialEnemyPositions ?? [this.edgeSpawnPosition()]) {
      if (this.enemies.length >= this.tuning.maxEnemies) break;
      this.addEnemy(position);
    }
    this.nextSpawnSeconds = this.tuning.spawnIntervalSeconds;
  }
  pause(): void { if (this.state === 'running') this.state = 'paused'; }
  resume(): void { if (this.state === 'paused') this.state = 'running'; }
  reset(): void {
    this.state = 'idle';
    this.elapsedSeconds = 0;
    this.position = { x: 0, y: 0 };
    this.health = this.maxHealth;
    this.enemies = [];
    this.nextEntityId = 2;
    this.nextSpawnSeconds = 0;
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
    const events: DemoEvent[] = [];
    // Consume cadence even while capped: no stored burst when a slot becomes free.
    if (this.elapsedSeconds + 1e-10 >= this.nextSpawnSeconds) {
      this.nextSpawnSeconds = this.elapsedSeconds + this.tuning.spawnIntervalSeconds;
      if (this.enemies.length < this.tuning.maxEnemies) {
        const enemy = this.addEnemy(this.edgeSpawnPosition());
        events.push({ type: 'enemySpawn', elapsedSeconds: this.elapsedSeconds,
          handle: { ...enemy.handle }, position: { ...enemy.position } });
      }
    }
    const contactRadius = this.tuning.heroRadius + this.tuning.enemyRadius;
    for (const enemy of this.enemies) {
      const dx = this.position.x - enemy.position.x;
      const dy = this.position.y - enemy.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance > contactRadius) {
        const travel = Math.min(this.tuning.enemySpeed * dtSeconds, distance - contactRadius);
        enemy.position.x += dx / distance * travel;
        enemy.position.y += dy / distance * travel;
      }
    }
    for (const enemy of this.enemies) {
      if (Math.hypot(this.position.x - enemy.position.x, this.position.y - enemy.position.y) > contactRadius + 1e-10
        || this.elapsedSeconds + 1e-10 < enemy.nextContactSeconds) continue;
      enemy.nextContactSeconds = this.elapsedSeconds + this.tuning.contactIntervalSeconds;
      this.health = Math.max(0, this.health - this.tuning.contactDamage);
      events.push({ type: 'heroDamaged', elapsedSeconds: this.elapsedSeconds,
        attacker: { ...enemy.handle }, target: { id: 1, generation: this.generation }, damage: this.tuning.contactDamage });
      if (this.health === 0) {
        this.state = 'ended';
        events.push({ type: 'runEnded', elapsedSeconds: this.elapsedSeconds, reason: 'defeat' });
        return events;
      }
    }
    return events;
  }

  private addEnemy(position: Vec2): EnemyState {
    const enemy: EnemyState = { handle: { id: this.nextEntityId++, generation: this.generation },
      position: { ...position }, health: this.tuning.enemyHealth, nextContactSeconds: 0 };
    this.enemies.push(enemy);
    return enemy;
  }

  private edgeSpawnPosition(): Vec2 {
    const halfWidth = ARENA_WIDTH / 2;
    const halfHeight = ARENA_HEIGHT / 2;
    for (let attempt = 0; attempt < 64; attempt++) {
      const edge = Math.floor(this.random.next() * 4);
      const offset = this.random.next() * 2 - 1;
      const position = edge < 2
        ? { x: edge === 0 ? -halfWidth : halfWidth, y: offset * halfHeight }
        : { x: offset * halfWidth, y: edge === 2 ? -halfHeight : halfHeight };
      if (Math.hypot(position.x - this.position.x, position.y - this.position.y) >= this.tuning.minSpawnDistance) return position;
    }
    // A bounded deterministic fallback avoids an unbounded rejection loop.
    const position = { x: this.position.x > 0 ? -halfWidth : halfWidth,
      y: this.position.y > 0 ? -halfHeight : halfHeight };
    if (Math.hypot(position.x - this.position.x, position.y - this.position.y) < this.tuning.minSpawnDistance) {
      throw new Error('tuning.minSpawnDistance cannot be satisfied inside the arena.');
    }
    return position;
  }

  snapshot(): DemoSnapshot {
    return {
      state: this.state, elapsedSeconds: this.elapsedSeconds,
      hero: { handle: { id: 1, generation: this.generation }, position: { ...this.position }, health: this.health, maxHealth: this.maxHealth },
      enemies: this.enemies.map((enemy): DemoEnemySnapshot => ({ handle: { ...enemy.handle }, position: { ...enemy.position }, health: enemy.health })),
      projectiles: [], orbs: [], level: 1, xp: 0, xpCapped: false, kills: 0,
    };
  }
}
