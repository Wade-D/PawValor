# Pawvalor 阶段 1 骨架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user chooses delegated execution. Implement task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 在现有 client 工程中交付可独立检查的战斗与成长接口、可校验的雷恩配置和能运行的最小启动场景。

**Architecture:** 纯 TypeScript 核心不依赖引擎；Cocos 适配层负责启动与诊断呈现。配置保持数据形式，测试运行于 Node，项目仍以 Cocos Creator 为运行环境。

**Tech Stack:** Cocos Creator 3.8.6、TypeScript、Node 内置测试器；开发依赖仅新增 TypeScript，具体稳定版本在安装时核实并写入 lockfile。

**Spec:** [已批准设计](../specs/2026-10-15-phase-1-design.md)。原始基线为 `docs/design/pawvalor-v0.1-original.md`。

## Global Constraints

- 客户端工程、代码、资源、测试与工具配置均位于 `client/`；`server/` 仅预留；公共文档放根目录 `docs/`。
- 保持 Creator 3.8.6。保留既有 package.json 的 uuid 和 creator 字段，保留主 tsconfig 的 Cocos extends。
- 单英雄远程自动攻击、武器绑定；普通三选一与固定 Lv.3/7/11 规则不得混淆。
- 核心不得依赖 cc、微信、DOM、Node 专用 API；禁止在配置中嵌入执行函数。
- 所有原型数值显式标为 prototype；双元素槽位关系仍以策略表达，不隐式确定正式默认值。
- .scene/.prefab/.anim/.meta 一律由 Cocos MCP 或编辑器创建修改，不手写序列化资产。
- 本阶段不实现战斗 Demo、抽卡算法、升级状态机、完整进化技能或服务端。

## Review Focus

1. 配置中的 NaN、Infinity、负值不能通过编译类型掩盖：由任务 3 校验，并返回字段路径。
2. ID 存在但引用了其他英雄的路线或武器：由任务 3 校验归属关系。
3. 升级一次跨越固定等级：任务 2 的接口必须支持逐级待处理队列；任务 4 验证固定等级数据为 3/7/11。实际队列算法在阶段 3 测试。
4. 编辑器未启动、MCP 项目不匹配、存在未保存场景：任务 5 必须先查询，禁止覆盖或切换丢失用户修改。
5. 核心经间接 import 引入引擎或平台 API：任务 1 使用受限编译环境和 import 边界检查覆盖所有核心与配置文件。

## 文件职责

```text
client/package.json                       开发命令与 TypeScript 依赖
client/package-lock.json                  锁定实际依赖
client/tsconfig.core.json                 核心与配置 strict/noEmit 检查
client/tsconfig.test.json                 产出供 Node 测试的 CommonJS 模块
client/tools/check-core-boundary.mjs      通过 TypeScript AST 检查核心依赖
client/tests/boundary.test.mjs            边界检查器的有效与违规样例
client/tests/contracts.typecheck.ts       编译期契约断言
client/tests/config-validation.test.mjs   配置校验行为测试
client/tests/raine-config.test.mjs        示例配置与固定进化节点测试
client/assets/scripts/core/contracts.ts   时钟、随机源、实体及战斗事件契约
client/assets/scripts/core/build.ts       构筑状态、待升级与组合状态契约
client/assets/scripts/core/config.ts      配置数据类型
client/assets/scripts/core/validate-config.ts 纯配置校验函数
client/assets/scripts/config/raine.prototype.ts 雷恩测试配置
client/assets/scripts/cocos/Bootstrap.ts  启动校验与最小诊断文本
client/assets/scenes/Bootstrap.scene      MCP 创建的最小启动场景
client/README.md                          开发命令及工程入口
docs/design/phase-1-foundation.md          模块依赖、事件顺序及待定决策
```

测试生成文件写入 `client/.test-build/` 并加入 client/.gitignore。不把测试代码放入 assets，避免随游戏打包。核心与配置采用相对 import，不引入路径别名。

### Task 1: 建立独立检查链

**Files:** package.json、package-lock.json、tsconfig.core.json、tsconfig.test.json、.gitignore、tools/check-core-boundary.mjs、tests/boundary.test.mjs。

**Interfaces:** `checkCoreBoundary(sourceFiles: string[]): string[]` 返回违规诊断；命令失败需非零退出。仅允许核心内部相对 import，配置可引用核心及配置；禁止 require、动态 import、外部 import 和三斜线依赖引用。

