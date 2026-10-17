import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// 适配器需要引擎模块；这里只替换输入与向量外壳。
// 实际的 DemoInput 类及其同步重开回调保持原样运行。
const source = fs.readFileSync(new URL('../assets/scripts/cocos/DemoInput.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true,
} }).outputText;
const KeyCode = Object.fromEntries(['KEY_R', 'KEY_D', 'KEY_A', 'KEY_W', 'KEY_S',
  'ARROW_RIGHT', 'ARROW_LEFT', 'ARROW_UP', 'ARROW_DOWN'].map((key, i) => [key, i]));
class Vec2 {
  x = 0; y = 0;
  set(x, y) { this.x = x; this.y = y; }
  lengthSqr() { return this.x ** 2 + this.y ** 2; }
  normalize() { const length = Math.hypot(this.x, this.y); this.x /= length; this.y /= length; }
}
const exports = {};
vm.runInNewContext(compiled, { exports, require: () => ({
  _decorator: { ccclass: () => value => value }, Component: class {}, Vec2, KeyCode,
}) });

test('held R restarts once despite synchronous movement clear; release rearms it', () => {
  const input = new exports.DemoInput();
  let restarts = 0;
  input.onRestart = () => { restarts++; input.clear(); };
  input.keyDown({ keyCode: KeyCode.KEY_D });
  assert.equal(input.movement.x, 1);
  input.keyDown({ keyCode: KeyCode.KEY_R });
  assert.equal(input.movement.x, 0);
  for (let i = 0; i < 5; i++) input.keyDown({ keyCode: KeyCode.KEY_R });
  assert.equal(restarts, 1);
  input.keyUp({ keyCode: KeyCode.KEY_R });
  input.keyDown({ keyCode: KeyCode.KEY_R });
  assert.equal(restarts, 2);
});

test('focus loss releases restart latch when keyup happens outside the preview', () => {
  const input = new exports.DemoInput();
  let restarts = 0;
  input.onRestart = () => { restarts++; input.clear(); };
  input.keyDown({ keyCode: KeyCode.KEY_R });
  input.keyDown({ keyCode: KeyCode.KEY_D });
  input.blur();
  assert.equal(input.movement.x, 0);
  // 实际按键在预览窗口外松开，因此不会收到 keyUp。
  input.keyDown({ keyCode: KeyCode.KEY_R });
  assert.equal(restarts, 2);
  input.keyDown({ keyCode: KeyCode.KEY_R });
  assert.equal(restarts, 2);
});
