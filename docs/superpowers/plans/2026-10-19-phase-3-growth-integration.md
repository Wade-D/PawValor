# PawValor 第三阶段第三步：成长战斗与雷霆剑雨实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 默认战斗真正提供中文升级选择、串行成长和下一等级免费组合，并可见地执行雷霆剑雨。

**Architecture:** GrowthSession负责成长事务及组合调度，新增纯核心GrowthCombatRun独占世界与成长会话。构筑在同步暂停边界应用，Cocos只提交命令及显示快照；旧Demo与五个效果预设继续回归。

**Tech Stack:** Cocos Creator 3.8.6、TypeScript 6.0.3、Node内置测试器，无新增运行时依赖。

**Spec:** [已批准的第三步规格](../specs/2026-10-18-phase-3-growth-integration-design.md)，用户于2026-10-19批准；规格优先于本计划。

## Global Constraints

- 使用 `D:\project\VibeCoding\PawValor`，当前 `codex/phase-3-growth-core` 分支与目录，顺序实施、最后一次独立审查。执行方式已选定，不重复询问。
- 文档前基线 `b3170be`，产品代码基线 `03d085c`，338项测试。每个功能先观察失败，再实现，再完整验证并精确暂存；中文提交日志。不自行合并或推送。
- 保留 `client/.creator`、`client/extensions`、`client/settings`。不手改 `.scene/.prefab/.meta`；新增元数据由Creator生成。
- 玩家文案和新代码注释用中文；核心禁止导入cc、DOM、Node、微信、适配层或配置目录。
- 默认成长模式：空构筑，通用/附魔/副机制均开放，每局两次刷新；11段每段5点经验，累计55点到12级封顶。旧诊断模式仍二级封顶，两者文案必须区分。
- 组合在前置满足的下一等级免费激活，不占选择/槽位/刷新；本级激活不递归激活其他组合，Lv.11自动事务也执行调度。12级新满足的组合保留待13级，显示本局封顶。
- 雷霆剑雨：雷恩+万剑流+雷附魔1级+攻击强化2级；保留普攻，每次主攻击另发四枚，夹角-18/-6/+6/+18度，每枚非暴击主伤害D的50%。来源synergy/depth1/共享主攻击root，独立attackId。
- 组合仅继承攻击伤害/尺寸/射程，效果与弹体白名单取交集；不暴击、不继承穿透增幅、不触发附魔/副机制/额外弹体/组合。弹体速度12、尺寸0.3×0.8、寿命1、基础穿透0。
- 旧弹体和灼烧保留发射/施加快照；应用保留生命比例与冷却。成长等待冻结全部模拟及伤害表现，清输入和固定步累积；手动继续不能绕过选择。
- 路线/分支/终极完整招式仍属于第四阶段，卡面明确说明；不新增品质、相关卡保底或路线权重策略，不扩展更多组合/英雄/存档/服务端。

## Review Focus

1. 一次经验跨Lv.10→12、同时组合激活与下张卡抽取失败：失败不得留下已经提交的等级、战斗属性或重复激活事件；见任务1/4回归。
2. 普攻、60%额外弹体与四枚组合剑气同一步命中：只生成一组组合，源/预算/伤害基准不串用，同敌人不双重死亡；见任务3回归。
3. 选卡刷新/重开/切模式之后旧按钮迟到，以及按住移动键选卡：旧令牌拒绝，选择不穿透到摇杆，关闭后需重新输入；见任务4/6及实际预览。
4. 世界已完成拾取后成长入账异常：经验留待重试、模拟停止、重试不重复入账，随机回调不能重入；见任务1/4回归。
5. 默认成长入口与五个诊断入口来回切换、累计经验已达12级但队列未提交：不显示错误等级/上限、不携带预设或旧组合；见任务4/6/7回归。

## File Map

