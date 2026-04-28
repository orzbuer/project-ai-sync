# project-ai-sync 公网版构建计划

> 基于 `@mi/project-ai-sync`（v0.0.26）源码分析，制定公网开源版本的完整构建方案。
> 原始代码位置：`/home/cmq/codes/hiuiv5-template/cli/`

---

## 一、项目总览

### 1.1 目标

将公司内网 CLI 工具 `@mi/project-ai-sync` 改造为可发布到 npm 公网的开源版本，实现跨项目复用 AI 配置文件（`.cursor/`、`.claude/`、`AGENTS.md` 等）的能力。

### 1.2 核心差异点（原包 vs 公网版）

| 维度 | 原包 `@mi/project-ai-sync` | 公网版（待定名） |
|---|---|---|
| npm scope | `@mi/`（公司私有 registry） | 个人 scope 或无 scope |
| 默认 repoUrl | `git@git.n.xiaomi.com:panyan/hiuiv5-template.git` | 无硬编码默认值，首次使用必须配置 |
| Git 托管平台 | GitLab（内网） | GitHub / GitLab / Gitee 均支持 |
| MR/PR 链接生成 | GitLab MR 格式 | 自动检测平台，生成对应 PR/MR 链接 |
| 模板内容 | HiUI v5 项目模板 | 通用——用户自定义模板仓库 |
| init-project | 硬编码 `hiuiv5-template` 替换逻辑 | 通用模板替换，支持用户自定义占位符 |
| 认证方式 | SSH（内网 GitLab） | SSH + HTTPS token 均支持 |

### 1.3 包名候选

- `project-ai-sync`（无 scope，简洁）
- `@cmq/project-ai-sync`（个人 scope）
- `ai-config-sync`（更语义化）

> 决策：待确认 npm 包名可用性后决定。

---

## 二、项目结构设计

```
project-ai-sync/
├── bin/
│   └── cli.js                  # 可执行文件入口（#!/usr/bin/env node）
├── src/
│   ├── index.ts                # CLI 主入口（commander 命令注册）
│   ├── commands/
│   │   ├── config.ts           # config 命令
│   │   ├── init.ts             # init 命令（删除+覆盖）
│   │   ├── init-project.ts     # init-project 命令（基于模板创建新项目）
│   │   ├── update.ts           # update 命令（git merge 增量更新）
│   │   ├── commit.ts           # commit 命令（推回模板仓库）
│   │   └── commit-project.ts   # commit-project 命令
│   └── utils/
│       ├── config.ts           # 配置文件读写
│       ├── git.ts              # Git 操作封装
│       └── platform.ts         # 【新增】平台检测（GitHub/GitLab/Gitee）
├── dist/                       # TypeScript 编译输出
├── doc/                        # 项目文档
├── package.json
├── tsconfig.json
├── .gitignore
├── LICENSE
└── README.md
```

---

## 三、分阶段实施计划

### 阶段 1：项目脚手架搭建

**目标**：建立可编译、可运行的空壳 CLI 项目。

| # | 任务 | 详情 |
|---|---|---|
| 1.1 | 初始化 npm 项目 | `npm init`，填写包名、描述、license (MIT)、bin 入口 |
| 1.2 | 安装依赖 | 生产：`commander`, `chalk@4`, `fs-extra`, `simple-git`, `inquirer@9`, `ora@5`, `open@8`；开发：`typescript`, `@types/node`, `@types/fs-extra`, `@types/inquirer`, `ts-node` |
| 1.3 | TypeScript 配置 | `tsconfig.json`：target ES2020, module commonjs, outDir dist, strict true |
| 1.4 | 创建 bin/cli.js | `#!/usr/bin/env node` + `require('../dist/index.js')` |
| 1.5 | 创建 src/index.ts 骨架 | 注册 commander program，添加 version、description，先注册一个 `--help` 能跑通 |
| 1.6 | 验证 | `npm run build` 编译通过，`node bin/cli.js --help` 输出正常 |

**预计耗时**：0.5 天

---

