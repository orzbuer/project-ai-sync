import chalk from 'chalk'
import ora from 'ora'

import { cleanupTempDir, cloneRepository, copyFolders, CopyOptions } from '../utils/git'
import { DEFAULT_AI_FOLDERS } from '../utils/config'

export async function initCommand(
  repoUrl: string,
  branch: string,
  targetFolders: string[] = DEFAULT_AI_FOLDERS,
  options: { checkOnly?: boolean; merge?: boolean } = {}
): Promise<void> {
  const spinner = ora('Initializing AI capabilities...').start()
  const cwd = process.cwd()
  let clonedDir: string | null = null

  try {
    spinner.text = 'Cloning remote repository...'
    clonedDir = await cloneRepository({
      repoUrl,
      branch,
      targetDir: cwd,
    })

    spinner.text = 'Copying folders (deleting existing first)...'
    const copyOptions: CopyOptions = {
      deleteFirst: true,
      checkOnly: options.checkOnly,
      merge: options.merge,
    }

    const result = await copyFolders(clonedDir, cwd, targetFolders, copyOptions)

    if (result.conflicts.length > 0) {
      spinner.warn(`Found ${result.conflicts.length} conflict(s)`)
      result.conflicts.forEach((conflict) => {
        if (conflict.merged) {
          console.log(chalk.blue(`  - ${conflict.path} (merge conflict markers generated)`))
        } else {
          console.log(chalk.yellow(`  - ${conflict.path}`))
        }
      })
      if (!options.checkOnly && !options.merge) {
        console.log(chalk.yellow('\nUse --merge to generate conflict markers.'))
      }
    }

    if (result.merged.length > 0) {
      console.log(
        chalk.blue(`\n✓ Generated merge conflict markers for ${result.merged.length} file(s):`)
      )
      result.merged.forEach((merged) => {
        console.log(chalk.gray(`  - ${merged}`))
      })
      console.log(
        chalk.yellow('\n⚠ Please resolve conflicts manually by editing the files above.')
      )
    }

    spinner.text = 'Cleaning up...'
    await cleanupTempDir(clonedDir)

    if (options.checkOnly) {
      spinner.info('Check completed (dry-run mode)')
    } else {
      spinner.succeed(chalk.green('Successfully initialized AI capabilities!'))
      console.log(chalk.green('\n✓ Copied folders:'))
      result.copied.forEach((folder) => {
        console.log(chalk.gray(`  - ${folder}`))
      })
    }
  } catch (error) {
    spinner.fail('Failed to initialize')
    if (clonedDir) {
      await cleanupTempDir(clonedDir)
    }
    throw error
  }
}
