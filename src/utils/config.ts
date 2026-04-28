import chalk from 'chalk'
import * as fs from 'fs-extra'
import * as path from 'path'

export interface IPathSyncConfig {
  include?: string[]
  exclude?: string[]
}

export interface SyncConfig {
  repoUrl: string
  branch: string

  init?: IPathSyncConfig
  update?: IPathSyncConfig
  commit?: IPathSyncConfig
  updateProject?: IPathSyncConfig
  commitProject?: IPathSyncConfig

  initProject?: {
    templateName?: string
    templateNameZh?: string
  }
}

const CONFIG_FILE_NAME = '.project-ai-syncrc.json'

export const DEFAULT_AI_FOLDERS = ['.cursor', '.claude', 'AGENTS.md', '.github/copilot']

export const DEFAULT_PROJECT_SYNC_EXCLUDE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/*.log',
  '**/.DS_Store',
]

const DEFAULT_CONFIG: SyncConfig = {
  repoUrl: '',
  branch: 'main',

  init: {
    include: [...DEFAULT_AI_FOLDERS],
    exclude: [],
  },
  update: {
    include: [...DEFAULT_AI_FOLDERS],
    exclude: [],
  },
  commit: {
    include: [...DEFAULT_AI_FOLDERS],
    exclude: [],
  },
  updateProject: {
    include: ['src/**'],
    exclude: [...DEFAULT_PROJECT_SYNC_EXCLUDE],
  },
  commitProject: {
    include: [],
    exclude: [],
  },
  initProject: {
    templateName: '',
    templateNameZh: '',
  },
}

export { DEFAULT_CONFIG }

export function normalizePathList(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return []
  }
  return input.map((v) => String(v).trim()).filter(Boolean)
}

export function shouldUseDefaultInclude(include: string[] | undefined): boolean {
  return !include || include.length === 0
}

export function resolveCommandInclude(
  configInclude: string[] | undefined,
  defaultInclude: string[]
) {
  return shouldUseDefaultInclude(configInclude) ? defaultInclude : configInclude
}

export function resolveCommandExclude(
  configExclude: string[] | undefined,
  fallbackExclude: string[] = []
): string[] {
  const normalized = configExclude || []
  return normalized.length > 0 ? normalized : fallbackExclude
}

export function mergeCliIncludeExclude(options: {
  cliInclude?: string[]
  cliExclude?: string[]
  configInclude?: string[]
  configExclude?: string[]
  defaultInclude: string[]
  fallbackExclude?: string[]
}): { include: string[]; exclude: string[] } {
  const include = options.cliInclude
    ? options.cliInclude
    : resolveCommandInclude(options.configInclude, options.defaultInclude) || []

  const exclude = options.cliExclude
    ? options.cliExclude
    : resolveCommandExclude(options.configExclude, options.fallbackExclude)

  return { include, exclude }
}

export function includeToFolders(include: string[]): string[] {
  const folders: string[] = []
  for (const pattern of include) {
    const folder = pattern.replace(/\*\*/g, '').replace(/\*/g, '').trim().replace(/\/+$/, '')
    if (folder && !folders.includes(folder)) {
      folders.push(folder)
    }
  }
  return folders
}

export function getConfigPath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_FILE_NAME)
}

export async function readConfig(cwd: string = process.cwd()): Promise<SyncConfig | null> {
  const configPath = getConfigPath(cwd)

  if (!(await fs.pathExists(configPath))) {
    return null
  }

  try {
    const configContent = await fs.readJson(configPath)
    return {
      repoUrl: configContent.repoUrl || DEFAULT_CONFIG.repoUrl,
      branch: configContent.branch || DEFAULT_CONFIG.branch,

      init: {
        ...DEFAULT_CONFIG.init,
        ...configContent.init,
      },
      update: {
        ...DEFAULT_CONFIG.update,
        ...configContent.update,
      },
      commit: {
        ...DEFAULT_CONFIG.commit,
        ...configContent.commit,
      },
      updateProject: {
        ...DEFAULT_CONFIG.updateProject,
        ...configContent.updateProject,
      },
      commitProject: {
        ...DEFAULT_CONFIG.commitProject,
        ...configContent.commitProject,
      },
      initProject: {
        ...DEFAULT_CONFIG.initProject,
        ...configContent.initProject,
      },
    }
  } catch (error) {
    console.log(chalk.yellow(`Warning: Failed to read config file: ${error}`))
    return null
  }
}

