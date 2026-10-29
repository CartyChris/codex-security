import { createHash } from 'node:crypto'
import { Sandbox } from '@vercel/sandbox'
import { get, list, put, BlobPathnameMismatchError } from '@vercel/blob'
import { githubUser, githubResponse, validGithubOrigin } from '../../../lib/github'
import { validateSnapshot } from '../../../lib/source-snapshots'

export const runtime = 'nodejs'
export const maxDuration = 60
function storage() {
  const token = process.env.PRIVATE_SOURCE_READ_WRITE_TOKEN
  if (!token) throw new Error('Private storage unavailable')
  return { token }
}
function prefix(user: string) { return `validation-reports/${encodeURIComponent(user)}/` }
export async function GET(request: Request) {
  const user = await githubUser()
  if (!user) return githubResponse({ error: 'Sign in to view reports.' }, 401)
  const id = new URL(request.url).searchParams.get('id')
  try {
    if (id) {
      if (!/^\d{13}$/.test(id)) return githubResponse({ error: 'Invalid report.' }, 400)
      const result = await get(`${prefix(user.id)}${id}.json`, { ...storage(), access: 'private', useCache: false })
      if (!result || result.statusCode !== 200) return githubResponse({ error: 'Report not found.' }, 404)
      return new Response(result.stream, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'Content-Disposition': `attachment; filename="validation-${id}.json"` } })
    }
    const result = await list({ ...storage(), prefix: prefix(user.id), limit: 100 })
    return githubResponse({ reports: result.blobs.map(blob => ({ id: blob.pathname.split('/').pop()!.replace('.json', ''), createdAt: blob.uploadedAt })).sort((a,b) => b.id.localeCompare(a.id)), hasMore: result.hasMore })
  } catch { return githubResponse({ error: 'Report storage is unavailable.' }, 503) }
}
export async function POST(request: Request) {
  const user = await githubUser()
  if (!user) return githubResponse({ error: 'Sign in to run validation.' }, 401)
  if (!validGithubOrigin(request)) return githubResponse({ error: 'Invalid request origin.' }, 403)
  let files
  try {
    const body = await request.json()
    if (body.authorized !== true) throw new Error('Confirm ownership or permission first.')
    files = validateSnapshot(body.files).filter(file => /\.(js|mjs|cjs)$/.test(file.path))
    if (!files.length || files.length > 30) throw new Error('Choose 1–30 JavaScript files (.js, .mjs, .cjs).')
  } catch (error) { return githubResponse({ error: error instanceof Error ? error.message : 'Invalid source scope.' }, 400) }
  const id = String(Math.floor(Date.now() / 60000) * 60000)
  const path = `${prefix(user.id)}${id}.json`
  const report = { id, createdAt: new Date().toISOString(), kind: 'Node.js syntax validation', status: 'running', limitation: 'Syntax only, not security or runtime tests. No dependencies installed. No imported code executed. Source paths and hashes are retained, not source contents.', files: files.map(file => ({ path: file.path, sha256: createHash('sha256').update(file.content).digest('hex') })), results: [] as { path: string; exitCode: number }[], cleanup: 'not-started' }
  try {
    await put(path, JSON.stringify(report), { ...storage(), access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'application/json' })
  } catch (error) {
    if (error instanceof BlobPathnameMismatchError || (error instanceof Error && /already exists/i.test(error.message))) return githubResponse({ error: 'One run per minute is allowed. Refresh saved reports before retrying.' }, 429)
    return githubResponse({ error: 'Could not reserve a private report. No sandbox was started.' }, 503)
  }
  let sandbox: Sandbox | undefined
  try {
    sandbox = await Sandbox.create({ runtime: 'node24', persistent: false, networkPolicy: 'deny-all', timeout: 30000, resources: { vcpus: 2 } })
    await sandbox.writeFiles(files.map((file, index) => ({ path: `/vercel/sandbox/source-${index}${'.' + file.path.split('.').pop()}`, content: Buffer.from(file.content) })))
    for (const [index, file] of files.entries()) {
      const result = await sandbox.runCommand('node', ['--check', `/vercel/sandbox/source-${index}${'.' + file.path.split('.').pop()}`])
      report.results.push({ path: file.path, exitCode: result.exitCode })
    }
    report.status = report.results.every(result => result.exitCode === 0) ? 'passed' : 'failed'
  } catch { report.status = 'infrastructure-error' }
  finally {
    if (sandbox) {
      try { await sandbox.stop(); report.cleanup = 'stopped' } catch { report.cleanup = 'stop-unconfirmed; automatic 30-second expiry applies' }
    }
  }
  try { await put(path, JSON.stringify(report), { ...storage(), access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' }) }
  catch { return githubResponse({ error: 'Validation ended but the final report could not be saved. The reserved report may still say running.', report }, 503) }
  return githubResponse({ report }, report.status === 'infrastructure-error' ? 503 : 200)
}
