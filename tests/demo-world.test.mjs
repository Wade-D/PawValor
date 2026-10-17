import assert from 'node:assert/strict';
import test from 'node:test';
import { rainePrototypeConfig } from '../.test-build/config/raine.prototype.js';
const module = await import('../.test-build/core/demo-world.js').catch(error => {
  if (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
const zero = { x: 0, y: 0 };
test('seeded random source reproduces its sequence after reset', () => {
  assert.equal(typeof module.SeededRandom, 'function');
  const random = new module.SeededRandom(42);
  const first = Array.from({ length: 8 }, () => random.next());
  assert.ok(first.every(value => value >= 0 && value < 1));
  assert.ok(new Set(first).size > 1);
  random.reset();
  assert.deepEqual(Array.from({ length: 8 }, () => random.next()), first);
  assert.notDeepEqual(Array.from({ length: 8 }, () => new module.SeededRandom(43).next()), first);
});
function world(config = rainePrototypeConfig, options) {
  assert.equal(typeof module.DemoWorld, 'function');
  return new module.DemoWorld(config, options);
}
test('new world is idle at full health with no later-task entities', () => {
  const snapshot = world().snapshot();
  assert.equal(snapshot.state, 'idle');
  assert.deepEqual(snapshot.hero.position, zero);
  assert.equal(snapshot.hero.health, 100);
  assert.equal(snapshot.hero.maxHealth, 100);
  assert.equal(snapshot.level, 1);
  assert.equal(snapshot.xp, 0);
  assert.equal(snapshot.xpCapped, false);
  assert.equal(snapshot.kills, 0);
  for (const key of ['enemies', 'projectiles', 'orbs']) assert.deepEqual(snapshot[key], []);
});
test('fixed step moves by configured speed and diagonal never accelerates', () => {
  for (const input of [{ x: 1, y: 0 }, { x: 1, y: 1 }]) {
    const demo = world(); demo.start();
    assert.deepEqual(demo.step(1 / 60, input), []);
    const p = demo.snapshot().hero.position;
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - 5 / 60) < 1e-12);
    assert.equal(demo.snapshot().elapsedSeconds, 1 / 60);
  }
  const config = structuredClone(rainePrototypeConfig);
  config.heroes[0].baseStats.moveSpeed = 3;
  const demo = world(config); demo.start(); demo.step(1 / 60, { x: 1, y: 0 });
  assert.equal(demo.snapshot().hero.position.x, 3 / 60);
});
test('idle, paused and zero delta do not advance; resume advances and arena bounds hold', () => {
  const demo = world(); demo.step(1 / 60, { x: 1, y: 0 });
  assert.equal(demo.snapshot().elapsedSeconds, 0);
  demo.start(); demo.pause(); demo.start(); demo.step(1 / 60, { x: 1, y: 0 });
  assert.equal(demo.snapshot().state, 'paused');
  assert.equal(demo.snapshot().elapsedSeconds, 0);
  demo.resume(); demo.step(0, { x: 1, y: 0 });
  assert.equal(demo.snapshot().elapsedSeconds, 0);
  for (let i = 0; i < 1000; i++) demo.step(1 / 60, { x: 1, y: -1 });
  assert.deepEqual(demo.snapshot().hero.position, { x: 10, y: -5.625 });
});
test('snapshots and reset isolate state and invalidate old entity handles', () => {
  const demo = world(rainePrototypeConfig, { seed: 42 });
  const first = demo.snapshot(); first.hero.position.x = 999; first.hero.handle.id = 999;
  assert.deepEqual(demo.snapshot().hero.position, zero);
  demo.start(); demo.step(1 / 60, { x: 1, y: 0 });
  const previous = demo.snapshot(); demo.reset(); const reset = demo.snapshot();
  assert.equal(reset.state, 'idle'); assert.equal(reset.elapsedSeconds, 0);
  assert.deepEqual(reset.hero.position, zero);
  assert.equal(reset.hero.handle.id, previous.hero.handle.id);
  assert.equal(reset.hero.handle.generation, previous.hero.handle.generation + 1);
});
test('rejects invalid config and seeds with actionable errors', () => {
  const config = structuredClone(rainePrototypeConfig); config.heroes[0].baseStats.moveSpeed = NaN;
  assert.throws(() => world(config), /config.*moveSpeed/i);
  for (const seed of [NaN, Infinity, -1, 1.5, 4294967296]) assert.throws(() => world(rainePrototypeConfig, { seed }), /seed/i);
});
test('rejects invalid delta and input before changing state even while idle', () => {
  const demo = world(); const before = demo.snapshot();
  for (const dt of [NaN, Infinity, -1, 1 / 30]) assert.throws(() => demo.step(dt, zero), /dt/i);
  for (const input of [{ x: NaN, y: 0 }, { x: 0, y: Infinity }, {}, null]) assert.throws(() => demo.step(0, input), /input/i);
  assert.deepEqual(demo.snapshot(), before);
});
