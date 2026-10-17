import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const checkerUrl = new URL('../tools/check-core-boundary.mjs', import.meta.url);
const checker = await import(checkerUrl.href).catch(() => ({}));
const compiler = join(projectRoot, 'node_modules/typescript/bin/tsc');

function fixture(t, files) {
  const root = mkdtempSync(join(tmpdir(), 'pawvalor-boundary-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const [name, text] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  }
  return root;
}

function check(root, entry = 'core/entry.ts') {
  assert.equal(typeof checker.checkCoreBoundary, 'function', 'checker must export checkCoreBoundary');
  return checker.checkCoreBoundary([join(root, 'assets/scripts', entry)]);
}

test('allows core relative dependencies, cycles, comments and import-like strings', (t) => {
  const root = fixture(t, {
    'assets/scripts/core/entry.ts': 'import { value } from "./value"; export { value }; // require("cc")\nconst text = "import(\'cc\')";',
    'assets/scripts/core/value.ts': 'import type {} from "./entry"; export const value = 1;',
  });
  assert.deepEqual(check(root), []);
});

test('allows configuration dependencies on configuration and core', (t) => {
  const root = fixture(t, {
    'assets/scripts/config/entry.ts': 'import { value } from "../core/value"; export { extra } from "./extra";',
    'assets/scripts/core/value.ts': 'export const value = 1;',
    'assets/scripts/config/extra.ts': 'export const extra = 2;',
  });
  assert.deepEqual(check(root, 'config/entry.ts'), []);
});

const rejected = [
  ['direct cc import', 'import { Node } from "cc";', /external.*cc/i],
  ['node builtin', 'import { readFile } from "node:fs";', /external.*node:fs/i],
  ['external re-export', 'export * from "cc";', /external.*cc/i],
  ['external type import', 'export type EngineNode = import("cc").Node;', /external.*cc/i],
  ['dynamic import', 'export const load = () => import("./value");', /dynamic import/i],
  ['require call', 'const value = require("./value");', /require/i],
  ['import equals require', 'import value = require("cc");', /require/i],
  ['adapter escape', 'import "../cocos/adapter";', /outside.*core/i],
  ['core to config escape', 'import "../config/data";', /outside.*core/i],
  ['triple slash path', '/// <reference path="../cocos/adapter.ts" />\nexport {};', /triple.slash/i],
  ['triple slash types', '/// <reference types="node" />\nexport {};', /triple.slash/i],
  ['triple slash lib', '/// <reference lib="dom" />\nexport {};', /triple.slash/i],
];

for (const [name, source, expected] of rejected) {
  test(`rejects ${name}`, (t) => {
    const root = fixture(t, {
      'assets/scripts/core/entry.ts': source,
      'assets/scripts/core/value.ts': 'export const value = 1;',
      'assets/scripts/cocos/adapter.ts': 'export {};',
      'assets/scripts/config/data.ts': 'export {};',
    });
    assert.match(check(root).join('\n'), expected);
  });
}

test('follows an internal barrel and rejects its indirect cc dependency', (t) => {
  const root = fixture(t, {
    'assets/scripts/core/entry.ts': 'export * from "./barrel";',
    'assets/scripts/core/barrel.ts': 'export * from "./engine";',
    'assets/scripts/core/engine.ts': 'import "cc";',
  });
  assert.match(check(root).join('\n'), /engine\.ts.*external.*cc/i);
});

test('rejects unresolved internal dependencies', (t) => {
  const root = fixture(t, { 'assets/scripts/core/entry.ts': 'import "./missing";' });
  assert.match(check(root).join('\n'), /unresolved.*missing/i);
});

test('CLI exits nonzero for a boundary violation', (t) => {
  const root = fixture(t, { 'assets/scripts/core/entry.ts': 'import "cc";' });
  const result = spawnSync(process.execPath, [fileURLToPath(checkerUrl), join(root, 'assets/scripts/core/entry.ts')], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /external.*cc/i);
});

function compileFixture(t, source, configName = 'tsconfig.core.json') {
  const root = fixture(t, { 'assets/scripts/core/entry.ts': source });
  const config = JSON.parse(readFileSync(join(projectRoot, configName), 'utf8'));
  config.extends = configName === 'tsconfig.test.json' ? join(projectRoot, 'tsconfig.core.json') : undefined;
  config.include = ['assets/scripts/core/**/*.ts'];
  config.compilerOptions.outDir = join(root, '.test-build');
  config.compilerOptions.rootDir = join(root, 'assets/scripts');
  writeFileSync(join(root, 'tsconfig.json'), JSON.stringify(config));
  return { root, result: spawnSync(process.execPath, [compiler, '-p', join(root, 'tsconfig.json')], { encoding: 'utf8' }) };
}

for (const global of ['document', 'window', 'process', 'wx']) {
  test(`core compiler rejects platform global ${global}`, (t) => {
    const { result } = compileFixture(t, `export const platform = ${global};`);
    assert.notEqual(result.status, 0);
    assert.match(result.stdout + result.stderr, new RegExp(`Cannot find name '${global}'`));
  });
}

test('core compiler enforces strict typing and ES2020-only globals', (t) => {
  const { result } = compileFixture(t, 'export function identity(value) { return value; }\nexport const ref = new WeakRef({});');
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /implicitly has an 'any' type/);
  assert.match(result.stdout + result.stderr, /Cannot find name 'WeakRef'/);
});

test('core compiler accepts ES2020 and does not emit output', (t) => {
  const { root, result } = compileFixture(t, 'export const value: bigint = 1n;');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.throws(() => readFileSync(join(root, '.test-build/core/entry.js')), { code: 'ENOENT' });
});

test('test compiler emits executable JavaScript into its separate build directory', (t) => {
  const { root, result } = compileFixture(t, 'export const value: number = 42;', 'tsconfig.test.json');
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const emitted = join(root, '.test-build/core/entry.js');
  const run = spawnSync(process.execPath, ['-e', `if (require(${JSON.stringify(emitted)}).value !== 42) process.exit(1)`], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
});
