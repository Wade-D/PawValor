# Pawvalor Phase 2 Combat Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a playable Cocos Creator 3.8.6 combat prototype with Raine movement, automatic straight sword attacks, one chasing enemy, contact damage, XP pickup, Lv.2 cap and restart.

**Architecture:** Keep simulation, geometry and progression in `assets/scripts/core/` with no engine dependency. A Cocos adapter owns input, fixed-step scheduling, HUD and visual nodes; one new scene hosts the demo while `Bootstrap.scene` remains a config diagnostic. Runtime numeric values are prototype data only.

**Tech Stack:** TypeScript 6.0.3; Cocos Creator 3.8.6; Node built-in test runner and existing `npm.cmd run verify`; Cocos MCP for serialized scene/meta operations.

**Spec:** `docs/superpowers/specs/2026-10-16-phase-2-combat-demo-design.md` (under the `PawValor/` repository root). The original implementation used a temporary `client/` Git root; the user corrected it to `PawValor/` on 2026-10-18.

## Global Constraints

- Product code, assets, tests and tools remain under `client/`; `server/` stays reserved.
- Preserve existing `Bootstrap.scene`, `rainePrototypeConfig` and stage-1 contracts. Validate the config before starting combat.
- Core/config source may not import `cc`, Node, DOM, wx or the Cocos adapter; `npm.cmd run verify` must keep passing.
- World scale is 64 pixels per unit, arena 20×11.25 units; fixed simulation step `1/60` second, at most 5 catch-up steps per frame.
- Raine uses prototype config values; direct damage is `baseDamage + attackPower × attackPowerScaling` (20 in current data). Crits, talents, routes and elemental effects do not run.
- Enemy: 30 HP, speed 2, contact damage 10 every 1 second per enemy at center distance ≤0.70 (hero/enemy radius 0.35 each); spawn every 2 seconds at arena edge, at least 4 units from hero, maximum 12. Initial live enemy count is 1.
- Sword: nearest live target within range 8, interval 0.8 seconds, speed 12, lifetime 1 second, no pierce, first swept-segment/circle hit consumes it. Enemy hit radius 0.35.
- Kill drops one XP orb worth 1 at death position; pickup radius 0.45; 5 XP reaches Lv.2, then XP stops growing. Lv.3 is never entered in this demo.
- Read/write `.scene`, `.prefab`, `.anim` and `.meta` only through Creator/MCP when mutation is needed. Never hand-edit serialized assets or fabricate UUIDs. Commit only task-owned files and generated `.meta`, not existing untracked editor directories.
- Root `docs/` belongs to the `PawValor/` Git repository. Keep product code under `client/` and the server placeholder under `server/`.

## File Map

| File | Responsibility |
|---|---|
| `client/assets/scripts/core/demo-model.ts` | Demo-only tuning, snapshot/event/option types and constants. |
| `client/assets/scripts/core/demo-geometry.ts` | Vector normalization, arena clamp and swept segment/circle intersection. |
| `client/assets/scripts/core/demo-world.ts` | One run's lifecycle, actor state, enemy AI, targeting, attacks, damage and XP drops. |
| `client/assets/scripts/core/demo-growth.ts` | XP progress and Lv.2 cap, independent of Cocos. |
| `client/assets/scripts/core/demo-fixed-step.ts` | Frame accumulator, five-step limit and dropped-time diagnostic. |
| `client/assets/scripts/cocos/DemoInput.ts` | Keyboard/touch joystick state, focus loss and restart controls. |
| `client/assets/scripts/cocos/CombatDemo.ts` | Config gate, world/controller lifecycle, Cocos drawing and HUD. |
| `client/assets/scenes/CombatDemo.scene` | MCP-created scene with Canvas, demo host, HUD and touch controls. |
| `client/tests/demo-*.test.mjs` | Node tests for pure geometry, world, growth and fixed-step behavior. |
| `client/README.md` | Preview instructions, controls, prototype limits and verification evidence. |

## Review Focus

1. A frame after backgrounding can contain seconds of elapsed time: test that only five fixed steps run and leftover time is dropped, preventing an attack/spawn burst (Task 5).
2. An enemy killed by one projectile might be hit again in the same step: test exactly one kill and one XP orb (Task 3).
3. A reused entity ID could receive a stale projectile hit: test generation matching before damage (Task 3).
4. Contact damage could kill Raine before his attack in the same step: test that attack and pickup are skipped (Task 4).
5. Repeated restart could retain cooldowns, XP or stale visuals: test reset reproduces the seeded initial positions while advancing generation and clearing all per-run data; manually verify node counts/HUD (Tasks 4 and 6).

---

### Task 1: Simulation model, geometry and movement

