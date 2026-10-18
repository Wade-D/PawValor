# Pawvalor（萌爪骑士团）

本仓库以 `PawValor/` 为项目根目录。

- `client/`：Cocos Creator 3.8.6 客户端项目。请在 Creator 中打开此目录；安装与验证命令见 [客户端说明](client/README.md)。
- `server/`：预留未来服务端开发，目前没有服务端实现。
- `config/`：预留跨端配置，目前没有运行时配置。
- `docs/`：设计稿与开发计划。

`master` 已包含第一阶段客户端基础和第二阶段战斗 Demo。第二阶段分支 `codex/phase-2-combat-demo` 保留作为历史工作分支。当前 Demo 实现最短战斗闭环，升至二级后封顶，尚不包含升级三选一。

第三阶段第一步在 `codex/phase-3-growth-core` 实现纯 TypeScript 成长核心：经验与串行升级、通用天赋三选一、每局两次刷新、Lv.3/7/11 固定进化，以及候选不足时的独立基础强化。原型每级 5 点经验、55 点达到 Lv.12；兜底分别记录基础攻击、生命或移速 +1% 的获取次数。这些均为测试参数。

第二步已将通用属性、火冰雷附魔、共鸣、追踪剑气与命中爆裂接入战斗。打开 `client/assets/scenes/CombatDemo.scene` 预览，顶部提供“基础 / 通用强化 / 火冰雷 / 雷电共鸣 / 副机制”五个中文测试预设，切换即重建一局。**这些构筑为直接注入；正式升级三选一、新经验流程和解除战斗二级上限在第三步接入。** “基础”仍保持原第二阶段规则。验收证据与待测设备见[客户端说明](client/README.md)和[第二步规格](docs/superpowers/specs/2026-10-18-phase-3-combat-effects-design.md)。

成长核心的接口示例、验证结果和 Creator 导入状态见[客户端说明](client/README.md)，规则依据见[已批准设计](docs/superpowers/specs/2026-10-18-phase-3-growth-core-design.md)和[实施计划](docs/superpowers/plans/2026-10-18-phase-3-growth-core.md)。
