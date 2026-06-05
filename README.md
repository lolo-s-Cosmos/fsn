# fate-sandbox

Fate sandbox for pi coding agent. 当前大量测试集中在 Fate/strange Fake 斯诺菲尔德的绫香线。

## Requirements

- Node.js >= 24
- pnpm 11.3.0
- pi coding agent

## Install

```bash
pnpm install
```

## Start

```bash
./start.sh
```

首次运行会在项目内创建隔离配置目录：

```txt
.pi/agent/
```

如果没有可用认证，请按 pi 的正常流程登录或配置 provider。

## Tester Notes

- 游玩存档在 `sessions/`。
- `state/` 是运行时 debug export / legacy fallback，不是发布内容。
- `.pi/agent/auth.json` 包含本地认证信息，不要分享。
- 普通玩家模式会禁用 pi-subagents 内置 coding agents；开发时可用：

```bash
TAVERN2AGENT_DEV=1 ./start.sh
```

## License

GPL-3.0-or-later. See `LICENSE`.

这是同人实验项目；Fate / TYPE-MOON 相关设定归各自权利方所有。

## Package

```bash
pnpm run pack:release
```

输出在：

```txt
dist/
```

发布包不包含 `node_modules/`、`sessions/`、`state/`、`.pi/agent/`、`.pi/npm/`。