- [x] 查询 client Git 状态和实际文件；保留用户已有改动与内部仓库，不擅自迁移 Git 到根目录。
- [x] 核实 TypeScript 稳定版本并安装为开发依赖；写 scripts：`typecheck:core`、`check:boundary`、`test`、`verify`。verify 串行运行类型检查、边界检查与测试。
- [x] 配置核心编译为 strict、ES2020、lib 仅 ES2020、types 为空、noEmit。测试编译使用独立 outDir `.test-build`，不继承 Cocos 的临时 tsconfig。
- [x] 写 boundary.test.mjs：内部相对依赖通过；直接与间接 cc 引用、node:fs、DOM 全局、越过核心目录引用适配层、动态导入及 require 均被边界或编译检查拒绝。
- [x] 运行 `node --test tests/boundary.test.mjs`，记录实现前失败；实现 AST 边界检查，再运行并确认通过。
- [x] 使用 `npm.cmd run verify` 作为最终统一入口。此时尚未创建核心文件可只验证工具自身，整体验收在任务 5。

### Task 2: 定义纯核心与配置契约

**Files:** core/contracts.ts、core/build.ts、core/config.ts、tests/contracts.typecheck.ts。

**Interfaces:**

- `Vec2 { x: number; y: number }`、`EntityHandle { id: number; generation: number }`。
- `RandomSource { next(): number }`，返回值约定 `[0,1)`；`SimulationClock { readonly elapsedSeconds: number }`，由流程推进，暂停不推进。
- `RunState = 'idle' | 'running' | 'paused' | 'ended'`；`RunController` 提供 start/pause/resume/end/reset/update(dtSeconds)。这里只定义接口。
- `CombatEvent` 为带 type 的联合，attack/hit/kill/runEnded 各有明确载荷；攻击来源带 rootAttackId、sourceKind、depth。`CombatEventBus` 提供 subscribe、emit、clear；subscribe 返回取消订阅函数。
- `BuildState` 包含 heroId、level、routeId、branchId、talentLevels、secondaryMechanismIds、enchantmentIds、pendingSynergies、activeSynergyIds；`PendingSynergy` 包含 eligibleAtLevel、activateAtLevel、synergyId。
- `GrowthState` 包含待处理目标等级队列及至多一个待选择项；待选择项区分普通、主路线、分支，终极为自动事件。
- `GameConfig` 集合包含 heroes、weapons、projectiles、talents、routes、effects、synergies、elementPolicy、triggerPolicies、growth；配置条目以 ID 交叉引用。
- `ElementPolicy` 明确 maxEnchantments:2、maxSecondaryMechanisms:2，innateElementCounts:boolean、enchantmentsUseSecondarySlots:boolean；测试选择不代表正式默认。
- 路线拥有 heroId、入口效果、恰好两条分支及终极效果引用；每个分支有唯一 ID、效果与终极行为引用。effects 使用 kind + 参数的可序列化联合。
- `TriggerPolicy` 明确 allowedSources、maxDepth、maxTriggersPerRoot、cooldownSeconds、targetHitIntervalSeconds；不允许无限次数标记。

- [x] 先写编译期断言：非法弹道运动类型、未知事件 type、缺 generation 的实体、maxEnchantments:1 及含执行函数的效果均触发 `@ts-expect-error`。
- [x] 运行 `npm.cmd run typecheck:core` 确认缺失类型导致失败，再添加上述类型与数据接口。配置效果只覆盖本阶段的数值修饰、攻击模式、元素和终极行为引用，不实现战斗执行器。
- [x] 运行类型检查和边界检查，确认纯核心不需要 Cocos 或 Node 类型；检查所有接口时间单位均为秒。

### Task 3: 实现配置校验

**Files:** core/validate-config.ts、tests/config-validation.test.mjs。

**Interfaces:** `validateGameConfig(config: GameConfig): ConfigIssue[]`，`ConfigIssue { code: string; path: string; message: string }`。不修改输入，返回全部可检测问题；引擎入口遇到非空 issues 必须阻止开始。

- [x] 写失败测试：有效最小配置 issues 为空；重复 ID、空 ID、悬空引用、错误英雄归属分别返回精确字段路径。
- [x] 加入测试：等级上限非正整数、权重为负、冷却为负、数值 NaN/Infinity、非法元素策略、非两条分支、缺终极行为、固定节点不是 3/7/11、前置天赋等级超过该天赋上限都被拒绝。
- [x] 加入测试：两个 route 中分支 ID 重复应报错；测试用有效原生元素计数策略与槽位策略均可通过；衍生来源触发必须有有限次数及深度限制。
- [x] 运行 `npm.cmd test`，记录失败后实现校验；使用按集合建立的索引检查引用，跨路线分支 ID 做全局唯一性检查。
- [x] 重跑测试与 core 类型检查；断言校验前后输入深度相等。