export async function writeConfig(
  config: Partial<SyncConfig>,
  cwd: string = process.cwd()
): Promise<void> {
  const configPath = getConfigPath(cwd)
  const existingConfig = await readConfig(cwd)
  const mergedConfig: SyncConfig = {
    ...DEFAULT_CONFIG,
    ...existingConfig,
    ...config,

    init: {
      ...DEFAULT_CONFIG.init,
      ...existingConfig?.init,
      ...config.init,
    },
    update: {
      ...DEFAULT_CONFIG.update,
      ...existingConfig?.update,
      ...config.update,
    },
    commit: {
      ...DEFAULT_CONFIG.commit,
      ...existingConfig?.commit,
      ...config.commit,
    },
    updateProject: {
      ...DEFAULT_CONFIG.updateProject,
      ...existingConfig?.updateProject,
      ...config.updateProject,
    },
    commitProject: {
      ...DEFAULT_CONFIG.commitProject,
      ...existingConfig?.commitProject,
      ...config.commitProject,
    },
    initProject: {
      ...DEFAULT_CONFIG.initProject,
      ...existingConfig?.initProject,
      ...config.initProject,
    },
  }

  await fs.writeJson(configPath, mergedConfig, { spaces: 2 })
}

export async function getConfig(
  overrides?: Partial<SyncConfig>,
  cwd: string = process.cwd()
): Promise<SyncConfig> {
  const fileConfig = await readConfig(cwd)

  const filteredOverrides: Partial<SyncConfig> = {}
  if (overrides) {
    if (overrides.repoUrl !== undefined) {
      filteredOverrides.repoUrl = overrides.repoUrl
    }
    if (overrides.branch !== undefined) {
      filteredOverrides.branch = overrides.branch
    }
    if (overrides.init !== undefined) {
      filteredOverrides.init = overrides.init
    }
    if (overrides.update !== undefined) {
      filteredOverrides.update = overrides.update
    }
    if (overrides.commit !== undefined) {
      filteredOverrides.commit = overrides.commit
    }
    if (overrides.updateProject !== undefined) {
      filteredOverrides.updateProject = overrides.updateProject
    }
    if (overrides.commitProject !== undefined) {
      filteredOverrides.commitProject = overrides.commitProject
    }
    if (overrides.initProject !== undefined) {
      filteredOverrides.initProject = overrides.initProject
    }
  }

  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...filteredOverrides,

    init: {
      ...DEFAULT_CONFIG.init,
      ...fileConfig?.init,
      ...filteredOverrides.init,
    },
    update: {
      ...DEFAULT_CONFIG.update,
      ...fileConfig?.update,
      ...filteredOverrides.update,
    },
    commit: {
      ...DEFAULT_CONFIG.commit,
      ...fileConfig?.commit,
      ...filteredOverrides.commit,
    },
    updateProject: {
      ...DEFAULT_CONFIG.updateProject,
      ...fileConfig?.updateProject,
      ...filteredOverrides.updateProject,
    },
    commitProject: {
      ...DEFAULT_CONFIG.commitProject,
      ...fileConfig?.commitProject,
      ...filteredOverrides.commitProject,
    },
    initProject: {
      ...DEFAULT_CONFIG.initProject,
      ...fileConfig?.initProject,
      ...filteredOverrides.initProject,
    },
  }
}

export async function deleteConfig(cwd: string = process.cwd()): Promise<void> {
  const configPath = getConfigPath(cwd)
  if (await fs.pathExists(configPath)) {
    await fs.remove(configPath)
  }
}

export async function configExists(cwd: string = process.cwd()): Promise<boolean> {
  const configPath = getConfigPath(cwd)
  return await fs.pathExists(configPath)
}
