import chalk from 'chalk'
import ora from 'ora'

import { performGitMerge } from '../utils/git'
import { DEFAULT_AI_FOLDERS } from '../utils/config'

export async function updateCommand(
  repoUrl: string,
  branch: string,
  targetFolders: string[] = DEFAULT_AI_FOLDERS,
  options: { checkOnly?: boolean } = {}
): Promise<void> {
  const spinner = ora('Updating AI capabilities...').start()
  const cwd = process.cwd()

  try {
    spinner.text = 'Performing git merge with file history...'
    spinner.stop()
    try {
      const mergeResult = await performGitMerge(repoUrl, branch, cwd, targetFolders, {
        checkOnly: options.checkOnly,
      })
      spinner.start()

      if (mergeResult.conflicts.length > 0) {
        spinner.warn(`Merge has ${mergeResult.conflicts.length} conflict(s)`)
        console.log(
          chalk.blue(
            '\n✓ Git merge completed. Your editor should now show merge conflict UI.\n' +
              'Resolve conflicts, then run: git merge --continue'
          )
        )
      } else if (mergeResult.merged) {
        spinner.succeed('Git merge completed successfully without conflicts')
        console.log(chalk.green('\n✅ All files merged successfully - no conflicts detected'))
      }
    } catch (error: unknown) {
      spinner.fail('Git merge failed')
      throw error
    }
  } catch (error) {
    spinner.fail('Failed to update')
    throw error
  }
}
