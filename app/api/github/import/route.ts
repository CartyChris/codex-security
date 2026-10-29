import { githubClient, githubFailure, githubResponse, githubUser, validGithubOrigin } from '../../../../lib/github'
import { MAX_BYTES, MAX_FILES, sourcePathAllowed, type SourceFile } from '../../../../lib/security-review'

export const maxDuration = 60
export async function POST(request: Request) {
  const user = await githubUser()
  if (!user) return githubResponse({ error: 'Sign in before importing a repository.' }, 401)
  if (!validGithubOrigin(request)) return githubResponse({ error: 'Invalid request origin.' }, 403)
  let input: { owner: string; repo: string; ref: string; folder: string }
  try {
    const text = await request.text()
    if (text.length > 4096) throw new Error()
    input = JSON.parse(text)
    if (!input || ![input.owner, input.repo].every(value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(value)) || typeof input.ref !== 'string' || !input.ref || input.ref.length > 200 || typeof input.folder !== 'string' || input.folder.length > 300 || input.folder.startsWith('/') || input.folder.includes('\\') || input.folder.split('/').includes('..')) throw new Error()
  } catch { return githubResponse({ error: 'Choose a repository, branch or commit, and a valid relative folder.' }, 400) }
  try {
    const github = await githubClient(user.id)
    const { owner, repo } = input
    const { data: commit } = await github.repos.getCommit({ owner, repo, ref: input.ref })
    const { data: tree } = await github.git.getTree({ owner, repo, tree_sha: commit.commit.tree.sha, recursive: '1' })
    if (tree.truncated) return githubResponse({ error: 'Repository tree is too large for a complete import. Use a local source folder instead.' }, 422)
    const folder = input.folder.replace(/\/+$/, '')
    const selected = tree.tree.filter(entry => entry.type === 'blob' && ['100644', '100755'].includes(entry.mode ?? '') && entry.path && entry.sha && (!folder || entry.path.startsWith(`${folder}/`)) && sourcePathAllowed(entry.path))
    if (!selected.length) return githubResponse({ error: 'No supported source files in this scope.' }, 422)
    if (selected.length > MAX_FILES || selected.reduce((sum, entry) => sum + (entry.size ?? MAX_BYTES + 1), 0) > MAX_BYTES) return githubResponse({ error: 'Scope exceeds 150 files or 2 MB. Choose a narrower folder.' }, 422)
    const files: SourceFile[] = []
    let bytes = 0
    for (let index = 0; index < selected.length; index += 5) {
      const batch = await Promise.all(selected.slice(index, index + 5).map(async entry => {
        const { data } = await github.git.getBlob({ owner, repo, file_sha: entry.sha! })
        if (data.encoding !== 'base64') throw new Error('Unsupported encoding')
        const buffer = Buffer.from(data.content, 'base64')
        bytes += buffer.byteLength
        if (bytes > MAX_BYTES) throw new Error('Source budget exceeded')
        try {
          const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
          return content.includes('\0') ? null : { path: entry.path!, content }
        } catch { return null }
      }))
      files.push(...batch.filter((file): file is SourceFile => file !== null))
    }
    if (!files.length) return githubResponse({ error: 'No UTF-8 source files found.' }, 422)
    return githubResponse({ files, repository: `${owner}/${repo}`, commit: commit.sha, skipped: selected.length - files.length })
  } catch (error) { return githubFailure(error) }
}
