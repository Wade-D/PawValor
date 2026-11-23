# Pawvalor（萌爪骑士团）

竖屏、单英雄、自动攻击的轻度动作肉鸽游戏，目标平台为微信小游戏，使用 Cocos Creator 3.8.6 + TypeScript 开发。

## 当前进度

`master` 已包含阶段 1（工程骨架、核心契约与配置校验）和阶段 2（基础战斗 Demo）。Demo 实现雷恩移动、自动剑气、怪物追击、经验拾取，升至 Lv.2 后封顶，尚不包含升级三选一。阶段 3（成长系统）开工前需先锁定[待定决策](docs/design/open-decisions.md)。详见[文档索引](docs/README.md)。

## 目录

| 目录 | 说明 |
|---|---|
| `client/` | Cocos Creator 3.8.6 客户端工程。在 Creator 中打开此目录；安装、测试与预览见[客户端说明](client/README.md) |
| `server/` | 预留未来服务端，目前没有实现 |
| `config/` | 预留跨端共享配置，目前没有运行时配置 |
| `docs/` | 设计基线、阶段设计与实施计划，入口为 [docs/README.md](docs/README.md) |

## 快速开始

```bash
cd client
npm ci
npm run verify
```

Windows PowerShell 下使用 `npm.cmd`。

分支 `codex/phase-2-combat-demo` 作为阶段 2 的历史工作分支保留。
