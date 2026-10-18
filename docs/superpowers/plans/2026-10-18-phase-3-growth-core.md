# PawValor 第三阶段第一步：成长核心实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 实现可独立测试的经验、普通三选一、刷新与 Lv.3/7/11 固定进化成长核心。

**Architecture:** 延续纯 TypeScript 核心，通过注入配置、经验曲线与随机源运行串行成长事务。合法性与抽取分开，命令结果返回事件，快照隔离内部数据；本步不接入战斗及 Cocos 界面。

**Tech Stack:** TypeScript 6.0.3、Cocos Creator 3.8.6 工程、Node 内置测试器；不新增依赖。

**Spec:** [已批准设计](../specs/2026-10-18-phase-3-growth-core-design.md)。执行者须同时阅读设计和本计划。

## Global Constraints

- 项目根目录 `D:\project\VibeCoding\PawValor`；代码、测试和工程均在 `client/`，文档在根目录 `docs/`。
- 工作分支 `codex/phase-3-growth-core`；不得自行合并。保留 `client/.creator`、`client/extensions`、`client/settings` 本地未跟踪目录；精确暂存任务文件，禁止 `git add .`。
- 核心不依赖 `cc`、Node、DOM、微信或适配层；使用现有 `GameConfig`、`BuildState`、`RandomSource`、`UltimateEvolutionEvent`。
- 玩家可见名称、拒绝提示、新写代码注释和 Git 提交日志使用中文。
- 仅开放 `general` 分类；不执行属性、路线攻击、元素、副机制及组合调度，不修改 `DemoWorld`、`CombatDemo`、原战斗经验封顶或 `.scene`。
- 普通选择三张不同卡；先过滤再按正权重抽取。原型刷新两次，可再次抽到相同卡；固定节点不能刷新。
- 兜底三种奖励各增加未修饰基础攻击伤害、最大生命或移速的 1%，只累计次数，不突破普通天赋上限。本步不执行属性变化。
- 原型曲线为 11 个值 5，累计 55 点达到 Lv.12；曲线可注入且至少覆盖 Lv.11。经验封顶仍须处理已有队列。
- 新资产脚本通过 Creator 导入生成 `.meta`，保留 UUID；不手写序列化场景或伪造导入结果。
- 每项功能按失败测试→最小实现→通过检查推进。测试在 `client/` 执行；Git 命令在项目根目录执行。已有同版本依赖可直接复用。

## Review Focus

1. 两个有限数相加可能溢出，极小经验阈值也可能因舍入无法递增：封顶采用剩余量比较，拒绝无严格递增累计门槛的曲线（任务 1）。
2. 共享互斥标签会误杀已拥有天赋的自身升级：只比较其他已拥有天赋；合法性判断不得消费随机数（任务 2）。
3. 随机源返回非法值或刷新抽取中途失败：内部事务完整回滚，旧选择和刷新次数保留；不承诺回滚外部随机源（任务 3、4）。
4. 单次经验直达 Lv.12 容易跳过固定节点：逐项提交，Lv.11 自动事件只产生一次，Lv.12 恢复普通选卡（任务 3）。
5. 同版本跨实例命令、重开旧令牌及外部对象修改：会话隔离、局次与版本校验、配置深复制和快照分离（任务 4）。

## File Map

| 创建或修改 | 责任 |
|---|---|
| 修改 `client/assets/scripts/core/build.ts` | 扩展普通选项类型、奖励次数、终极记录；保留既有组合字段 |
| 创建 `client/assets/scripts/core/growth-model.ts` | 成长令牌、快照、命令结果、拒绝原因与经验进度类型 |
| 创建 `client/assets/scripts/core/growth-experience.ts` | 校验经验曲线、累计门槛与封顶经验运算 |
| 创建 `client/assets/scripts/core/growth-candidates.ts` | 前置、分类、满级和互斥过滤；只返回纯数据 |
| 创建 `client/assets/scripts/core/growth-draw.ts` | 加权不放回抽取与独立奖励补齐 |
| 创建 `client/assets/scripts/core/growth-session.ts` | 队列、选择、刷新、固定进化、命令事务与重置 |
| 创建 `client/assets/scripts/config/growth.prototype.ts` | `calibration: 'prototype'` 成长曲线与原型奖励数据 |
| 修改 `client/tests/contracts.typecheck.ts` | 适配构筑/普通选择的显式契约变更 |
| 创建 `client/tests/growth-*.test.mjs` | 经验、候选、抽样、会话、隔离与生命周期验收 |
| 创建 `client/tests/helpers/growth-fixtures.mjs` | 从现有雷恩配置克隆测试数据、可计数序列随机源 |
| 修改 `client/README.md`、根 `README.md` | 成长核心使用示例、实测结果与本步交付边界 |

