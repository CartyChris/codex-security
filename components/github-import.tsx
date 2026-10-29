'use client'
import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import { authorizeGithub } from '../app/actions/github'
import { authClient } from '../lib/auth-client'
import type { SourceFile } from '../lib/security-review'
import styles from './security-lab.module.css'

type Repo = { id: number; owner: string; name: string; fullName: string; defaultBranch: string; private: boolean }
type RepositoryPage = { repositories?: Repo[]; hasMore?: boolean; error?: string; authorize?: boolean; signIn?: boolean }
export type GithubScope = { repository: string; commit: string }
export default function GithubImport({ onImport }: { onImport: (files: SourceFile[], scope: GithubScope) => void }) {
  const { data, isPending } = authClient.useSession()
  const session = data as { user: { id: string } } | null
  if (isPending) return <p className={styles.disclaimer}>Checking GitHub sign-in…</p>
  return <GithubImportControls key={session?.user.id ?? 'signed-out'} userId={session?.user.id ?? 'signed-out'} onImport={onImport} />
}
function GithubImportControls({ onImport, userId }: { onImport: (files: SourceFile[], scope: GithubScope) => void; userId: string }) {
  const [expanded, setExpanded] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Repo | null>(null)
  const [ref, setRef] = useState('')
  const [folder, setFolder] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [authorizationUrl, setAuthorizationUrl] = useState('')
  const { data, error, isLoading, mutate } = useSWR<RepositoryPage>(expanded ? [`/api/github/repositories?page=${page}`, userId] : null, async ([url]: [string, string]) => { const response = await fetch(url); return response.json() })
  async function authorize() {
    setBusy(true); setMessage('')
    try { const result = await authorizeGithub(); if (result.url) setAuthorizationUrl(result.url); else setMessage(result.error || 'Authorization unavailable.') }
    catch { setMessage('Could not start authorization. Please retry.') }
    finally { setBusy(false) }
  }
  async function importRepository() {
    if (!selected) return
    setBusy(true); setMessage('Reading supported files at one commit…')
    try {
      const response = await fetch('/api/github/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: selected.owner, repo: selected.name, ref, folder }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      onImport(result.files, { repository: result.repository, commit: result.commit })
      setMessage(`Imported ${result.files.length} files from ${result.repository} at ${result.commit.slice(0, 12)}. ${result.skipped} non-text files skipped.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Import failed.') }
    finally { setBusy(false) }
  }
  return <section style={{ marginTop: 24 }} aria-label="GitHub source import"><button className={styles.secondary} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Import from GitHub</button>
    {expanded && <><p className={styles.disclaimer}>Read-only access through your own GitHub account. Source files pass through this server into your browser; they are not saved unless you choose to save a private snapshot. Imports replace the current scope. No code is executed.</p>
      {isLoading && <p role="status">Loading repositories…</p>}
      {(data?.error || error) && <p role="status" className={styles.disclaimer}>{data?.error || 'Could not load repositories.'}</p>}
      {data?.signIn ? <Link className={styles.secondary} href="/sign-in">Sign in</Link> : <div className={styles.buttons}><button className={styles.secondary} disabled={busy} onClick={() => void authorize()}>Authorize GitHub</button><button className={styles.secondary} disabled={busy || isLoading} onClick={() => void mutate()}>Refresh repositories</button></div>}
      {authorizationUrl && <p className={styles.disclaimer}><a className={styles.secondary} href={authorizationUrl} onClick={(event) => { event.preventDefault(); if (window.self !== window.top) window.open(authorizationUrl, '_blank', 'noopener,noreferrer'); else window.location.href = authorizationUrl }}>Continue to GitHub</a><br />After authorizing, return here and refresh repositories.</p>}
      {data?.repositories && <><div className={styles.filters} style={{ display: 'flex', flexDirection: 'column' }}><label>Repository<select style={{ width: '100%', fontSize: 16, minHeight: 44 }} value={selected?.id ?? ''} disabled={busy} onChange={(event) => { const repo = data.repositories?.find(repo => repo.id === Number(event.target.value)) ?? null; setSelected(repo); setRef(repo?.defaultBranch ?? '') }}><option value="">Choose a repository</option>{data.repositories.map(repo => <option key={repo.id} value={repo.id}>{repo.fullName}{repo.private ? ' (private)' : ''}</option>)}</select></label><label>Branch or commit<input style={{ fontSize: 16, minHeight: 44 }} value={ref} disabled={busy} onChange={(event) => setRef(event.target.value)} /></label><label>Source folder (optional)<input style={{ fontSize: 16, minHeight: 44 }} value={folder} disabled={busy} onChange={(event) => setFolder(event.target.value)} placeholder="e.g. src" /></label></div><div className={styles.buttons}><button className={styles.primary} disabled={busy || !selected || !ref} onClick={() => void importRepository()}>{busy ? 'Working…' : 'Import source files'}</button>{page > 1 && <button className={styles.secondary} disabled={busy} onClick={() => { setSelected(null); setPage(page - 1) }}>Previous</button>}{data.hasMore && <button className={styles.secondary} disabled={busy} onClick={() => { setSelected(null); setPage(page + 1) }}>Next</button>}</div>{!data.repositories.length && <p className={styles.disclaimer}>No repositories available on this page. Check GitHub app installation access.</p>}</>}
      <p role="status" className={styles.disclaimer}>{message}</p>
    </>}
  </section>
}
