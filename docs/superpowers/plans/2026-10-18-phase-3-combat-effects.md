# PawValor 第三阶段第二步：战斗效果实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让通用天赋、独立奖励、火冰雷附魔与两种副机制在现有战斗中实际生效，并交付五个可见的中文效果测试预设。

**Architecture:** 扩展现有纯核心战斗，分离构筑解析、触发预算与状态计时。构筑在静止事务边界原子应用，弹体保留发射快照；Cocos 仅呈现核心快照/事件，不计算伤害或前置。

**Tech Stack:** Cocos Creator 3.8.6、TypeScript 6.0.3、Node 内置测试器；沿用现有 npm 验证脚本，不新增依赖。

**Spec:** [已批准的第二步规格](../specs/2026-10-18-phase-3-combat-effects-design.md)。执行者须阅读规格与本计划，冲突以规格为准。

## Global Constraints

- 在 `D:\project\VibeCoding\PawValor` 的 `codex/phase-3-growth-core` 分支、现有工作目录顺序实现，最后独立全分支审查；用户已选定，不再要求选择执行方式。
- 基线设计提交 `17c2172`，当前已有 287 项测试。代码/测试在 `client/`，文档在根 `docs/`，核心禁止依赖 cc、Node、DOM、微信和适配层。
- 玩家可见文案、新写代码注释、提交日志用中文。保留三个本地未跟踪目录 `client/.creator`、`client/extensions`、`client/settings`；精确暂存任务文件，不自行合并或推送。
- 固有元素不占附魔位，最多两个附魔；附魔与两个副机制槽独立，升级已有项不占新槽；同属性共鸣替代普通效果。
- 属性采用 `基础值 × (1 + 百分比增幅总和) + 固定增加总和`；独立奖励各次 +1%；最大生命重算保持生命比例，死亡不复活。
- 火焰每秒 20% 基础直接伤害、持续 3 秒；寒冰追加 15% 并减速 30% 持续 2 秒；雷电追加 30%。共鸣分别替换为 30%/25%/50%，雷霆固有雷单独为 40%；附魔伤害按等级线性增长。
- 追踪剑气每级 35% 伤害、速度 10、寿命 2 秒；爆裂每级 30% 伤害、基础半径 1；两项副机制上限三级。
- 主/额外弹体共享根 ID，额外弹体 60% 伤害、左侧垂直偏移 0.2；所有直接命中独立暴击。衍生伤害不再暴击/触发附魔或副机制。
- 每根每效果最多一次；元素冷却与同目标间隔 0.25 秒，副机制两项各 0.8 秒；时间只用模拟时钟，校验实体代次。
- 本步不接正式三选一、升级暂停/继续、新经验流程、组合调度及完整路线/分支/终极。预设仍保留二级战斗上限，并在 HUD 明示。
- 新脚本通过 Creator 导入生成唯一 `.meta`；场景序列化资源仅通过 Creator/MCP 修改。本步优先运行时生成预设控件，避免新增场景绑定。
- 测试与类型检查在 `client/` 执行，Git 在项目根执行。每个功能先看见对应失败，再实现，通过验证后提交。已有依赖可直接复用。

## Review Focus

1. 已经发射的弹体或已有灼烧遇到构筑重算：保留快照、原预算及冷却，不被新构筑追溯修改（任务 3、4）。
2. 灼烧反复刷新、恰好到期或较强/较弱来源替换：不推迟下次跳伤，不漏掉第三秒最后一跳，不无限保留旧根预算（任务 4）。
3. 穿透、额外弹体和击杀后效果在同一固定步交错：共享根预算，派生来源正确，每敌人只死一次且只掉一个经验球（任务 3、5）。
4. 满槽升级、同属性共鸣和能力前置：已有项可升级，第三附魔被过滤，范围卡不提前出现，构筑快照可直接查询（任务 1）。
5. 暂停、阵亡、重复切换预设及触控：时钟/特效冻结，旧局节点与回调清空，点击测试按钮不误驱动摇杆；核心通过不能冒充视觉或设备通过（任务 6、7）。

## File Map

下表路径相对 `client/`；后续任务块的 `core/`、`config/`、`cocos/` 分别缩写 `assets/scripts/core/`、`assets/scripts/config/`、`assets/scripts/cocos/`。配置数据由调用方注入，核心不反向导入配置目录。

