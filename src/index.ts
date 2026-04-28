#!/usr/bin/env node

import chalk from 'chalk'
import { Command } from 'commander'

import { commitCommand } from './commands/commit'
import { commitProjectCommand } from './commands/commit-project'
import { configCommand } from './commands/config'
import { initCommand } from './commands/init'
import { initProjectCommand } from './commands/init-project'
import { updateCommand } from './commands/update'

const program = new Command()

program
  .name('project-ai-sync')
  .description(
    'CLI tool to sync AI capabilities (.cursor, .claude, AGENTS.md, etc.) between projects'
  )
  .version('0.1.0')

// --- config ---
program
  .command('config')
  .description('Configure default repository URL, branch, and target folders')
  .option('-r, --repo <url>', 'Set default repository URL')
  .option('-b, --branch <branch>', 'Set default branch name')
  .option('--init-exclude <patterns>', 'Set init.exclude patterns (comma-separated)')
  .option('--update-exclude <patterns>', 'Set update.exclude patterns (comma-separated)')
  .option('--commit-exclude <patterns>', 'Set commit.exclude patterns (comma-separated)')
  .option('--update-project-include <patterns>', 'Set updateProject.include patterns (comma-separated)')
  .option('--update-project-exclude <patterns>', 'Set updateProject.exclude patterns (comma-separated)')
  .option('--commit-project-include <patterns>', 'Set commitProject.include patterns (comma-separated)')
  .option('--commit-project-exclude <patterns>', 'Set commitProject.exclude patterns (comma-separated)')
  .option('-s, --show', 'Show current configuration')
  .option('-d, --delete', 'Delete configuration file')
  .action(async (options) => {
    try {
      await configCommand(options)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// --- init ---
program
  .command('init')
  .description(
    'Initialize: Copy AI capability folders from remote repository (deletes existing first)'
  )
  .option('-r, --repo <url>', 'Remote repository URL (overrides config)')
  .option('-b, --branch <branch>', 'Branch name (overrides config)')
  .option(
    '-f, --folders <folders>',
    'Target folders/files to sync (comma-separated; overrides include from config)'
  )
  .option(
    '--exclude <patterns>',
    'Exclude patterns (comma-separated; overrides exclude from config)'
  )
  .option('--merge', 'Generate merge conflict markers for conflicting files')
  .option('--check', 'Check for conflicts without making changes (dry-run)')
  .action(async (options) => {
    try {
      const { getConfig, DEFAULT_AI_FOLDERS, includeToFolders, mergeCliIncludeExclude } =
        await import('./utils/config')
      const config = await getConfig({
        repoUrl: options.repo,
        branch: options.branch,
      })

      if (!config.repoUrl) {
        console.error(chalk.red('Error: Repository URL is not configured. Run "project-ai-sync config" first.'))
        process.exit(1)
      }

      const cliInclude = options.folders
        ? options.folders.split(',').map((f: string) => f.trim()).filter(Boolean)
        : undefined
      const cliExclude = options.exclude
        ? options.exclude.split(',').map((f: string) => f.trim()).filter(Boolean)
        : undefined

      const { include } = mergeCliIncludeExclude({
        cliInclude,
        cliExclude,
        configInclude: config.init?.include,
        configExclude: config.init?.exclude,
        defaultInclude: DEFAULT_AI_FOLDERS,
      })

      const targetFolders = includeToFolders(include)

      await initCommand(config.repoUrl, config.branch, targetFolders, {
        merge: options.merge,
        checkOnly: options.check,
      })
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// --- init-project ---
program
  .command('init-project')
  .description('Create a new project based on a remote template repository')
  .option('-r, --repo <url>', 'Remote repository URL (overrides config)')
  .option('-b, --branch <branch>', 'Branch name (default: main)')
  .action(async (options) => {
    try {
      await initProjectCommand({
        repoUrl: options.repo,
        branch: options.branch,
      })
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// --- update ---
program
  .command('update')
  .description(
    'Update: Merge remote AI capability files using git merge (preserves file history)'
  )
  .option('-r, --repo <url>', 'Remote repository URL (overrides config)')
  .option('-b, --branch <branch>', 'Branch name (overrides config)')
  .option(
    '-f, --folders <folders>',
    'Target folders/files to sync (comma-separated; overrides include from config)'
  )
  .option(
    '--exclude <patterns>',
    'Exclude patterns (comma-separated; overrides exclude from config)'
  )
  .option('--check', 'Check for conflicts without making changes (dry-run)')
  .action(async (options) => {
    try {
      const { getConfig, DEFAULT_AI_FOLDERS, includeToFolders, mergeCliIncludeExclude } =
        await import('./utils/config')
      const config = await getConfig({
        repoUrl: options.repo,
        branch: options.branch,
      })

      if (!config.repoUrl) {
        console.error(chalk.red('Error: Repository URL is not configured. Run "project-ai-sync config" first.'))
        process.exit(1)
      }

      const cliInclude = options.folders
        ? options.folders.split(',').map((f: string) => f.trim()).filter(Boolean)
        : undefined
      const cliExclude = options.exclude
        ? options.exclude.split(',').map((f: string) => f.trim()).filter(Boolean)
        : undefined

      const { include } = mergeCliIncludeExclude({
        cliInclude,
        cliExclude,
        configInclude: config.update?.include,
        configExclude: config.update?.exclude,
        defaultInclude: DEFAULT_AI_FOLDERS,
      })

      const targetFolders = includeToFolders(include)

      await updateCommand(config.repoUrl, config.branch, targetFolders, {
        checkOnly: options.check,
      })
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// --- update-project ---
program
  .command('update-project')
  .description(
    'Update Project: Merge remote project files using git merge (uses config for sync scope)'
  )
  .option('-r, --repo <url>', 'Remote repository URL (overrides config)')
  .option('-b, --branch <branch>', 'Branch name (overrides config)')
  .option(
    '-f, --folders <folders>',
    'Target folders/files to sync (comma-separated; overrides include from config)'
  )
  .option(
    '--exclude <patterns>',
    'Exclude patterns (comma-separated; overrides exclude from config)'
  )
  .option('--check', 'Check for conflicts without making changes (dry-run)')
  .action(async (options) => {
    try {
      const { getConfig, DEFAULT_PROJECT_SYNC_EXCLUDE, includeToFolders, mergeCliIncludeExclude } =
        await import('./utils/config')
      const config = await getConfig({
        repoUrl: options.repo,
        branch: options.branch,
      })

      if (!config.repoUrl) {
        console.error(chalk.red('Error: Repository URL is not configured. Run "project-ai-sync config" first.'))
        process.exit(1)
      }

      const cliInclude = options.folders
        ? options.folders.split(',').map((f: string) => f.trim()).filter(Boolean)
        : undefined
      const cliExclude = options.exclude
        ? options.exclude.split(',').map((f: string) => f.trim()).filter(Boolean)
        : undefined

      const defaultInclude =
        config.updateProject?.include && config.updateProject.include.length > 0
          ? config.updateProject.include
          : ['src/**']

      const { include } = mergeCliIncludeExclude({
        cliInclude,
        cliExclude,
        configInclude: config.updateProject?.include,
        configExclude: config.updateProject?.exclude,
        defaultInclude,
        fallbackExclude: DEFAULT_PROJECT_SYNC_EXCLUDE,
      })

      const targetFolders = includeToFolders(include)

      await updateCommand(config.repoUrl, config.branch, targetFolders, {
        checkOnly: options.check,
      })
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// --- commit ---
program
  .command('commit')
  .description(
    'Commit: Submit AI capability changes to remote repository via PR/MR'
  )
  .option('-r, --repo <url>', 'Remote repository URL (overrides config)')
  .option('-b, --branch <branch>', 'Target branch name (overrides config)')
  .option(
    '-f, --folders <folders>',
    'Target folders/files to sync (comma-separated; overrides include from config)'
  )
  .option(
    '--exclude <patterns>',
    'Exclude patterns (comma-separated; overrides exclude from config)'
  )
  .option('-m, --message <message>', 'Commit message (default: feat: sync AI capabilities)')
  .action(async (options) => {
    try {
      const { getConfig, DEFAULT_AI_FOLDERS, includeToFolders, mergeCliIncludeExclude } =
        await import('./utils/config')
      const config = await getConfig({
        repoUrl: options.repo,
        branch: options.branch,
      })

      if (!config.repoUrl) {
        console.error(chalk.red('Error: Repository URL is not configured. Run "project-ai-sync config" first.'))
        process.exit(1)
      }

      const cliInclude = options.folders
        ? options.folders.split(',').map((f: string) => f.trim()).filter(Boolean)
        : undefined
      const cliExclude = options.exclude
        ? options.exclude.split(',').map((f: string) => f.trim()).filter(Boolean)
        : undefined

      const { include } = mergeCliIncludeExclude({
        cliInclude,
        cliExclude,
        configInclude: config.commit?.include,
        configExclude: config.commit?.exclude,
        defaultInclude: DEFAULT_AI_FOLDERS,
      })

      const targetFolders = includeToFolders(include)

      await commitCommand(config.repoUrl, config.branch, options.message, targetFolders)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

// --- commit-project ---
program
  .command('commit-project')
  .description(
    'Commit Project: Submit project files to remote repository via PR/MR (paths from -f or config)'
  )
  .option(
    '-f, --folders <folders>',
    'Target folders/files to sync (comma-separated; overrides include from config)'
  )
  .option(
    '--exclude <patterns>',
    'Exclude patterns (comma-separated; overrides exclude from config)'
  )
  .option('-r, --repo <url>', 'Remote repository URL (overrides config)')
  .option('-b, --branch <branch>', 'Target branch name (overrides config)')
  .option('-m, --message <message>', 'Commit message (default: feat: sync AI capabilities)')
  .action(async (options) => {
    try {
      await commitProjectCommand({
        ...options,
        exclude: options.exclude,
      })
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })

program.parse()