### 阶段 2：配置模块（config）

**目标**：实现 `.project-ai-syncrc.json` 配置文件的读写，去除硬编码默认值。

| # | 任务 | 详情 |
|---|---|---|
| 2.1 | 移植 `utils/config.ts` | 复制原始代码，修改 `DEFAULT_CONFIG`：移除硬编码 repoUrl，改为空字符串；branch 默认 `main`（公网惯例） |
| 2.2 | 修改默认 AI 文件夹 | 默认 include 从 `['.cursor', '.local-context', 'AGENTS.md']` 扩展为 `['.cursor', '.claude', 'AGENTS.md', '.github/copilot']`（覆盖更多 AI 工具） |
| 2.3 | 实现 config 命令 | 移植 `commands/config.ts`，修改交互式提示文案：去掉小米内网 URL 示例，改为通用 Git URL 格式 |
| 2.4 | 添加首次使用引导 | 当 repoUrl 为空时，强制进入交互式配置流程，而非使用无效默认值 |
| 2.5 | 验证 | `node bin/cli.js config` 能正确生成配置文件、`--show` 能展示、`--delete` 能删除 |

**原始文件参考**：
- `src/utils/config.ts`（297 行）— 核心配置逻辑
- `src/commands/config.ts`（340 行）— config 命令实现

**预计耗时**：0.5 天

---

### 阶段 3：Git 工具层

**目标**：移植并改造 Git 操作工具函数，支持多平台。

| # | 任务 | 详情 |
|---|---|---|
| 3.1 | 移植 `utils/git.ts` 基础函数 | `cloneRepository`、`cleanupTempDir`、`copyFolders` 及其辅助函数——这些不含平台特定逻辑，可直接使用 |
| 3.2 | 移植 diff/merge 工具 | `calculateFileHash`、`isTextFile`、`hasLineLevelDifferences`、`arePathsDifferent`、`diffLines`（LCS 算法）、`generateMergeConflictFile`、`mergeDirectory`——纯算法代码，直接复用 |
| 3.3 | 移植 `performGitMerge` | 核心 git merge 流程（add remote → fetch → merge → filter target folders → commit），需修改 remote 命名格式中的解析逻辑以支持 GitHub/Gitee URL |
| 3.4 | **新增** `utils/platform.ts` | 平台检测模块，根据 repoUrl 自动识别 GitHub / GitLab / Gitee / 其他，并生成对应的 PR/MR 创建链接 |

**platform.ts 设计**：

```typescript
type Platform = 'github' | 'gitlab' | 'gitee' | 'unknown'

interface PlatformInfo {
  platform: Platform
  baseUrl: string
  projectPath: string
}

// 根据 repo URL 检测平台
function detectPlatform(repoUrl: string): PlatformInfo

// 生成 PR/MR 创建链接
function generatePRUrl(info: PlatformInfo, sourceBranch: string, targetBranch: string): string
// GitHub: https://github.com/{owner}/{repo}/compare/{target}...{source}?expand=1
// GitLab: https://{host}/{path}/merge_requests/new?merge_request[source_branch]=...
// Gitee:  https://gitee.com/{owner}/{repo}/pull/new?head={source}&base={target}
```

**原始文件参考**：
- `src/utils/git.ts`（920 行）— 全部 Git 操作逻辑

**预计耗时**：1 天

---

### 阶段 4：核心命令实现

**目标**：移植 6 个核心命令。

#### 4.1 init 命令

| # | 任务 | 详情 |
|---|---|---|
| 4.1.1 | 移植 `commands/init.ts` | 直接复用，逻辑无平台依赖：clone → delete existing → copy from tmp |
| 4.1.2 | 验证 | 在测试仓库中执行 init，确认文件正确复制 |

**原始文件**：`commands/init.ts`（87 行）

#### 4.2 update 命令

| # | 任务 | 详情 |
|---|---|---|
| 4.2.1 | 移植 `commands/update.ts` | 直接复用，调用 `performGitMerge`，无平台依赖 |
| 4.2.2 | 验证 | 模拟增量更新场景，确认 git merge 正常工作 |

