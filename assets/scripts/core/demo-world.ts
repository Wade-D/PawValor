import type { ProjectileConfig, WeaponConfig, GameConfig } from './config';
import type { AttackSource, EntityHandle, RandomSource, RunState, Vec2 } from './contracts';
import { validateGameConfig } from './validate-config';
import { applyDemoXp } from './demo-growth';
import { assertFiniteVector, clampToArena, normalizeIntent, segmentCircleHit } from './demo-geometry';
import { ARENA_HEIGHT, ARENA_WIDTH, DEFAULT_DEMO_TUNING, FIXED_STEP_SECONDS } from './demo-model';
import type { DemoEnemySnapshot, DemoOrbSnapshot, DemoEvent, DemoSnapshot, DemoTuning, DemoWorldOptions } from './demo-model';

interface EnemyState {
  handle: { id: number; generation: number };
  position: Vec2;
  health: number;
  nextContactSeconds: number;
}

interface SwordState {
  handle: EntityHandle;
  attacker: EntityHandle;
  attackId: number;
  position: Vec2;
  direction: Vec2;
  age: number;
  distance: number;
}

/** 用于复现试玩战局的小型确定性 32 位无符号随机数生成器。 */
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
  private readonly weapon: WeaponConfig;
  private readonly projectile: ProjectileConfig;
  private readonly damage: number;
  private nextAttackSeconds = 0;
  private nextAttackId = 1;
  private swords: SwordState[] = [];
  private orbs: DemoOrbSnapshot[] = [];
  private kills = 0;
  private level: 1 | 2 = 1;
  private xp = 0;
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
    const weapon = config.weapons.find(item => item.id === hero.weaponId)!;
    this.weapon = { ...weapon };
    this.projectile = { ...config.projectiles.find(item => item.id === weapon.projectileId)! };
    this.damage = weapon.baseDamage + hero.baseStats.attackPower * weapon.attackPowerScaling;
    this.maxHealth = hero.baseStats.maxHealth;
    this.health = this.maxHealth;
    this.moveSpeed = hero.baseStats.moveSpeed;
    this.random = new SeededRandom(options.seed ?? 1);
    this.tuning = { ...DEFAULT_DEMO_TUNING, ...options.tuning };
    if (!Number.isInteger(this.tuning.maxEnemies) || this.tuning.maxEnemies <= 0) {
      throw new Error('tuning.maxEnemies must be a positive integer.');
    }
    for (const [key, value] of Object.entries(this.tuning)) {
      if (!Number.isFinite(value) || value < 0) throw new Error(`tuning.${key} must be finite and non-negative.`);
    }
    if (this.tuning.level2Xp === 0) throw new Error('tuning.level2Xp must be positive.');
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
    this.swords = [];
    this.orbs = [];
    this.kills = 0;
    this.level = 1;
    this.xp = 0;
    this.nextAttackSeconds = 0;
    this.nextAttackId = 1;
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
    // 达到数量上限时也推进生成节拍，避免空位出现后集中补刷。
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
    this.launchSword(events);
    this.advanceSwords(dtSeconds, events);
    this.pickupOrbs(events);
    return events;
  }

  private pickupOrbs(events: DemoEvent[]): void {
    const remaining: DemoOrbSnapshot[] = [];
    for (const orb of this.orbs) {
      if (orb.handle.generation !== this.generation
        || Math.hypot(orb.position.x - this.position.x, orb.position.y - this.position.y) > this.tuning.pickupRadius) {
        remaining.push(orb);
        continue;
      }
      const progress = applyDemoXp({ level: this.level, xp: this.xp }, orb.value, this.tuning.level2Xp);
      this.level = progress.level;
      this.xp = progress.xp;
      events.push({ type: 'xpPickup', elapsedSeconds: this.elapsedSeconds, handle: { ...orb.handle }, value: orb.value });
      if (progress.leveledUp) events.push({ type: 'levelUp', elapsedSeconds: this.elapsedSeconds, level: 2 });
    }
    this.orbs = remaining;
  }

  private source(attackId: number): AttackSource {
    return { rootAttackId: attackId, sourceKind: 'direct', depth: 0 };
  }

  private launchSword(events: DemoEvent[]): void {
    if (this.elapsedSeconds + 1e-10 < this.nextAttackSeconds) return;
    const candidates = this.enemies.filter(enemy => enemy.health > 0
      && enemy.handle.generation === this.generation
      && Math.hypot(enemy.position.x - this.position.x, enemy.position.y - this.position.y) <= this.weapon.range);
    candidates.sort((a, b) => Math.hypot(a.position.x - this.position.x, a.position.y - this.position.y)
      - Math.hypot(b.position.x - this.position.x, b.position.y - this.position.y) || a.handle.id - b.handle.id);
    const target = candidates[0];
    if (!target) return;
    const dx = target.position.x - this.position.x;
    const dy = target.position.y - this.position.y;
    const length = Math.hypot(dx, dy);
    const direction = length === 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length };
    const attackId = this.nextAttackId++;
    const attacker = { id: 1, generation: this.generation };
    this.swords.push({ handle: { id: this.nextEntityId++, generation: this.generation },
      attacker, attackId, position: { ...this.position }, direction, age: 0, distance: 0 });
    this.nextAttackSeconds = this.elapsedSeconds + this.weapon.attackIntervalSeconds;
    events.push({ type: 'attack', elapsedSeconds: this.elapsedSeconds, attackId,
      attacker: { ...attacker }, source: this.source(attackId), projectileId: this.projectile.id,
      origin: { ...this.position }, direction: { ...direction } });
  }

  private advanceSwords(dt: number, events: DemoEvent[]): void {
    const remaining: SwordState[] = [];
    for (const sword of this.swords) {
      if (sword.attacker.generation !== this.generation || sword.handle.generation !== this.generation) continue;
      const duration = Math.min(dt, Math.max(0, this.projectile.lifetimeSeconds - sword.age));
      const travel = Math.min(this.projectile.speed * duration, Math.max(0, this.weapon.range - sword.distance));
      const end = { x: sword.position.x + sword.direction.x * travel,
        y: sword.position.y + sword.direction.y * travel };
      let hit: EnemyState | undefined;
      let first = Infinity;
      for (const enemy of this.enemies) {
        if (enemy.health <= 0 || enemy.handle.generation !== this.generation) continue;
        const fraction = segmentCircleHit(sword.position, end, enemy.position, this.tuning.enemyRadius);
        if (fraction !== null && (fraction < first || (fraction === first && enemy.handle.id < hit!.handle.id))) {
          hit = enemy; first = fraction;
        }
      }
      if (hit) {
        const target = { ...hit.handle };
        events.push({ type: 'hit', elapsedSeconds: this.elapsedSeconds, attackId: sword.attackId,
          attacker: { ...sword.attacker }, target, source: this.source(sword.attackId), damage: this.damage, critical: false });
        hit.health = Math.max(0, hit.health - this.damage);
        if (hit.health === 0) {
          this.enemies = this.enemies.filter(enemy => enemy !== hit);
          this.kills++;
          events.push({ type: 'kill', elapsedSeconds: this.elapsedSeconds, attackId: sword.attackId,
            killer: { ...sword.attacker }, target: { ...target }, source: this.source(sword.attackId) });
          const orb = { handle: { id: this.nextEntityId++, generation: this.generation },
            position: { ...hit.position }, value: this.tuning.xpPerOrb };
          this.orbs.push(orb);
          events.push({ type: 'xpDrop', elapsedSeconds: this.elapsedSeconds,
            handle: { ...orb.handle }, position: { ...orb.position }, value: orb.value });
        }
        continue;
      }
      sword.position = end;
      sword.age += duration;
      sword.distance += travel;
      if (sword.age + 1e-10 < this.projectile.lifetimeSeconds && sword.distance + 1e-10 < this.weapon.range) remaining.push(sword);
    }
    this.swords = remaining;
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
    // 有界的确定性回退方式可避免无限重试。
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
      projectiles: this.swords.map(sword => ({ handle: { ...sword.handle }, position: { ...sword.position }, direction: { ...sword.direction } })),
      orbs: this.orbs.map(orb => ({ handle: { ...orb.handle }, position: { ...orb.position }, value: orb.value })),
      level: this.level, xp: this.xp, xpCapped: this.level === 2, kills: this.kills,
    };
  }
}