| 文件 | 责任 |
|---|---|
| 修改 `assets/scripts/core/config.ts`、`validate-config.ts` | 效果执行参数、能力条件、已确认槽位语义与校验 |
| 修改 `assets/scripts/config/raine.prototype.ts` | 元素执行描述、独立副机制天赋/效果、额外弹体参数 |
| 创建 `assets/scripts/core/combat-model.ts` | 有效属性、已解析效果、伤害请求、状态及命中上下文契约 |
| 创建 `assets/scripts/core/combat-build.ts` | 构筑合法性、能力解析、属性和有效效果计算 |
| 创建 `assets/scripts/core/build-prerequisites.ts` | 独立的构筑前置判定，供候选与效果解析共同使用 |
| 修改 `assets/scripts/core/growth-candidates.ts`、`growth-model.ts`、`growth-session.ts` | 分类显式启用、槽位/能力过滤、首次获得分类 ID 的维护 |
| 创建 `assets/scripts/core/combat-trigger.ts` | 按效果隔离的根预算、冷却、目标间隔与清理 |
| 创建 `assets/scripts/core/combat-status.ts` | 灼烧续期/跳伤、寒冷减速、状态快照与清理 |
| 创建 `assets/scripts/core/combat-secondary.ts` | 衍生目标选择、追踪方向及爆裂目标排序 |
| 修改 `assets/scripts/core/demo-world.ts`、`demo-model.ts` | 效果模式、弹体快照、统一伤害/击杀、事件及生命周期 |
| 修改 `assets/scripts/core/demo-geometry.ts`（按需） | 扫掠多命中排序所需纯几何，保留旧函数语义 |
| 创建 `assets/scripts/config/combat-presets.prototype.ts` | 五个中文预设及耐久怪调参 |
| 创建 `assets/scripts/cocos/CombatEffectPanel.ts` | 运行时按钮、伤害提示/状态占位表现与清理 |
| 修改 `assets/scripts/cocos/CombatDemo.ts` | 预设切换、HUD、有效尺寸及新事件呈现 |
| 创建 `tests/combat-*.test.mjs`、`tests/helpers/combat-fixtures.mjs` | 属性、预算、命中、状态、副机制、预设及集成回归 |
| 修改 `tests/contracts.typecheck.ts`、`growth.typecheck.ts` 及受契约影响的配置/候选测试 | 正向只读兼容、参数校验与既有行为回归 |
| 修改根 `README.md`、`client/README.md` 及本计划 | 预设使用方法、实测证据与边界 |

## 共享接口与迁移决策

