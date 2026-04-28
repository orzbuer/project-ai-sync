# project-ai-sync

CLI tool for syncing AI capability files (`.cursor`, `.claude`, `AGENTS.md`, etc.) across projects. Keep your AI coding assistant configs in a central template repo and distribute them to all your projects with a single command.

## Why

If you use AI coding tools like Cursor, Claude Code, or GitHub Copilot across multiple projects, you end up maintaining the same rules, prompts, and agent configs in every repo. This tool lets you:

- **Centralize** AI configs in one template repository
- **Distribute** them to any project with `init` or `update`
- **Contribute back** improvements from any project via `commit`
- **Handle conflicts** with real Git merge (not blind overwrites)

## Install

```bash
# Use with npx (recommended, always latest)
npx project-ai-sync <command>

# Or install globally
npm install -g project-ai-sync
```

## Quick Start

```bash
# 1. Configure your template repository
npx project-ai-sync config -r "git@github.com:you/your-ai-template.git" -b main

# 2. Pull AI configs into your project
npx project-ai-sync init

# 3. Later, update to latest
npx project-ai-sync update

# 4. Push local improvements back to the template
npx project-ai-sync commit -m "feat: add new cursor rules"
```

## Commands

| Command | Description |
|---|---|
| `config` | Configure repository URL, branch, and sync scope |
| `init` | Initialize AI configs (delete existing + copy from template) |
| `init-project` | Create a new project from the template repository |
| `update` | Incrementally merge latest AI configs via Git merge |
| `update-project` | Merge project files (src, etc.) from template |
| `commit` | Push AI config improvements back to template repo (creates PR/MR) |
| `commit-project` | Push project file improvements back to template repo |

## Default Sync Targets

The `init`, `update`, and `commit` commands sync these paths by default:

- `.cursor/` - Cursor AI rules and skills
- `.claude/` - Claude Code configuration
- `AGENTS.md` - AI agent specifications
- `.github/copilot/` - GitHub Copilot configuration

Customize via `.project-ai-syncrc.json` or the `-f` flag.

## Configuration

Run `npx project-ai-sync config` to generate `.project-ai-syncrc.json`:

```json
{
  "repoUrl": "git@github.com:you/your-ai-template.git",
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

### Config Options

```bash
# Set repo and branch
npx project-ai-sync config -r "git@github.com:you/repo.git" -b main

# View current config
npx project-ai-sync config --show

# Delete config
npx project-ai-sync config --delete
```

## Command Details

### init

First-time setup. Deletes existing target folders, then copies from template.

```bash
npx project-ai-sync init

# Custom folders
npx project-ai-sync init -f ".cursor,.claude,AGENTS.md"

# Dry run
npx project-ai-sync init --check
```

**Tip:** Use `init` for the first sync to establish shared Git history. Use `update` for subsequent syncs — Git can then do accurate three-way merges.

### update

Incremental update using real Git merge. Preserves file history, detects conflicts, and integrates with editor merge UI (VS Code, Cursor).

```bash
npx project-ai-sync update

# Check for conflicts first
npx project-ai-sync update --check
```

If conflicts occur:
1. Your editor will show the merge conflict UI
2. Resolve conflicts manually
3. Run `git merge --continue`
4. Clean up: `git remote remove project-ai-sync/...`

### commit

Push your local improvements back to the template repo. Creates a feature branch and provides a PR/MR link. Does **not** affect your project's Git state (operates in a temp directory).

```bash
npx project-ai-sync commit -m "feat: add new cursor rules"

# Custom folders
npx project-ai-sync commit -f ".cursor,.claude" -m "fix: update prompts"
```

Supports GitHub (Pull Request), GitLab (Merge Request), and Gitee — auto-detected from your repo URL.

### update-project / commit-project

Same as `update` / `commit`, but for project source files. Scope is defined by the `updateProject` / `commitProject` config.

```bash
# Sync project files from template
npx project-ai-sync update-project

# Push project files back
npx project-ai-sync commit-project -f "src,package.json" -m "feat: sync utils"
```

### init-project

Interactively create a new project from the template repository.

```bash
npx project-ai-sync init-project
```

## Common Options

All commands support:

| Option | Description |
|---|---|
| `-r, --repo <url>` | Override repository URL |
| `-b, --branch <branch>` | Override branch name |
| `-f, --folders <folders>` | Override include paths (comma-separated) |
| `--exclude <patterns>` | Override exclude patterns (comma-separated) |
| `--check` | Dry-run mode (init, update, update-project) |
| `-m, --message <msg>` | Commit message (commit, commit-project) |

## How It Works

- **init**: `git clone --depth 1` to temp dir, delete + copy target folders
- **update**: Add template as Git remote, `git merge --allow-unrelated-histories`, keep only target folder changes, auto-restore other files
- **commit**: Clone template to temp dir, overwrite target folders, push new branch, generate PR/MR link

All temp files are stored in `os.tmpdir()` and cleaned up automatically.

## Requirements

- Node.js >= 16
- Git installed and configured (SSH key or HTTPS credentials)
- Target directory must be a Git repository (for `update` command)

## License

[MIT](./LICENSE)
