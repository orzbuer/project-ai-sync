import chalk from 'chalk'

import { commitCommand } from './commit'

export async function commitProjectCommand(options: {
  repo?: string
  branch?: string
  folders?: string
  exclude?: string
  message?: string
}): Promise<void> {
  const { getConfig, includeToFolders, mergeCliIncludeExclude } = await import('../utils/config')
  const config = await getConfig({
    repoUrl: options.repo,
    branch: options.branch,
  })

  const cliInclude = options.folders
    ? options.folders
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)
    : undefined

  const cliExclude = options.exclude
    ? options.exclude
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)
    : undefined

  const defaultInclude = config.commitProject?.include || []

  const { include } = mergeCliIncludeExclude({
    cliInclude,
    cliExclude,
    configInclude: config.commitProject?.include,
    configExclude: config.commitProject?.exclude,
    defaultInclude,
  })

  const targetFolders = includeToFolders(include)

  if (targetFolders.length === 0) {
    throw new Error(
      'No target folders/files specified for commit-project. Provide -f, --folders <folders> or configure commitProject.include in .project-ai-syncrc.json.'
    )
  }

  await commitCommand(config.repoUrl, config.branch, options.message, targetFolders)

  console.log(
    chalk.gray(
      `\ncommit-project synced paths: ${targetFolders.map((f) => JSON.stringify(f)).join(', ')}`
    )
  )
}
