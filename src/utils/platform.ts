export type Platform = 'github' | 'gitlab' | 'gitee' | 'unknown'

export interface PlatformInfo {
  platform: Platform
  baseUrl: string
  projectPath: string
}

export function detectPlatform(repoUrl: string): PlatformInfo {
  const withoutGit = repoUrl.replace(/\.git$/, '')

  // SSH format: git@host:owner/repo
  const sshMatch = withoutGit.match(/^git@([^:]+):(.+)$/)
  if (sshMatch) {
    const host = sshMatch[1]
    const projectPath = sshMatch[2]
    return {
      platform: classifyHost(host),
      baseUrl: `https://${host}`,
      projectPath,
    }
  }

  // HTTPS format: https://host/owner/repo
  try {
    const u = new URL(withoutGit)
    const projectPath = u.pathname.replace(/^\//, '')
    return {
      platform: classifyHost(u.hostname),
      baseUrl: `${u.protocol}//${u.host}`,
      projectPath,
    }
  } catch {
    return { platform: 'unknown', baseUrl: '', projectPath: '' }
  }
}

function classifyHost(host: string): Platform {
  const h = host.toLowerCase()
  if (h.includes('github.com') || h.includes('github')) return 'github'
  if (h.includes('gitee.com') || h.includes('gitee')) return 'gitee'
  if (h.includes('gitlab')) return 'gitlab'
  return 'unknown'
}

export function generatePRUrl(
  info: PlatformInfo,
  sourceBranch: string,
  targetBranch: string
): string {
  const { platform, baseUrl, projectPath } = info

  switch (platform) {
    case 'github':
      return `${baseUrl}/${projectPath}/compare/${targetBranch}...${sourceBranch}?expand=1`
    case 'gitlab':
      return (
        `${baseUrl}/${projectPath}/merge_requests/new` +
        `?merge_request[source_branch]=${sourceBranch}` +
        `&merge_request[target_branch]=${targetBranch}`
      )
    case 'gitee':
      return `${baseUrl}/${projectPath}/pull/new?head=${sourceBranch}&base=${targetBranch}`
    default:
      return ''
  }
}

export function getPRLabel(platform: Platform): string {
  switch (platform) {
    case 'github':
    case 'gitee':
      return 'Pull Request'
    case 'gitlab':
      return 'Merge Request'
    default:
      return 'Pull/Merge Request'
  }
}
