import assert from 'node:assert/strict';
import test from 'node:test';

test('four XP stays level 1, fifth levels once, and later XP stays capped', async () => {
  const growth = await import('../.test-build/core/demo-growth.js').catch(() => ({}));
  assert.equal(typeof growth.applyDemoXp, 'function', 'growth API must exist');
  const apply = growth.applyDemoXp;
  assert.deepEqual(apply({ level: 1, xp: 0 }, 4), { level: 1, xp: 4, leveledUp: false });
  assert.deepEqual(apply({ level: 1, xp: 4 }, 1), { level: 2, xp: 5, leveledUp: true });
  assert.deepEqual(apply({ level: 1, xp: 4 }, 10), { level: 2, xp: 5, leveledUp: true });
  assert.deepEqual(apply({ level: 2, xp: 5 }, 100), { level: 2, xp: 5, leveledUp: false });
  for (const amount of [-1, NaN, Infinity]) assert.throws(() => apply({ level: 1, xp: 0 }, amount));
});