1. `config.ts` 中 `ElementPolicy.usage` 允许 `'test-only' | 'confirmed'`；雷恩数据改为 confirmed，确认策略要求 `innateElementCounts:false`、`enchantmentsUseSecondarySlots:false`。保留旧 test-only 结构测试，运行时效果模式拒绝未确认策略，避免静默采用历史实验值。
2. `TalentConfig` 增加 `requiredCapabilities?: readonly CombatCapability[]`，首个能力为 `'area-attack'`；范围增幅声明该条件。`EffectConfig` 的元素分支增加可选 `execution` 联合：`{ kind:'burn'; tickIntervalSeconds:number } | { kind:'slow-hit'; slowRatio:number } | { kind:'bonus-hit' }`。仅已声明 execution 的元素才由本步执行器运行。
3. 现有 attack-pattern 分支增加可选 `execution:{ kind:'extra-projectile'; trigger:'on-fire'; lateralOffset:number }`，首批只接受 single、数量 1。新增效果分支 `{ id; kind:'secondary-mechanism'; trigger:'on-direct-hit'; damageMultiplier; triggerPolicyId; inheritance:ProjectileInheritance; behavior:{ kind:'homing'; projectileId:string } | { kind:'explosion'; radius:number } }`。路线规划效果可以继续没有 execution；拥有的天赋效果若不支持则明确拒绝。
4. 两项新天赋 ID 为 `secondary-seeking`、`secondary-burst`，对应效果 ID 为 `secondary-seeking-effect`、`secondary-burst-effect`，类别 secondary-mechanism、maxLevel 3、weight 1、无额外前置/互斥。追踪使用新独立 `secondary-seeking-blade`，从现有追踪弹体数值建立，明确关闭附魔/副机制及暴击/穿透继承；不要改写第四阶段的 seeking-blade。共鸣以元素类型匹配，不以中文名或特定 ID 选择算法。
5. `combat-model.ts` 导出 `ResolvedCombatStats`（attackDamage、attackIntervalSeconds、critChance、critDamageMultiplier、pierceCount、projectileSize:Vec2、range、areaScale、maxHealth、moveSpeed、damageReduction）、`ResolvedElement`、`ResolvedSecondary`、`CompiledCombatBuild`（递归只读 build、stats、elements、secondary、extraProjectiles）、`CombatStatusSnapshot`、`DamageRequest`、`DirectHitContext`。效果使用可辨识 kind，携带原始 effectId、触发策略及所需执行参数。已解析效果有 `name:string`，从所属天赋中文名、路线中文名或元素类型对应的中文显示名称获取，不依赖特定 ID 决定行为。伤害请求包含 attackId、attacker/target 句柄、AttackSource、damage、critical。
6. `compileCombatBuild(config: GameConfig, build: GrowthReadonly<BuildState>): CompiledCombatBuild` 校验并深复制构筑；`combatCapabilities(config:GameConfig, build:GrowthReadonly<BuildState>): readonly CombatCapability[]` 仅扫描已拥有天赋的已支持效果，不递归调用 compileCombatBuild。二者在 combat-build.ts；该模块不得导入 growth-candidates。将现有 `meetsPrerequisites(requirements:readonly BuildPrerequisite[], build:GrowthReadonly<BuildState>):boolean` 移至 build-prerequisites.ts，并从 growth-candidates 保留原导出；候选层和构筑层均依赖该纯模块，从而没有循环依赖。
7. 候选函数追加可选 `options?: { enabledCategories:readonly TalentCategory[] }`，默认只启用 general，保持第一步显式分类边界；`GrowthSessionOptions.enabledTalentCategories?: readonly TalentCategory[]` 传入候选层。开启新分类后，select 首次取得分类天赋才追加对应 ID，升级不重复追加；重置仍清空。新增拒绝原因含 slot-full、capability、unsupported-effect。查询输入继续递归只读。
8. `DemoWorldOptions.effects?: { build:GrowthReadonly<BuildState>; criticalSeed?:number }`；增加 `applyBuild(build:GrowthReadonly<BuildState>, expectedGeneration:number):void`，只允许 idle/paused 且代次匹配，校验失败无变化。构造时可注入预设；reset 恢复构造时预设而非保留临时 applyBuild 的变更。未提供 effects 且未 applyBuild 时严格保留旧 Demo 行为。
9. `DemoSnapshot.effects?: { build:GrowthReadonly<BuildState>; stats:ResolvedCombatStats; elements:readonly ResolvedElement[] }`；效果模式敌人快照增加 maxHealth/statuses，弹体快照增加 kind/size。旧模式不强行添加这些可选字段，保留既有快照断言。`DemoEvent` 增加 `effectTriggered`（时间、effectId、中文 effectName、source、position、可选 radius/target）；命中仍用 HitEvent 表达伤害。

## Task 1：可执行数据、构筑属性与成长合法性

**Files:** 修改 `core/config.ts`、`core/validate-config.ts`、`config/raine.prototype.ts`、`core/growth-candidates.ts`、`core/growth-model.ts`、`core/growth-session.ts`；创建 `core/combat-model.ts`、`core/combat-build.ts`、`core/build-prerequisites.ts`、`tests/combat-build.test.mjs`、`tests/combat-config.test.mjs`、`tests/combat-growth.test.mjs`、`tests/helpers/combat-fixtures.mjs`；更新 File Map 中受影响的既有契约/配置测试。

**Interfaces:** 实现共享接口 1—7。`compileCombatBuild` 输出不是战斗状态，不执行计时/命中。`ResolvedElement` 包含普通/共鸣解析后的执行参数和 rank；`ResolvedSecondary` 包含 behavior 及本级倍率。

