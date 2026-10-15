import type {
  AttackSource, CombatEvent, CombatEventBus, EntityHandle, RandomSource,
  RunController, RunState, SimulationClock, Vec2,
} from '../assets/scripts/core/contracts';
import type {
  BuildState, GrowthState, PendingGrowthChoice, PendingSynergy, UltimateEvolutionEvent,
} from '../assets/scripts/core/build';
import type {
  EffectConfig, ElementPolicy, GameConfig, ProjectileConfig, RouteConfig, TriggerPolicy,
} from '../assets/scripts/core/config';

// Positive imports/assignments must compile: missing exports cannot hide behind expect-error.
const position: Vec2 = { x: 0, y: 1 };
const entity: EntityHandle = { id: 1, generation: 2 };
const random: RandomSource = { next: () => 0.5 };
const clock: SimulationClock = { elapsedSeconds: 0 };
const state: RunState = 'paused';
declare const run: RunController;
run.start(); run.pause(); run.resume(); run.update(0.016); run.end('victory'); run.reset();
const currentState: RunState = run.state;
const source: AttackSource = { rootAttackId: 1, sourceKind: 'direct', depth: 0 };
const events: CombatEvent[] = [
  { type: 'attack', elapsedSeconds: 0, attackId: 1, attacker: entity, source, projectileId: 'sword', origin: position, direction: position },
  { type: 'hit', elapsedSeconds: 0, attackId: 1, attacker: entity, target: entity, source, damage: 10, critical: false },
  { type: 'kill', elapsedSeconds: 0, attackId: 1, killer: entity, target: entity, source },
  { type: 'runEnded', elapsedSeconds: 1, reason: 'victory' },
];
declare const bus: CombatEventBus;
const unsubscribe: () => void = bus.subscribe('hit', event => {
  const damage: number = event.damage;
  void damage;
});
bus.emit(events[0]); unsubscribe(); bus.clear();
const pending: PendingSynergy = { synergyId: 'storm', eligibleAtLevel: 4, activateAtLevel: 5 };
const build: BuildState = {
  heroId: 'raine', level: 2, routeId: null, branchId: null,
  talentLevels: { attack: 1 }, secondaryMechanismIds: [], enchantmentIds: [],
  pendingSynergies: [pending], activeSynergyIds: [],
};
const choices: PendingGrowthChoice[] = [
  { kind: 'ordinary', targetLevel: 2, talentIds: ['attack', 'speed', 'health'] },
  { kind: 'route', targetLevel: 3, routeIds: ['many', 'thunder', 'return'] },
  { kind: 'branch', targetLevel: 7, routeId: 'many', branchIds: ['scatter', 'focus'] },
];
const growth: GrowthState = { pendingTargetLevels: [3, 4, 5], pendingChoice: choices[0] };
const automatic: UltimateEvolutionEvent = {
  type: 'ultimateEvolution', targetLevel: 11, routeId: 'many', branchId: 'scatter',
  effectId: 'ultimate', ultimateBehaviorEffectId: 'wide-array',
};
const policy: ElementPolicy = {
  usage: 'test-only', maxEnchantments: 2, maxSecondaryMechanisms: 2,
  innateElementCounts: true, enchantmentsUseSecondarySlots: false, resonanceEffectIds: [],
};
const trigger: TriggerPolicy = {
  id: 'direct-only', allowedSources: ['direct'], maxDepth: 0,
  maxTriggersPerRoot: 1, cooldownSeconds: 0, targetHitIntervalSeconds: 0.1,
};
const projectile: ProjectileConfig = {
  id: 'sword', movement: 'straight', speed: 8, size: { x: 1, y: 1 },
  lifetimeSeconds: 2, pierceCount: 0,
  inheritance: { stats: ['attackDamage'], enchantments: true, secondaryMechanisms: false },
};
const effects: EffectConfig[] = [
  { id: 'damage', kind: 'stat-modifier', stat: 'attackDamage', operation: 'multiply', value: 1.1 },
  { id: 'many', kind: 'attack-pattern', pattern: 'multishot', projectileId: 'sword', projectileCount: 3, damageMultiplier: 0.8, triggerPolicyId: 'direct-only' },
  { id: 'fire', kind: 'element', element: 'fire', damageMultiplier: 0.2, durationSeconds: 2, triggerPolicyId: 'direct-only' },
  { id: 'wide-array', kind: 'ultimate-behavior', behaviorId: 'wide-sword-array', projectileId: 'sword', damageMultiplier: 2, triggerPolicyId: 'direct-only' },
];
const route: RouteConfig = {
  id: 'many', name: 'Many swords', heroId: 'raine', entryEffectIds: ['many'],
  branches: [
    { id: 'scatter', name: 'Scatter', effectIds: ['many'], ultimateBehaviorEffectId: 'wide-array' },
    { id: 'focus', name: 'Focus', effectIds: ['damage'], ultimateBehaviorEffectId: 'wide-array' },
  ],
  ultimate: { name: 'Sword array', effectId: 'many' },
};
const config: GameConfig = {
  calibration: 'prototype',
  heroes: [{ id: 'raine', name: 'Raine', weaponId: 'longsword', baseStats: { maxHealth: 100, moveSpeed: 5, attackPower: 10, critChance: 0.05, critDamageMultiplier: 1.5 }, routeIds: ['many', 'thunder', 'return'] }],
  weapons: [{ id: 'longsword', name: 'Longsword', heroId: 'raine', kind: 'longsword', attackIntervalSeconds: 1, range: 8, projectileId: 'sword', baseDamage: 10, attackPowerScaling: 1 }],
  projectiles: [projectile],
  talents: [{ id: 'attack', name: 'Attack', category: 'general', maxLevel: 5, prerequisites: [{ kind: 'talent', talentId: 'speed', minLevel: 1 }], exclusiveTags: [], effectIds: ['damage'], weight: 1 }],
  routes: [route], effects,
  synergies: [{ id: 'storm', name: 'Storm', usage: 'test-only', prerequisites: [{ kind: 'route', routeId: 'many' }], effectIds: ['damage'], activation: 'next-level' }],
  elementPolicy: policy, triggerPolicies: [trigger],
  growth: { routeLevel: 3, branchLevel: 7, ultimateLevel: 11, freeRerolls: 2, ordinaryChoiceCount: 3 },
};