## 共享接口决策

`build.ts` 增加 `GrowthRewardId = 'base-attack' | 'base-health' | 'base-move-speed'`、`BonusRewardCounts = Record<GrowthRewardId, number>`。`BuildState` 增加必填 `bonusRewardCounts` 与 `ultimateEvolution: UltimateEvolutionEvent | null`，同步修改已有类型测试夹具。`PendingGrowthChoice` 的普通分支改用 `options: GrowthOption[]`，替代 `talentIds`；其他分支保留现有 routeIds/branchIds。

`GrowthOption` 是 `{ kind: 'talent'; id: string; talentId: string; name: string } | { kind: 'reward'; id: string; rewardId: GrowthRewardId; name: string; description: string }`。普通选项 ID 用 `talent:${talentId}` 或 `reward:${rewardId}`，避免奖励与天赋同名碰撞；固定选择的选项 ID 直接使用路线/分支 ID。

`growth-model.ts` 定义：

- `GrowthToken = { sessionId: number; generation: number; revision: number }`。
- `ExperienceProgress = { xp: number; earnedLevel: number; xpCapped: boolean }`；earnedLevel 为经验可达等级，build.level 为已提交等级。
- `GrowthReadonly<T>` 为递归只读映射类型。
- `GrowthSnapshot = GrowthReadonly<{ build: BuildState; growth: GrowthState; xp: number; earnedLevel: number; xpCapped: boolean; rerollsRemaining: number; token: GrowthToken | null }>`。
- `GrowthRejection = 'no-choice' | 'stale-token' | 'invalid-option' | 'fixed-node' | 'no-rerolls'`。
- `GrowthCommandResult = { ok: true; events: readonly UltimateEvolutionEvent[] } | { ok: false; reason: GrowthRejection; message: string; events: readonly [] }`。
- `GrowthRewardConfig = { id: GrowthRewardId; name: string; description: string; stat: 'attackDamage' | 'maxHealth' | 'moveSpeed'; baselineFraction: 0.01 }`。
- `GrowthSessionOptions = { heroId: string; random: RandomSource; levelCosts: readonly number[]; rewards: readonly GrowthRewardConfig[] }`。reset 需要调用方显式提供新局随机源。奖励表也通过参数注入，核心不得反向导入 `config/growth.prototype.ts`。

## Task 1：构筑契约与经验运算

**Files:** 修改 `core/build.ts` 与 `tests/contracts.typecheck.ts`；创建 `core/growth-model.ts`、`core/growth-experience.ts`、`config/growth.prototype.ts`、`tests/growth-experience.test.mjs`（均相对 `client/`）。

**Interfaces:** `experienceThresholds(levelCosts: readonly number[]): readonly number[]` 返回从 Lv.2 开始的累计门槛；`applyExperience(xp: number, amount: number, thresholds: readonly number[]): ExperienceProgress`。`growthPrototype` 导出只读对象，字段为 calibration、levelCosts、rewards；rewards 每项包含 id、中文 name/description、stat（attackDamage/maxHealth/moveSpeed）及 `baselineFraction: 0.01`。

