# Pawvalor 文档索引

本目录存放《萌爪骑士团》的设计基线、各阶段设计与实施计划。代码使用说明见[客户端说明](../client/README.md)。

## 当前进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| 阶段 1 | 工程骨架、纯 TS 核心契约、配置校验、雷恩测试配置、`Bootstrap.scene` | 已完成，已合入 `master` |
| 阶段 2 | 基础战斗 Demo：移动、自动剑气、追击怪物、经验拾取、Lv.2 封顶、重开 | 已完成，已合入 `master`；触屏与微信真机待手动验证 |
| 阶段 3 | 成长系统：普通三选一、Lv.3/7/11 固定进化、元素与组合 | 未开始；开工前需先锁定[待定决策](design/open-decisions.md) |
| 阶段 4 | 三条路线的实际战斗差异 | 未开始 |

## 文档清单

| 文档 | 类型 | 状态 | 说明 |
|---|---|---|---|
| [pawvalor-v0.1-original.md](design/pawvalor-v0.1-original.md) | 设计基线 | 冻结 | 原始策划交接文档，所有阶段设计的依据。第 13–14 节为早期交接指令，已由下列阶段文档取代 |
| [phase-1-foundation.md](design/phase-1-foundation.md) | 规则交接 | 有效 | 依赖方向、雷恩配置含义、通用天赋计算语义、升级事务顺序、伤害衍生边界、重置清单 |
| [open-decisions.md](design/open-decisions.md) | 待定决策 | 有效，待用户决定 | 阶段 3 前必须锁定的规则，各文档统一引用此处 |
| [2026-10-15-phase-1-design.md](superpowers/specs/2026-10-15-phase-1-design.md) | 阶段设计 | 已批准、已实施 | 阶段 1 架构选择与数据契约 |
| [2026-10-15-phase-1-foundation.md](superpowers/plans/2026-10-15-phase-1-foundation.md) | 实施计划 | 已完成 | 阶段 1 的 5 项任务 |
| [2026-10-16-phase-2-combat-demo-design.md](superpowers/specs/2026-10-16-phase-2-combat-demo-design.md) | 阶段设计 | 已批准、已实施 | 阶段 2 战斗规则、时间步与事件顺序 |
| [2026-10-17-phase-2-combat-demo.md](superpowers/plans/2026-10-17-phase-2-combat-demo.md) | 实施计划 | 已完成 | 阶段 2 的 6 项任务（英文） |

建议阅读顺序：原始基线 → 阶段 1 规则交接 → 待定决策 → 最新阶段设计。

## 目录约定

```text
docs/
  README.md                  # 本索引
  design/                    # 设计基线、长期有效的规则交接与待定决策
  superpowers/specs/         # 各阶段设计（YYYY-MM-DD-phase-N-<主题>-design.md）
  superpowers/plans/         # 各阶段实施计划（YYYY-MM-DD-phase-N-<主题>.md）
```

- 新阶段先写设计并经用户批准，再写实施计划；完成后在本索引更新进度与状态。
- 已完成的设计与计划作为历史记录保留，不回改正文；状态变化写在文首状态行。
- 跨阶段仍有效的规则放在 `design/`；待定问题只维护在 `open-decisions.md` 一处。
- 测试执行证据放在被忽略的 `client/.superpowers/`，不提交。