**Files:** Create `client/assets/scripts/core/demo-model.ts`, `demo-geometry.ts`, `demo-world.ts`, `client/tests/demo-geometry.test.mjs`, `client/tests/demo-world.test.mjs`.

**Interfaces:** `DemoWorld` constructor `(config: GameConfig, options?: { seed?: number; tuning?: Partial<DemoTuning>; initialEnemyPositions?: readonly Vec2[] })`; `start(): void`, `pause(): void`, `resume(): void`, `reset(): void`, `step(dtSeconds: number, input: Vec2): readonly DemoEvent[]`, `snapshot(): DemoSnapshot`. `DemoSnapshot` has `state: RunState`, `elapsedSeconds`, `hero: { handle: EntityHandle; position: Vec2; health: number; maxHealth: number }`, readonly `enemies`, `projectiles`, `orbs` (each item has a handle and position, plus health/direction/value as relevant), `level: 1 | 2`, `xp`, `xpCapped`, `kills`. `DemoEvent` is the existing `CombatEvent` union plus `enemySpawn`, `xpDrop`, `xpPickup`, `levelUp` and `heroDamaged` events with handles/positions or amounts relevant to rendering. `normalizeIntent(input): Vec2`, `clampToArena(position): Vec2`, `segmentCircleHit(start,end,center,radius): number | null` returns first segment fraction or null. A new world starts idle, at origin, full health, level 1; `start` makes it running. Seeded generator is resettable. Reject invalid config, seed, `dt` or input with clear errors.

- [ ] Write tests: `(1,1)` normalizes to length 1; zero stays zero; `(100,0)` clamps within the arena; a segment crossing a circle hits even when both endpoints lie outside; missing circle returns null; `DemoWorld` moves exactly `5/60` units in one step and diagonal distance matches; pause/idle do not advance elapsed time; invalid config, seed, `dt` or input is rejected.
- [ ] Run `npm.cmd test`; confirm the new tests fail for missing implementation.
- [ ] Implement the interfaces using `rainePrototypeConfig` through the supplied `GameConfig`, copy-on-read snapshots, and direct numeric vectors. `step` only accepts a non-negative finite delta up to `1/60` second; `0` is a no-op. Leave enemy/attack/progression arrays empty until later tasks. `reset` returns idle, restores the seed/state and advances run generation.
- [ ] Run `npm.cmd run verify`; confirm tests, typecheck and boundary checks pass. Commit only Task 1 source/tests and generated `.meta` when Creator imports them.

### Task 2: Spawn, chase and contact damage

**Files:** Modify `client/assets/scripts/core/demo-world.ts`, `demo-model.ts`; add `client/tests/demo-enemy.test.mjs`.

**Interfaces:** Keep Task 1 `DemoWorld` API. `DemoTuning` holds enemy HP 30, speed 2, hit radius 0.35, hero radius 0.35, contact damage 10, contact interval 1, spawn interval 2, spawn distance 4 and live cap 12. `initialEnemyPositions` permits scripted test setups; when absent, one seeded edge spawn is used on `start`; `reset` returns idle until `start` is called again.

- [ ] Write tests: first enemy exists after `start`; two worlds with the same seed generate equal edge positions; scripted initial positions outside the arena are rejected; enemies approach Raine by `2/60` per step and stop when centers are within 0.70; spawn stays at least 4 units away and never exceeds 12 live enemies; contact hit removes exactly 10 HP and cannot repeat for 1 second from the same enemy; two enemies have independent cooldowns.
- [ ] Confirm focused tests fail, then implement seeded edge spawn, capped cadence, chase movement and per-handle contact cooldown. A death transition occurs immediately after contact; later phases of that step must not run.
- [ ] Run `npm.cmd run verify`, inspect `git diff --check`, then commit Task 2 files only.

### Task 3: Targeting, sword projectile, damage and XP drop

**Files:** Modify `client/assets/scripts/core/demo-world.ts`, `demo-geometry.ts`, `demo-model.ts`; add `client/tests/demo-combat.test.mjs`.

**Interfaces:** `step()` emits direct `AttackEvent`, `HitEvent`, `KillEvent` from existing `contracts.ts` plus demo spawn/drop events. Each direct attack has `sourceKind:'direct'`, `depth:0`, `rootAttackId=attackId`; handles carry ID and generation. Snapshot exposes live sword projectiles and XP orbs for Cocos rendering.

- [ ] Write tests: nearest in-range enemy wins and equal distance uses lower ID; no target means no attack backlog; movement continues on an attack step; launched sword travels in a fixed direction, hits a 0.35-radius enemy using a swept segment and expires at lifetime/range; damage is 20; two candidate hits pick the earliest segment intersection, then the sword disappears; dead enemy emits exactly one kill and one orb; stale handle generation cannot take damage.
- [ ] Confirm focused tests fail. Implement cooldown, target selection, projectile motion/hit ordering, attack IDs and immediate death/drop cleanup. Do not run crit/element/talent effects or change existing config data.
- [ ] Run `npm.cmd run verify` and `git diff --check`; commit Task 3 files only.

