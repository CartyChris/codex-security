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
  const [message, setMessage] = useState('')
  const { data: reports, error, mutate } = useSWR<{ reports: { id: string; createdAt: string }[]; hasMore: boolean }>(expanded && userId ? ['/api/runs', userId] : null, async ([url]) => { const response = await fetch(url); const result = await response.json(); if (!response.ok) throw new Error(result.error); return result })
  async function run() {
    setBusy(true); setMessage('Creating a network-blocked sandbox…')
    try {
      const response = await fetch('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files, authorized }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || `Run status: ${result.report?.status ?? 'unavailable'}. Check the saved report.`)
      setMessage(`Syntax validation ${result.report.status}. ${result.report.results.length} files checked. Sandbox: ${result.report.cleanup}.`)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Run unavailable.') }
    finally { setBusy(false); void mutate() }
  }
  return <section style={{ marginTop: 24, marginBottom: 24 }} aria-label="Isolated syntax validation"><button className={styles.secondary} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Isolated syntax validation</button>{expanded && <><p className={styles.disclaimer}>Uploads your current JavaScript scope to a disposable, network-blocked microVM for Node.js syntax checks. No dependency installation or application execution. Not a security verdict. Maximum 30 JavaScript files, 30 seconds, one run per minute. Files are removed when the sandbox stops. Reports retain paths, hashes and exit codes privately.</p><p className={styles.disclaimer}>JSX, TypeScript, framework configuration, Semgrep, dependency analysis and runtime scenarios are not covered.</p>{!userId && <p className={styles.disclaimer}>Sign in through Account to run validation and view reports.</p>}<button className={styles.primary} disabled={busy || !userId || !authorized || !files.length} onClick={() => void run()}>{busy ? 'Validating…' : 'Upload & validate syntax'}</button><p role="status" className={styles.disclaimer}>{message}</p><button className={styles.secondary} disabled={!userId || busy} onClick={() => void mutate()}>Refresh reports</button>{error && <p role="alert" className={styles.disclaimer}>{error.message}</p>}{reports?.reports.map(report => <p key={report.id}><a className={styles.secondary} href={`/api/runs?id=${report.id}`}>Download report · {new Date(report.createdAt).toLocaleString()}</a></p>)}{reports?.reports.length === 0 && <p className={styles.disclaimer}>No saved validation reports.</p>}{reports?.hasMore && <p className={styles.disclaimer}>Showing the first 100 stored reports.</p>}</>}</section>
}