- [x] 写失败测试：11 项 5 得到 `[5,10,15,20,25,30,35,40,45,50,55]`；4 点为 Lv.1，5 点为 Lv.2，55 点为 Lv.12；54 加 `Number.MAX_VALUE` 饱和为 55；0.25+0.25 得 0.5。测试变更阈值 `[1,2,3,4,5,6,7,8,9,10]`，累计 55 得 Lv.11。验证空/不足十项、0/负数/NaN/Infinity、累计溢出或舍入不递增曲线，以及非法经验输入被拒绝。
- [x] 执行 `npm.cmd test`，确认失败来自缺失新 API 或新契约，而非既有测试异常。
- [x] 实现共享类型、原型常量与上述两个函数；累计门槛必须有限且严格递增，经验饱和先比较剩余量以避免加法溢出；不复用或修改第二阶段 `applyDemoXp`。更新已有构筑夹具的新增字段和普通选项表示，新增类型测试验证奖励不能伪装天赋、快照嵌套字段不可赋值。
- [x] 执行 `npm.cmd run verify`；预期核心类型、边界及所有测试通过。按新文件清单检查导入后的 `.meta`，只暂存本任务文件。
- [x] 中文提交：`功能：定义成长构筑契约与经验规则`。

## Task 2：前置过滤与三选一抽取

**Files:** 创建 `core/growth-candidates.ts`、`core/growth-draw.ts`、`tests/growth-candidates.test.mjs`、`tests/growth-draw.test.mjs`、`tests/helpers/growth-fixtures.mjs`。

**Interfaces:** 消费 Task 1 的 `GrowthOption` 与 `BuildState`。导出 `meetsPrerequisites(requirements: readonly BuildPrerequisite[], build: GrowthReadonly<BuildState>): boolean`；`evaluateTalent(talent: TalentConfig, config: GameConfig, build: GrowthReadonly<BuildState>): { eligible: boolean; reasons: readonly TalentRejection[] }`，其中 `TalentRejection = 'unsupported-category' | 'prerequisites' | 'max-level' | 'exclusive'`；`eligibleTalents(config: GameConfig, build: GrowthReadonly<BuildState>): readonly TalentConfig[]`；`drawOrdinaryOptions(candidates: readonly TalentConfig[], random: RandomSource, rewards: readonly GrowthRewardConfig[]): readonly GrowthOption[]` 固定返回三项，不改输入。

- [x] 写失败测试：逐一验证 hero/talent/route/branch/synergy 前置和 AND 关系；满级、分类与互斥排除，自身升级允许；过滤前后随机调用计数均为零。候选结果顺序与配置一致。
- [x] 写失败测试：权重 `[1,3]` 的边界随机数 0、0.249999、0.25、接近 1 确认先抽对应区间；四个正权重天赋选三项且不重复；零权重永不抽中；负数/非有限权重明确拒绝；`Number.MAX_VALUE` 权重组合不溢出；固定序列结果一致。候选足够时不混入奖励。
- [x] 写失败测试：0/1/2 个正权重候选分别补 3/2/1 种不同奖励；保留全部可抽天赋；补齐等概率不放回且名称中文；同一个候选 ID 重复输入、随机数 -0.1/1/NaN/Infinity 被拒绝，输入数组不变。测试辅助模块导出 `fixtureConfig(): GameConfig`（运行时为深复制）与 `sequenceRandom(values)`（返回 random 与调用次数读取器）。
- [x] 执行 `npm.cmd test`，确认上述失败，再实现接口。抽取每轮用当前最大权重归一化后求和，按配置顺序遍历区间，移除抽中项后重新归一化；舍入边界回退到最后一个正权重项。奖励数据由测试/调用方传入原型表；不在过滤层读取随机源。拒绝缺项、重复 ID、未知 ID、空中文显示字段或数值/属性与规定不匹配的奖励表，并添加对应失败测试。
- [x] 执行 `npm.cmd run verify` 与任务文件差异检查，通过后精确暂存并中文提交：`功能：实现天赋前置过滤与三选一抽取`。

## Task 3：串行成长会话与固定进化

**Files:** 创建 `core/growth-session.ts`、`tests/growth-session.test.mjs`；复用并按需补充测试辅助模块。

**Interfaces:** 消费任务 1、2 接口和现有 `validateGameConfig`。导出 `class GrowthSession`：`constructor(config: GameConfig, options: GrowthSessionOptions)`、`grantXp(amount: number): readonly UltimateEvolutionEvent[]`、`select(token: GrowthToken, optionId: string): GrowthCommandResult`、`reroll(token: GrowthToken): GrowthCommandResult`、`snapshot(): GrowthSnapshot`、`reset(random: RandomSource): void`。新会话构筑等级 1、无路线/分支/终极、奖励次数全零、队列空，刷新数来自配置。

