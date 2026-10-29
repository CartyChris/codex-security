import { parse } from 'yaml'
import type { SourceFile } from './security-review'

export type LockedPackage = { name: string; version: string; paths: string[] }
export function lockedDependencies(files: SourceFile[]) {
  const packages = new Map<string, LockedPackage>()
  const skipped: string[] = []
  let lockfiles = 0
  function add(name: string, version: string, path: string) {
    if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version)) { skipped.push(`${path}: ${name} has no exact registry version`); return }
    const key = `${name}@${version}`
    const existing = packages.get(key)
    if (existing) { if (!existing.paths.includes(path)) existing.paths.push(path) }
    else packages.set(key, { name, version, paths: [path] })
  }
  for (const file of files) {
    const filename = file.path.split('/').pop()
    if (filename === 'pnpm-lock.yaml') {
      lockfiles++
      const lock = parse(file.content)
      if (Number(lock?.lockfileVersion) !== 9 || !lock.packages) throw new Error('Dependency scanning supports pnpm lockfile version 9.')
      for (const [key, value] of Object.entries(lock.packages)) {
        const entry = value as { name?: string; version?: string; resolution?: { integrity?: string } }
        const match = /^(.+)@(\d+\.\d+\.\d+[^()]*)/.exec(key)
        if (!match || !entry.resolution?.integrity) { skipped.push(`${file.path}: non-registry dependency ${key}`); continue }
        add(entry.name ?? match[1], entry.version ?? match[2], file.path)
      }
    } else if (filename === 'package-lock.json') {
      lockfiles++
      const lock = JSON.parse(file.content)
      if (![2, 3].includes(lock.lockfileVersion) || !lock.packages) throw new Error('Dependency scanning supports npm lockfile versions 2 and 3.')
      for (const [key, value] of Object.entries(lock.packages)) {
        if (!key) continue
        const entry = value as { name?: string; version?: string; link?: boolean; integrity?: string }
        const name = entry.name ?? key.split('node_modules/').pop()!
        if (entry.link || !entry.version || !entry.integrity) { skipped.push(`${file.path}: non-registry dependency ${key}`); continue }
        add(name, entry.version, file.path)
      }
    }
  }
  if (!lockfiles || !packages.size) throw new Error('Include a pnpm v9 or npm v2/v3 lockfile with resolved registry dependencies. Manifest version ranges are not scanned.')
  return { packages: [...packages.values()], skipped, lockfiles }
}

export async function scanDependencies(scope: ReturnType<typeof lockedDependencies>, request: typeof fetch = fetch) {
  const findings: { name: string; version: string; paths: string[]; advisories: string[] }[] = []
  for (let start = 0; start < scope.packages.length; start += 1000) {
    let pending = scope.packages.slice(start, start + 1000).map(item => ({ item, pageToken: undefined as string | undefined }))
    const ids = new Map<string, Set<string>>()
    while (pending.length) {
      const response = await request('https://api.osv.dev/v1/querybatch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30000),
        body: JSON.stringify({ queries: pending.map(({ item, pageToken }) => ({ package: { name: item.name, ecosystem: 'npm' }, version: item.version, ...(pageToken ? { page_token: pageToken } : {}) })) }),
      })
      if (!response.ok) throw new Error(`OSV query failed (${response.status}). No complete dependency verdict is available.`)
      const data = await response.json() as { results: { vulns?: { id: string }[]; next_page_token?: string }[] }
      if (!Array.isArray(data.results) || data.results.length !== pending.length) throw new Error('OSV returned an incomplete batch response.')
      const next: typeof pending = []
      data.results.forEach((result, index) => {
        const { item } = pending[index]
        const key = `${item.name}@${item.version}`
        const set = ids.get(key) ?? new Set<string>()
        for (const vuln of result.vulns ?? []) set.add(vuln.id)
        ids.set(key, set)
        if (result.next_page_token) next.push({ item, pageToken: result.next_page_token })
      })
      pending = next
    }
    for (const item of scope.packages.slice(start, start + 1000)) {
      const advisories = [...(ids.get(`${item.name}@${item.version}`) ?? [])]
      if (advisories.length) findings.push({ ...item, advisories })
    }
  }
  return { provider: 'OSV', queriedPackages: scope.packages.length, lockfiles: scope.lockfiles, skipped: scope.skipped, findings }
}
