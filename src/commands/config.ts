import chalk from 'chalk'
import inquirer from 'inquirer'
import * as path from 'path'

import {
  configExists,
  deleteConfig,
  getConfig,
  readConfig,
  SyncConfig,
  writeConfig,
} from '../utils/config'

function printSyncConfig(name: string, include?: string[], exclude?: string[]) {
  console.log(chalk.blue(`  ${name}:`))
  console.log(chalk.gray(`    Include: ${include?.join(', ') || 'none'}`))
  console.log(chalk.gray(`    Exclude: ${exclude?.join(', ') || 'none'}`))
}

function printFullConfig(config: SyncConfig) {
  console.log(chalk.blue(`\nRepository URL: ${config.repoUrl || chalk.yellow('(not set)')}`))
  console.log(chalk.blue(`Branch: ${config.branch}`))
  console.log(chalk.blue(`\nSync configs:`))

  printSyncConfig('init', config.init?.include, config.init?.exclude)
  printSyncConfig('update', config.update?.include, config.update?.exclude)
  printSyncConfig('commit', config.commit?.include, config.commit?.exclude)
  printSyncConfig('updateProject', config.updateProject?.include, config.updateProject?.exclude)
  printSyncConfig('commitProject', config.commitProject?.include, config.commitProject?.exclude)

  if (config.initProject?.templateName || config.initProject?.templateNameZh) {
    console.log(chalk.blue(`\nInit Project:`))
    console.log(chalk.gray(`    Template name: ${config.initProject?.templateName || 'none'}`))
    console.log(chalk.gray(`    Template name (zh): ${config.initProject?.templateNameZh || 'none'}`))
  }
}

