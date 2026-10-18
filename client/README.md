# Pawvalor 客户端：战斗 Demo 与成长核心

使用 **Cocos Creator 3.8.6** 打开此 `client/` 目录。Git 根目录在上一级 `PawValor/`；批准设计位于 `docs/superpowers/specs/2026-10-16-phase-2-combat-demo-design.md`。

## 安装与检查

```powershell
npm.cmd ci
npm.cmd run verify
```

`verify` 执行纯核心类型检查、依赖边界检查及全部 Node 测试，输出位于忽略的 `.test-build/`。核心与配置不依赖 Cocos、微信、DOM 或 Node API。

## 战斗预览

1. 等待 Creator 导入，打开 `assets/scenes/CombatDemo.scene`，运行当前场景浏览器预览。
2. 点击 **开始**；使用 **暂停 / 继续 / 重开** 控制战局。
3. **WASD / 方向键** 移动，**R** 重开。左下区域触摸并拖动提供虚拟摇杆方向；活动触摸优先于键盘，失焦/触摸取消清空输入。
4. 蓝色圆为雷恩、红色圆为敌人、金色短条为剑气、绿色圆为经验。靠近经验球拾取，累计 5 点达到 Lv.2 Demo 上限。死亡后重开。

1280×720 设计分辨率，64 像素/世界单位；核心固定 1/60 秒，每帧最多补进 5 步，超出时间丢弃并输出诊断。界面显示生命、等级、经验、击杀、模拟时间和状态。战斗开始前校验配置；失败时界面显示中文提示，控制台记录详细错误并禁止启动。

`CombatDemo` 检查器绑定 World、Hud、Status、Joystick 和 Knob，四个按钮绑定对应方法。图形节点由运行时生成，按实体 generation/ID 同步并在重开/销毁时清理。场景与 `.meta` 只通过 Creator/MCP 修改，保留生成的 UUID。玩家可见文案与第二阶段代码注释使用中文。

## 已验证与待测

2026-10-17，Creator 3.8.6 + 桌面 Edge 预览：场景引用校验通过、保存干净、没有脚本/import 或浏览器异常；实际按钮点击与键盘移动/R 重开通过。真实适配器加速固定步验证自动攻击、命中、击杀、拾取、Lv.2 封顶、接触死亡、暂停/死亡冻结及五次重开无旧节点。加速验证通过直接提供移动意图驱动适配器，不代表完整人工游玩或触摸手感验收。

`npm.cmd run verify`：244 个测试通过。额外适配器类型检查：`npx.cmd tsc --noEmit -p tsconfig.json --ignoreDeprecations 6.0 --skipLibCheck --lib ES2020,DOM` 通过。2026-10-18 补验了 `R` 长按防重复和失焦后重新按键；失焦时移动输入与重开键锁定均会清空。直接运行未覆盖参数的 Creator 项目 tsc 会出现引擎声明及默认 lib 不匹配错误；正式验收以核心检查与 Creator 实际导入/预览为依据。

**待手动验证：中文文案在实际预览中的显示、真实触屏摇杆、多点触摸与目标微信设备。** 中文文案写入后场景引用校验通过，但截图时 Cocos MCP 连接中断，未完成新的视觉复查。桌面截图不作为微信真机 FPS 或性能结论。测试证据放在当前计划忽略目录 `.superpowers/sdd/phase-2-combat-demo/`。

## 阶段 1 诊断入口

`assets/scenes/Bootstrap.scene` 保持配置诊断用途，不启动战斗。预览显示并输出 **Pawvalor：配置校验通过（测试参数）**；该回归检查已通过。失败时控制台包含错误代码、路径和说明。

## 第三阶段第一步：成长核心

`GrowthSession` 提供独立于场景的纯 TypeScript 成长规则，**尚未接入战斗 Demo 与选卡界面，也不执行已选天赋或进化的战斗效果**。