// Invalid data must be rejected at the real public boundary.
// @ts-expect-error Every pooled entity reference requires its generation.
const missingGeneration: EntityHandle = { id: 1 };
// @ts-expect-error Only declared projectile motion controllers are accepted.
const invalidMovement: ProjectileConfig['movement'] = 'teleport';
// @ts-expect-error Unknown event types must not silently enter the combat bus.
const unknownEvent: CombatEvent['type'] = 'teleport';
// @ts-expect-error This rule allows exactly two enchantments, not one.
const invalidSlots: ElementPolicy = { ...policy, maxEnchantments: 1 };
// @ts-expect-error Effects contain data; an executable callback is not an effect.
const executableEffect: EffectConfig = { id: 'bad', kind: 'stat-modifier', stat: 'attackDamage', operation: 'add', value: () => 10 };
// @ts-expect-error Finite trigger counts are numeric, never unlimited markers.
const unlimitedTrigger: TriggerPolicy = { ...trigger, maxTriggersPerRoot: 'unlimited' };
// @ts-expect-error A route must define exactly two branches.
const missingBranch: RouteConfig = { ...route, branches: [route.branches[0]] };
// @ts-expect-error Ultimate evolution is automatic and never a pending choice.
const ultimateChoice: PendingGrowthChoice = { kind: 'ultimate', targetLevel: 11 };
// @ts-expect-error Growth pauses at a single choice, not an array of choices.
const parallelChoices: GrowthState = { pendingTargetLevels: [3], pendingChoice: choices };
// @ts-expect-error Subscribers receive only the selected event payload.
bus.subscribe('hit', event => { const reason = event.reason; void reason; });
// @ts-expect-error The simulation clock is read-only to consumers.
clock.elapsedSeconds = 3;

void [random, clock, state, currentState, build, growth, automatic, config];
