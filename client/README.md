# Pawvalor 客户端

使用 **Cocos Creator 3.8.6** 打开此 `client/` 目录（Git 根目录在上一级 `PawValor/`）。当前内容为阶段 2 战斗 Demo，设计见 [阶段 2 设计](../docs/superpowers/specs/2026-10-16-phase-2-combat-demo-design.md)，全部文档见[文档索引](../docs/README.md)。

## 安装与检查

```bash
npm ci
npm run verify
```

Windows PowerShell 下使用 `npm.cmd ci` / `npm.cmd run verify`。

`verify` 依次执行纯核心类型检查、依赖边界检查和全部 Node 测试，编译输出位于被忽略的 `.test-build/`。核心与配置不依赖 Cocos、微信、DOM 或 Node API。

## 目录

| 路径 | 说明 |
|---|---|
| `assets/scripts/core/` | 纯 TS 核心：契约、配置类型与校验、Demo 世界模拟、几何、成长、固定步 |
| `assets/scripts/config/` | 雷恩 `prototype` 测试配置 |
| `assets/scripts/cocos/` | Cocos 适配层：`Bootstrap`、`CombatDemo`、`DemoInput` |
| `assets/scenes/` | `Bootstrap.scene`（配置诊断）、`CombatDemo.scene`（战斗 Demo） |
| `tests/` | Node 测试与编译期契约断言 |
| `tools/` | 核心依赖边界检查 |

## 战斗预览

1. 等待 Creator 导入，打开 `assets/scenes/CombatDemo.scene`，运行当前场景浏览器预览。
2. 点击 **开始**；使用 **暂停 / 继续 / 重开** 控制战局。
3. **WASD / 方向键** 移动，**R** 重开。左下区域触摸拖动为虚拟摇杆；活动触摸优先于键盘，失焦或触摸取消时清空输入。
4. 蓝色圆为雷恩、红色圆为敌人、金色短条为剑气、绿色圆为经验。靠近经验球拾取，累计 5 点达到 Lv.2 上限。死亡后重开。

技术参数：

- 1280×720 设计分辨率，64 像素 = 1 世界单位。
- 核心固定步 1/60 秒，每帧最多补进 5 步，多余时间丢弃并输出诊断。
- HUD 显示生命、等级、经验、击杀、模拟时间和状态。
- 战斗开始前校验配置；失败时界面显示中文提示，控制台记录详细错误并禁止启动。

## 场景与编辑约定

- `CombatDemo` 检查器绑定 World、Hud、Status、Joystick 和 Knob，四个按钮绑定对应方法。
- 图形节点由运行时生成，按实体 generation/ID 同步，重开或销毁时清理。
- `.scene`、`.prefab`、`.anim`、`.meta` 只通过 Creator / Cocos MCP 修改，保留生成的 UUID，不手写序列化资产。
- 玩家可见文案与阶段 2 代码注释使用中文。

`assets/scenes/Bootstrap.scene` 保持阶段 1 配置诊断用途，不启动战斗：通过时显示 **Pawvalor：配置校验通过（测试参数）**；失败时控制台输出错误代码、路径和说明。

## 验证记录

已通过：

- `npm run verify`：244 个测试全部通过（2026-10-18，2026-11-23 复核）。
- 适配器额外类型检查：`npx tsc --noEmit -p tsconfig.json --ignoreDeprecations 6.0 --skipLibCheck --lib ES2020,DOM`。直接运行未加参数的 Creator 项目 tsc 会出现引擎声明与默认 lib 不匹配错误；正式验收以核心检查与 Creator 实际导入/预览为准。
- 2026-10-17，Creator 3.8.6 + 桌面 Edge 预览：场景引用校验通过、保存干净，无脚本/import 或浏览器异常；按钮点击、键盘移动、R 重开通过。
- 真实适配器加速固定步验证：自动攻击、命中、击杀、拾取、Lv.2 封顶、接触死亡、暂停/死亡冻结，五次重开无旧节点。该验证直接提供移动意图驱动适配器，不代表完整人工游玩或触摸手感验收。
- 2026-10-18 补验：`R` 长按不重复触发；失焦时移动输入与重开键锁定均清空，重新按键正常。

**待手动验证：**

- 中文文案在实际预览中的显示（写入后场景引用校验通过，但截图时 MCP 连接中断，未完成视觉复查）。
- 真实触屏摇杆与多点触摸。
- 微信目标设备；桌面截图不作为真机 FPS 或性能结论。

测试证据存放在被忽略的 `.superpowers/sdd/phase-2-combat-demo/`。

## 原型边界

当前只实现雷恩移动、自动直线剑气、敌人追击与接触伤害、击杀经验和 Lv.2 封顶，不会进入 Lv.3。所有数值为测试参数；色块不代表正式伪 45° 美术。

未实现：暴击、天赋、路线/分支/终极、元素、组合、Boss、正式地图、服务端及上线资源。阶段 3 前需锁定的规则见[待定决策](../docs/design/open-decisions.md)；示例 `elementPolicy` 不代表正式默认。