### Task 4: 添加雷恩测试配置与依赖文档

**Files:** config/raine.prototype.ts、tests/raine-config.test.mjs、docs/design/phase-1-foundation.md。

**Interfaces:** 导出 `rainePrototypeConfig: GameConfig`。导出配置的 calibration 为 `prototype`，elementPolicy 的用途为 `test-only`；不得作为正式玩法默认配置。growth 定义 routeLevel:3、branchLevel:7、ultimateLevel:11、freeRerolls:2。

- [x] 写失败测试：雷恩只绑定长剑；拥有万剑、雷霆、回旋剑三条路线；每条恰好两分支，分别为散华/聚锋、连锁雷击/雷霆贯心、护体飞剑/追魂剑；终极分别为万剑归宗、雷神审判、无尽剑轮。
- [x] 断言十二项通用天赋等级上限为 `[5,5,4,3,2,3,3,3,3,3,3,1]`，固定进化等级为 3/7/11，刷新次数为 2；整表通过 validateGameConfig。
- [x] 添加上述配置、火冰雷元素和一个明确标记测试用途的组合前置示例；组合激活策略固定为 next-level。所有倍率、武器和基础属性数值标记 prototype。
- [x] 运行测试，确保引用完整；文档说明这些是结构和规则数据示例，三条路线尚无实际战斗行为。
- [x] 文档记录依赖方向、升级事务顺序、多级经验逐级处理、伤害衍生边界、重置清理要求及阶段 3 前必须锁定的双元素策略与兜底奖励。

### Task 5: 接入最小启动场景并验收

**Files:** cocos/Bootstrap.ts、assets/scenes/Bootstrap.scene（仅 MCP 创建）、client/README.md。

**Interfaces:** `Bootstrap extends Component`，提供供场景绑定的 Label 属性；onLoad 运行 validateGameConfig，成功展示“Pawvalor：配置校验通过（测试参数）”，失败展示错误数量并通过 console.error 输出 issues。不启动战斗。

- [x] 用 MCP 查询 project_info、当前场景、is_dirty 及资源；只操作 `D:/project/VibeCoding/PawValor/client`。如当前未保存则保留场景，优先保存可定位的原场景；无可安全保存位置时暂停场景切换并说明具体冲突。
- [x] 重新确认 TestMCP 是否存在。若存在完整保留；若不存在不擅自恢复用户可能删除的测试资源。
- [x] 编写 Bootstrap.ts；通过 MCP 资源刷新等待脚本导入，创建或打开 `db://assets/scenes/Bootstrap.scene`，用 UI 工具创建诊断文本、挂载脚本并绑定 Label，保存场景。已有同名场景时先检查，不覆盖用户内容。
- [x] 运行 `npm.cmd run verify`：全部检查通过、测试零失败。检查 Git diff，确保没有改写扩展代码或非目标资产。
- [x] MCP 验证场景无断裂引用并确认 is_dirty:false；运行预览，读取控制台，确认启动校验日志且没有本次新增脚本错误。编辑器不可用时记录未验证，不声称通过。
- [x] 写 client/README.md：安装与 verify 命令、在 Creator 打开 client、启动 Bootstrap 场景、阶段边界和暂未锁定的玩法规则。
- [x] 输出变更、测试证据和限制。由于 Git 位于 client 内，根目录 docs 不在该仓库追踪范围；不自动移动仓库。提交时只精确暂存本阶段客户端文件，不能 git add . 混入已有 extensions/settings。提交不是本次阶段交付的必要条件。

## 执行方式建议

建议在当前会话由同一代理顺序执行：五项任务共享配置类型和校验接口，当前范围集中，串行执行便于调整契约。用户也可选择子代理分任务执行，额外增加独立上下文与审阅成本。

## 计划自检

已覆盖批准设计的目录边界、核心契约、配置格式、错误诊断、雷恩示例、引擎隔离、启动场景及验收。成长状态机与完整技能实现明确留在后续阶段；不将接口定义或示例配置表述为完整玩法实现。实际执行时逐项更新复选框与检查结果。