以下路径相对 `client/`；`core/`、`config/`、`cocos/` 分别缩写 `assets/scripts/core/`、`assets/scripts/config/`、`assets/scripts/cocos/`。文档路径相对仓库根。

| 文件 | 责任 |
|---|---|
| 修改 core/build.ts、growth-model.ts、growth-session.ts | 成长事件、临时升级事务、组合激活提示、同步校验及提交钩子 |
| 新增 core/growth-synergies.ts | 组合前置扫描、历史pending处理、幂等；不执行攻击 |
| 修改 core/config.ts、validate-config.ts、combat-model.ts、combat-build.ts，config/raine.prototype.ts | 组合执行数据、编译能力、继承及数值预检 |
| 新增 core/combat-volley.ts，修改 core/demo-world.ts、demo-model.ts、contracts.ts | 扇形方向、组合弹体、来源名称、外部经验模式 |
| 新增 core/growth-combat-model.ts、growth-combat-run.ts | 纯核心协调层与快照/命令接口 |
| 新增 core/growth-presentation.ts，config/growth-copy.prototype.ts | 中文卡片/构筑视图；具体说明数据从配置注入 |
| 新增 cocos/GrowthChoicePanel.ts、GrowthPlaytestControls.ts | 模态选卡、构筑详情、提示、显式验收按钮 |
| 修改 cocos/CombatDemo.ts、CombatEffectPanel.ts、DemoInput.ts | 默认入口、六模式、输入阻断、组合颜色与伤害提示 |
| 新增 config/growth-playtest.prototype.ts | seed44及合法准备命令序列、测试参数 |
| 新增 tests/growth-synergies.test.mjs、growth-transactions.test.mjs、combat-synergy-config.test.mjs、combat-synergy.test.mjs、growth-combat-run.test.mjs、growth-presentation.test.mjs、growth-playtest.test.mjs | 各自模块的行为测试 |
| 新增 tests/helpers/growth-integration-fixtures.mjs，修改受影响的tests/*.typecheck.ts及历史契约测试 | 测试夹具与只读类型兼容；保留原行为约束 |
| README、客户端README、规格/本计划、docs/evidence/phase-3-growth-integration/ | 实际入口、截图、检查结果、设备边界及审查记录 |

## Shared Interfaces

1. 在build.ts定义SynergyActivatedEvent：`{type:'synergyActivated';targetLevel:number;synergyId:string;name:string}`；在growth-model.ts定义 `GrowthEvent = UltimateEvolutionEvent | SynergyActivatedEvent`。GrowthSession.grantXp及GrowthCommandResult.events改为readonly GrowthEvent[]；引用终极字段的消费者须先按type缩窄。
2. GrowthSnapshot新增 `activatingSynergyIds:readonly string[]`。build始终是已提交构筑；私有事务保存 `targetLevel` 和 `preparedBuild`，后者已激活本级历史组合，供候选/刷新使用；不作为public build发布。`GrowthSessionOptions.validateBuild?:(build:GrowthReadonly<BuildState>)=>void`、`commitBuild?:(build:GrowthReadonly<BuildState>)=>void`，默认均不提供。
3. 所有成长修改命令使用整个命令期间的重入锁。先完成全部临时调度/抽取、调用隔离快照的validateBuild，再在构筑变化时调用commitBuild，最后一次赋值提交会话数据；钩子不能重入。commitBuild契约为同步、原子：失败时不修改接收方；本项目只绑定已有原子DemoWorld.applyBuild。它后面不得再执行可能失败的抽取或外部回调。不承诺回滚任意第三方回调的副作用。
4. `prepareSynergyLevel(config:GameConfig, build:GrowthReadonly<BuildState>, targetLevel:number):{build:BuildState;events:readonly SynergyActivatedEvent[]}`；`queueEligibleSynergies(config:GameConfig, build:GrowthReadonly<BuildState>, eligibleAtLevel:number):BuildState`。二者深复制，配置顺序稳定，按pending/active去重；不消费随机数。初始化扫描level1，本级提交后再扫描；active必须是已满足前置的有效引用，pending等级必须是安全整数且activate=eligible+1。
5. attack-pattern.execution追加 `{kind:'synergy-volley';trigger:'on-fire';spreadDegrees:number;inheritance:ProjectileInheritance}`，保留extra-projectile原分支。`ResolvedSynergyVolley`包含synergyId、effectId、name、projectileCount、spreadDegrees、damageMultiplier、inheritance、projectile、policy。CompiledCombatBuild新增readonly synergyVolleys；只有active组合参与解析，不能把该execution误编译为额外弹体或普通天赋。
6. `volleyDirections(direction:Vec2,count:number,spreadDegrees:number):readonly Vec2[]`：归一化非零方向，count1取中心，其他均匀覆盖两端。count为1—64安全整数，spread为[0,360]有限数；64是单组执行预算上限，默认仍为4；非执行的规划攻击配置不受此新增执行能力限制。
7. DemoWorldOptions新增 `experienceMode?:'legacy'|'external'`，缺省legacy。external仍产xpPickup和移除球，但不调用applyDemoXp、不产旧levelUp、不截断拾取数量。DemoProjectileSnapshot.kind增加synergy；HitEvent和DamageRequest增加可选中文effectName，仅组合命中携带，旧事件形状不变。
8. `GrowthCombatRun(config:GameConfig,options:GrowthCombatRunOptions)`；options含heroId、levelCosts、rewards、seed?(默认1)、createGrowthRandom?:(seed:number)=>RandomSource、world?:Omit<DemoWorldOptions,'effects'|'experienceMode'|'seed'>。当前协调器与DemoWorld一致，只支持heroId='raine'，其他英雄在构造前明确拒绝，不能使用另一英雄成长搭配雷恩世界。内部开启全部三类天赋；成长种子`(seed ^ 0x85ebca6b) >>> 0`，工厂接收这个已派生seed，默认创建new SeededRandom；世界/暴击沿用旧独立源。
9. GrowthCombatRun提供 `start/pause/resume/reset():void`、`step(dt:number,input:Vec2):{combatEvents:readonly DemoEvent[];growthEvents:readonly GrowthEvent[]}`、`grantXp(amount:number):readonly GrowthEvent[]`、`retryGrowth():readonly GrowthEvent[]`、`select(token:GrowthToken,id:string):GrowthRunCommandResult`、`reroll(token:GrowthToken):GrowthRunCommandResult`、`snapshot():GrowthRunSnapshot`。grantXp合法数值入待入账队列后尝试处理；非法数值在排队前抛错。内部处理失败保存队列/旧选择及失败动作（经验入账、带原令牌的选择或刷新），发布error状态，不抛过渲染循环。retryGrowth重试该动作，成功后清除失败动作，重复重试无事件；reset清除它。
10. GrowthRunCommandResult为GrowthCommandResult或 `{ok:false;reason:'run-not-active'|'transaction-failed';message:string;events:readonly []}`。GrowthRunSnapshot递归只读，包含world、growth、pauseReason('none'/'manual'/'growth'/'error'/'ended')、queuedXp、error:string|null、inputRevision，以及experience `{total:number;current:number;nextCost:number|null;capped:boolean}`。current按已提交等级限在下一门槛内，55点待选时显示5/5及队列而非55/5；提交12级后nextCost=null。
11. 输入应清空的边界使inputRevision递增；选择成功即使还有下张卡也递增，旧令牌拒绝不递增。适配层发现revision变化便清输入/复位固定步；每个补步前检查运行资格。reset复位局内状态但inputRevision不回退，世界代次与会话令牌均递增。
12. GrowthCopyConfig、GrowthViewModel定义于core/growth-presentation.ts，config/growth-copy.prototype.ts导出growthCopyPrototype数据，核心不反向导入配置。GrowthCopyConfig定义中文天赋说明和路线/分支/终极说明，按配置引用，非硬编码算法。`presentGrowth(config:GameConfig,copy:GrowthCopyConfig,snapshot:GrowthRunSnapshot):GrowthViewModel`输出mode标题、HUD、cards、refresh可用状态、构筑明细、本级免费激活及error；卡含optionId/name/category/description/rankText。纯展示，不抽卡、不提交、不修改输入。

## Task 1：组合调度与可原子提交的成长事务

**Files:** 修改core/build.ts、growth-model.ts、growth-session.ts；新增core/growth-synergies.ts、tests/growth-synergies.test.mjs、tests/growth-transactions.test.mjs；更新受影响的类型测试。

**Interfaces:** 产出共享接口1—4。现有select/reroll/token调用方式保留，事件变为可辨识联合。事务开始激活仅存于preparedBuild及activatingSynergyIds，选择确认后才公开提交。

- [x] 写失败测试 `本级满足下级激活且普通选择不减少`：夹具组合仅要求attack-up1，2级取得后pending为eligible2/activate3；3级开始提示将激活、public active仍空；确认路线后active仅一项，组合事件仅一次，路线选择仍存在且不扣刷新。

  关键断言：`assert.deepEqual(snapshot.build.activeSynergyIds, [])`、`assert.deepEqual(snapshot.activatingSynergyIds, [synergyId])`；确认后按type筛事件，`assert.equal(activations.length, 1)`且`assert.equal(snapshot.rerollsRemaining, 2)`。
- [x] 写失败测试覆盖：初始化满足排2级；Lv.7/11激活，Lv.11自动提交后出现12级卡；activeA使B满足时B排下级而不当级激活；刷新/重复命令/多次grantXp(0)不重放事件；12级新满足保留13级pending；输入和快照不共享可变对象，reset清空。
- [x] 写失败测试 `激活后再抽卡失败整个命令不提交`：在10级临近11/12时注入先正常后抛错的随机源，产生11级组合/终极但12级抽取失败；检查原build、经验、token、刷新和commit钩子调用次数均不变，重试不重复激活。校验/commit钩子抛错同样不提交；两个钩子、随机回调中重入grant/select/reroll/reset均拒绝。
- [x] 执行 `npm.cmd test`，Expected：新增调度或钩子断言FAIL，既有测试仍可编译。
- [x] 实现临时事务、两个纯辅助函数及钩子提交顺序。为reroll使用preparedBuild，不能对已提交build重复激活。生成事件返回副本及所有可能失败工作均先完成，再调用原子commit钩子。
- [x] 执行 `npm.cmd run verify` 和根目录 `git diff --check`，Expected：全部PASS、无差异错误。
- [x] 精确暂存本任务文件，提交 `功能：按升级事务调度免费组合`。

## Task 2：雷霆剑雨执行配置与构筑编译

**Files:** 修改core/config.ts、validate-config.ts、combat-model.ts、combat-build.ts、config/raine.prototype.ts；新增core/combat-volley.ts、tests/combat-synergy-config.test.mjs；按联合类型更新既有消费者。

**Interfaces:** 产出共享接口5、6。原示例组合ID `test-thunder-sword-rain` 保留，中文名“雷霆剑雨”，usage仍test-only；原效果ID保留。新弹体ID `synergy-sword-rain`，新策略 `synergy-on-fire`。

- [x] 写失败测试：未active不编译；合法active且前置齐全时输出一组4枚、36度、0.5倍率、中文名；仅pending不提前执行。未知/重复active、active前置不满足、缺执行描述、错误movement/继承/策略、未知弹体、非法角度/数量均拒绝，规划路线仍通过结构验证。
- [x] 写失败测试：volleyDirections((1,0),4,36)角度为[-18,-6,6,18]、单位长度；单枚居中、非单位输入归一；零向量、NaN、Infinity、count0/65、spread361拒绝。编译预检组合伤害、尺寸及几何可达乘积溢出，不修改输入。

  关键断言：`assert.equal(compiled.synergyVolleys[0].projectileCount, 4)`、`assert.equal(compiled.synergyVolleys[0].damageMultiplier, 0.5)`；角度/浮点使用1e-9容差，不对核心伤害先取整。
- [x] 执行 `npm.cmd test`，Expected：新增能力缺失FAIL。
- [x] 实现数据、辅助几何与解析。新弹体为straight/12/0.3×0.8/1秒/基础穿透0，白名单仅伤害尺寸射程且两触发flag=false。策略direct/depth0/root1/cooldown0/targetInterval0。只有synergy-volley可作为本步active组合执行，普通天赋执行能力不得误认它。
- [x] 执行 `npm.cmd run verify` 及差异检查，Expected：PASS。
- [x] 精确暂存本任务文件，提交 `功能：配置并编译雷霆剑雨组合`。

## Task 3：组合弹体真实执行与旧行为兼容

**Files:** 修改core/demo-world.ts、demo-model.ts、contracts.ts、combat-model.ts；新增tests/combat-synergy.test.mjs。

**Interfaces:** 消费ResolvedSynergyVolley与volleyDirections，产出共享接口7中的事件/弹体扩展。发射组和直接伤害路径分清，组合使用统一dealDamage及扫掠/寿命/射程裁剪。

- [x] 写失败测试：合法构筑每次主攻击增加4枚、保留主弹；有extra-projectile时总计6枚且只发1组组合；D20→每枚10，攻击强化2的D24→每枚12，不取60%额外弹体D。四枚方向与ID正确，同根synergy/depth1、effectName中文。

  关键断言：`assert.equal(attacks.filter(e => e.source.sourceKind === 'synergy').length, 4)`，额外弹体夹具`assert.equal(attacks.length, 6)`，派生命中均`assert.equal(hit.critical, false)`及`assert.equal(hit.damage, 12)`。
- [x] 写失败测试：英雄100%暴击、穿透/附魔/副机制全具备时，组合仍不暴击、不消费暴击随机数、不穿透增幅、不触发元素或副机制/新组合；两层白名单交集各只继承一次；每枚可打同一存活目标但每枚只打一次，击杀只掉1球。无目标不补发，旧代次无伤害，应用后旧组合弹体保留快照。
- [x] 写失败测试：暂停及阵亡冻结；接触致死跳过组合发射；组内多个目标同一步交错死亡不影响剩余扫掠。组合根预算在最后弹体结束前保留，reset清空；原无effects与五个预设的事件/等级约束保持。
- [x] 执行 `npm.cmd test`，Expected：组合攻击缺失FAIL。
- [x] 实现on-fire的一次组触发，方向基于本次主攻击，伤害基于本次主弹体解析后的非暴击D。组合强制critical=false，只有kind=direct才能抽暴击及进入onDirectHit；根/策略与额外弹体独立，不新增每枚组合的递归触发。
- [x] 执行 `npm.cmd run verify` 及差异检查，Expected：PASS。
- [x] 精确暂存本任务文件，提交 `功能：执行雷霆剑雨扇形剑气`。

## Task 4：战斗成长协调、经验入账与暂停

**Files:** 新增core/growth-combat-model.ts、growth-combat-run.ts、tests/growth-combat-run.test.mjs、tests/helpers/growth-integration-fixtures.mjs；修改demo-world/model的experienceMode、growth-session钩子集成。

**Interfaces:** 实现共享接口7—11；只使用前述公开成长/战斗接口，世界和会话不暴露可写引用。协调层绑定validateBuild=compileCombatBuild、commitBuild=当前代次的world.applyBuild；XP处理前在同步边界暂停世界。

- [x] 写失败测试：external世界同一步拾取多个球按原值出xpPickup、无旧levelUp或5点截断；legacy仍二级封顶。协调层累计到5点出现三张卡、build仍1级、暂停后推进300步世界与表现时间不变；选择攻击强化后升级2且伤害22，经验继续到3级路线而不是封顶。
- [x] 写失败测试：grantXp(55)earnedLevel12但build1且显示5/5；逐项选择到12，11自动事件仅一次且12恢复普通卡。手动暂停与成长等待独立，“继续”不能跳选择；成功选择仍有队列时继续等待，最终按manual标志恢复。inputRevision只在有效边界递增，旧命令不改变。
- [x] 写失败测试：同一步拾取入账抽卡失败，世界已拾取但queuedXp保留、pauseReason=error；修复注入随机源后retry只入账一次，重复retry无事件；非法XP在排队前拒绝，有限大XP按剩余上限安全封顶。提交不支持/溢出构筑时成长与world不变，保留原选择。错误期间选择/继续不能绕过错误，可重开清空。

  选择或刷新异常也保留原动作，retryGrowth重试原令牌/选项；成功后清错误、按manual/待选状态决定是否恢复，失败则仍保留动作。关键断言：`assert.equal(snapshot.queuedXp, 5)`、`assert.equal(snapshot.pauseReason, 'error')`；成功重试后`assert.equal(snapshot.queuedXp, 0)`且xp只增加5。
- [x] 写失败测试：世界接触死亡不入后续XP；死亡后拒绝成长命令、不复活；保持生命比例、冷却与旧弹/灼烧；五次reset及新实例/旧token隔离；三类随机源独立，成长刷新不改变耐久敌人夹具的刷怪位置序列。构造配置/options及快照深复制，快照直接传给编译/候选的正向类型测试。
- [x] 执行 `npm.cmd test`，Expected：协调层缺失FAIL。
- [x] 实现队列饱和入账、同步暂停边界、错误捕获与重试。不要重复累计legacy经验，单个固定步完成后统一处理拾取，选择窗口期间不执行任何下一步。
- [x] 执行 `npm.cmd run verify` 与差异检查，Expected：PASS。
- [x] 精确暂存本任务文件，提交 `功能：将成长事务接入实际战斗`。

## Task 5：纯中文展示模型与原型说明

**Files:** 新增core/growth-presentation.ts、config/growth-copy.prototype.ts、tests/growth-presentation.test.mjs；扩展growth-combat-model.ts的展示类型；不导入引擎。

**Interfaces:** 实现共享接口12。GrowthViewModel至少含title、hud、cards、token、refresh `{visible,enabled,label}`、buildLines、activatingLines、error；只读数据。说明按实际配置值/本次等级变化生成，禁止显示代码ID或把未实现招式说成已生效。

- [x] 写失败测试：普通卡中文名/类别/当前→下一级/数值与三个不同optionId；奖励注明独立累计1%；满槽升级文案不再占槽。route3张、branch2张、固定节点无刷新；刷新0次禁用。构筑明细包含路线/分支、天赋等级、两附魔/两副机制、pending/active组合。
- [x] 写失败测试：万剑/回旋及分支/终极说明包含“招式效果在第四阶段实现”，雷霆固有雷与已执行组合说明准确；activating列表不伪装已active；12级pending13显示本局已封顶；经验55待选显示当前5/5、已提交1级及待处理数量，最终12级显示封顶。未知说明引用清楚拒绝，不显示undefined。
- [x] 执行 `npm.cmd test`，Expected：展示接口缺失FAIL。
- [x] 实现纯格式化和声明式中文说明。数值显示保留一位小数但不改核心精度，路线锁定/两次刷新/测试参数信息清楚。
- [x] 执行 `npm.cmd run verify` 和差异检查，Expected：PASS。
- [x] 精确暂存本任务文件，提交 `功能：提供中文成长卡片与构筑视图`。

## Task 6：默认成长入口、模态面板和合法验收入口

**Files:** 新增cocos/GrowthChoicePanel.ts、GrowthPlaytestControls.ts、config/growth-playtest.prototype.ts、tests/growth-playtest.test.mjs；修改cocos/CombatDemo.ts、CombatEffectPanel.ts、DemoInput.ts。

**Interfaces:** GrowthChoicePanel提供 `initialize(parent:Node, handlers:{select:(token:GrowthToken,id:string)=>void;reroll:(token:GrowthToken)=>void;restart:()=>void;retry:()=>void}):void`、`render(view:GrowthViewModel):void`、`consume(events:readonly GrowthEvent[],elapsedSeconds:number):void`、`clear():void`，销毁时释放节点和监听；通知保存队列，按模拟时间显示，跨下张选择不丢失。CombatEffectPanel.initialize追加可选onGrowth回调，提供第六模式按钮；clear仍只清动态效果。

GrowthPlaytestControls提供 `initialize(parent:Node,handlers:{prepare:()=>void;grantXp:(amount:number)=>void}):void`、`clear():void`；clear/销毁释放全部QA节点和监听，切入口后按需重新创建。处理器捕获当前入口代次，旧QA回调不能向新局注入经验。

DemoInput增加 `setGameplayBlocked(blocked:boolean):void`；阻断键盘/触摸移动，但保留R重开。进入阻断时记住尚未松开的移动键；阻断期间按下的移动键也必须等keyup后再接受，避免系统重复keydown在关卡面板关闭后恢复旧移动。触摸ID取消后旧MOVE/END不能重新驱动摇杆；失焦/销毁清理所有锁存状态。

`growth-playtest.prototype.ts`导出seed44、有限测试tuning与声明式命令序列：grantXp20、select talent:attack-up、select wanjian、reroll、select talent:attack-up、select talent:lightning-enchantment。`?growthFixture=sword-rain`才显示QA控件“准备组合前置 / 经验+5 / 经验+55”，准备会新建seed44局并执行该序列；不得直接写内部build/level/active。测试敌人位置(2,0)/(3,-1)/(3,1)，生命200、移速0、接触伤害0、生成间隔100秒；画面明示测试参数，默认不使用这些值。

- [x] 写失败测试：用公开协调接口执行上述序列后level5、攻击2、雷附魔1、路线万剑、pending6且无active；+5进入6级并提示免费激活，选择任一非攻击强化普通卡后active恰一次、有效D仍24；默认无脚本或注入XP。reset后再执行结果复现，旧令牌失效。
- [x] 执行 `npm.cmd test`，Expected：测试入口数据/脚本缺失FAIL。
- [x] 实现数据与可见控件。CombatDemo默认使用GrowthCombatRun；诊断模式仅使用原DemoWorld，不创建第二套成长状态。六模式切换、重开、销毁统一清理面板/伤害/输入/固定步；revision改变时立即复位，补步闭包每步先检查状态。
- [x] 构建三卡模态遮罩、两张分支卡、刷新、构筑详情和重开/重试；按钮捕获渲染时完整token，不能从最新快照补旧token。遮罩阻止背景按钮/摇杆，组件监听按场景生命周期移除。背景Graphics与文字Label使用独立节点，避免同节点多渲染组件冲突。
- [x] 接入青色synergy弹体，尺寸取snapshot；伤害提示优先event.effectName（雷霆剑雨），其余沿用中文来源。通知不依赖真实时间；面板错误保持冻结且显示中文可重试，固定节点不留可点击刷新。
- [x] 执行 `npm.cmd run verify` 及 `npx.cmd tsc --noEmit -p tsconfig.json --ignoreDeprecations 6.0 --skipLibCheck --lib ES2020,DOM`，Expected：PASS。
- [x] Creator导入新增脚本、生成meta且UUID唯一、场景引用有效，Expected：无新导入错误或损坏引用。
- [x] 精确暂存本任务文件，提交 `功能：接入中文选卡与成长试玩入口`。

## Task 7：浏览器验收、独立审查及交付

**Files:** Creator元数据、根/客户端README、规格状态与本计划、`docs/evidence/phase-3-growth-integration/`；实际问题在所属任务文件中修复。

**Interfaces:** 使用公开协调命令、中文面板和显式QA入口验收，不直接篡改内部状态。测试截图与代码记录放证据目录；临时执行日志使用本计划独有的忽略目录，最终清理不触碰第二步被Creator占用的日志或其他计划目录。

- [x] 默认入口实际击杀/拾取并看到2级三选一；选卡期间敌人/弹体/灼烧/显示冻结，普通“继续”无效；选完后伤害/属性变化且可以继续到3级路线。检查中文说明、刷新两次耗尽、固定节点不能刷新、生命格式与构筑详情。
- [x] QA入口点击准备前置，在5级看到pending6，注入+5后验证免费激活仍保留普通卡，选择后实际看到四枚青色剑气/中文伤害；全组与主/额外弹体共存，无递归触发。+55逐项处理到12，记录7分支、11终极一次提示、12封顶且无卡丢失；新局不继承经验或组合。
- [x] 桌面按住移动键进入选择、刷新后点击旧卡、重开后旧回调、手动暂停后选择、反复六模式切换均复查；不能通过桌面模拟宣布真机触控通过。若工具不能模拟某输入序列，记录该项未完成，继续其余验收。触屏按钮、摇杆、多点触摸、微信设备分别列已验/待验。
- [x] 保存关键截图及最终预览控制台记录，Expected：无新增脚本导入或浏览器异常；核对UUID唯一与三个本地目录。执行最终 `npm.cmd run verify`、适配器类型检查、`git diff --check`，Expected：全部PASS；不以纯核心测试代替画面。
- [x] 一次独立只读审查覆盖本计划代码范围、规格和五项Review Focus；base取任务1开始前的 `git rev-parse HEAD`，head取最终实现提交，不重复审查前两步已经交付的代码范围。先按用户后果分级，Critical/Important先失败测试再修，完整验证再绿；所有裁定及暂缓Minor留文档，不重复启动审查。若首选模型不可用，记录原因再使用可用独立审查模型，不把失败启动计作完成。
- [x] 更新文档、已验证/待验证、原型参数与第四阶段边界，并勾选本计划；精确暂存提交 `文档：记录第三步成长与组合验收结果`。保留当前分支与工作目录，不自行合并/推送；提供最终测试数量与真实预览证据。

## 计划自查与执行交接

任务1覆盖临时成长/组合事务；2—3覆盖配置和实际组合攻击；4连接拾取/暂停/原子应用；5—6覆盖中文界面、输入及显式测试入口；7覆盖画面、设备边界、审查与文档。共享接口已检查方向：核心不反向导入config，表现层不维护成长规则，组合命中不走direct派生链。

2026-10-19，使用既有编译产物只读验证seed44的正常抽卡序列：2级攻击、3级万剑、4级刷新一次后攻击、5级雷附魔；未修改产品代码。64枚单组执行预算、两钩子原子提交契约和blocked键需等松开，属于本计划明确的实现约束；默认四枚、伤害和玩法范围与批准规格一致。

2026-10-19，用户已批准并开始执行；任务1至7已完成，使用既定顺序实施与一次最终独立审查。364项测试、核心/适配器类型与边界检查通过，实际桌面预览和待验设备边界见 docs/evidence/phase-3-growth-integration/验收与审查.md。保留当前分支，未合并或推送。

验收复选框表示工作及结果记录完成；真实触控、微信设备、完整持续按键和迟到旧UI回调未实测，已按任务7要求列为待验。MCP专用场景验证受许可过期影响，本轮使用实际加载及静态引用检查，未将其冒充MCP验证器通过。证据和全部裁定见[验收与审查](../../evidence/phase-3-growth-integration/验收与审查.md)。
