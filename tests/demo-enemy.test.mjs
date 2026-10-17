import assert from 'node:assert/strict';
import test from 'node:test';
import { DemoWorld } from '../.test-build/core/demo-world.js';
import { rainePrototypeConfig } from '../.test-build/config/raine.prototype.js';
const dt = 1 / 60;
const zero = { x: 0, y: 0 };
function world(options = {}) { return new DemoWorld(rainePrototypeConfig, options); }
function advance(demo, count) { const events = []; for (let i = 0; i < count; i++) events.push(...demo.step(dt, zero)); return events; }
test('start creates one reproducible seeded edge enemy and reset restores idle', () => {
  const a = world({ seed: 42 }); const b = world({ seed: 42 });
  a.start(); b.start();
  assert.equal(a.snapshot().enemies.length, 1);
  assert.deepEqual(a.snapshot().enemies, b.snapshot().enemies);
  const first = a.snapshot().enemies[0];
  assert.equal(first.health, 30);
  assert.ok(Math.abs(first.position.x) === 10 || Math.abs(first.position.y) === 5.625);
  a.start(); assert.equal(a.snapshot().enemies.length, 1);
  a.reset(); assert.equal(a.snapshot().state, 'idle'); assert.deepEqual(a.snapshot().enemies, []);
  a.start(); const restarted = a.snapshot().enemies[0];
  assert.deepEqual(restarted.position, first.position);
  assert.equal(restarted.handle.id, first.handle.id);
  assert.equal(restarted.handle.generation, first.handle.generation + 1);
});
test('scripted positions are copied and outside-arena positions are rejected', () => {
  for (const position of [{ x: 10.01, y: 0 }, { x: 0, y: -5.626 }]) {
    assert.throws(() => world({ initialEnemyPositions: [position] }), /initialEnemyPositions.*arena/i);
  }
  const positions = [{ x: 2, y: 0 }]; const demo = world({ initialEnemyPositions: positions });
  positions[0].x = 999; demo.start(); assert.equal(demo.snapshot().enemies[0].position.x, 2);
  const snapshot = demo.snapshot(); snapshot.enemies[0].position.x = 888;
  assert.equal(demo.snapshot().enemies[0].position.x, 2);
});
test('enemies chase by configured speed and stop at contact distance without overshooting', () => {
  const demo = world({ initialEnemyPositions: [{ x: 2, y: 0 }], tuning: { contactDamage: 0 } }); demo.start();
  advance(demo, 1); assert.equal(demo.snapshot().enemies.length, 1); assert.ok(Math.abs(demo.snapshot().enemies[0].position.x - (2 - 2 / 60)) < 1e-12);
  advance(demo, 59); assert.ok(Math.abs(demo.snapshot().enemies[0].position.x - 0.7) < 1e-12);
  const overlap = world({ initialEnemyPositions: [{ x: 0.2, y: 0 }] }); overlap.start(); advance(overlap, 1);
  assert.equal(overlap.snapshot().enemies[0].position.x, 0.2);
});
test('cadence spawns on edges at least four units away and caps live enemies', () => {
  const demo = world({ tuning: { contactDamage: 0 } }); demo.start();
  advance(demo, 119); assert.equal(demo.snapshot().enemies.length, 1);
  const events = advance(demo, 1800);
  assert.equal(demo.snapshot().enemies.length, 12);
  assert.equal(events.filter(e => e.type === 'enemySpawn').length, 11);
  for (const event of events.filter(e => e.type === 'enemySpawn')) {
    assert.ok(Math.hypot(event.position.x, event.position.y) >= 4);
    assert.ok(Math.abs(event.position.x) === 10 || Math.abs(event.position.y) === 5.625);
  }
});
test('each enemy deals ten damage with its own one-second cooldown', () => {
  const demo = world({ initialEnemyPositions: [zero, { x: 0.75, y: 0 }] }); demo.start();
  const first = advance(demo, 1); assert.equal(demo.snapshot().hero.health, 90);
  assert.equal(first.filter(e => e.type === 'heroDamaged').length, 1);
  advance(demo, 1); assert.equal(demo.snapshot().hero.health, 80);
  advance(demo, 58); assert.equal(demo.snapshot().hero.health, 80);
  advance(demo, 1); assert.equal(demo.snapshot().hero.health, 70);
  advance(demo, 1); assert.equal(demo.snapshot().hero.health, 60);
});
test('edge spawns respect the moving hero position at the moment of spawning', () => {
  let checkedSpawns = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const demo = world({ seed, initialEnemyPositions: [], tuning: { contactDamage: 0 } }); demo.start();
    for (let step = 0; step < 600; step++) {
      const events = demo.step(dt, { x: 1, y: 0 });
      const hero = demo.snapshot().hero.position;
      for (const event of events.filter(event => event.type === 'enemySpawn')) {
        assert.ok(hero.x > 9.9, 'hero must be near the right arena edge when a spawn is checked');
        assert.ok(Math.hypot(event.position.x - hero.x, event.position.y - hero.y) >= 4,
          `seed ${seed}: spawn must stay four units from the current hero position`);
        checkedSpawns++;
      }
    }
  }
  assert.equal(checkedSpawns, 60);
});
test('live enemy cap must be a positive integer', () => {
  for (const maxEnemies of [1.5, 0, -1, NaN, Infinity]) {
    assert.throws(() => world({ tuning: { maxEnemies } }), /maxEnemies/i);
  }
  const demo = world({ tuning: { maxEnemies: 1, contactDamage: 0 } }); demo.start();
  advance(demo, 240); assert.equal(demo.snapshot().enemies.length, 1);
});
test('lethal contact stops immediately and death freezes simulation until reset', () => {
  const demo = world({ initialEnemyPositions: Array.from({ length: 11 }, () => zero) }); demo.start();
  const events = advance(demo, 1);
  assert.equal(demo.snapshot().hero.health, 0); assert.equal(demo.snapshot().state, 'ended');
  assert.equal(events.filter(e => e.type === 'heroDamaged').length, 10);
  const dead = demo.snapshot(); advance(demo, 120); assert.deepEqual(demo.snapshot(), dead);
  demo.reset(); demo.start(); assert.equal(demo.snapshot().hero.health, 100);
});
