import assert from 'node:assert/strict';
import test from 'node:test';
import { DemoWorld } from '../.test-build/core/demo-world.js';
import { rainePrototypeConfig } from '../.test-build/config/raine.prototype.js';
const dt = 1 / 60;
const zero = { x: 0, y: 0 };
function world(positions, mutate = () => {}, tuning = {}) {
  const config = structuredClone(rainePrototypeConfig); mutate(config);
  const demo = new DemoWorld(config, { initialEnemyPositions: positions, tuning: {
    enemySpeed: 0, contactDamage: 0, spawnIntervalSeconds: 100, ...tuning,
  } }); demo.start(); return demo;
}
function advance(demo, count, input = zero) {
  return Array.from({ length: count }, () => demo.step(dt, input)).flat();
}
const of = (events, type) => events.filter(event => event.type === type);
test('nearest in-range live enemy wins; equal distance uses lower ID', () => {
  for (const positions of [[{ x: 9, y: 0 }, { x: 0, y: 3 }, { x: 2, y: 0 }], [{ x: 0, y: 2 }, { x: 2, y: 0 }]]) {
    const demo = world(positions);
    const attack = of(advance(demo, 1), 'attack')[0];
    assert.ok(attack);
    assert.deepEqual(attack.direction, positions.length === 3 ? { x: 1, y: 0 } : { x: 0, y: 1 });
    assert.deepEqual(attack.source, { rootAttackId: attack.attackId, sourceKind: 'direct', depth: 0 });
    assert.deepEqual(attack.attacker, { id: 1, generation: 0 });
    assert.equal(attack.projectileId, 'sword-qi');
  }
});
test('no target stores no burst and movement continues on attack step', () => {
  const demo = world([{ x: 10, y: 0 }]);
  assert.equal(of(advance(demo, 120), 'attack').length, 0);
  const events = advance(demo, 25, { x: 1, y: 0 });
  const attacks = of(events, 'attack'); assert.equal(attacks.length, 1);
  assert.ok(demo.snapshot().hero.position.x > 2);
  assert.ok(attacks[0].origin.x >= 2 - 1e-10);
  assert.equal(of(advance(demo, 22), 'attack').length, 0);
});
test('sword keeps launch direction while hero and target move', () => {
  const demo = world([{ x: 7, y: 0 }], () => {}, { enemySpeed: 2 });
  const attack = of(advance(demo, 1), 'attack')[0]; assert.ok(attack);
  advance(demo, 10, { x: 0, y: 1 });
  const sword = demo.snapshot().projectiles[0]; assert.ok(sword);
  assert.deepEqual(sword.direction, { x: 1, y: 0 });
  assert.equal(sword.position.y, 0); assert.ok(Math.abs(sword.position.x - 2.2) < 1e-10);
});
test('swept sword hits earliest circle, deals 20, and never pierces', () => {
  const demo = world([{ x: 3, y: 0 }, { x: 2, y: 0 }], config => { config.projectiles[0].speed = 300; });
  const events = advance(demo, 1); const hits = of(events, 'hit');
  assert.equal(hits.length, 1); assert.equal(hits[0].target.id, 3);
  assert.equal(hits[0].damage, 20); assert.equal(hits[0].critical, false);
  assert.deepEqual(hits[0].source, of(events, 'attack')[0].source);
  assert.deepEqual(demo.snapshot().enemies.map(enemy => enemy.health), [30, 10]);
  assert.deepEqual(demo.snapshot().projectiles, []);
});
test('off-axis radius hit kills once and drops one isolated orb at death position', () => {
  const demo = world([{ x: 3, y: 0.34 }, { x: 6, y: 0 }], config => {
    config.projectiles[0].speed = 300;
  }, { enemyHealth: 20 });
  // Nearest aim is off-axis; the hit is still a swept circle intersection.
  const events = advance(demo, 48);
  assert.equal(of(events, 'kill').length, 1); assert.equal(of(events, 'xpDrop').length, 1);
  assert.equal(demo.snapshot().kills, 1);
  const orb = demo.snapshot().orbs[0]; assert.equal(orb.value, 1);
  assert.deepEqual(orb.position, { x: 3, y: 0.34 });
  orb.position.x = 999; assert.equal(demo.snapshot().orbs[0].position.x, 3);
});
test('projectiles clip the final sweep at lifetime and range before a same-ray enemy', () => {
  // Enemy circle entry is just beyond each boundary but inside an unclipped final step:
  // lifetime: 1.64 - 0.35 = 1.29 > 12 * 0.105 = 1.26 (unclipped end 1.4).
  // range: 8.5 - 0.35 = 8.15 > 8 (unclipped end 10).
  for (const [speed, lifetime, steps, obstacleX] of [[12, 0.105, 7, 1.64], [150, 1, 4, 8.5]]) {
    const demo = world([{ x: 7, y: 0 }, { x: obstacleX, y: 0 }], config => {
      config.projectiles[0].speed = speed; config.projectiles[0].lifetimeSeconds = lifetime;
      config.weapons[0].attackIntervalSeconds = 100;
    });
    assert.equal(of(advance(demo, 1), 'attack').length, 1);
    assert.equal(demo.snapshot().projectiles.length, 1);
    demo.enemies[0].position = { x: 7, y: 5 };
    const events = advance(demo, steps - 1);
    assert.equal(of(events, 'hit').length, 0);
    assert.deepEqual(demo.snapshot().projectiles, []);
    assert.deepEqual(demo.snapshot().enemies.map(enemy => enemy.health), [30, 30]);
    assert.deepEqual(demo.snapshot().enemies[1].position, { x: obstacleX, y: 0 });
  }
});
test('a surviving in-range target receives attacks at actual 0.8-second intervals', () => {
  const demo = world([{ x: 2, y: 0 }], () => {}, { enemyHealth: 100 });
  const attacks = of(advance(demo, 120), 'attack');
  assert.equal(attacks.length, 3);
  for (let index = 1; index < attacks.length; index++) {
    assert.ok(Math.abs(attacks[index].elapsedSeconds - attacks[index - 1].elapsedSeconds - 0.8) < 1e-10);
  }
  assert.equal(demo.snapshot().enemies.length, 1);
  assert.equal(demo.snapshot().enemies[0].health, 40);
});
test('generation mismatch rejects stale hit and reset removes old attacks', () => {
  const demo = world([{ x: 2, y: 0 }]); advance(demo, 1);
  // Simulate a recycled target between launch and impact without adding test APIs.
  demo.enemies[0].handle.generation++;
  assert.equal(of(advance(demo, 10), 'hit').length, 0);
  assert.equal(demo.snapshot().enemies[0].health, 30);
  demo.reset(); demo.start();
  const events = advance(demo, 10);
  assert.equal(of(events, 'attack').length, 1);
  assert.equal(of(events, 'attack')[0].attackId, 1);
  assert.equal(of(events, 'hit').length, 1);
  assert.equal(of(events, 'hit')[0].target.generation, 1);
});

