import chalk from 'chalk'
import * as crypto from 'crypto'
import * as fs from 'fs-extra'
import * as os from 'os'
import * as path from 'path'
import simpleGit from 'simple-git'

export const TARGET_FOLDERS = ['.cursor', '.claude', 'AGENTS.md', '.github/copilot']

export interface CloneOptions {
  repoUrl: string
  branch: string
  targetDir: string
}

export async function cloneRepository(options: CloneOptions): Promise<string> {
  const { repoUrl, branch } = options
  const timestamp = Date.now()
  const tempDir = path.join(os.tmpdir(), `project-ai-sync-${timestamp}`)

  if (await fs.pathExists(tempDir)) {
    await fs.remove(tempDir)
  }

  console.log(chalk.blue(`Cloning repository from ${repoUrl} (branch: ${branch})...`))

  const git = simpleGit()
  await git.clone(repoUrl, tempDir, ['--branch', branch, '--depth', '1'])

  return tempDir
}

async function calculateFileHash(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath)
    return crypto.createHash('sha256').update(content).digest('hex')
  } catch {
    return ''
  }
}

async function isTextFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath)
    if (!stat.isFile()) return false

    const ext = path.extname(filePath).toLowerCase()
    const textExtensions = [
      '.md', '.txt', '.json', '.js', '.ts', '.tsx', '.jsx',
      '.css', '.scss', '.html', '.xml', '.yaml', '.yml',
      '.sh', '.bash', '.zsh', '.py', '.java', '.cpp', '.c',
      '.h', '.hpp', '.go', '.rs', '.rb', '.php', '.sql',
      '.vue', '.svelte', '.mdc', '.toml', '.ini', '.cfg',
    ]

    if (textExtensions.includes(ext)) return true

    const buffer = await fs.readFile(filePath)
    return !buffer.includes(0)
  } catch {
    return false
  }
}

async function hasLineLevelDifferences(file1: string, file2: string): Promise<boolean> {
  try {
    const content1 = await fs.readFile(file1, 'utf-8')
    const content2 = await fs.readFile(file2, 'utf-8')

    const lines1 = content1.split(/\r?\n/)
    const lines2 = content2.split(/\r?\n/)

    if (lines1.length !== lines2.length) return true

    for (let i = 0; i < lines1.length; i++) {
      if (lines1[i] !== lines2[i]) return true
    }

    return false
  } catch {
    return true
  }
}

async function arePathsDifferent(path1: string, path2: string): Promise<boolean> {
  if (!(await fs.pathExists(path1)) || !(await fs.pathExists(path2))) return true

  const stat1 = await fs.stat(path1)
  const stat2 = await fs.stat(path2)

  if (stat1.isDirectory() !== stat2.isDirectory()) return true

  if (stat1.isFile() && stat2.isFile()) {
    if (stat1.size !== stat2.size) return true

    if (await isTextFile(path1)) {
      return await hasLineLevelDifferences(path1, path2)
    }

    const hash1 = await calculateFileHash(path1)
    const hash2 = await calculateFileHash(path2)
    return hash1 !== hash2
  }

  if (stat1.isDirectory() && stat2.isDirectory()) {
    const files1 = await fs.readdir(path1)
    const files2 = await fs.readdir(path2)

    if (files1.length !== files2.length) return true

    for (const file of files1) {
      if (file === '.git' || file === 'node_modules') continue

      const subPath1 = path.join(path1, file)
      const subPath2 = path.join(path2, file)

      if (!(await fs.pathExists(subPath2))) return true
      if (await arePathsDifferent(subPath1, subPath2)) return true
    }

    return false
  }

  return false
}

// --- Diff / Merge ---

interface DiffOperation {
  type: 'equal' | 'delete' | 'insert' | 'replace'
  currentLines?: string[]
  incomingLines?: string[]
}

