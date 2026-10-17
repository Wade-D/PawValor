import assert from 'node:assert/strict';
import test from 'node:test';
import { DemoWorld } from '../.test-build/core/demo-world.js';
import { rainePrototypeConfig } from '../.test-build/config/raine.prototype.js';
const dt = 1 / 60;
const zero = { x: 0, y: 0 };
const of = (events, type) => events.filter(event => event.type === type);
function make(positions, tuning = {}) {
  const demo = new DemoWorld(rainePrototypeConfig, { seed: 73, initialEnemyPositions: positions,
    tuning: { enemySpeed: 0, enemyHealth: 20, contactDamage: 0, spawnIntervalSeconds: 100, ...tuning } });
  demo.start(); return demo;
}
function advance(demo, count, input = zero) {
  return Array.from({ length: count }, () => demo.step(dt, input)).flat();
}

test('pickup boundary is inclusive, removes the orb once, and rejects stale generation', () => {
  for (const x of [0.45, 0.450001]) {
    const demo = make([{ x, y: 0 }]);
    const events = advance(demo, 1);
    assert.equal(of(events, 'xpDrop').length, 1);
    assert.equal(of(events, 'xpPickup').length, x === 0.45 ? 1 : 0);
    assert.equal(demo.snapshot().orbs.length, x === 0.45 ? 0 : 1);
    assert.equal(demo.snapshot().xp, x === 0.45 ? 1 : 0);
    assert.equal(of(advance(demo, 1), 'xpPickup').length, 0);
    if (x > 0.45) {
      demo.orbs[0].handle.generation++;
      assert.equal(of(advance(demo, 1, { x: 1, y: 0 }), 'xpPickup').length, 0);
    }
  }
});

test('real kills and pickups emit one level-up and consume orbs after the cap', () => {
  const demo = make(Array.from({ length: 6 }, () => ({ x: 0.4, y: 0 })));
  const events = advance(demo, 250);
  assert.equal(of(events, 'kill').length, 6);
  assert.equal(of(events, 'xpPickup').length, 6);
  assert.equal(of(events, 'levelUp').length, 1);
  assert.deepEqual(events.filter(event => event.type !== 'heroDamaged').slice(0, 4).map(event => event.type), ['attack', 'hit', 'kill', 'xpDrop']);
  const types = events.map(event => event.type);
  assert.equal(types[types.indexOf('levelUp') - 1], 'xpPickup');
  assert.equal(demo.snapshot().level, 2);
  assert.equal(demo.snapshot().xp, 5);
  assert.equal(demo.snapshot().xpCapped, true);
  assert.deepEqual(demo.snapshot().orbs, []);
  demo.reset();
  assert.equal(demo.snapshot().level, 1); assert.equal(demo.snapshot().xp, 0);
  assert.equal(demo.snapshot().xpCapped, false);
});

test('pause freezes all state; lethal contact skips attacks, existing hits and pickups then freezes', () => {
  const demo = make([{ x: 0.5, y: 0 }, { x: 4, y: 0 }]);
  advance(demo, 1); // First enemy drops an orb outside pickup radius.
  demo.pause(); const paused = demo.snapshot();
  assert.deepEqual(advance(demo, 100, { x: 1, y: 0 }), []);
  assert.deepEqual(demo.snapshot(), paused); demo.resume();
  advance(demo, 48); // Launch a sword at the second enemy.
  assert.equal(demo.snapshot().projectiles.length, 1);
  demo.enemies[0].position = { x: 0.5, y: 0 };
  demo.tuning.contactDamage = 100; // Arrange lethal contact without production test APIs.
  const events = demo.step(dt, { x: 1, y: 0 });
  assert.deepEqual(events.map(event => event.type), ['heroDamaged', 'runEnded']);
  const ended = demo.snapshot();
  assert.equal(ended.state, 'ended'); assert.equal(ended.xp, 0);
  assert.equal(ended.orbs.length, 1); assert.equal(ended.projectiles.length, 1);
  assert.deepEqual(advance(demo, 100, { x: 1, y: 0 }), []);
  assert.deepEqual(demo.snapshot(), ended);
});

test('two reset/start cycles restore seed, progress, IDs, attacks and contact/spawn timers', () => {
  const demo = make(undefined, { spawnIntervalSeconds: 2, enemySpeed: 2, contactDamage: 10 });
  const initial = demo.snapshot();
  const first = advance(demo, 125);
  assert.equal(of(first, 'enemySpawn').length, 1);
  for (let cycle = 1; cycle <= 2; cycle++) {
    demo.reset(); demo.reset();
    const idle = demo.snapshot();
    assert.equal(idle.state, 'idle'); assert.equal(idle.elapsedSeconds, 0);
    assert.equal(idle.level, 1); assert.equal(idle.xp, 0); assert.equal(idle.xpCapped, false);
    assert.equal(idle.kills, 0);
    assert.deepEqual([idle.enemies, idle.projectiles, idle.orbs], [[], [], []]);
    demo.start(); const started = demo.snapshot();
    assert.deepEqual(started.enemies.map(e => e.position), initial.enemies.map(e => e.position));
    assert.equal(started.enemies[0].handle.id, initial.enemies[0].handle.id);
    assert.equal(started.hero.handle.generation, cycle * 2);
    const events = advance(demo, 125);
    const stripGeneration = value => JSON.parse(JSON.stringify(value).replace(/"generation":\d+/g, '"generation":0'));
    assert.deepEqual(stripGeneration(events), stripGeneration(first));
  }
  const dirty = make([{ x: 0.4, y: 0 }, { x: 7, y: 0 }]);
  advance(dirty, 49); assert.equal(dirty.snapshot().xp, 1);
  assert.equal(dirty.snapshot().projectiles.length, 1);
  dirty.reset(); dirty.start();
  assert.equal(dirty.snapshot().kills, 0); assert.equal(dirty.snapshot().xp, 0);
  assert.equal(of(dirty.step(dt, zero), 'attack')[0].attackId, 1);
  const orbWorld = make([{ x: 0.5, y: 0 }]);
  advance(orbWorld, 1); assert.equal(orbWorld.snapshot().orbs.length, 1);
  orbWorld.reset(); assert.deepEqual(orbWorld.snapshot().orbs, []);
});
