import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import ts from 'typescript'
import * as review from './security-review.ts'

const source = await readFile(new URL('../app/api/github/import/route.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const commitSha = 'a'.repeat(40)
const treeSha = 'b'.repeat(40)
const blobSha = 'c'.repeat(40)
const entry = { path: 'src/main.js', type: 'blob', mode: '100644', size: 20, sha: blobSha }

function harness({ user = { id: 'test-user' }, originAllowed = true, entries = [entry], truncated = false, blob = async () => ({ data: { encoding: 'base64', content: Buffer.from('export const value = 1').toString('base64') } }) } = {}) {
  const calls = []
  const github = {
    repos: { getCommit: async input => { calls.push(['commit', input]); return { data: { sha: commitSha, commit: { tree: { sha: treeSha } } } } } },
    git: {
      getTree: async input => { calls.push(['tree', input]); return { data: { tree: entries, truncated } } },
      getBlob: async input => { calls.push(['blob', input]); return blob(input) },
    },
  }
  const auth = {
    githubUser: async () => user,
    validGithubOrigin: () => originAllowed,
    githubClient: async id => { calls.push(['client', id]); return github },
    githubResponse: (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } }),
    githubFailure: () => Response.json({ error: 'Upstream request failed' }, { status: 503 }),
  }
  const exports = {}
  // Compile the live route with test-only service doubles; production auth is unchanged.
  vm.runInNewContext(compiled, {
    exports, Buffer, TextDecoder,
    require: path => {
      if (path === '../../../../lib/github') return auth
      if (path === '../../../../lib/security-review') return review
      throw new Error(`Unexpected route dependency: ${path}`)
    },
  })
  const run = (overrides = {}) => exports.POST(new Request('https://example.test/api/github/import', {
    method: 'POST', headers: { Origin: 'https://example.test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ owner: 'example', repo: 'project', ref: 'main', folder: 'src', ...overrides }),
  }))
  return { calls, run }
}

test('rejects unauthenticated and invalid-origin imports before any provider call', async () => {
  for (const [options, status] of [[{ user: null }, 401], [{ originAllowed: false }, 403]]) {
    const h = harness(options)
    assert.equal((await h.run()).status, status)
    assert.deepEqual(h.calls, [])
  }
})

test('uses the session identity and pins tree and blob reads to resolved SHAs', async () => {
  const h = harness()
  const response = await h.run({ userId: 'different-user' })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  const result = await response.json()
  assert.equal(result.commit, commitSha)
  assert.deepEqual(result.files, [{ path: entry.path, content: 'export const value = 1' }])
  assert.deepEqual(structuredClone(h.calls), [
    ['client', 'test-user'],
    ['commit', { owner: 'example', repo: 'project', ref: 'main' }],
    ['tree', { owner: 'example', repo: 'project', tree_sha: treeSha, recursive: '1' }],
    ['blob', { owner: 'example', repo: 'project', file_sha: blobSha }],
  ])
})

test('rejects unsafe folders before resolving a provider client', async () => {
  for (const folder of ['../outside', '/absolute', 'src/../outside', 'src\\outside']) {
    const h = harness()
    assert.equal((await h.run({ folder })).status, 400)
    assert.deepEqual(h.calls, [])
  }
})

test('rejects truncated trees and oversized scopes without downloading blobs', async () => {
  for (const options of [
    { truncated: true },
    { entries: [{ ...entry, size: review.MAX_BYTES + 1 }] },
    { entries: Array.from({ length: review.MAX_FILES + 1 }, (_, index) => ({ ...entry, path: `src/${index}.js` })) },
  ]) {
    const h = harness(options)
    assert.equal((await h.run()).status, 422)
    assert.ok(!h.calls.some(([kind]) => kind === 'blob'))
  }
})

test('imports only regular files inside the exact folder and excludes credential files', async () => {
  const h = harness({ entries: [entry,
    { ...entry, path: 'src-other/main.js' },
    { ...entry, path: 'src/link.js', mode: '120000' },
    { ...entry, path: 'src/.env' },
    { ...entry, path: 'src/submodule', type: 'commit', mode: '160000' },
  ] })
  const response = await h.run({ folder: 'src/' })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).files.length, 1)
  assert.equal(h.calls.filter(([kind]) => kind === 'blob').length, 1)
})

test('reports skipped binary files instead of treating them as reviewed source', async () => {
  const h = harness({ entries: [entry, { ...entry, path: 'src/binary.js', sha: 'd'.repeat(40) }], blob: async ({ file_sha }) => ({ data: { encoding: 'base64', content: Buffer.from(file_sha === blobSha ? 'const ok = true' : '\0binary').toString('base64') } }) })
  const response = await h.run()
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.skipped, 1)
  assert.equal(result.files.length, 1)
})

test('a failed blob download never returns a successful partial import', async () => {
  const h = harness({ blob: async () => { throw new Error('Provider unavailable') } })
  const response = await h.run()
  assert.equal(response.status, 503)
  assert.equal((await response.json()).files, undefined)
})

test('enforces the decoded byte budget even if tree sizes under-report content', async () => {
  const h = harness({ blob: async () => ({ data: { encoding: 'base64', content: Buffer.alloc(review.MAX_BYTES + 1, 'x').toString('base64') } }) })
  const response = await h.run()
  assert.equal(response.status, 503)
  assert.equal((await response.json()).files, undefined)
})