- [x] 写失败测试：grantXp(5) 出现 Lv.2 普通选择但构筑仍为 Lv.1；有效选择才升级并增加天赋等级或奖励次数；非当前卡拒绝。pendingChoice 保留在队首，选择提交才移除；待选期间增加经验只扩充目标队列。
- [x] 写失败测试：一次 grantXp(55) 后逐级选择，实际处理顺序为 `2,3,4,5,6,7,8,9,10,11,12`；Lv.3 三路线，Lv.7 当前路线两分支，Lv.11 无选卡且返回一次包含正确 effectId/ultimateBehaviorEffectId 的事件，下一选择为 Lv.12 普通卡。分别遍历三条路线与各自两分支，覆盖六条固定进化路径。
- [x] 写失败测试：刷新两次后拒绝第三次；固定节点拒绝刷新且次数保留；随机源恒为零可重复抽到同样三张，仍更新版本并扣一次。创建清空组合示例的合法配置夹具，再将通用天赋 maxLevel 调为 1，避免原组合 minLevel 为 2 导致配置不合法；跨多个普通升级取同一种兜底，奖励次数增加但普通天赋不越级。
- [x] 写失败测试：重复/旧版本令牌拒绝；无选择命令明确拒绝；终极不被 snapshot、重复提交或零经验重放。未知英雄、无效配置、非法曲线阻止初始化，grantXp 非法数值不改变会话。
- [x] 执行 `npm.cmd test` 确认失败，再实现会话。每条命令先在临时状态中完成经验、选择生成和自动节点推进，全部成功才提交内部状态及事件；普通操作错误返回中文类型化拒绝，配置/数值/随机源异常抛明确错误。按 `no-choice → stale-token → 节点/次数/选项校验` 的顺序拒绝命令。构筑变更只由会话负责。
- [x] 执行 `npm.cmd run verify`，通过后精确暂存并中文提交：`功能：实现串行升级与固定进化事务`。

## Task 4：会话隔离、重置与异常事务保护

**Files:** 修改 `core/growth-session.ts`；创建 `tests/growth-isolation.test.mjs`、`tests/growth-lifecycle.test.mjs`。

**Interfaces:** 保持任务 3 API；令牌包含会话标识、局次、选择版本。snapshot 返回的数组、字典、令牌和终极记录都与内部对象分离；配置在构造时深复制。reset 接受调用方已创建/复位的随机源。

- [x] 写失败测试：两个实例均处 Lv.2、相同局次与版本时，互相令牌仍被拒绝；同实例重开后拒绝旧令牌；重置两次后清空经验、构筑、奖励、队列、终极并恢复刷新次数。相同初始随机序列重开后卡组一致。
- [x] 写失败测试：修改快照嵌套的 talentLevels、bonusRewardCounts、pendingChoice.options、固定节点数组、队列、token 和 ultimateEvolution，后续快照不变；修改构造传入的英雄/天赋/路线/分支/效果/前置/权重、经验列表及奖励表不影响会话。
- [x] 写失败测试：注入“抽取到第二张时返回 NaN/抛错”的随机源，reroll 失败后 snapshot 与之前完全相同，次数不扣；grantXp 初次建卡失败不增加经验；select 成功选项随后推进下一普通节点时随机失败，整个 select 回滚且旧令牌仍有效。允许外部随机源调用计数改变，不对此作回滚断言。
- [x] 写失败测试：零经验与封顶后继续获得经验不创建重复队列；待处理队列未清空时封顶仍逐级完成；用配置 ID `__proto__` 作为天赋 ID 时能准确记录和升级，字典原型不被修改。
- [x] 执行 `npm.cmd test` 确认缺陷对应失败，再补齐隔离与保护：模块内单调分配会话 ID，重置递增 generation，选择每次发布递增 revision；达到非安全整数前明确拒绝，避免复用。内部字典使用 Map 或无原型对象并通过自有键读取；对外依契约返回普通数据快照。
- [x] 执行 `npm.cmd run verify`，通过后精确暂存并中文提交：`功能：保护成长会话隔离与重置状态`。