- 普通升级先过滤前置、满级与互斥，再按正权重不放回抽三张不同卡；本步仅开放通用天赋。
- 每局两次普通刷新，允许再次出现相同卡组；Lv.3 主路线、Lv.7 当前路线分支不能刷新；Lv.11 自动记录终极并返回一次事件。
- 合法候选不足三张时，补入独立基础攻击、生命、移速强化卡，各记录基础值 +1% 的次数，可跨升级重复获取，不占用或突破普通天赋等级。
- 原型从 Lv.1→2 至 Lv.11→12 每级需要 5 点经验，55 点封顶。一次经验跨多级也逐项等待选择，经验达到等级与构筑提交等级分别记录。
- 选择与刷新需要完整令牌，旧卡、旧局与跨实例命令被拒绝。异常抽取保留原状态和次数，但外部随机源已经调用的次数不会回滚。

以下为开发期规则演示，自动选择首项；正式界面需由玩家提交选择。成长随机源独立创建，避免选卡影响战场刷怪随机序列。

```typescript
import { GrowthSession } from './assets/scripts/core/growth-session';
import { SeededRandom } from './assets/scripts/core/demo-world';
import { rainePrototypeConfig } from './assets/scripts/config/raine.prototype';
import { growthPrototype } from './assets/scripts/config/growth.prototype';

const growth = new GrowthSession(rainePrototypeConfig, {
  heroId: 'raine',
  random: new SeededRandom(42),
  levelCosts: growthPrototype.levelCosts,
  rewards: growthPrototype.rewards,
});
growth.grantXp(55);
while (true) {
  const snapshot = growth.snapshot();
  const choice = snapshot.growth.pendingChoice;
  if (!choice || !snapshot.token) break;
  const optionId = choice.kind === 'ordinary' ? choice.options[0].id
    : choice.kind === 'route' ? choice.routeIds[0] : choice.branchIds[0];
  const result = growth.select(snapshot.token, optionId);
  if (!result.ok) throw new Error(result.message);
  for (const event of result.events) console.info('自动终极进化', event);
}
// 新局必须显式提供新建或复位的成长随机源。
growth.reset(new SeededRandom(42));
```

普通卡 ID 带 `talent:` 或 `reward:` 前缀，固定选择直接使用路线/分支 ID。`snapshot.build.level` 是已提交等级，`snapshot.earnedLevel` 是经验可达等级。未来接入适配层时，存在待选项或待处理等级就应冻结战斗模拟，并在选择完成后重置固定步累积与移动输入。

2026-10-18，`npm.cmd run verify`：**287 项测试通过**，包括类型和依赖边界检查；覆盖六条路线/分支进化路径、Lv.12 普通升级、兜底、异常事务回滚、快照/配置隔离及重开。既有 244 项测试保留。原型曲线及 1% 奖励未经平衡验证。

**Creator 资产导入：** 2026-10-18，Creator 3.8.6 已完成资产数据库初始化并生成全部六个新脚本的 `.meta`；导入标记与全部 26 个资源 UUID 唯一性检查通过，既有元数据无改动。启动日志仍记录用户配置 `window.json` 含空字节的解析异常，但未阻止本次资产导入；未手动修改该全局配置。MCP 插件本轮离线许可检查通过。以上不替代中文画面、触控和微信设备验收。

## 原型边界

当前只实现雷恩移动、自动直线剑气、敌人追击/接触伤害、击杀经验和 Lv.2 封顶。所有数值为测试参数；色块不代表正式伪 45° 美术。未实现暴击、天赋、路线/分支/终极、元素、组合、Boss、正式地图、服务端或上线资源。Lv.3 不会进入。

第三阶段后续仍需确定元素占槽策略、属性合并和战斗经验曲线；示例 `elementPolicy` 不代表正式默认规则。第一步的兜底和经验曲线仅用于独立成长原型；本节战斗 Demo 仍为 Lv.2 封顶。
