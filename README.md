# project-ai-sync

跨项目同步 AI 编码助手配置文件（`.cursor`、`.claude`、`AGENTS.md` 等）的 CLI 工具。将 AI 配置集中管理在一个模板仓库中，一行命令分发到所有项目。

## 为什么需要这个工具

如果你同时在多个项目中使用 Cursor、Claude Code、GitHub Copilot 等 AI 编码工具，你会发现自己在每个仓库中重复维护相同的规则、提示词和 Agent 配置。这个工具帮你：

- **集中管理** — 所有 AI 配置存放在一个模板仓库中
- **一键分发** — 通过 `init` 或 `update` 拉取到任意项目
- **双向同步** — 通过 `commit` 将项目中的改进推回模板仓库
- **智能合并** — 使用真正的 Git merge，而非简单覆盖

## 安装

```bash
# 使用 npx（推荐，始终使用最新版本）
npx project-ai-sync <command>

# 确保使用最新版本
npx project-ai-sync@latest <command>

# 或全局安装
npm install -g project-ai-sync
```

## 快速开始

```bash
# 1. 配置你的模板仓库
npx project-ai-sync config -r "git@github.com:你的用户名/ai-template.git" -b main

# 2. 拉取 AI 配置到当前项目
npx project-ai-sync init

# 3. 后续更新到最新版本
npx project-ai-sync update

# 4. 将本地改进推回模板仓库
npx project-ai-sync commit -m "feat: 新增 cursor 规则"
```

## 命令一览

| 命令 | 说明 |
|---|---|
| `config` | 配置仓库 URL、分支和同步范围 |
| `init` | 初始化 AI 配置（删除已有 + 从模板复制） |
| `init-project` | 基于模板仓库交互式创建新项目 |
| `update` | 通过 Git merge 增量更新 AI 配置 |
| `update-project` | 更新项目源码文件（使用配置中的同步范围） |
| `commit` | 将 AI 配置改进推回模板仓库（创建 PR/MR） |
| `commit-project` | 将项目文件改进推回模板仓库 |

## 默认同步目标

`init`、`update`、`commit` 命令默认同步以下路径：

- `.cursor/` — Cursor AI 规则和技能
- `.claude/` — Claude Code 配置
- `AGENTS.md` — AI 代理规范文档
- `.github/copilot/` — GitHub Copilot 配置

可通过 `.project-ai-syncrc.json` 配置文件或 `-f` 参数自定义。

## 配置文件

运行 `npx project-ai-sync config` 生成 `.project-ai-syncrc.json`：

```json
{
  "repoUrl": "git@github.com:你的用户名/ai-template.git",
  "branch": "main",
  "init": {
    "include": [".cursor", ".claude", "AGENTS.md", ".github/copilot"],
    "exclude": []
  },
  "update": {
    "include": [".cursor", ".claude", "AGENTS.md", ".github/copilot"],
    "exclude": []
  },
  "commit": {
    "include": [".cursor", ".claude", "AGENTS.md", ".github/copilot"],
    "exclude": []
  },
  "updateProject": {
    "include": ["src/**"],
    "exclude": ["**/node_modules/**", "**/.git/**", "**/dist/**"]
  }
}
```

### 配置命令

```bash
# 设置仓库和分支
npx project-ai-sync config -r "git@github.com:user/repo.git" -b main

# 查看当前配置
npx project-ai-sync config --show

# 删除配置文件
npx project-ai-sync config --delete
```

## 命令详解

### init — 初始化

首次同步使用。删除已存在的目标文件夹，然后从模板复制。

```bash
npx project-ai-sync init

# 指定同步的文件夹
npx project-ai-sync init -f ".cursor,.claude,AGENTS.md"

# 仅检查，不执行（dry-run）
npx project-ai-sync init --check
```

**建议**：首次同步使用 `init` 建立共同 Git 历史。后续使用 `update` 进行增量更新 — Git 可以进行准确的三路合并。

### update — 增量更新

使用真正的 Git merge 进行增量更新。保留文件历史，检测冲突，集成编辑器合并 UI（VS Code、Cursor）。

```bash
npx project-ai-sync update

# 先检查冲突
npx project-ai-sync update --check
```

如果发生冲突：
1. 编辑器会自动显示合并冲突 UI
2. 手动解决冲突
3. 运行 `git merge --continue`
4. 清理临时 remote：`git remote remove project-ai-sync/...`

### commit — 推回改进

将本地改进推回模板仓库。创建新分支并提供 PR/MR 链接。**不会影响**当前项目的 Git 状态（在临时目录中操作）。

```bash
npx project-ai-sync commit -m "feat: 新增 cursor 规则"

# 指定文件夹
npx project-ai-sync commit -f ".cursor,.claude" -m "fix: 更新提示词"
```

自动检测平台并生成对应链接：GitHub（Pull Request）、GitLab（Merge Request）、Gitee。

### update-project / commit-project — 项目文件同步

与 `update` / `commit` 相同逻辑，但用于项目源码文件。同步范围由 `updateProject` / `commitProject` 配置定义。

```bash
# 从模板同步项目文件
npx project-ai-sync update-project

# 推回项目文件改进
npx project-ai-sync commit-project -f "src,package.json" -m "feat: 同步工具函数"
```

### init-project — 创建新项目

基于模板仓库交互式创建新项目。

```bash
npx project-ai-sync init-project
```

## 通用选项

所有命令支持：

| 选项 | 说明 |
|---|---|
| `-r, --repo <url>` | 覆盖仓库 URL |
| `-b, --branch <branch>` | 覆盖分支名 |
| `-f, --folders <folders>` | 覆盖同步路径（逗号分隔） |
| `--exclude <patterns>` | 覆盖排除规则（逗号分隔） |
| `--check` | 仅检查模式（init、update、update-project） |
| `-m, --message <msg>` | 提交信息（commit、commit-project） |

## 工作原理

- **init**：`git clone --depth 1` 到临时目录，删除目标文件夹后复制
- **update**：将模板仓库添加为 Git remote，执行 `git merge --allow-unrelated-histories`，仅保留目标文件夹变更，自动恢复其他文件
- **commit**：克隆模板到临时目录，覆盖目标文件夹，推送新分支，生成 PR/MR 链接

所有临时文件存放在系统临时目录（`os.tmpdir()`），自动清理。

## 环境要求

- Node.js >= 16
- Git 已安装并配置（SSH 密钥或 HTTPS 凭据）
- 当前目录必须是 Git 仓库（`update` 命令要求）

## 许可证

[MIT](./LICENSE)
