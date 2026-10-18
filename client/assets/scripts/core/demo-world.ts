import type { BuildState } from './build';
import type { GrowthReadonly } from './growth-model';
import type { CompiledCombatBuild, DamageRequest, DirectHitContext } from './combat-model';
import { compileCombatBuild } from './combat-build';
import { selectSecondaryTarget, homingDirection, explosionTargets } from './combat-secondary';
import { CombatStatusStore } from './combat-status';
import { CombatTriggerGuard } from './combat-trigger';
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
  source?: AttackSource;
  payload?: { compiled: CompiledCombatBuild; damage: number; baseDamage: number; range: number; size: Vec2; pierce: number; critChance: number; critMultiplier: number; projectile: ProjectileConfig };
  hitTargets?: Set<string>;
  kind?: 'direct' | 'homing';
  excludedTarget?: EntityHandle;
  target?: EntityHandle;
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
  private readonly config: GameConfig;
  private compiled: CompiledCombatBuild | null = null;
  private readonly initialCompiled: CompiledCombatBuild | null;
  private readonly criticalRandom: SeededRandom;
  private readonly triggerGuard = new CombatTriggerGuard();
  private readonly statuses = new CombatStatusStore();
  private readonly baseHealth: number;
  private readonly baseMoveSpeed: number;
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
  private pendingSwords: SwordState[] = [];
  private orbs: DemoOrbSnapshot[] = [];
  private kills = 0;
  private level: 1 | 2 = 1;
  private xp = 0;
  private maxHealth: number;
  private moveSpeed: number;
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
    this.config = JSON.parse(JSON.stringify(config)) as GameConfig;
    const hero = config.heroes.find(item => item.id === 'raine');
    if (!hero) throw new Error('Invalid config: DemoWorld requires hero raine.');
    const weapon = config.weapons.find(item => item.id === hero.weaponId)!;
    this.weapon = { ...weapon };
    this.projectile = { ...config.projectiles.find(item => item.id === weapon.projectileId)! };
    this.damage = weapon.baseDamage + hero.baseStats.attackPower * weapon.attackPowerScaling;
    this.baseHealth = hero.baseStats.maxHealth;
    this.baseMoveSpeed = hero.baseStats.moveSpeed;
    this.maxHealth = this.baseHealth;
    this.health = this.maxHealth;
    this.moveSpeed = hero.baseStats.moveSpeed;
    this.random = new SeededRandom(options.seed ?? 1);
    this.criticalRandom = new SeededRandom(options.effects?.criticalSeed ?? (((options.seed ?? 1) ^ 0x9e3779b9) >>> 0));
    this.initialCompiled = options.effects ? compileCombatBuild(this.config, options.effects.build) : null;
    this.compiled = this.initialCompiled;
    if (this.compiled) { this.maxHealth = this.compiled.stats.maxHealth; this.health = this.maxHealth; this.moveSpeed = this.compiled.stats.moveSpeed; }
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
    this.compiled = this.initialCompiled;
    this.maxHealth = this.compiled?.stats.maxHealth ?? this.baseHealth;
    this.moveSpeed = this.compiled?.stats.moveSpeed ?? this.baseMoveSpeed;
    this.triggerGuard.reset();
    this.statuses.reset();
    this.criticalRandom.reset();
    this.elapsedSeconds = 0;
    this.position = { x: 0, y: 0 };
    this.health = this.maxHealth;
    this.enemies = [];
    this.swords = [];
    this.pendingSwords = [];
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
        const travel = Math.min(this.tuning.enemySpeed * this.statuses.slowFactor(enemy.handle, this.elapsedSeconds) * dtSeconds, distance - contactRadius);
        enemy.position.x += dx / distance * travel;
        enemy.position.y += dy / distance * travel;
      }
    }
    for (const enemy of this.enemies) {
      if (Math.hypot(this.position.x - enemy.position.x, this.position.y - enemy.position.y) > contactRadius + 1e-10
        || this.elapsedSeconds + 1e-10 < enemy.nextContactSeconds) continue;
      enemy.nextContactSeconds = this.elapsedSeconds + this.tuning.contactIntervalSeconds;
      const contactDamage = this.tuning.contactDamage * (1 - (this.compiled?.stats.damageReduction ?? 0));
      this.health = Math.max(0, this.health - contactDamage);
      events.push({ type: 'heroDamaged', elapsedSeconds: this.elapsedSeconds,
        attacker: { ...enemy.handle }, target: { id: 1, generation: this.generation }, damage: contactDamage });
      if (this.health === 0) {
        this.state = 'ended';
        events.push({ type: 'runEnded', elapsedSeconds: this.elapsedSeconds, reason: 'defeat' });
        return events;
      }
    }
    this.launchSword(events);
    this.advanceSwords(dtSeconds, events);
    for (const request of this.statuses.advance(this.elapsedSeconds, this.enemies.map(e => e.handle))) this.dealDamage(request, events);
    const liveRoots = new Set(this.statuses.liveRootIds());
    for (const sword of this.swords) liveRoots.add(sword.source?.rootAttackId ?? sword.attackId);
    this.triggerGuard.retainRoots(liveRoots, this.generation, this.elapsedSeconds);
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

  applyBuild(build: GrowthReadonly<BuildState>, expectedGeneration: number): void {
    if ((this.state !== 'idle' && this.state !== 'paused') || expectedGeneration !== this.generation) throw new Error('构筑只能在当前局次的待开始或暂停状态应用。');
    const compiled = compileCombatBuild(this.config, build);
    const ratio = this.health / this.maxHealth;
    this.compiled = compiled; this.maxHealth = compiled.stats.maxHealth;
    this.health = ratio * this.maxHealth; this.moveSpeed = compiled.stats.moveSpeed;
  }

  private launchSword(events: DemoEvent[]): void {
    if (this.elapsedSeconds + 1e-10 < this.nextAttackSeconds) return;
    const range = this.compiled?.stats.range ?? this.weapon.range;
    const candidates = this.enemies.filter(enemy => enemy.health > 0 && enemy.handle.generation === this.generation
      && Math.hypot(enemy.position.x - this.position.x, enemy.position.y - this.position.y) <= range);
    candidates.sort((a, b) => Math.hypot(a.position.x - this.position.x, a.position.y - this.position.y)
      - Math.hypot(b.position.x - this.position.x, b.position.y - this.position.y) || a.handle.id - b.handle.id);
    const target = candidates[0]; if (!target) return;
    const dx = target.position.x - this.position.x; const dy = target.position.y - this.position.y;
    const length = Math.hypot(dx, dy); const direction = length === 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length };
    const rootId = this.nextAttackId;
    this.emitSword(this.projectile, direction, { ...this.position }, 1, rootId, events);
    for (const extra of this.compiled?.extraProjectiles ?? []) {
      const origin = clampToArena({ x: this.position.x - direction.y * extra.lateralOffset, y: this.position.y + direction.x * extra.lateralOffset });
      this.emitSword(extra.projectile, direction, origin, extra.damageMultiplier, rootId, events);
    }
    this.nextAttackSeconds = this.elapsedSeconds + (this.compiled?.stats.attackIntervalSeconds ?? this.weapon.attackIntervalSeconds);
  }

  private emitSword(projectile: ProjectileConfig, direction: Vec2, origin: Vec2, multiplier: number, rootId: number, events: DemoEvent[]): void {
    const attackId = this.nextAttackId++; const attacker = { id: 1, generation: this.generation };
    const sword: SwordState = { handle: { id: this.nextEntityId++, generation: this.generation }, attacker, attackId,
      position: origin, direction: { ...direction }, age: 0, distance: 0 };
    if (this.compiled) {
      const c = this.compiled; const inherits = projectile.inheritance.stats;
      const baseStats = this.config.heroes.find(hero => hero.id === c.build.heroId)!.baseStats;
      sword.source = { rootAttackId: rootId, sourceKind: 'direct', depth: 0 }; sword.kind = 'direct'; sword.hitTargets = new Set();
      sword.payload = { compiled: c, baseDamage: c.baseDamage * multiplier, damage: (inherits.includes('attackDamage') ? c.stats.attackDamage : c.baseDamage) * multiplier,
        range: inherits.includes('range') ? c.stats.range : this.weapon.range,
        size: { x: projectile.size.x * (inherits.includes('projectileSize') ? c.stats.projectileSize.x / this.projectile.size.x : 1),
          y: projectile.size.y * (inherits.includes('projectileSize') ? c.stats.projectileSize.y / this.projectile.size.y : 1) },
        pierce: projectile.pierceCount + (inherits.includes('pierceCount') ? c.stats.pierceCount - this.projectile.pierceCount : 0),
        critChance: inherits.includes('critChance') ? c.stats.critChance : baseStats.critChance,
        critMultiplier: inherits.includes('critDamageMultiplier') ? c.stats.critDamageMultiplier : baseStats.critDamageMultiplier, projectile };
      if (!Number.isFinite(sword.payload.damage)) throw new Error('弹体伤害溢出。');
    }
    this.swords.push(sword);
    events.push({ type: 'attack', elapsedSeconds: this.elapsedSeconds, attackId, attacker: { ...attacker },
      source: sword.source ? { ...sword.source } : this.source(attackId), projectileId: projectile.id, origin: { ...origin }, direction: { ...direction } });
  }

  private advanceSwords(dt: number, events: DemoEvent[]): void {
    const remaining: SwordState[] = [];
    for (const sword of this.swords) {
      if (sword.attacker.generation !== this.generation || sword.handle.generation !== this.generation) continue;
      if (sword.kind === 'homing') {
        let target = this.enemies.find(e => e.handle.id === sword.target?.id && e.handle.generation === sword.target?.generation && e.health > 0);
        if (!target) {
          const handle = selectSecondaryTarget(sword.position, sword.payload!.range, sword.excludedTarget!, this.enemies.filter(e => e.handle.generation === this.generation));
          sword.target = handle ?? undefined; target = this.enemies.find(e => e.handle.id === handle?.id && e.handle.generation === handle?.generation);
        }
        if (target) sword.direction = homingDirection(sword.position, target.position, sword.direction);
      }
      const projectile = sword.payload?.projectile ?? this.projectile;
      const duration = Math.min(dt, Math.max(0, projectile.lifetimeSeconds - sword.age));
      const travel = Math.min(projectile.speed * duration, Math.max(0, (sword.payload?.range ?? this.weapon.range) - sword.distance));
      const end = { x: sword.position.x + sword.direction.x * travel, y: sword.position.y + sword.direction.y * travel };
      const collisions: { enemy: EnemyState; fraction: number }[] = [];
      for (const enemy of this.enemies) {
        if (enemy.health <= 0 || enemy.handle.generation !== this.generation || (enemy.handle.id === sword.excludedTarget?.id && enemy.handle.generation === sword.excludedTarget?.generation) || sword.hitTargets?.has(`${enemy.handle.generation}:${enemy.handle.id}`)) continue;
        const fraction = segmentCircleHit(sword.position, end, enemy.position, this.tuning.enemyRadius + (sword.payload ? sword.payload.size.x / 2 : 0));
        if (fraction !== null) collisions.push({ enemy, fraction });
      }
      collisions.sort((a,b) => a.fraction - b.fraction || a.enemy.handle.id - b.enemy.handle.id);
      let consumed = false;
      for (const {enemy: hit, fraction} of collisions) {
        if (hit.health <= 0) continue;
        const critical = !!sword.payload && sword.kind !== 'homing' && this.criticalRandom.next() < sword.payload.critChance;
        const damage = (sword.payload?.damage ?? this.damage) * (critical ? sword.payload!.critMultiplier : 1);
        this.dealDamage({ attackId: sword.attackId, attacker: sword.attacker, target: hit.handle,
          source: sword.source ?? this.source(sword.attackId), damage, critical }, events);
        if (sword.payload && sword.kind === 'direct') this.onDirectHit({ attackId: sword.attackId, attacker: sword.attacker,
          source: sword.source!, target: hit.handle, position: { x: sword.position.x + (end.x - sword.position.x) * fraction, y: sword.position.y + (end.y - sword.position.y) * fraction },
          damage: sword.payload.damage, baseDamage: sword.payload.baseDamage, elements: sword.payload.projectile.inheritance.enchantments ? sword.payload.compiled.elements : [],
          secondary: sword.payload.projectile.inheritance.secondaryMechanisms ? sword.payload.compiled.secondary : [], compiled: sword.payload.compiled }, events);
        sword.hitTargets?.add(`${hit.handle.generation}:${hit.handle.id}`);
        if (!sword.payload || sword.payload.pierce <= 0) { consumed = true; break; }
        sword.payload.pierce--;
      }
      sword.position = end; sword.age += duration; sword.distance += travel;
      if (!consumed && sword.age + 1e-10 < projectile.lifetimeSeconds && sword.distance + 1e-10 < (sword.payload?.range ?? this.weapon.range)) remaining.push(sword);
    }
    this.swords = [...remaining, ...this.pendingSwords];
    this.pendingSwords = [];
  }

  private onDirectHit(context: DirectHitContext, events: DemoEvent[]): void {
    for (const element of context.elements) {
      const target = this.enemies.find(e => e.health > 0 && e.handle.id === context.target.id && e.handle.generation === context.target.generation);
      if (!target || !this.triggerGuard.tryConsume(`element:${element.element}`, element.policy, context.source, target.handle, this.generation, this.elapsedSeconds)) continue;
      const source: AttackSource = { rootAttackId: context.source.rootAttackId, sourceKind: element.kind === 'burn' ? 'damage-over-time' : 'element', depth: context.source.depth + 1 };
      const request = { attackId: this.nextAttackId++, attacker: { ...context.attacker }, target: { ...target.handle }, source, damage: context.damage * element.damageMultiplier, critical: false };
      if (element.kind === 'burn') this.statuses.applyBurn(target.handle, { ...request, durationSeconds: element.durationSeconds, tickIntervalSeconds: element.tickIntervalSeconds }, this.elapsedSeconds);
      else {
        this.dealDamage(request, events);
        if (element.kind === 'slow-hit' && target.health > 0) this.statuses.applySlow(target.handle, element.slowRatio, element.durationSeconds, this.elapsedSeconds);
      }
      events.push({ type: 'effectTriggered', elapsedSeconds: this.elapsedSeconds, effectId: element.effectId, effectName: element.name,
        source: { ...source }, position: { ...context.position }, target: { ...context.target } });
    }
    for (const secondary of context.secondary) {
      const factor = secondary.inheritance.stats.includes('attackDamage') ? context.damage : context.baseDamage;
      const damage = factor * secondary.damageMultiplier;
      if (!Number.isFinite(damage)) throw new Error('副机制伤害溢出。');
      const source: AttackSource = { rootAttackId: context.source.rootAttackId,
        sourceKind: secondary.behavior.kind === 'homing' ? 'split' : 'explosion', depth: context.source.depth + 1 };
      const candidates = this.enemies.filter(e => e.handle.generation === this.generation && e.health > 0);
      let radius: number | undefined;
      if (secondary.behavior.kind === 'homing') {
        const projectile = secondary.projectile!;
        const inherited = (stat: import('./config').StatId): boolean => secondary.inheritance.stats.includes(stat) && projectile.inheritance.stats.includes(stat);
        const range = inherited('range') ? context.compiled.stats.range : this.weapon.range;
        const target = selectSecondaryTarget(context.position, range, context.target, candidates);
        if (!target || !this.triggerGuard.tryConsume(secondary.effectId, secondary.policy, context.source, target, this.generation, this.elapsedSeconds)) continue;
        const targetState = candidates.find(e => e.handle.id === target.id && e.handle.generation === target.generation)!;
        const attackId = this.nextAttackId++;
        const direction = homingDirection(context.position, targetState.position, { x: 1, y: 0 });
        this.pendingSwords.push({ handle: { id: this.nextEntityId++, generation: this.generation }, attacker: { ...context.attacker }, attackId,
          source, kind: 'homing', target, excludedTarget: { ...context.target }, position: { ...context.position }, direction, age: 0, distance: 0, hitTargets: new Set(),
          payload: { compiled: context.compiled, damage, baseDamage: context.baseDamage * secondary.damageMultiplier, range,
            size: { x: projectile.size.x * (inherited('projectileSize') ? context.compiled.stats.projectileSize.x / this.projectile.size.x : 1),
              y: projectile.size.y * (inherited('projectileSize') ? context.compiled.stats.projectileSize.y / this.projectile.size.y : 1) },
            pierce: 0, critChance: 0, critMultiplier: 1, projectile } });
        events.push({ type: 'attack', elapsedSeconds: this.elapsedSeconds, attackId, attacker: { ...context.attacker }, source: { ...source },
          projectileId: projectile.id, origin: { ...context.position }, direction: { ...direction } });
      } else {
        radius = secondary.behavior.radius * (secondary.inheritance.stats.includes('areaSize') ? context.compiled.stats.areaScale : 1);
        const targets = explosionTargets(context.position, radius, candidates);
        if (!targets.length || !this.triggerGuard.tryConsume(secondary.effectId, secondary.policy, context.source, targets[0], this.generation, this.elapsedSeconds)) continue;
        const attackId = this.nextAttackId++;
        for (const target of targets) this.dealDamage({ attackId, attacker: context.attacker, target, source, damage, critical: false }, events);
      }
      events.push({ type: 'effectTriggered', elapsedSeconds: this.elapsedSeconds, effectId: secondary.effectId, effectName: secondary.name,
        source: { ...source }, position: { ...context.position }, ...(radius === undefined ? {} : { radius }) });
    }
  }

  private dealDamage(request: DamageRequest, events: DemoEvent[]): void {
    if (!Number.isFinite(request.damage) || request.damage < 0) throw new Error('伤害必须为有限非负数。');
    const enemy = this.enemies.find(e => e.health > 0 && e.handle.id === request.target.id && e.handle.generation === request.target.generation);
    if (!enemy || enemy.handle.generation !== this.generation || request.attacker.generation !== this.generation) return;
    const target = { ...enemy.handle }; const source = { ...request.source }; const attacker = { ...request.attacker };
    events.push({ type: 'hit', elapsedSeconds: this.elapsedSeconds, attackId: request.attackId, attacker, target, source, damage: request.damage, critical: request.critical });
    enemy.health = Math.max(0, enemy.health - request.damage);
    if (enemy.health > 0) return;
    this.enemies = this.enemies.filter(e => e !== enemy); this.kills++;
    events.push({ type: 'kill', elapsedSeconds: this.elapsedSeconds, attackId: request.attackId, killer: { ...attacker }, target: { ...target }, source: { ...source } });
    const orb = { handle: { id: this.nextEntityId++, generation: this.generation }, position: { ...enemy.position }, value: this.tuning.xpPerOrb };
    this.orbs.push(orb); events.push({ type: 'xpDrop', elapsedSeconds: this.elapsedSeconds, handle: { ...orb.handle }, position: { ...orb.position }, value: orb.value });
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
      ...(this.compiled ? { effects: JSON.parse(JSON.stringify({ build: this.compiled.build, stats: this.compiled.stats, elements: this.compiled.elements })) } : {}),
      state: this.state, elapsedSeconds: this.elapsedSeconds,
      hero: { handle: { id: 1, generation: this.generation }, position: { ...this.position }, health: this.health, maxHealth: this.maxHealth },
      enemies: this.enemies.map((enemy): DemoEnemySnapshot => ({ handle: { ...enemy.handle }, position: { ...enemy.position }, health: enemy.health, ...(this.compiled ? { maxHealth: this.tuning.enemyHealth, statuses: this.statuses.snapshot(enemy.handle) } : {}) })),
      projectiles: this.swords.map(sword => ({ handle: { ...sword.handle }, position: { ...sword.position }, direction: { ...sword.direction }, ...(sword.payload ? { kind: sword.kind, size: { ...sword.payload.size } } : {}) })),
      orbs: this.orbs.map(orb => ({ handle: { ...orb.handle }, position: { ...orb.position }, value: orb.value })),
      level: this.level, xp: this.xp, xpCapped: this.level === 2, kills: this.kills,
    };
  }
}