- [ ] 写失败测试：攻击强化二级 + 三次奖励得到 24.6；十二天赋满级对应攻击 30、攻速间隔 `0.8/1.4`、暴击率 0.25、暴伤 2.1、穿透 2、尺寸倍率 1.3、射程 10.88、范围倍率 1.3、生命 136、移速 5.9、减伤 0.18；额外弹体为单独 60% 发射描述。用带爆裂的合法构筑测试范围属性，不制造无能力构筑。
- [ ] 写失败测试：固有雷+火冰合法，第三附魔被过滤；满槽已有附魔可升级，共鸣只解析一个雷效果；两个副机制占满后不重复占槽。未拥有范围攻击时过滤范围卡，获得爆裂后允许。正向类型测试直接传入 snapshot.build，旧 general 默认分类仍成立。
- [ ] 写失败测试：非法/未知引用、等级超限/非整数、奖励非法、分类列表不一致、互斥/前置不符、未确认策略、所选天赋缺少执行能力、非有限执行参数均拒绝；配置与构筑对象不被修改。配置缺 execution 的路线规划效果仍通过结构检查，但不被当作已实现技能。

```javascript
const build = emptyBuild(); // 复用 tests/helpers/growth-fixtures.mjs。
build.talentLevels['attack-up'] = 2;
build.bonusRewardCounts['base-attack'] = 3;
assert.ok(Math.abs(compileCombatBuild(fixtureConfig(), build).stats.attackDamage - 24.6) < 1e-10);
```

- [ ] 执行 `npm.cmd test`，确认新增功能的预期失败；实现上述数据、校验与解析。按继承白名单取基础值与修饰，禁止对已计算伤害再乘一次攻击强化；快照深复制。更新旧候选测试对范围卡的预期，这是已批准的能力过滤变化，其余历史约束保留。
- [ ] 执行 `npm.cmd run verify` 与根目录 `git diff --check`；通过后精确暂存，提交 `功能：解析天赋构筑并统一元素槽位规则`。

## Task 2：隔离的触发预算与清理

**Files:** 创建 `core/combat-trigger.ts`、`tests/combat-trigger.test.mjs`。

**Interfaces:** `class CombatTriggerGuard`：`tryConsume(effectId:string, policy:TriggerPolicy, source:AttackSource, target:EntityHandle, generation:number, now:number):boolean`；`retainRoots(rootIds:ReadonlySet<number>, generation:number, now:number):void`；`reset():void`。来源/深度限制检查的是触发事件，衍生结果深度由后续执行者递增。

- [ ] 写失败测试：同根同效果只消费一次，火冰互不占预算；不同根仍受 0.25 秒元素/0.8 秒副机制冷却，同目标间隔包含 id+generation；来源或深度不符拒绝，拒绝不消费预算，精确到达冷却边界可触发。
- [ ] 写失败测试：释放旧根后效果冷却不归零；存活根保留预算，目标间隔到期可清理；reset 清空全部，旧代次不可继承到新局。非法时间、次数、深度、Infinity 配置在消费前拒绝。

```javascript
const guard = new CombatTriggerGuard();
const policy = fixtureConfig().triggerPolicies.find(p => p.id === 'element-direct-only');
const source = { rootAttackId: 1, sourceKind: 'direct', depth: 0 };
assert.equal(guard.tryConsume('fire-hit', policy, source, { id: 2, generation: 0 }, 0, 0), true);
assert.equal(guard.tryConsume('fire-hit', policy, source, { id: 2, generation: 0 }, 0, 0.3), false);
```

- [ ] 执行 `npm.cmd test` 确认失败，再实现按 generation/root/effect 与 effect/target 分开的记录。保留根与全局冷却两套生命周期，不用一个 Map 删除操作同时清掉两者。
- [ ] 执行 `npm.cmd run verify` 与差异检查；提交 `功能：约束根攻击触发预算与效果冷却`。

## Task 3：直接攻击、通用天赋与原子构筑应用

**Files:** 修改 demo-world/model/geometry，创建 `tests/combat-direct.test.mjs`、`tests/combat-apply-build.test.mjs`；按需要扩展共享模型。

**Interfaces:** 实现共享接口 8、9 的直接攻击部分；统一私有 `dealDamage(request:DamageRequest, events:DemoEvent[]):void`，所有伤害通过同一实体代次/死亡/掉落路径。弹体内部保存 source、伤害快照、尺寸、穿透剩余与已命中句柄集合。

