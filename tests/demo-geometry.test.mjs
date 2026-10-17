import assert from 'node:assert/strict';
import test from 'node:test';
const geometry = await import('../.test-build/core/demo-geometry.js').catch(error => {
  if (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});
test('movement intent caps diagonal speed and preserves zero and analog input', () => {
  assert.equal(typeof geometry.normalizeIntent, 'function');
  const diagonal = geometry.normalizeIntent({ x: 1, y: 1 });
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-12);
  assert.deepEqual(geometry.normalizeIntent({ x: 0, y: 0 }), { x: 0, y: 0 });
  assert.deepEqual(geometry.normalizeIntent({ x: 0.5, y: 0 }), { x: 0.5, y: 0 });
  assert.deepEqual(geometry.normalizeIntent({ x: Number.MAX_VALUE, y: Number.MAX_VALUE }), diagonal);
});
test('arena clamps both coordinates to its edges', () => {
  assert.equal(typeof geometry.clampToArena, 'function');
  assert.deepEqual(geometry.clampToArena({ x: 100, y: 0 }), { x: 10, y: 0 });
  assert.deepEqual(geometry.clampToArena({ x: -100, y: 100 }), { x: -10, y: 5.625 });
});
test('swept collision returns the first fraction including overlap and tangency', () => {
  assert.equal(typeof geometry.segmentCircleHit, 'function');
  assert.equal(geometry.segmentCircleHit({ x: -2, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 0 }, 1), 0.25);
  assert.equal(geometry.segmentCircleHit({ x: -2, y: 2 }, { x: 2, y: 2 }, { x: 0, y: 0 }, 1), null);
  assert.equal(geometry.segmentCircleHit({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, 1), 0);
  assert.equal(geometry.segmentCircleHit({ x: 2, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 0 }, 1), null);
  assert.equal(geometry.segmentCircleHit({ x: -2, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 0 }, 1), 0.5);
});
