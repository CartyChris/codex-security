import { randomUUID } from 'node:crypto'
import { get, put, list, del } from '@vercel/blob'
import { auth } from '../../../lib/auth'
import { snapshotPath, snapshotPrefix, validateSnapshot } from '../../../lib/source-snapshots'

export const runtime = 'nodejs'
function privateStorage() {
  const token = process.env.PRIVATE_SOURCE_READ_WRITE_TOKEN
  if (!token) throw new Error('Private source storage is not configured.')
  return { token }
}
const response = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })

async function access(request: Request, mutation = false) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return null
  if (mutation) {
    const origin = request.headers.get('origin')
    const allowed = [new URL(request.url).origin, ...auth.options.trustedOrigins, auth.options.baseURL].filter(Boolean)
    if (!origin || !allowed.includes(origin)) return null
  }
  return session.user.id
}

export async function GET(request: Request) {
  const userId = await access(request)
  if (!userId) return response({ error: 'Sign in to access private snapshots.' }, 401)
  const params = new URL(request.url).searchParams
  try {
    const id = params.get('id')
    if (id) {
      let path: string
      try { path = snapshotPath(userId, id) } catch { return response({ error: 'Invalid snapshot identifier.' }, 400) }
      const result = await get(path, { ...privateStorage(), access: 'private', useCache: false })
      if (!result || result.statusCode !== 200) return response({ error: 'Snapshot not found.' }, 404)
      return new Response(result.stream, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...(params.has('download') ? { 'Content-Disposition': `attachment; filename="source-snapshot-${id}.json"` } : {}) } })
    }
    const result = await list({ ...privateStorage(), prefix: snapshotPrefix(userId), limit: 50, cursor: params.get('cursor') || undefined })
    return response({ snapshots: result.blobs.map((blob) => ({ id: blob.pathname.split('/').pop()!.replace(/\.json$/, ''), size: blob.size, uploadedAt: blob.uploadedAt })), cursor: result.hasMore ? result.cursor : null })
  } catch { return response({ error: 'Private storage is unavailable. Please retry.' }, 503) }
}

export async function POST(request: Request) {
  const userId = await access(request, true)
  if (!userId) return response({ error: 'Sign in and save from this application.' }, 401)
  try {
    const text = await request.text()
    if (new TextEncoder().encode(text).length > 4_000_000) return response({ error: 'The snapshot request exceeds 4 MB.' }, 413)
    let files
    try { files = validateSnapshot(JSON.parse(text).files) } catch (error) { return response({ error: error instanceof SyntaxError ? 'Invalid JSON.' : error instanceof Error ? error.message : 'Invalid source files.' }, 400) }
    const id = randomUUID()
    await put(snapshotPath(userId, id), JSON.stringify({ version: 1, files }), { ...privateStorage(), access: 'private', addRandomSuffix: false, contentType: 'application/json' })
    return response({ id }, 201)
  } catch (error) {
    const wrongStore = error instanceof Error && error.message.includes('Cannot use private access on a public store')
    return response({ error: wrongStore ? 'A private Blob store is required. The connected store is public; no source files were saved.' : 'Could not save to private storage. No public storage fallback is used.' }, 503)
  }
}

export async function DELETE(request: Request) {
  const userId = await access(request, true)
  if (!userId) return response({ error: 'Sign in and delete from this application.' }, 401)
  let path
  try { path = snapshotPath(userId, new URL(request.url).searchParams.get('id') || '') } catch { return response({ error: 'Invalid snapshot identifier.' }, 400) }
  try { await del(path, privateStorage()); return response({ deleted: true }) } catch { return response({ error: 'Could not delete snapshot. Please retry.' }, 503) }
}
