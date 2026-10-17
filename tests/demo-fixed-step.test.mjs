import assert from 'node:assert/strict';
import test from 'node:test';

const module = await import('../.test-build/core/demo-fixed-step.js').catch(() => ({}));
test('fixed step driver API exists', () => assert.equal(typeof module.FixedStepDriver, 'function'));
test('normal frame runs one exact fixed step', () => {
  const driver = new module.FixedStepDriver();
  const times = [];
  assert.deepEqual(driver.advance(1 / 60, dt => times.push(dt)), { steps: 1, droppedSeconds: 0 });
  assert.deepEqual(times, [1 / 60]);
});
test('long frame caps catch up at five and discards excess accumulation', () => {
  const driver = new module.FixedStepDriver();
  let count = 0;
  const result = driver.advance(1, () => count++);
  assert.equal(count, 5);
  assert.equal(result.steps, 5);
  assert.ok(Math.abs(result.droppedSeconds - 55 / 60) < 1e-12);
  assert.equal(driver.dropCount, 1);
  assert.equal(driver.droppedSeconds, result.droppedSeconds);
  assert.deepEqual(driver.advance(0, () => count++), { steps: 0, droppedSeconds: 0 });
});
test('small frames accumulate and preserve fractional remainder', () => {
  const driver = new module.FixedStepDriver();
  let count = 0;
  for (let i = 0; i < 240; i++) driver.advance(1 / 240, () => count++);
  assert.equal(count, 60);
  assert.equal(driver.dropCount, 0);
});
test('invalid deltas are rejected without changing accumulator', () => {
  const driver = new module.FixedStepDriver();
  driver.advance(1 / 120, () => {});
  for (const dt of [-1, NaN, Infinity, -Infinity]) {
    assert.throws(() => driver.advance(dt, () => assert.fail('must not step')), RangeError);
  }
  assert.equal(driver.advance(1 / 120, () => {}).steps, 1);
});
test('reset clears remainder and drop diagnostics', () => {
  const driver = new module.FixedStepDriver();
  driver.advance(1, () => {});
  driver.advance(1 / 120, () => {});
  driver.reset();
  assert.equal(driver.dropCount, 0);
  assert.equal(driver.droppedSeconds, 0);
  assert.equal(driver.advance(1 / 120, () => {}).steps, 0);
});
test('exactly five steps do not report floating point residue as a dropped frame', () => {
  const driver = new module.FixedStepDriver();
  assert.deepEqual(driver.advance(5 / 60, () => {}), { steps: 5, droppedSeconds: 0 });
  assert.equal(driver.dropCount, 0);
});