### Task 4: XP pickup, level cap and run reset

**Files:** Create `client/assets/scripts/core/demo-growth.ts`; modify `demo-world.ts`, `demo-model.ts`; add `client/tests/demo-growth.test.mjs`, `demo-integration.test.mjs`.

**Interfaces:** `applyDemoXp(current: { level: 1 | 2; xp: number }, amount: number): { level: 1 | 2; xp: number; leveledUp: boolean }`. `DemoWorld.snapshot()` exposes level, XP and `xpCapped`; `reset()` returns to original seed/initial state and clears entities, cooldowns and attack IDs.

- [ ] Write tests: pickups require distance ≤0.45 and remove one orb; four XP stays Lv.1, the fifth reaches Lv.2, later pickups cannot increase XP or enter Lv.3; contact death earlier in the step prevents attack/pickup; pause and death freeze the world; two `reset`/`start` cycles reproduce seeded positions with newer generation and clear projectiles, orbs, kills and timers.
- [ ] Confirm tests fail, implement growth and pickup after hits only while alive. Set `xpCapped` at Lv.2 and emit one level-up event on transition; make repeated reset safe.
- [ ] Run `npm.cmd run verify` and `git diff --check`; commit Task 4 files only.

### Task 5: Fixed-step driver and Cocos input

**Files:** Create `client/assets/scripts/core/demo-fixed-step.ts`, `client/assets/scripts/cocos/DemoInput.ts`, `client/tests/demo-fixed-step.test.mjs`.

**Interfaces:** `FixedStepDriver.advance(frameDtSeconds: number, step: (dtSeconds: number) => void): { steps: number; droppedSeconds: number }`, `reset(): void`; step size `1/60`, maximum 5. `DemoInput` exposes `movement: Vec2`, a restart callback, `clear()` and `dispose()`; active touch overrides keyboard, focus/touch cancel clears input. Adapter does not feed paused/ended frame time into the driver and calls `reset()` on pause/resume/restart.

- [ ] Write tests: a normal frame runs 1 fixed step; a long frame runs exactly 5 and drops the excess; repeated small frames accumulate correctly; invalid frame delta is rejected; `reset` clears accumulator and drop diagnostics.
- [ ] Confirm tests fail, implement the driver in pure core. Implement Cocos input using Creator 3.8.6 keyboard/touch APIs; normalize combined keys, map joystick displacement to a unit vector, clear on cancel/blur, and unregister listeners on destroy. Keep per-frame stepping outside the input component.
- [ ] Run `npm.cmd run verify`; verify Cocos script import in the editor, then commit Task 5 source/tests and imported `.meta` only.

### Task 6: Battle scene, HUD and live verification

**Files:** Create `client/assets/scripts/cocos/CombatDemo.ts`, `client/assets/scenes/CombatDemo.scene`; modify `client/README.md`; add Creator-generated `.meta`. Do not alter `Bootstrap.scene` except to resolve a verified regression.

**Interfaces:** `CombatDemo` owns `DemoWorld`, `FixedStepDriver`, `DemoInput`, runtime visual nodes and HUD; Cocos inspector properties bind the scene's Canvas/world root, HUD labels and touch control nodes. World positions map to screen with factor 64. `onLoad` validates `rainePrototypeConfig`, displays every issue and refuses to start if invalid. `onDestroy` removes input listeners and generated nodes.

- [ ] Use Cocos MCP to create `CombatDemo.scene` and bind its controls/component; create all serialized nodes via MCP, never by editing `.scene`/`.meta` text. Code may create/destroy runtime Graphics nodes for simple player, enemy, sword and orb markers. The scene exposes start/pause/resume/restart controls, keyboard `R`, HUD and visible joystick.
- [ ] Run Creator import and `validate_scene`; inspect console for script/import errors, save scene and confirm clean state. Preview and verify keyboard movement, auto attack, sword hit, orb pickup, Lv.2 cap, contact death, restart, pause and no old visual nodes after repeated restart.
- [ ] Capture runtime screenshot or short recording and console evidence; manually test touch on a touch-capable preview/device if available, otherwise mark it pending. Reopen `Bootstrap.scene` and confirm config diagnostic still works. Do not report WeChat-device FPS from desktop evidence.
- [ ] Update README with controls, preview path, verified checks and prototype limits. Run `npm.cmd run verify` and `git diff --check` after all changes; commit only Task 6 source, scene, generated `.meta` and README. Obtain independent whole-branch review before declaring completion.