function computeLCS(currentLines: string[], incomingLines: string[]): number[][] {
  const m = currentLines.length
  const n = incomingLines.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (currentLines[i - 1] === incomingLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  return dp
}

function extractLCS(
  currentLines: string[],
  incomingLines: string[],
  dp: number[][]
): Array<{ currentIdx: number; incomingIdx: number }> {
  const lcs: Array<{ currentIdx: number; incomingIdx: number }> = []
  let i = currentLines.length
  let j = incomingLines.length

  while (i > 0 && j > 0) {
    if (currentLines[i - 1] === incomingLines[j - 1]) {
      lcs.unshift({ currentIdx: i - 1, incomingIdx: j - 1 })
      i--
      j--
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--
    } else {
      j--
    }
  }

  return lcs
}

function diffLines(currentLines: string[], incomingLines: string[]): DiffOperation[] {
  const operations: DiffOperation[] = []

  if (currentLines.length === 0 && incomingLines.length === 0) return []
  if (currentLines.length === 0) return [{ type: 'insert', incomingLines }]
  if (incomingLines.length === 0) return [{ type: 'delete', currentLines }]

  const dp = computeLCS(currentLines, incomingLines)
  const lcs = extractLCS(currentLines, incomingLines, dp)

  const currentMatched = new Set<number>()
  const incomingMatched = new Set<number>()

  for (const match of lcs) {
    currentMatched.add(match.currentIdx)
    incomingMatched.add(match.incomingIdx)
  }

  let currentIdx = 0
  let incomingIdx = 0

  while (currentIdx < currentLines.length || incomingIdx < incomingLines.length) {
    const currentIsMatched = currentMatched.has(currentIdx)
    const incomingIsMatched = incomingMatched.has(incomingIdx)

    if (
      currentIsMatched &&
      incomingIsMatched &&
      currentLines[currentIdx] === incomingLines[incomingIdx]
    ) {
      const commonLines: string[] = []
      while (
        currentIdx < currentLines.length &&
        incomingIdx < incomingLines.length &&
        currentMatched.has(currentIdx) &&
        incomingMatched.has(incomingIdx) &&
        currentLines[currentIdx] === incomingLines[incomingIdx]
      ) {
        commonLines.push(currentLines[currentIdx])
        currentIdx++
        incomingIdx++
      }

      if (commonLines.length > 0) {
        operations.push({
          type: 'equal',
          currentLines: commonLines,
          incomingLines: commonLines,
        })
      }
    } else {
      const currentConflict: string[] = []
      const incomingConflict: string[] = []

      while (currentIdx < currentLines.length && !currentMatched.has(currentIdx)) {
        currentConflict.push(currentLines[currentIdx])
        currentIdx++
      }

      while (incomingIdx < incomingLines.length && !incomingMatched.has(incomingIdx)) {
        incomingConflict.push(incomingLines[incomingIdx])
        incomingIdx++
      }

      if (currentConflict.length > 0 || incomingConflict.length > 0) {
        if (currentConflict.length > 0 && incomingConflict.length > 0) {
          operations.push({
            type: 'replace',
            currentLines: currentConflict,
            incomingLines: incomingConflict,
          })
        } else if (currentConflict.length > 0) {
          operations.push({ type: 'delete', currentLines: currentConflict })
        } else {
          operations.push({ type: 'insert', incomingLines: incomingConflict })
        }
      }
    }
  }

  return operations
}

export async function generateMergeConflictFile(
  sourcePath: string,
  targetPath: string,
  outputPath: string
): Promise<void> {
  const sourceContent = await fs.readFile(sourcePath, 'utf-8')
  const targetContent = await fs.readFile(targetPath, 'utf-8')

  const sourceLines = sourceContent.split(/\r?\n/)
  const targetLines = targetContent.split(/\r?\n/)

  const diff = diffLines(targetLines, sourceLines)

  const mergedLines: string[] = []
  let hasConflict = false

  for (const op of diff) {
    if (op.type === 'equal') {
      if (op.currentLines) mergedLines.push(...op.currentLines)
    } else if (op.type === 'replace') {
      hasConflict = true
      mergedLines.push('<<<<<<< HEAD')
      if (op.currentLines) mergedLines.push(...op.currentLines)
      mergedLines.push('=======')
      if (op.incomingLines) mergedLines.push(...op.incomingLines)
      mergedLines.push('>>>>>>> incoming')
    } else if (op.type === 'delete') {
      hasConflict = true
      mergedLines.push('<<<<<<< HEAD')
      if (op.currentLines) mergedLines.push(...op.currentLines)
      mergedLines.push('=======')
      mergedLines.push('>>>>>>> incoming')
    } else if (op.type === 'insert') {
      hasConflict = true
      mergedLines.push('<<<<<<< HEAD')
      mergedLines.push('=======')
      if (op.incomingLines) mergedLines.push(...op.incomingLines)
      mergedLines.push('>>>>>>> incoming')
    }
  }

  if (!hasConflict) {
    await fs.writeFile(outputPath, targetContent, 'utf-8')
    return
  }

  const mergedContent = mergedLines.join('\n')
  await fs.writeFile(outputPath, mergedContent, 'utf-8')
}

// --- Directory merge ---

async function mergeDirectory(
  sourceDir: string,
  targetDir: string,
  relativePath: string,
  result: CopyResult,
  generateConflictMarkers = true
): Promise<void> {
  await fs.ensureDir(targetDir)

  const sourceItems = await fs.readdir(sourceDir)
  const targetItems = new Set(await fs.readdir(targetDir).catch(() => []))

  for (const item of sourceItems) {
    if (item === '.git' || item === 'node_modules') continue

    const sourceItemPath = path.join(sourceDir, item)
    const targetItemPath = path.join(targetDir, item)
    const itemRelativePath = path.join(relativePath, item)

    const sourceStat = await fs.stat(sourceItemPath)

    if (sourceStat.isDirectory()) {
      if (await fs.pathExists(targetItemPath)) {
        const targetStat = await fs.stat(targetItemPath)
        if (targetStat.isDirectory()) {
          await mergeDirectory(sourceItemPath, targetItemPath, itemRelativePath, result)
        } else {
          result.conflicts.push({
            path: itemRelativePath,
            sourcePath: sourceItemPath,
            targetPath: targetItemPath,
          })
          console.log(chalk.yellow(`⚠ Conflict: ${itemRelativePath} (directory vs file)`))
        }
      } else {
        await fs.copy(sourceItemPath, targetItemPath, {
          filter: (src) => !src.includes('node_modules') && !src.includes('.git'),
        })
        result.copied.push(itemRelativePath)
      }
    } else if (sourceStat.isFile()) {
      if (await fs.pathExists(targetItemPath)) {
        const targetStat = await fs.stat(targetItemPath)
        if (targetStat.isFile()) {
          const isDifferent = await arePathsDifferent(sourceItemPath, targetItemPath)
          if (isDifferent) {
            if (generateConflictMarkers && (await isTextFile(sourceItemPath))) {
              try {
                await generateMergeConflictFile(sourceItemPath, targetItemPath, targetItemPath)
                result.merged.push(itemRelativePath)
                result.conflicts.push({
                  path: itemRelativePath,
                  sourcePath: sourceItemPath,
                  targetPath: targetItemPath,
                  merged: true,
                })
                console.log(
                  chalk.blue(`✓ Generated merge conflict markers for ${itemRelativePath}`)
                )
              } catch (error) {
                console.log(chalk.yellow(`Warning: Failed to merge ${itemRelativePath}: ${error}`))
                result.conflicts.push({
                  path: itemRelativePath,
                  sourcePath: sourceItemPath,
                  targetPath: targetItemPath,
                })
              }
            } else {
              result.conflicts.push({
                path: itemRelativePath,
                sourcePath: sourceItemPath,
                targetPath: targetItemPath,
              })
              if (await isTextFile(sourceItemPath)) {
                console.log(chalk.yellow(`⚠ Conflict: ${itemRelativePath} (files differ)`))
              } else {
                console.log(
                  chalk.yellow(`⚠ Binary file conflict: ${itemRelativePath} (both versions kept)`)
                )
              }
            }
          } else {
            result.copied.push(itemRelativePath)
          }
        } else {
          result.conflicts.push({
            path: itemRelativePath,
            sourcePath: sourceItemPath,
            targetPath: targetItemPath,
          })
          console.log(chalk.yellow(`⚠ Conflict: ${itemRelativePath} (file vs directory)`))
        }
      } else {
        await fs.copy(sourceItemPath, targetItemPath)
        result.copied.push(itemRelativePath)
      }
    }
  }

  for (const item of targetItems) {
    if (item === '.git' || item === 'node_modules') continue

    const sourceItemPath = path.join(sourceDir, item)
    const itemRelativePath = path.join(relativePath, item)

    if (!(await fs.pathExists(sourceItemPath))) {
      console.log(chalk.gray(`  Keeping ${itemRelativePath} (exists only in target)`))
    }
  }
}

// --- Copy folders ---

export interface CopyOptions {
  deleteFirst?: boolean
  checkOnly?: boolean
  merge?: boolean
}

export interface CopyResult {
  copied: string[]
  conflicts: Array<{ path: string; sourcePath: string; targetPath: string; merged?: boolean }>
  merged: string[]
}

export async function copyFolders(
  sourceDir: string,
  targetDir: string,
  folders: string[],
  options: CopyOptions = {}
): Promise<CopyResult> {
  const { deleteFirst = false, checkOnly = false, merge = false } = options

  const result: CopyResult = {
    copied: [],
    conflicts: [],
    merged: [],
  }

  for (const folder of folders) {
    const sourcePath = path.join(sourceDir, folder)
    const targetPath = path.join(targetDir, folder)

    if (!(await fs.pathExists(sourcePath))) {
      console.log(chalk.yellow(`Warning: Source folder ${folder} does not exist, skipping...`))
      continue
    }

    if (deleteFirst && (await fs.pathExists(targetPath))) {
      if (checkOnly) {
        console.log(chalk.yellow(`Would delete existing: ${folder}`))
      } else {
        console.log(chalk.yellow(`Deleting existing folder: ${folder}`))
        await fs.remove(targetPath)
      }
    }

    if (!deleteFirst && (await fs.pathExists(targetPath))) {
      const isDifferent = await arePathsDifferent(sourcePath, targetPath)

      if (isDifferent) {
        result.conflicts.push({ path: folder, sourcePath, targetPath })

        if (checkOnly) {
          console.log(chalk.red(`⚠ Conflict detected: ${folder} (files differ)`))
          continue
        }

        const stat = await fs.stat(sourcePath)
        if (stat.isDirectory()) {
          try {
            await mergeDirectory(sourcePath, targetPath, folder, result, merge)
            continue
          } catch (error) {
            console.log(chalk.yellow(`Warning: Failed to merge directory ${folder}: ${error}`))
          }
        } else if (stat.isFile()) {
          if (merge) {
            if (await isTextFile(sourcePath)) {
              try {
                await generateMergeConflictFile(sourcePath, targetPath, targetPath)
                result.merged.push(folder)
                result.conflicts[result.conflicts.length - 1].merged = true
                console.log(chalk.blue(`✓ Generated merge conflict markers for ${folder}`))
                console.log(chalk.gray(`  Edit ${targetPath} to resolve conflicts`))
                continue
              } catch (error) {
                console.log(
                  chalk.yellow(`Warning: Failed to generate merge conflict for ${folder}: ${error}`)
                )
              }
            } else {
              console.log(chalk.yellow(`⚠ Binary file conflict: ${folder} (both versions differ)`))
            }
          } else {
            console.log(
              chalk.yellow(
                `⚠ Skipping ${folder} due to conflict (use --merge to generate conflict markers)`
              )
            )
            continue
          }
        }
      }
    }

    if (!checkOnly) {
      console.log(chalk.green(`Copying ${folder}...`))
      await fs.copy(sourcePath, targetPath, {
        overwrite: true,
        filter: (src) => !src.includes('node_modules') && !src.includes('.git'),
      })
      result.copied.push(folder)
    } else {
      console.log(chalk.green(`Would copy: ${folder}`))
      result.copied.push(folder)
    }
  }

  return result
}

export async function cleanupTempDir(tempDir: string): Promise<void> {
  if (await fs.pathExists(tempDir)) {
    await fs.remove(tempDir)
    console.log(chalk.gray('Cleaned up temporary files'))
  }
}

// --- Git merge (real git remote + merge) ---

function parseRepoName(url: string): string {
  const withoutGitSuffix = url.replace(/\.git$/, '')
  // SSH: git@host:group/repo
  const sshMatch = withoutGitSuffix.match(/^[^:]+:(.+)$/)
  if (sshMatch) {
    const parts = sshMatch[1].split('/').filter(Boolean)
    return parts[parts.length - 1] || 'repo'
  }
  // HTTPS: https://host/group/repo
  try {
    const u = new URL(withoutGitSuffix)
    const parts = u.pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || 'repo'
  } catch {
    return 'repo'
  }
}

export async function performGitMerge(
  repoUrl: string,
  branch: string,
  cwd: string,
  targetFolders: string[],
  options: { checkOnly?: boolean } = {}
): Promise<{ conflicts: string[]; merged: boolean }> {
  const git = simpleGit(cwd)
  const conflicts: string[] = []
  let currentBranch = ''

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const ts = Date.now()

  const repoName = parseRepoName(repoUrl)
  const tempRemoteName = `project-ai-sync/${repoName}-${year}-${month}-${day}-${ts}`

  try {
    const isRepo = await git.checkIsRepo()
    if (!isRepo) {
      throw new Error(
        'Current directory is not a git repository. Git merge requires a git repository.'
      )
    }

    currentBranch = await git.revparse(['--abbrev-ref', 'HEAD'])

    const status = await git.status()
    if (status.files.length > 0 && !options.checkOnly) {
      throw new Error(
        'You have uncommitted changes. Please commit or stash them before running merge.'
      )
    }

    if (options.checkOnly) {
      console.log(chalk.blue(`Would add remote: ${tempRemoteName}`))
      console.log(chalk.blue(`Would merge ${branch} from ${repoUrl} into ${currentBranch}`))
      console.log(chalk.blue(`Would limit merge to paths: ${targetFolders.join(', ')}`))
      return { conflicts: [], merged: false }
    }

    console.log(chalk.blue(`Adding remote repository: ${tempRemoteName}...`))
    try {
      await git.addRemote(tempRemoteName, repoUrl)
    } catch {
      try {
        await git.removeRemote(tempRemoteName)
        await git.addRemote(tempRemoteName, repoUrl)
      } catch {
        // Ignore
      }
    }

    console.log(chalk.blue(`Fetching branch ${branch} from remote...`))
    await git.fetch([tempRemoteName, branch])

    const remoteRef = `${tempRemoteName}/${branch}`
    console.log(
      chalk.blue(`Merging ${remoteRef} into ${currentBranch} (with file history)...`)
    )

    const mergeSucceeded = await git
      .merge([remoteRef, '--no-ff', '--no-commit', '--no-edit', '--allow-unrelated-histories'])
      .then(() => true)
      .catch(() => false)

    // Restore non-target files
    const mergeStatus = await git.status()
    const allChangedPaths = new Set<string>()
    for (const f of mergeStatus.files) {
      allChangedPaths.add(f.path)
    }
    for (const r of mergeStatus.renamed) {
      allChangedPaths.add(r.from)
      allChangedPaths.add(r.to)
    }
    const allChangedFiles = Array.from(allChangedPaths)

    const normalize = (p: string) => p.replace(/^\.\//, '').replace(/\\/g, '/')
    const normalizeFolder = (p: string) => normalize(p).replace(/\/+$/, '')
    let restoredCount = 0
    for (const file of allChangedFiles) {
      const normalizedFile = normalize(file)
      const isTargetFile = targetFolders.some((folder) => {
        const folderNorm = normalizeFolder(folder)
        return normalizedFile === folderNorm || normalizedFile.startsWith(folderNorm + '/')
      })
      if (!isTargetFile) {
        const pathForGit = file.replace(/^\.\//, '')
        await git.checkout(['HEAD', '--', pathForGit]).catch(() => {})
        await git.reset(['HEAD', '--', pathForGit]).catch(() => {})
        restoredCount += 1
      }
    }
    if (restoredCount > 0) {
      console.log(chalk.gray(`  Restored ${restoredCount} file(s) outside target paths`))
    }

    // Check conflicts in target paths
    const statusAfter = await git.status()
    if (statusAfter.conflicted.length > 0) {
      console.log(
        chalk.yellow(`\n⚠️  Merge has ${statusAfter.conflicted.length} conflict(s) in target paths`)
      )
      conflicts.push(...statusAfter.conflicted)
      console.log(chalk.red('\n═══════════════════════════════════════════════════════════'))
      console.log(chalk.red('CONFLICT FILES - Need Manual Resolution:'))
      console.log(chalk.red('═══════════════════════════════════════════════════════════'))
      statusAfter.conflicted.forEach((file, index) => {
        console.log(chalk.yellow(`  ${index + 1}. ⚠️  ${file}`))
      })
      console.log(chalk.red('═══════════════════════════════════════════════════════════\n'))
      console.log(
        chalk.blue(
          `\nRemote ${tempRemoteName} added. Resolve conflicts and run:\n` +
            `  git merge --continue  # After resolving conflicts\n` +
            `  git remote remove ${tempRemoteName}  # To remove temporary remote`
        )
      )
      return { conflicts, merged: false }
    }

    await git.commit(
      `Merge ${remoteRef} into ${currentBranch} (project-ai-sync: target paths only)`
    )

    if (mergeSucceeded) {
      console.log(chalk.green('Merge completed successfully without conflicts'))
      console.log(chalk.blue('✓ Incremental merge: New files added, existing files merged'))
    } else {
      console.log(chalk.green('Merge completed (non-target conflicts discarded)'))
    }
    try {
      await git.removeRemote(tempRemoteName)
    } catch {
      // Ignore cleanup errors
    }
    return { conflicts: [], merged: true }
  } catch (error: unknown) {
    try {
      await git.removeRemote(tempRemoteName).catch(() => {})
    } catch {
      // Ignore cleanup errors
    }
    throw error
  }
}