- [ ] 写失败测试：普通伤害 20，攻击强化一级 22，额外弹体独立 12 且不降低主伤害；主/额外 attackId 不同而 rootAttackId 相同，偏移 0.2 且不越出战场。通过配置 0/100% 暴击保证可复现命中结果，验证伤害按倍率结算与 RNG 不影响刷怪序列。
- [ ] 写失败测试：攻速、移动、护甲实际改变间隔/位移/接触伤害；穿透一级命中两个不同敌人且不反复伤同一敌人；加宽弹道能命中旧宽度之外目标，寿命和射程仍裁剪最终扫掠；无目标无补发。
- [ ] 写失败测试：50/100 生命应用一级生命强化后为 56/112，重复应用不再次加血；只允许 idle/paused 与正确代次，非法构筑/运行中/结束后应用拒绝且原状态不变。发射后暂停重算，旧弹体继续用旧伤害/穿透/尺寸/射程，新弹体用新属性；不重置现有冷却。

```javascript
const config = fixtureConfig(); config.heroes[0].baseStats.critChance = 0;
const build = emptyBuild(); build.talentLevels['attack-up'] = 1;
const world = new DemoWorld(config, { effects: { build }, initialEnemyPositions: [{ x: 1, y: 0 }], tuning: { enemySpeed: 0, enemyHealth: 200, contactDamage: 0 } });
world.start();
const events = Array.from({ length: 10 }, () => world.step(1 / 60, { x: 0, y: 0 })).flat();
assert.equal(events.find(e => e.type === 'hit').damage, 22);
```

- [ ] 执行 `npm.cmd test` 确认失败，再实现。暴击源独立使用 seeded RNG，默认 seed 为 `(worldSeed ^ 0x9e3779b9) >>> 0`，显式 criticalSeed 同样校验无符号 32 位整数；reset 复位两个随机源及构造预设。每次命中单独抽样，最终伤害保留精度。
- [ ] 执行 `npm.cmd run verify`，原第二阶段测试应继续通过；精确暂存并提交 `功能：让通用天赋作用于实际战斗`。

## Task 4：元素执行与状态时间

**Files:** 创建 `core/combat-status.ts`、`tests/combat-status.test.mjs`、`tests/combat-elements.test.mjs`；修改 demo-world/model 与共享模型。

**Interfaces:** `class CombatStatusStore`：`applyBurn(target:EntityHandle, payload:BurnPayload, now:number):void`、`applySlow(target:EntityHandle, slowRatio:number, durationSeconds:number, now:number):void`、`slowFactor(target:EntityHandle, now:number):number`、`advance(now:number, liveTargets:readonly EntityHandle[]):readonly DamageRequest[]`、`snapshot(target:EntityHandle):readonly CombatStatusSnapshot[]`、`liveRootIds():ReadonlySet<number>`、`reset():void`。`BurnPayload = Omit<DamageRequest,'target'|'critical'> & { durationSeconds:number; tickIntervalSeconds:number }`；状态按目标代次隔离。

- [ ] 写失败测试：D=20 时火焰每秒 4、三次共 12；寒冰追加 3 且移速乘 0.7；雷附魔追加 6，固有雷 8，共鸣仅为 10 而非三者相加；二级附魔伤害加倍，持续时间不增长。合法配置夹具补入固有火/冰以验证对应共鸣 6/5，不硬编码雷专例。
- [ ] 写失败测试：灼烧反复在首秒内续期仍在第一秒跳伤；第三秒最后一跳发生后删除；较强替换伤害/根归属，较弱或相等只延长期限；同目标代次不叠多份。寒冷重复施加不叠乘，边界到期回到原速。
- [ ] 写失败测试：direct 触发后所有派生 HitEvent 都是 element/damage-over-time、depth+1、原 rootId、critical=false；火冰雷各自受任务 2 限制。暂停/阵亡不补跳，旧代次不受伤；旧灼烧不随 applyBuild 变化，根预算在最后弹体/状态消失后释放。

