import chalk from 'chalk'
import * as fs from 'fs-extra'
import inquirer from 'inquirer'
import ora from 'ora'
import * as os from 'os'
import * as path from 'path'
import simpleGit from 'simple-git'

import { getConfig } from '../utils/config'
import { cloneRepository } from '../utils/git'

function toKebabCase(name: string): string {
  const slug = name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  return slug || 'new-project'
}

const TEXT_EXTENSIONS = new Set([
  '.md', '.txt', '.json', '.js', '.ts', '.tsx', '.jsx',
  '.css', '.scss', '.html', '.xml', '.yaml', '.yml',
  '.sh', '.mdc', '.toml', '.ini',
])

function isTextFileForReplace(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return TEXT_EXTENSIONS.has(ext)
}

async function replaceInDir(
  dir: string,
  search: string,
  replace: string,
  searchZh?: string,
  replaceZh?: string
): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.name === 'node_modules' || ent.name === '.git') continue
    if (ent.isDirectory()) {
      await replaceInDir(full, search, replace, searchZh, replaceZh)
      continue
    }
    if (!ent.isFile() || !isTextFileForReplace(full)) continue
    try {
      let content = await fs.readFile(full, 'utf-8')
      const original = content
      content = content.split(search).join(replace)
      if (searchZh && replaceZh) {
        content = content.split(searchZh).join(replaceZh)
      }
      if (content !== original) {
        await fs.writeFile(full, content, 'utf-8')
      }
    } catch {
      // skip non-text or unreadable files
    }
  }
}

export interface InitProjectOptions {
  repoUrl?: string
  branch?: string
}

export async function initProjectCommand(options: InitProjectOptions = {}): Promise<void> {
  const config = await getConfig({
    repoUrl: options.repoUrl,
    branch: options.branch,
  })

  if (!config.repoUrl) {
    console.log(
      chalk.red('Error: Repository URL is not configured. Run "project-ai-sync config" first.')
    )
    process.exit(1)
  }

  const repoUrl = config.repoUrl
  const branch = options.branch ?? config.branch ?? 'main'

  const templateName = config.initProject?.templateName || ''
  const templateNameZh = config.initProject?.templateNameZh || ''

  console.log(
    chalk.blue('\nCreate a new project based on the remote template repository\n')
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const questions: any[] = [
    {
      type: 'input',
      name: 'nameEn',
      message: 'Project name (for package name / directory):',
      default: 'my-project',
      validate: (v: string) => (v?.trim() ? true : 'Please enter a project name'),
    },
  ]

  if (templateNameZh) {
    questions.push({
      type: 'input',
      name: 'nameZh',
      message: 'Project display name (Chinese, optional):',
      default: '',
    })
  }

  questions.push({
    type: 'confirm',
    name: 'confirm',
    message: ((ans: { nameEn: string }) => {
      const slug = toKebabCase(ans.nameEn)
      const target = path.join(process.cwd(), slug)
      return `Create project?\n  Name: ${slug}\n  Path: ${target}\n  Repo: ${repoUrl} (${branch})\nConfirm?`
    }) as unknown as string,
    default: true,
  })

  const answers = await inquirer.prompt<{
    nameEn: string
    nameZh?: string
    confirm: boolean
  }>(questions)

  if (!answers.confirm) {
    console.log(chalk.gray('Cancelled'))
    return
  }

  const nameEn = answers.nameEn.trim()
  const nameZh = answers.nameZh?.trim() || ''
  const projectSlug = toKebabCase(nameEn)
  const targetDir = path.join(process.cwd(), projectSlug)

  const spinner = ora('Creating new project from template...').start()

  let clonedDir: string | null = null
  try {
    spinner.text = `Cloning ${repoUrl} (${branch})...`
    clonedDir = await cloneRepository({
      repoUrl,
      branch,
      targetDir: os.tmpdir(),
    })

    if (templateName) {
      spinner.text = `Replacing template name (${templateName} -> ${projectSlug})...`
      await replaceInDir(
        clonedDir,
        templateName,
        projectSlug,
        templateNameZh || undefined,
        nameZh || undefined
      )
    }

    if (await fs.pathExists(targetDir)) {
      spinner.fail(`Target directory already exists: ${targetDir}`)
      throw new Error('Please choose a different name or remove the existing directory')
    }

    spinner.text = `Copying to ${targetDir}...`
    await fs.ensureDir(path.dirname(targetDir))
    await fs.copy(clonedDir, targetDir, {
      filter: (src) => {
        const name = path.basename(src)
        return name !== 'node_modules' && name !== '.git'
      },
    })

    if (clonedDir) await fs.remove(clonedDir)
    clonedDir = null

    spinner.text = 'Running git init...'
    const targetGit = simpleGit(targetDir)
    await targetGit.init()

    spinner.succeed('Project created successfully')
    console.log(chalk.green(`\n✅ Project generated: ${targetDir}`))
    console.log(chalk.gray(`   Name: ${projectSlug}`))
    if (nameZh) console.log(chalk.gray(`   Display name: ${nameZh}`))
    console.log(chalk.gray('   git init done — disconnected from template repo'))
    console.log(
      chalk.blue(`\nNext: cd ${path.basename(targetDir)} && npm install\n`)
    )
  } catch (err) {
    spinner.fail('Failed to create project')
    throw err
  } finally {
    if (clonedDir) {
      await fs.remove(clonedDir).catch(() => {})
    }
  }
}