export async function configCommand(options: {
  repo?: string
  branch?: string
  updateProjectInclude?: string
  updateProjectExclude?: string
  initExclude?: string
  updateExclude?: string
  commitExclude?: string
  commitProjectInclude?: string
  commitProjectExclude?: string
  show?: boolean
  delete?: boolean
}): Promise<void> {
  const cwd = process.cwd()
  const configPath = path.join(cwd, '.project-ai-syncrc.json')

  if (options.show) {
    const config = await readConfig(cwd)
    if (config) {
      console.log(chalk.green('\nCurrent configuration:'))
      printFullConfig(config)
    } else {
      console.log(chalk.yellow('\nNo configuration file found. Using defaults.'))
      const defaultConfig = await getConfig()
      console.log(chalk.blue(`\nDefault settings:`))
      printFullConfig(defaultConfig)
    }
    return
  }

  if (options.delete) {
    if (await configExists(cwd)) {
      await deleteConfig(cwd)
      console.log(chalk.green('\n✓ Configuration file deleted'))
    } else {
      console.log(chalk.yellow('\nNo configuration file found'))
    }
    return
  }

  const hasCliOptions =
    options.repo ||
    options.branch ||
    options.updateProjectInclude ||
    options.updateProjectExclude ||
    options.initExclude ||
    options.updateExclude ||
    options.commitExclude ||
    options.commitProjectInclude ||
    options.commitProjectExclude

  const hasConfig = await configExists(cwd)

  if (hasCliOptions) {
    const parseList = (input: string | undefined): string[] | undefined => {
      if (input === undefined) return undefined
      return input.split(',').map((s) => s.trim()).filter(Boolean)
    }

    const config: Partial<SyncConfig> = {}

    if (options.repo) config.repoUrl = options.repo
    if (options.branch) config.branch = options.branch

    const projectInclude = parseList(options.updateProjectInclude)
    const projectExclude = parseList(options.updateProjectExclude)
    if (projectInclude !== undefined || projectExclude !== undefined) {
      config.updateProject = {
        ...(projectInclude !== undefined ? { include: projectInclude } : {}),
        ...(projectExclude !== undefined ? { exclude: projectExclude } : {}),
      }
    }

    if (options.initExclude !== undefined) {
      config.init = { exclude: parseList(options.initExclude) }
    }
    if (options.updateExclude !== undefined) {
      config.update = { exclude: parseList(options.updateExclude) }
    }
    if (options.commitExclude !== undefined) {
      config.commit = { exclude: parseList(options.commitExclude) }
    }

    const commitProjectInclude = parseList(options.commitProjectInclude)
    const commitProjectExclude = parseList(options.commitProjectExclude)
    if (commitProjectInclude !== undefined || commitProjectExclude !== undefined) {
      config.commitProject = {
        ...(commitProjectInclude !== undefined ? { include: commitProjectInclude } : {}),
        ...(commitProjectExclude !== undefined ? { exclude: commitProjectExclude } : {}),
      }
    }

    const existingConfig = await readConfig(cwd)
    const finalConfig: SyncConfig = {
      ...(existingConfig || (await getConfig())),
      ...config,
    }

    await writeConfig(finalConfig, cwd)
    console.log(chalk.green('\n✓ Configuration saved'))
    printFullConfig(finalConfig)
    console.log(chalk.gray(`\nConfig file: ${configPath}`))
    return
  }

  // No CLI options: interactive mode or auto-generate defaults
  if (!hasConfig) {
    console.log(chalk.blue('\nFirst-time setup — creating configuration file.\n'))
  }

  const currentConfig = await readConfig(cwd)
  const defaultConfig = await getConfig()

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'repoUrl',
      message: 'Remote repository URL (SSH or HTTPS):',
      default: currentConfig?.repoUrl || defaultConfig.repoUrl || undefined,
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Repository URL is required. Example: git@github.com:user/repo.git'
        }
        return true
      },
    },
    {
      type: 'input',
      name: 'branch',
      message: 'Default branch name:',
      default: currentConfig?.branch || defaultConfig.branch,
      validate: (input: string) => {
        if (!input.trim()) return 'Branch name is required'
        return true
      },
    },
    {
      type: 'input',
      name: 'initExclude',
      message: 'Init exclude patterns (comma-separated, optional):',
      default: (currentConfig?.init?.exclude || defaultConfig.init?.exclude || []).join(', '),
    },
    {
      type: 'input',
      name: 'updateExclude',
      message: 'Update exclude patterns (comma-separated, optional):',
      default: (currentConfig?.update?.exclude || defaultConfig.update?.exclude || []).join(', '),
    },
    {
      type: 'input',
      name: 'commitExclude',
      message: 'Commit exclude patterns (comma-separated, optional):',
      default: (currentConfig?.commit?.exclude || defaultConfig.commit?.exclude || []).join(', '),
    },
    {
      type: 'input',
      name: 'updateProjectInclude',
      message: 'Update Project include patterns (comma-separated):',
      default: (
        currentConfig?.updateProject?.include ||
        defaultConfig.updateProject?.include ||
        []
      ).join(', '),
    },
    {
      type: 'input',
      name: 'updateProjectExclude',
      message: 'Update Project exclude patterns (comma-separated):',
      default: (
        currentConfig?.updateProject?.exclude ||
        defaultConfig.updateProject?.exclude ||
        []
      ).join(', '),
    },
    {
      type: 'input',
      name: 'commitProjectInclude',
      message: 'Commit Project include patterns (comma-separated, optional):',
      default: (
        currentConfig?.commitProject?.include ||
        defaultConfig.commitProject?.include ||
        []
      ).join(', '),
    },
    {
      type: 'input',
      name: 'commitProjectExclude',
      message: 'Commit Project exclude patterns (comma-separated, optional):',
      default: (
        currentConfig?.commitProject?.exclude ||
        defaultConfig.commitProject?.exclude ||
        []
      ).join(', '),
    },
  ])

  const parseList = (input: string | undefined): string[] => {
    if (!input) return []
    return input.split(',').map((s) => s.trim()).filter(Boolean)
  }

  const config: Partial<SyncConfig> = {
    repoUrl: answers.repoUrl,
    branch: answers.branch,
    init: {
      exclude: parseList(answers.initExclude),
    },
    update: {
      exclude: parseList(answers.updateExclude),
    },
    commit: {
      exclude: parseList(answers.commitExclude),
    },
    updateProject: {
      include: parseList(answers.updateProjectInclude),
      exclude: parseList(answers.updateProjectExclude),
    },
    commitProject: {
      include: parseList(answers.commitProjectInclude),
      exclude: parseList(answers.commitProjectExclude),
    },
  }

  const existingConfig = await readConfig(cwd)
  const finalConfig: SyncConfig = {
    ...(existingConfig || (await getConfig())),
    ...config,
  }

  await writeConfig(finalConfig, cwd)

  console.log(chalk.green('\n✓ Configuration saved'))
  printFullConfig(finalConfig)
  console.log(chalk.gray(`\nConfig file: ${configPath}`))
}
