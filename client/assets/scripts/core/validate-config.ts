import type { BuildPrerequisite, GameConfig, RouteBranchConfig } from './config';

export interface ConfigIssue {
  code: string;
  path: string;
  message: string;
}

const stats = [
  'attackDamage', 'attackSpeed', 'critChance', 'critDamageMultiplier', 'pierceCount',
  'projectileSize', 'range', 'areaSize', 'maxHealth', 'moveSpeed', 'damageReduction', 'projectileCount',
] as const;
const attackSources = ['direct', 'split', 'bounce', 'explosion', 'element', 'damage-over-time', 'synergy'] as const;

/** Validates typed configuration data without changing it. Any issue must block run startup. */
export function validateGameConfig(config: GameConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const issue = (code: string, path: string, message: string): void => {
    issues.push({ code, path, message });
  };

  function identifier(value: unknown, path: string): value is string {
    if (typeof value === 'string' && value.trim().length > 0) return true;
    issue('invalid-id', path, 'Expected a nonempty identifier.');
    return false;
  }

  function addId<T extends { id: string }>(item: T, path: string, index: Map<string, T>): void {
    if (!identifier(item.id, `${path}.id`)) return;
    if (index.has(item.id)) {
      issue('duplicate-id', `${path}.id`, `Identifier "${item.id}" is already defined in this collection.`);
    } else {
      index.set(item.id, item);
    }
  }

  function index<T extends { id: string }>(items: readonly T[], path: string): Map<string, T> {
    const result = new Map<string, T>();
    items.forEach((item, i) => addId(item, `${path}[${i}]`, result));
    return result;
  }

  function reference<T>(value: unknown, path: string, target: Map<string, T>): T | undefined {
    if (!identifier(value, path)) return undefined;
    const entry = target.get(value);
    if (entry === undefined) issue('dangling-reference', path, `Referenced identifier "${value}" does not exist in the target collection.`);
    return entry;
  }

  function references<T>(values: readonly string[], path: string, target: Map<string, T>): void {
    values.forEach((value, i) => reference(value, `${path}[${i}]`, target));
  }

  function number(value: unknown, path: string, min = 0, integer = false, exclusiveMin = false, max = Infinity): boolean {
    if (typeof value === 'number' && Number.isFinite(value)
      && (exclusiveMin ? value > min : value >= min) && value <= max
      && (!integer || Number.isInteger(value))) return true;
    const range = `${exclusiveMin ? '>' : '>='} ${min}${max === Infinity ? '' : ` and <= ${max}`}`;
    issue('invalid-number', path, `Expected a finite ${integer ? 'integer' : 'number'} ${range}.`);
    return false;
  }

  function domain(value: unknown, path: string, allowed: readonly unknown[]): void {
    if (!allowed.includes(value)) issue('invalid-value', path, `Expected one of: ${allowed.join(', ')}.`);
  }

  function fixedNumber(value: unknown, path: string, expected: number): void {
    if (number(value, path) && value !== expected) issue('invalid-value', path, `Expected the fixed rule value ${expected}.`);
  }

  const heroes = index(config.heroes, 'heroes');
  const weapons = index(config.weapons, 'weapons');
  const projectiles = index(config.projectiles, 'projectiles');
  const talents = index(config.talents, 'talents');
  const routes = index(config.routes, 'routes');
  const effects = index(config.effects, 'effects');
  const synergies = index(config.synergies, 'synergies');
  const triggers = index(config.triggerPolicies, 'triggerPolicies');
  const branches = new Map<string, RouteBranchConfig>();
  config.routes.forEach((route, i) => {
    route.branches.forEach((branch, j) => addId(branch, `routes[${i}].branches[${j}]`, branches));
  });

  function prerequisites(values: readonly BuildPrerequisite[], path: string): void {
    values.forEach((entry, i) => {
      const p = `${path}[${i}]`;
      const kind = entry.kind;
      switch (kind) {
        case 'hero': reference(entry.heroId, `${p}.heroId`, heroes); break;
        case 'talent': {
          const talent = reference(entry.talentId, `${p}.talentId`, talents);
          const validLevel = number(entry.minLevel, `${p}.minLevel`, 1, true);
          if (validLevel && talent && Number.isFinite(talent.maxLevel) && entry.minLevel > talent.maxLevel) {
            issue('prerequisite-level', `${p}.minLevel`, `Minimum level ${entry.minLevel} exceeds talent "${talent.id}" maximum ${talent.maxLevel}.`);
          }
          break;
        }
        case 'route': reference(entry.routeId, `${p}.routeId`, routes); break;
        case 'branch': reference(entry.branchId, `${p}.branchId`, branches); break;
        case 'synergy': reference(entry.synergyId, `${p}.synergyId`, synergies); break;
        default: issue('invalid-kind', `${p}.kind`, `Unsupported prerequisite kind "${String(kind)}".`);
      }
    });
  }

  domain(config.calibration, 'calibration', ['prototype']);
  config.heroes.forEach((hero, i) => {
    const p = `heroes[${i}]`;
    const weapon = reference(hero.weaponId, `${p}.weaponId`, weapons);
    if (weapon && weapon.heroId !== hero.id) {
      issue('hero-ownership', `${p}.weaponId`, `Weapon "${weapon.id}" belongs to a different hero.`);
    }
    if (hero.routeIds.length !== 3) issue('invalid-count', `${p}.routeIds`, 'A hero must declare exactly three routes.');
    const seen = new Set<string>();
    hero.routeIds.forEach((routeId, j) => {
      const path = `${p}.routeIds[${j}]`;
      if (seen.has(routeId)) issue('duplicate-reference', path, `Route "${routeId}" is already listed for this hero.`);
      seen.add(routeId);
      const route = reference(routeId, path, routes);
      if (route && route.heroId !== hero.id) issue('hero-ownership', path, `Route "${route.id}" belongs to a different hero.`);
    });
    number(hero.baseStats.maxHealth, `${p}.baseStats.maxHealth`, 0, false, true);
    number(hero.baseStats.moveSpeed, `${p}.baseStats.moveSpeed`);
    number(hero.baseStats.attackPower, `${p}.baseStats.attackPower`);
    number(hero.baseStats.critChance, `${p}.baseStats.critChance`, 0, false, false, 1);
    number(hero.baseStats.critDamageMultiplier, `${p}.baseStats.critDamageMultiplier`);
  });

  config.weapons.forEach((weapon, i) => {
    const p = `weapons[${i}]`;
    const hero = reference(weapon.heroId, `${p}.heroId`, heroes);
    if (hero && hero.weaponId !== weapon.id) issue('hero-ownership', `${p}.heroId`, `Hero "${hero.id}" is bound to a different weapon.`);
    reference(weapon.projectileId, `${p}.projectileId`, projectiles);
    domain(weapon.kind, `${p}.kind`, ['longsword', 'staff', 'hammer', 'shield', 'bow', 'spear']);
    number(weapon.attackIntervalSeconds, `${p}.attackIntervalSeconds`, 0, false, true);
    number(weapon.range, `${p}.range`);
    number(weapon.baseDamage, `${p}.baseDamage`);
    number(weapon.attackPowerScaling, `${p}.attackPowerScaling`);
  });

  config.projectiles.forEach((projectile, i) => {
    const p = `projectiles[${i}]`;
    domain(projectile.movement, `${p}.movement`, ['straight', 'homing', 'returning', 'bouncing', 'orbiting']);
    number(projectile.speed, `${p}.speed`);
    number(projectile.size.x, `${p}.size.x`, 0, false, true);
    number(projectile.size.y, `${p}.size.y`, 0, false, true);
    number(projectile.lifetimeSeconds, `${p}.lifetimeSeconds`, 0, false, true);
    number(projectile.pierceCount, `${p}.pierceCount`, 0, true);
    projectile.inheritance.stats.forEach((stat, j) => domain(stat, `${p}.inheritance.stats[${j}]`, stats));
    domain(projectile.inheritance.enchantments, `${p}.inheritance.enchantments`, [true, false]);
    domain(projectile.inheritance.secondaryMechanisms, `${p}.inheritance.secondaryMechanisms`, [true, false]);
  });

  config.talents.forEach((talent, i) => {
    const p = `talents[${i}]`;
    domain(talent.category, `${p}.category`, ['general', 'secondary-mechanism', 'enchantment']);
    number(talent.maxLevel, `${p}.maxLevel`, 1, true);
    number(talent.weight, `${p}.weight`);
    prerequisites(talent.prerequisites, `${p}.prerequisites`);
    references(talent.effectIds, `${p}.effectIds`, effects);
  });

  config.routes.forEach((route, i) => {
    const p = `routes[${i}]`;
    const hero = reference(route.heroId, `${p}.heroId`, heroes);
    if (hero && !hero.routeIds.includes(route.id)) issue('hero-ownership', `${p}.heroId`, `Hero "${hero.id}" does not declare route "${route.id}".`);
    references(route.entryEffectIds, `${p}.entryEffectIds`, effects);
    if (route.branches.length !== 2) issue('invalid-count', `${p}.branches`, 'A route must declare exactly two branches.');
    route.branches.forEach((branch, j) => {
      const b = `${p}.branches[${j}]`;
      references(branch.effectIds, `${b}.effectIds`, effects);
      const behavior = reference(branch.ultimateBehaviorEffectId, `${b}.ultimateBehaviorEffectId`, effects);
      if (behavior && behavior.kind !== 'ultimate-behavior') {
        issue('invalid-effect-kind', `${b}.ultimateBehaviorEffectId`, 'A branch ultimate must reference an ultimate-behavior effect.');
      }
    });
    if (!route.ultimate || typeof route.ultimate !== 'object') {
      issue('invalid-value', `${p}.ultimate`, 'A route must declare its ultimate evolution.');
    } else {
      reference(route.ultimate.effectId, `${p}.ultimate.effectId`, effects);
    }
  });

  config.effects.forEach((effect, i) => {
    const p = `effects[${i}]`;
    const kind = effect.kind;
    switch (kind) {
      case 'stat-modifier':
        domain(effect.stat, `${p}.stat`, stats);
        domain(effect.operation, `${p}.operation`, ['add', 'multiply']);
        number(effect.value, `${p}.value`, -Infinity);
        break;
      case 'attack-pattern':
        domain(effect.pattern, `${p}.pattern`, ['single', 'multishot', 'chain', 'returning', 'orbiting', 'homing', 'explosion', 'area']);
        reference(effect.projectileId, `${p}.projectileId`, projectiles);
        reference(effect.triggerPolicyId, `${p}.triggerPolicyId`, triggers);
        number(effect.projectileCount, `${p}.projectileCount`, 1, true);
        number(effect.damageMultiplier, `${p}.damageMultiplier`);
        break;
      case 'element':
        domain(effect.element, `${p}.element`, ['fire', 'ice', 'lightning']);
        reference(effect.triggerPolicyId, `${p}.triggerPolicyId`, triggers);
        number(effect.damageMultiplier, `${p}.damageMultiplier`);
        number(effect.durationSeconds, `${p}.durationSeconds`);
        break;
      case 'ultimate-behavior':
        identifier(effect.behaviorId, `${p}.behaviorId`);
        reference(effect.projectileId, `${p}.projectileId`, projectiles);
        reference(effect.triggerPolicyId, `${p}.triggerPolicyId`, triggers);
        number(effect.damageMultiplier, `${p}.damageMultiplier`);
        break;
      default: issue('invalid-kind', `${p}.kind`, `Unsupported effect kind "${String(kind)}".`);
    }
  });

  config.synergies.forEach((synergy, i) => {
    const p = `synergies[${i}]`;
    domain(synergy.usage, `${p}.usage`, ['test-only']);
    domain(synergy.activation, `${p}.activation`, ['next-level']);
    prerequisites(synergy.prerequisites, `${p}.prerequisites`);
    references(synergy.effectIds, `${p}.effectIds`, effects);
  });

  const policy = config.elementPolicy;
  domain(policy.usage, 'elementPolicy.usage', ['test-only']);
  fixedNumber(policy.maxEnchantments, 'elementPolicy.maxEnchantments', 2);
  fixedNumber(policy.maxSecondaryMechanisms, 'elementPolicy.maxSecondaryMechanisms', 2);
  domain(policy.innateElementCounts, 'elementPolicy.innateElementCounts', [true, false]);
  domain(policy.enchantmentsUseSecondarySlots, 'elementPolicy.enchantmentsUseSecondarySlots', [true, false]);
  references(policy.resonanceEffectIds, 'elementPolicy.resonanceEffectIds', effects);

  config.triggerPolicies.forEach((trigger, i) => {
    const p = `triggerPolicies[${i}]`;
    trigger.allowedSources.forEach((source, j) => domain(source, `${p}.allowedSources[${j}]`, attackSources));
    number(trigger.maxDepth, `${p}.maxDepth`, 0, true);
    number(trigger.maxTriggersPerRoot, `${p}.maxTriggersPerRoot`, 1, true);
    number(trigger.cooldownSeconds, `${p}.cooldownSeconds`);
    number(trigger.targetHitIntervalSeconds, `${p}.targetHitIntervalSeconds`);
  });

  fixedNumber(config.growth.routeLevel, 'growth.routeLevel', 3);
  fixedNumber(config.growth.branchLevel, 'growth.branchLevel', 7);
  fixedNumber(config.growth.ultimateLevel, 'growth.ultimateLevel', 11);
  fixedNumber(config.growth.ordinaryChoiceCount, 'growth.ordinaryChoiceCount', 3);
  number(config.growth.freeRerolls, 'growth.freeRerolls', 0, true);
  return issues;
}