**原始文件**：`commands/update.ts`（46 行）

#### 4.3 commit 命令（需重点改造）

| # | 任务 | 详情 |
|---|---|---|
| 4.3.1 | 移植 `commands/commit.ts` | 复制核心流程：check folders → clone to tmp → copy → create branch → commit → push |
| 4.3.2 | **替换 `parseGitLabUrl`** | 改用 `platform.ts` 的 `detectPlatform` + `generatePRUrl`，支持 GitHub/GitLab/Gitee |
| 4.3.3 | 修改 MR 提示文案 | "Create Merge Request" → 根据平台显示 "Create Pull Request" 或 "Create Merge Request" |
| 4.3.4 | 验证 | 用 GitHub 仓库测试 commit 流程，确认 PR 链接正确 |

**原始文件**：`commands/commit.ts`（222 行）

#### 4.4 commit-project 命令

| # | 任务 | 详情 |
|---|---|---|
| 4.4.1 | 移植 `commands/commit-project.ts` | 直接复用，它只是 commit 的薄封装 |

**原始文件**：`commands/commit-project.ts`（58 行）

#### 4.5 update-project 命令

| # | 任务 | 详情 |
|---|---|---|
| 4.5.1 | 已在 index.ts 中注册 | 该命令在主入口中直接调用 `updateCommand`，不是独立文件，移植 index.ts 时一并处理 |

#### 4.6 init-project 命令（需重点改造）

| # | 任务 | 详情 |
|---|---|---|
| 4.6.1 | 移植 `commands/init-project.ts` | 复制主流程：交互式输入 → clone → 替换名称 → copy → git init |
| 4.6.2 | **去除硬编码模板名** | 移除 `TEMPLATE_NAME = 'hiuiv5-template'` 和 `'轻财务模板'`，改为从配置文件读取 `templateName`（英文）和 `templateNameZh`（中文）占位符 |
| 4.6.3 | 添加配置项 | 在 `SyncConfig` 中新增 `initProject?: { templateName?: string, templateNameZh?: string }` |
| 4.6.4 | 验证 | 用自定义模板仓库测试创建新项目 |

**原始文件**：`commands/init-project.ts`（208 行）

**预计耗时**：2 天

---

### 阶段 5：主入口 index.ts 整合

**目标**：注册所有命令，统一 CLI 入口。

| # | 任务 | 详情 |
|---|---|---|
| 5.1 | 移植 `src/index.ts` | 复制全部命令注册代码（338 行），逐个替换 import 路径 |
| 5.2 | 修改 program 元信息 | `.name('project-ai-sync')`、`.description(...)` 更新为公网版描述 |
| 5.3 | 修改默认值引用 | 确保所有命令使用新的 `DEFAULT_CONFIG`（无硬编码 repoUrl） |
| 5.4 | 全量验证 | 逐个命令执行 `--help`，确认注册正确 |

**预计耗时**：0.5 天

---

### 阶段 6：测试与质量保障

**目标**：确保核心流程可靠。

| # | 任务 | 详情 |
|---|---|---|
| 6.1 | 端到端测试：config | 创建/读取/删除配置文件 |
| 6.2 | 端到端测试：init | 从 GitHub 仓库 init AI 配置到本地 |
| 6.3 | 端到端测试：update | 模拟模板仓库有更新，执行 update，验证 merge |
| 6.4 | 端到端测试：commit | 修改 AI 配置后 commit 到 GitHub，验证 PR 链接 |
| 6.5 | 端到端测试：init-project | 基于模板创建新项目，验证名称替换 |
| 6.6 | 边界测试 | 无配置文件时的行为、无 Git 仓库时的错误提示、网络超时处理 |

**预计耗时**：1 天

---

### 阶段 7：发布准备

**目标**：准备 npm 发布所需的一切。