test('two default hits kill one 30HP enemy and emit ordered hit kill drop exactly once', () => {
  const demo = world([{ x: 2, y: 0 }]);
  const events = advance(demo, 120);
  assert.equal(of(events, 'attack').length, 2);
  assert.equal(of(events, 'hit').length, 2);
  assert.equal(of(events, 'kill').length, 1);
  assert.equal(of(events, 'xpDrop').length, 1);
  assert.deepEqual(events.slice(-3).map(event => event.type), ['hit', 'kill', 'xpDrop']);
  assert.deepEqual(demo.snapshot().enemies, []);
  assert.equal(demo.snapshot().orbs.length, 1);
});
test('swept collision hits off-axis circles and orders exact ties by lower ID', () => {
  const demo = world([{ x: 7, y: 0 }, { x: 8, y: 0 }], config => { config.projectiles[0].speed = 120; });
  advance(demo, 1);
  demo.enemies[0].position = { x: 3, y: 0.34 };
  demo.enemies[1].position = { x: 3, y: -0.34 };
  const hits = of(advance(demo, 1), 'hit');
  assert.equal(hits.length, 1); assert.equal(hits[0].target.id, 2);
});

test('two already-live swords reaching a lethal enemy in one step emit only one hit kill and drop', () => {
  function arrange(enemyHealth) {
    const demo = world([{ x: 7, y: 0 }], config => {
      config.projectiles[0].speed = 1;
      config.projectiles[0].lifetimeSeconds = 10;
    }, { enemyHealth });
    const launches = of(advance(demo, 49), 'attack');
    assert.equal(launches.length, 2);
    assert.equal(demo.snapshot().projectiles.length, 2);
    // Both existing swords cross the circle's left edge x=6.65 next step.
    // Keep distinct real launch IDs; no projectile is created in the tested step.
    for (const sword of demo.swords) sword.position = { x: 6.64, y: 0 };
    return demo;
  }
  // Control proves both swords actually intersect in this fixture when the enemy survives.
  const control = arrange(100);
  const controlEvents = control.step(dt, zero);
  assert.equal(of(controlEvents, 'attack').length, 0);
  assert.equal(of(controlEvents, 'hit').length, 2);
  assert.equal(control.snapshot().enemies[0].health, 60);
  const demo = arrange(20);
  const events = demo.step(dt, zero);
  assert.equal(of(events, 'attack').length, 0);
  assert.deepEqual(events.map(event => event.type), ['hit', 'kill', 'xpDrop']);
  assert.equal(of(events, 'hit')[0].attackId, 1);
  assert.deepEqual(demo.snapshot().enemies, []);
  assert.equal(demo.snapshot().kills, 1);
  assert.equal(demo.snapshot().orbs.length, 1);
  assert.equal(demo.snapshot().projectiles.length, 1);
});
