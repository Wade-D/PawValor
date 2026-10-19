# PawValor（萌爪骑士团）

使用 **Cocos Creator 3.8.6** 打开 `client/`，Git根目录为本目录。`server/`、`config/` 是未来开发预留目录；`docs/` 保存设计、计划与证据。

`master` 保留第二阶段。第三阶段当前工作位于 `codex/phase-3-growth-core`，未合并或推送。

第三步已将成长核心接入实际战斗。打开 `client/assets/scenes/CombatDemo.scene` 预览，默认“成长试玩”从空构筑开始：自然击杀、拾取后打开中文三选一，每局两次刷新，三级选路线、七级选分支、十一级自动记录终极。每级5经验，累计55到十二级封顶，均为测试参数。选择期间战斗冻结。

雷霆剑雨测试组合已实际执行：万剑流、雷电附魔一级及攻击强化二级齐备后，下一级免费激活，保留普通选择。每次普攻另发四枚青色剑气，各造成非暴击主伤害的50%，不再触发附魔或副机制。完整路线、分支和终极招式仍留到第四阶段，卡面已注明。

顶部五个直接注入构筑的诊断入口继续保留，只有这些入口仍二级封顶。显式参数 `?growthFixture=sword-rain` 提供可见经验注入与合法前置准备按钮；默认入口不注入经验或自动选卡。

2026-10-19，完整验证 **364项测试通过**，核心/适配器类型及依赖边界检查通过；自然升级、中文选择、组合、十二级封顶与模式清理已有实际桌面截图。真实触屏、完整持续按键时序及微信设备仍待验。入口和命令见[客户端说明](client/README.md)，证据与边界见[验收与审查](docs/evidence/phase-3-growth-integration/验收与审查.md)、[已批准规格](docs/superpowers/specs/2026-10-18-phase-3-growth-integration-design.md)和[实施计划](docs/superpowers/plans/2026-10-19-phase-3-growth-integration.md)。