| # | 任务 | 详情 |
|---|---|---|
| 7.1 | 完善 package.json | files 字段（只发布 bin/ + dist/）、engines、keywords、repository、homepage |
| 7.2 | 编写 README.md | 参考原文档，用英文重写，包含安装、快速开始、命令列表、配置说明 |
| 7.3 | 添加 .npmignore | 排除 src/、doc/、tsconfig.json 等开发文件 |
| 7.4 | 添加 LICENSE | MIT |
| 7.5 | npm 账号准备 | 登录 npm，确认包名可用：`npm view <包名>` |
| 7.6 | 首次发布 | `npm run build && npm publish --access public` |
| 7.7 | 验证发布 | `npx <包名> --help` 确认可用 |

**预计耗时**：0.5 天

---

## 四、技术决策记录

### 4.1 依赖版本选择

| 依赖 | 版本 | 原因 |
|---|---|---|
| chalk | 4.x | 5.x 是纯 ESM，与 CommonJS 不兼容 |
| ora | 5.x | 6.x 是纯 ESM |
| inquirer | 9.x | 与原包一致 |
| open | 8.x | 9.x 是纯 ESM |
| commander | ^11 | 同原包 |
| simple-git | ^3.22 | 同原包 |
| fs-extra | ^11 | 同原包 |

> 选择 CJS 兼容版本是因为 TypeScript 编译 target 为 CommonJS，避免 ESM/CJS 互操作问题。

### 4.2 平台检测策略

通过 repoUrl 中的 hostname 自动判断：
- 包含 `github.com` → GitHub
- 包含 `gitlab` 或自建域名走 GitLab API → GitLab
- 包含 `gitee.com` → Gitee
- 其他 → 打印通用提示，提供分支名，用户手动创建 PR/MR

### 4.3 默认 AI 文件夹

公网版默认同步的 AI 配置文件夹扩展为：
```
['.cursor', '.claude', 'AGENTS.md', '.github/copilot']
```
覆盖 Cursor、Claude Code、GitHub Copilot 等主流 AI 编码工具。

---

## 五、风险与注意事项

| 风险 | 影响 | 缓解措施 |
|---|---|---|
| npm 包名已被占用 | 无法发布 | 提前查询，准备备选名 |
| ESM/CJS 兼容性 | 运行时报错 | 锁定 CJS 兼容版本的 chalk/ora/open |
| GitHub SSH 认证失败 | clone 报错 | 支持 HTTPS URL，提示用户配置 token |
| 大型模板仓库 clone 慢 | 用户体验差 | 已使用 `--depth 1` 浅克隆 |
| git merge 冲突复杂 | 用户不会处理 | 提供清晰的冲突解决指引 |

---

## 六、里程碑时间线

| 里程碑 | 阶段 | 预计完成 |
|---|---|---|
| CLI 骨架可运行 | 阶段 1 | Day 1 |
| 配置模块完成 | 阶段 2 | Day 1 |
| Git 工具层完成 | 阶段 3 | Day 2 |
| 全部命令可用 | 阶段 4 + 5 | Day 4 |
| 测试通过 | 阶段 6 | Day 5 |
| npm 首次发布 | 阶段 7 | Day 6 |

---

## 七、原始代码文件清单（供移植参考）

| 文件路径 | 行数 | 移植策略 |
|---|---|---|
| `src/index.ts` | 338 | 移植 + 修改默认值和描述文案 |
| `src/commands/config.ts` | 340 | 移植 + 去除内网 URL 示例 |
| `src/commands/init.ts` | 87 | 直接移植 |
| `src/commands/init-project.ts` | 208 | 移植 + 去除硬编码模板名 |
| `src/commands/update.ts` | 46 | 直接移植 |
| `src/commands/commit.ts` | 222 | 移植 + 替换平台检测逻辑 |
| `src/commands/commit-project.ts` | 58 | 直接移植 |
| `src/utils/config.ts` | 297 | 移植 + 修改 DEFAULT_CONFIG |
| `src/utils/git.ts` | 920 | 移植 + 修改 URL 解析 |
| **新增** `src/utils/platform.ts` | ~80 | 全新编写 |
| **总计** | ~2596 | — |