```javascript
const store = new CombatStatusStore(); const target = { id: 2, generation: 0 };
store.applyBurn(target, { attackId: 2, attacker: { id: 1, generation: 0 }, source: { rootAttackId: 1, sourceKind: 'damage-over-time', depth: 1 }, damage: 4, durationSeconds: 3, tickIntervalSeconds: 1 }, 0);
assert.deepEqual([1, 2, 3].flatMap(now => store.advance(now, [target])).map(hit => hit.damage), [4, 4, 4]);
assert.deepEqual(store.snapshot(target), []);
```

- [ ] 执行 `npm.cmd test` 确认失败，接入元素顺序火→冰→雷，先核验目标存活才消费预算。灼烧跳伤在本步直接/副机制之后、经验拾取之前处理；状态里只保存伤害请求数据，不直接操作世界或节点。
- [ ] 执行 `npm.cmd run verify` 与差异检查；提交 `功能：执行元素附魔与模拟时间状态效果`。

## Task 5：追踪剑气、爆裂与衍生集成

**Files:** 创建 `core/combat-secondary.ts`、`tests/combat-secondary.test.mjs`、`tests/combat-effects-integration.test.mjs`；修改 demo-world/model。

**Interfaces:** `selectSecondaryTarget(origin:Vec2, range:number, excluded:EntityHandle, enemies:readonly SecondaryTarget[]):EntityHandle|null`；`homingDirection(origin:Vec2, target:Vec2, previous:Vec2):Vec2`；`explosionTargets(origin:Vec2, radius:number, enemies:readonly SecondaryTarget[]):readonly EntityHandle[]`。SecondaryTarget 为 handle/position/health 只读数据；执行器持有伤害与预算，辅助模块只选目标/计算几何。

- [ ] 写失败测试：D=20 的一级追踪伤害 7、爆裂伤害 6，三级为 21/18；追踪速度 10、寿命 2、排除原目标，最近/ID 平局稳定；失效目标重新选择，无目标不创建，已有弹体无目标保持方向到期。
- [ ] 写失败测试：爆裂原半径 1，加一级范围增幅为 1.1，边界包含、多目标按距离/ID 排序；原直接目标存活时可再受爆裂，直接击杀后仍能在保留命中位置触发。追踪与爆裂不继承暴击/附魔/副机制，追踪不继承穿透；允许的伤害/尺寸/射程或半径修饰各只继承一次。
- [ ] 写失败测试：穿透+额外弹体同根每效果只触发一次；新追踪弹体下一步才移动，source split/depth 1，爆裂 explosion/depth 1，均不重新成为 direct；每敌人仅一次击杀/掉落。接触先致死时跳过全部伤害与拾取，多次 reset 清空状态/弹体/根预算。

```javascript
const target = { handle: { id: 2, generation: 0 }, position: { x: 1, y: 0 }, health: 20 };
assert.deepEqual(explosionTargets({ x: 0, y: 0 }, 1, [target]), [target.handle]);
assert.equal(selectSecondaryTarget({ x: 0, y: 0 }, 8, target.handle, [target]), null);
```

- [ ] 执行 `npm.cmd test` 确认失败，再接入直接命中上下文：保存真实扫掠命中点、非暴击 D、源与原目标句柄，先统一直接伤害，再存活原目标元素，随后两种副机制。追踪弹体全寿命的目标选择和碰撞均排除原直接目标。生成/结算副机制前确认有合法目标，再消费对应预算；爆裂一次消费可伤多个敌人。
- [ ] 执行 `npm.cmd run verify` 与差异检查；提交 `功能：实现追踪剑气与命中爆裂副机制`。

## Task 6：五个中文预设与可见效果

**Files:** 创建 config/combat-presets.prototype、cocos/CombatEffectPanel，修改 cocos/CombatDemo；创建 `tests/combat-presets.test.mjs`。

**Interfaces:** `CombatPresetId = 'basic'|'general'|'elements'|'resonance'|'secondary'`；`createCombatPreset(id:CombatPresetId):{ id; name:string; summary:string; config:GameConfig; options:DemoWorldOptions }` 返回独立数据。`CombatEffectPanel` 提供 `initialize(parent:Node, onPreset:(id:CombatPresetId)=>void):void`、`consume(events:readonly DemoEvent[]):void`、`render(snapshot:DemoSnapshot):void`、`clear():void`；组件销毁释放按钮监听和动态节点。

