# Pawvalor 客户端：阶段 1

使用 **Cocos Creator 3.8.6** 打开此 `client/` 目录。Git 根目录也在 `client/`；公共设计文档位于上一级的 `docs/`，需要单独纳入项目文档版本管理。

## 安装与检查

安装 Node.js/npm 后，在 `client/` 执行（Windows PowerShell）：

```powershell
npm.cmd ci
npm.cmd run verify
```

`verify` 依次执行纯核心类型检查、核心/配置依赖边界检查和全部 Node 测试。测试编译输出位于被忽略的 `.test-build/`。主 `tsconfig.json` 仍继承 Creator 生成的配置；Node 检查不替代真实编辑器导入及预览验收。

## 启动诊断场景

1. 在 Creator 3.8.6 中打开 `client/`，等待资源和脚本导入。
2. 在资源管理器打开 `assets/scenes/Bootstrap.scene`。
3. 运行当前场景预览。场景中的 `Bootstrap` 组件已绑定 `Canvas/ConfigStatus` 的 Label。

`Bootstrap.onLoad` 校验 `rainePrototypeConfig`。成功时画面和控制台显示 **Pawvalor：配置校验通过（测试参数）**；失败时画面显示错误数量，控制台通过 `console.error` 输出全部 `issues`，包含错误代码、字段路径和说明。该入口只执行配置诊断，不启动战斗。若手动改动场景后 Label 绑定丢失，控制台会报告 `Bootstrap.statusLabel 未绑定`。

场景及 `.meta` 应由编辑器或 Cocos MCP 创建、修改和保存；提交自动生成的 `.meta` 以保留资源 UUID。

## 本阶段边界

当前交付包括纯 TypeScript 契约、构筑状态结构、可序列化配置、引用/数值/固定规则校验、雷恩 prototype 配置、自动测试与最小启动诊断。`core/` 不依赖 Cocos、微信、DOM 或 Node 专用 API；只有 `cocos/` 适配层引用 `cc`。

所有配置数值均为测试参数，未验证平衡与真机性能。当前没有移动、索敌、攻击、碰撞、伤害、抽卡算法、升级状态机、完整进化技能、组合调度或服务端实现。单英雄绑定武器、远程自动攻击是后续实现约束；普通三选一与固定 Lv.3 选路线、Lv.7 选分支、Lv.11 自动终极必须分别处理。

阶段 3 接入真实构筑前仍需锁定：

- 固有元素是否占附魔槽，附魔是否占副机制槽；同属性共鸣的计槽、强化与替换规则。
- 普通候选不足三张时的兜底奖励、数值与上限。
- 属性合并顺序、附加弹体适用范围、组合前置表及经验曲线。

示例 `elementPolicy` 和测试组合仅用于结构验证，不代表正式默认规则。完整约束见上一级 `docs/design/phase-1-foundation.md`。