## Task 5：资产导入、使用文档与全分支验收

**Files:** 新脚本对应 `.meta`、`client/README.md`、根 `README.md`、本计划的任务勾选；按审查发现修改任务所属文件。

**Interfaces:** 文档示例使用 `new GrowthSession(rainePrototypeConfig, { heroId: 'raine', random, levelCosts: growthPrototype.levelCosts, rewards: growthPrototype.rewards })`，读取 snapshot.token 和待选项后调用 select；示例说明普通选项 ID 与固定路线/分支 ID 的区别。

- [x] 用 Creator 3.8.6 导入新增资产脚本，核对新脚本 `.meta` 均存在、importer 为 typescript 且 UUID 全局唯一；既有资源 UUID 不变。若许可或 MCP 连接阻塞，继续完成纯核心验收，将资产导入明确记录为未通过项，不报告第一步全部验收完成。
- [x] 更新两处 README：说明新增成长核心与现有 Lv.2 战斗 Demo 的不同状态，给出使用示例、两次刷新、1% 兜底、固定节点、55 经验原型封顶和实测测试数；保留现有中文画面/触控/微信待测记录。
- [x] 在 `client/` 执行 `npm.cmd run verify` 并检查退出码、测试总数和零失败；在项目根执行 `git diff --check`，确认改动没有触及原战斗及本地未跟踪目录。只在修复带来新改动或新风险时重复相关验证。
- [x] 按执行方法安排独立全分支审查，重点检查事务回滚、极端权重、固定节点与令牌隔离；将可证实问题补充回归测试后修复。审查完如有代码修改，再跑完整 verify。
- [x] 精确暂存文档、生成的资产元数据和任务状态，中文提交：`文档：补充成长核心使用与验证记录`。报告最终提交、验证结果和仍待测项；集成动作由用户决定。

## 执行前状态与选择

本计划编写前，分支已有设计提交 `9fe7897`，产品代码未修改；此前完整基线验证为 244 项通过。本轮仅编写和检查文档，不将此前测试结果算作新实现验证。

建议由当前会话在现有分支和工作目录逐项执行，最后独立全分支审查：五项任务依赖共享类型与事务接口，顺序实现可以减少交接成本。也可选择每项由子代理实现并单独审查，代价是更多独立上下文。用户须先审阅本计划并选定执行方式；未经选择不启动实现或子代理。

## 执行结果与裁定

用户选择当前会话在现有分支及目录顺序实现，五项任务均已完成。最终 `npm.cmd run verify`：287 项通过（原有 244 项、新增成长测试 43 项）；适配器类型检查、README 示例执行、Creator 六个元数据导入及全部 26 个资源 UUID 唯一性检查通过。

独立审查为一次全分支审查：Critical 无，Important 一项（公开查询的浅只读类型无法接收构筑快照），Minor 无。已添加三条正向类型回归，确认 TS2345 失败后将查询参数改为递归只读，完整验证再次通过。没有遗留审查问题。

实现裁定及代价：

- Windows 下用 PowerShell 等价维护执行记录，放在已有忽略规则的 `client/.superpowers/sdd/`；只改变临时记录位置，不改变产品行为。
- 基础隔离与回滚随任务 3 事务实现落地，任务 4 验收并修复随机回调重入；抽卡期间重入写命令明确报错，快照读取仍允许。
- 查询构筑参数由浅只读改为递归只读，允许直接接收公开快照；只放宽可接受的输入类型，无运行时变化。
- 属性执行、战斗暂停接入、元素/副机制/组合按已批准后续步骤交付；当前战斗仍为第二阶段 Demo。
- 平衡性、中文画面、触控与微信表现不从核心测试推断；后续仍需实际设备与玩法数据。
- 外部随机源异常后的状态不回滚，只保证会话内部原子性；复现重试须提供相同随机源状态。

Creator 起初因沙箱启动失败，正常启动后完成导入。用户 `window.json` 解析异常未阻止导入，未手动改全局配置。新增 `client/tests/growth.typecheck.ts` 验证只读契约及公开查询兼容性。用户指定的本地未跟踪目录全部保留，分支保留供后续工作。
