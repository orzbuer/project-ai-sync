import chalk from 'chalk'
import * as fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import * as os from 'os'
import * as path from 'path'
import simpleGit from 'simple-git'

import { DEFAULT_AI_FOLDERS } from '../utils/config'
import { cleanupTempDir } from '../utils/git'
import { detectPlatform, generatePRUrl, getPRLabel } from '../utils/platform'

export async function commitCommand(
  repoUrl: string,
  targetBranch: string,
  commitMessage: string | undefined,
  targetFolders: string[] = DEFAULT_AI_FOLDERS
): Promise<void> {
  const spinner = ora('Preparing to submit changes...').start()
  const cwd = process.cwd()
  const timestamp = Date.now()
  const tempDir = path.join(os.tmpdir(), `project-ai-sync-commit-${timestamp}`)

  try {
    const missingFolders: string[] = []
    for (const folder of targetFolders) {
      const folderPath = path.join(cwd, folder)
      if (!(await fs.pathExists(folderPath))) {
        missingFolders.push(folder)
      }
    }

    if (missingFolders.length > 0) {
      spinner.fail('Some folders are missing:')
      missingFolders.forEach((folder) => {
        console.log(chalk.red(`  - ${folder}`))
      })
      throw new Error('Please ensure all target folders exist before submitting changes')
    }

    spinner.text = 'Cloning remote repository...'
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir)
    }

    const git = simpleGit()
    await git.clone(repoUrl, tempDir, ['--branch', targetBranch, '--depth', '1'])

    spinner.text = 'Copying folders to temporary repository...'
    for (const folder of targetFolders) {
      const sourcePath = path.join(cwd, folder)
      const targetPath = path.join(tempDir, folder)

      if (await fs.pathExists(targetPath)) {
        await fs.remove(targetPath)
      }

      await fs.copy(sourcePath, targetPath, {
        overwrite: true,
        filter: (src) => !src.includes('node_modules') && !src.includes('.git'),
      })
    }

    spinner.text = 'Creating feature branch...'
    const tempGit = simpleGit(tempDir)

    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')

    const resolveProjectName = async (): Promise<string> => {
      try {
        const packageJson = (await fs.readJson(path.join(cwd, 'package.json'))) as {
          name?: unknown
        }
        if (typeof packageJson.name === 'string' && packageJson.name.trim()) {
          return packageJson.name.trim()
        }
      } catch {
        // ignore
      }
      return 'project'
    }

    const projectName = await resolveProjectName()
    const branchName = `feature/${projectName}-${year}-${month}-${day}-${timestamp}`

    await tempGit.checkoutLocalBranch(branchName)

    spinner.text = 'Staging changes...'
    await tempGit.add(targetFolders)

    const status = await tempGit.status()
    if (status.files.length === 0) {
      spinner.warn('No changes detected')
      await cleanupTempDir(tempDir)
      console.log(chalk.yellow('No changes to submit'))
      return
    }

    let finalCommitMessage: string = commitMessage || 'feat: sync AI capabilities'

    if (
      !finalCommitMessage.match(
        /^(feat|fix|chore|docs|style|refactor|perf|test|build|ci|revert)(\(.+\))?: /
      )
    ) {
      if (!finalCommitMessage.includes(':')) {
        finalCommitMessage = `feat: ${finalCommitMessage}`
      } else {
        finalCommitMessage = `feat: ${finalCommitMessage}`
      }
    }

    spinner.text = 'Committing changes...'
    await tempGit.commit(finalCommitMessage)

    spinner.text = 'Pushing to remote repository...'
    await tempGit.push(['-u', 'origin', branchName])

    const platformInfo = detectPlatform(repoUrl)
    const prUrl = generatePRUrl(platformInfo, branchName, targetBranch)
    const prLabel = getPRLabel(platformInfo.platform)

    spinner.succeed(chalk.green('Successfully pushed changes!'))
    console.log(chalk.green('\n✓ Changes have been pushed to remote repository'))
    console.log(chalk.blue(`\nBranch: ${branchName}`))

    if (prUrl) {
      console.log(chalk.blue(`\nCreate ${prLabel}:`))
      console.log(chalk.cyan(prUrl))

      const { openPR } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'openPR',
          message: `Do you want to open the ${prLabel} creation page in your browser?`,
          default: true,
        },
      ])

      if (openPR) {
        try {
          const open = (await import('open')).default
          await open(prUrl)
        } catch {
          console.log(
            chalk.yellow('\nCould not open browser automatically. Please copy the URL above.')
          )
        }
      }
    } else {
      console.log(chalk.yellow(`\nPlease create a ${prLabel} manually for branch: ${branchName}`))
    }

    await cleanupTempDir(tempDir)
  } catch (error) {
    spinner.fail('Failed to submit changes')
    await cleanupTempDir(tempDir)
    throw error
  }
}
