'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { authClient } from '../lib/auth-client'
import type { SourceFile } from '../lib/security-review'
import styles from './security-lab.module.css'

export default function IsolatedValidation({ files, authorized }: { files: SourceFile[]; authorized: boolean }) {
  const { data } = authClient.useSession()
  const userId = (data as { user: { id: string } } | null)?.user.id
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'syntax' | 'node-test'>('syntax')
  const [executionScope, setExecutionScope] = useState<SourceFile[] | null>(null)
  const [message, setMessage] = useState('')
  const { data: reports, error, mutate } = useSWR<{ reports: { id: string; createdAt: string }[]; hasMore: boolean }>(expanded && userId ? ['/api/runs', userId] : null, async ([url]) => { const response = await fetch(url); const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
  async function run() {
    setBusy(true); setMessage('Creating a network-blocked sandbox…')
    try {
      const response = await fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files, authorized, mode, executeConfirmed: executionScope === files }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `Run status: ${result.report?.status ?? 'unavailable'}. Check the saved report.`)
      setMessage(`${result.report.kind}: ${result.report.status}. Sandbox: ${result.report.cleanup}.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Run unavailable.') }
    finally { setBusy(false); void mutate() }
  }
  return <section style={{ marginTop: 24, marginBottom: 24 }} aria-label="Isolated validation"><button className={styles.secondary} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Isolated validation & tests</button>{expanded && <><p className={styles.disclaimer}>Uploads your current scope to a disposable, network-blocked microVM. No dependency installation or project credentials. Maximum 30 seconds, one run per minute. Reports retain paths, hashes and exit codes privately, not source contents or test output. Not a security verdict.</p><label>Validation mode<select style={{ display: 'block', width: '100%', fontSize: 16, minHeight: 44 }} disabled={busy} value={mode} onChange={event => { setMode(event.target.value as 'syntax' | 'node-test'); setExecutionScope(null) }}><option value="syntax">Syntax only — no code execution</option><option value="node-test">Execute Node.js test suite</option></select></label>{mode === 'node-test' ? <><p className={styles.disclaimer}>Include .test.js, .test.mjs, .test.cjs or .test.ts files and all local imports. Node.js 24 supports plain erasable TypeScript; JSX, framework transforms and external dependencies are not supported. Tests and their imports execute inside the isolated VM.</p><label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 }}><input type="checkbox" disabled={busy} checked={executionScope === files} onChange={event => setExecutionScope(event.target.checked ? files : null)} />I authorize execution of this uploaded test scope.</label></> : <p className={styles.disclaimer}>Syntax mode checks up to 30 .js, .mjs or .cjs files without executing them.</p>}<p className={styles.disclaimer}>Semgrep and dependency scanning are not included.</p>{!userId && <p className={styles.disclaimer}>Sign in through Account to run validation and view reports.</p>}<button className={styles.primary} disabled={busy || !userId || !authorized || !files.length || (mode === 'node-test' && executionScope !== files)} onClick={() => void run()}>{busy ? 'Validating…' : mode === 'node-test' ? 'Upload & execute tests' : 'Upload & validate syntax'}</button><p role="status" className={styles.disclaimer}>{message}</p><button className={styles.secondary} disabled={!userId || busy} onClick={() => void mutate()}>Refresh reports</button>{error && <p role="alert" className={styles.disclaimer}>{error.message}</p>}{reports?.reports.map(report => <p key={report.id}><a className={styles.secondary} href={`/api/runs?id=${report.id}`}>Download report · {new Date(report.createdAt).toLocaleString()}</a></p>)}{reports?.reports.length === 0 && <p className={styles.disclaimer}>No saved validation reports.</p>}{reports?.hasMore && <p className={styles.disclaimer}>Showing the first 100 stored reports.</p>}</>}</section>
}