- [ ] 写失败测试：五项名为“基础/通用强化/火冰雷/雷电共鸣/副机制”，basic 无 effects；其余怪物生命 200、移速 1。general 的攻击/攻速/暴击率各二级、暴伤及其余非范围通用各一级；elements 固有雷+一级火冰；resonance 固有雷+一级雷；secondary 两种副机制及范围增幅各一级。预设不能共享可变配置，所有效果构筑经 compileCombatBuild 通过，重开复现且仍为旧 Lv.2 战斗经验。

```javascript
const preset = createCombatPreset('resonance');
assert.equal(preset.name, '雷电共鸣');
assert.equal(compileCombatBuild(preset.config, preset.options.effects.build).elements.length, 1);
assert.equal(createCombatPreset('basic').options.effects, undefined);
```

- [ ] 执行 `npm.cmd test` 确认失败，再实现配置与控件。使用运行时节点生成按钮与伤害/状态占位；切换预设清输入、复位固定步、销毁旧表现并重建世界，不能给当前世界反复叠加。HUD 显示“效果测试预设”“测试参数”“本入口暂为二级封顶”与属性摘要；不是选卡弹窗。
- [ ] 伤害用中文来源和一位小数呈现，敌人生命和灼烧/寒冷标识可读，弹体图形宽度/长度采用核心 size；爆裂半径用世界单位换算。所有伤害进度/状态表现以模拟时钟计时，暂停/阵亡冻结；按钮触摸吞掉事件，避免同时驱动摇杆。
- [ ] 执行 `npm.cmd run verify` 和 `npx.cmd tsc --noEmit -p tsconfig.json --ignoreDeprecations 6.0 --skipLibCheck --lib ES2020,DOM`；Creator 3.8.6 导入脚本并生成 `.meta`，核对 UUID 唯一。通过后提交 `功能：提供中文战斗效果测试预设`。

## Task 7：完整验收、独立审查与交付记录

**Files:** 元数据、根/客户端 README、规格状态与本计划勾选；修复归属任务内的实际问题。

**Interfaces:** 只使用前六项公开接口验收；预设入口在现有 CombatDemo 场景，Bootstrap 保持配置诊断。

- [ ] Creator/浏览器实际预览逐项点击五个按钮，观察对应属性/附魔/共鸣/追踪/爆裂、中文可读性、暂停冻结与重开/切换无旧节点；记录截图及控制台。对副机制多目标验收使用固定测试敌人位置 `[(2,0),(2.3,0.3),(4,0)]`，保证从扫掠命中点产生的爆裂也能覆盖邻近目标；通过测试入口/临时驱动传入 initialEnemyPositions，不写进默认玩法生成规则。
- [ ] 分别报告桌面按钮点击、触控按钮、真实摇杆/多点触摸与微信设备结果；不可从桌面证据推断真机表现。若 Creator/MCP/预览阻塞，继续可完成的验证并明确标记视觉验收未完成，不把本步报告为全部验收通过。
- [ ] 运行完整 `npm.cmd run verify`、上述适配器类型检查及 `git diff --check`，核对既有行为回归、新测试结果、元数据与三个本地目录。只在修复、新改动或未解风险时重跑相关检查。
- [ ] 安排一次独立全分支审查，范围从本步代码前的文档提交到最终实现；审查含规格、计划与五项 Review Focus。对 Critical/Important 先写可复现失败测试再修复，重跑完整验证；记录 Minor 与裁定，不自行合并。
- [ ] 更新 README 的实际入口、五项预设、测试参数、已验证/待验证项，说明正式三选一/新经验流程在第三步；更新规格实施状态与任务清单。精确暂存并提交 `文档：记录战斗效果预设与验收结果`，保留当前分支供用户后续操作。

## 自查与执行交接

计划覆盖规格十节；已检查配置→构筑→发射快照→触发→状态/副机制→表现的依赖方向。两个特别约束：核心不能导入预设配置；只读构筑快照必须能直接传入候选及效果接口。

用户已选择当前会话在当前分支/目录顺序执行并最终独立审查。请先审阅本计划是否准确表达第二步；通过后保留该执行方式，不再重复选择。当前本轮只新增计划和更新规格批准状态，产品代码尚未修改。
