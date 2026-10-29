'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import type { SourceFile } from '../lib/security-review'
import styles from './security-lab.module.css'

type Snapshot = { id: string; size: number; uploadedAt: string }
async function load(url: string) {
  const response = await fetch(url)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Request failed.')
  return data
}
export default function SourceSnapshots({ files, authorized, onOpen }: { files: SourceFile[]; authorized: boolean; onOpen: (files: SourceFile[]) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const url = `/api/snapshots${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`
  const { data, error, isLoading, mutate } = useSWR<{ snapshots: Snapshot[]; cursor: string | null }>(expanded ? url : null, load)
  async function action(operation: () => Promise<void>) {
    setWorking(true); setMessage('')
    try { await operation() } catch (error) { setMessage(error instanceof Error ? error.message : 'Request failed.') }
    finally { setWorking(false) }
  }
  return <section style={{ margin: '24px 0', borderTop: '1px solid #d9dee7', paddingTop: 18 }} aria-label="Private source snapshots">
    <button className={styles.secondary} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>Private source snapshots</button>
    {expanded && <><p className={styles.disclaimer}>Saving sends the selected source contents to private storage tied to your account. Review files for secrets first. Opening a snapshot replaces the current scope and clears findings.</p>
      <button className={styles.primary} disabled={!files.length || !authorized || working} onClick={() => void action(async () => {
        const result = await fetch('/api/snapshots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) })
        const body = await result.json()
        if (!result.ok) throw new Error(body.error)
        setCursor(null); await mutate(); setMessage('Source snapshot saved privately.')
      })}>{working ? 'Working…' : 'Save current scope privately'}</button>
      <p role="status" className={styles.disclaimer}>{message || (isLoading ? 'Loading saved snapshots…' : '')}</p>
      {error && <p role="alert" className={styles.disclaimer}>{error.message} <Link href="/sign-in">Sign in</Link> · <button className={styles.secondary} onClick={() => void mutate()}>Retry</button></p>}
      {data?.snapshots.length === 0 && <p className={styles.disclaimer}>No saved snapshots on this page.</p>}
      {data?.snapshots.map((snapshot) => <article key={snapshot.id} className={styles.finding}><h3>Source snapshot</h3><p>{new Date(snapshot.uploadedAt).toLocaleString()} · {Math.ceil(snapshot.size / 1024)} KB</p><div className={styles.buttons}>
        <button className={styles.secondary} disabled={working} onClick={() => void action(async () => { const saved = await load(`/api/snapshots?id=${snapshot.id}`); onOpen(saved.files); setMessage('Snapshot opened. Confirm authorization before reviewing.') })}>Open</button>
        <a className={styles.secondary} href={`/api/snapshots?id=${snapshot.id}&download=1`}>Download</a>
        <button className={styles.secondary} disabled={working} onClick={() => setConfirmId(snapshot.id)}>Delete</button>
      </div>{confirmId === snapshot.id && <div><p className={styles.disclaimer}>Permanently delete this saved snapshot? Files already open in this tab remain available.</p><div className={styles.buttons}><button className={styles.secondary} disabled={working} onClick={() => void action(async () => { const result = await fetch(`/api/snapshots?id=${snapshot.id}`, { method: 'DELETE' }); if (!result.ok) throw new Error((await result.json()).error); setConfirmId(null); await mutate(); setMessage('Snapshot deleted.') })}>Confirm deletion</button><button className={styles.secondary} disabled={working} onClick={() => setConfirmId(null)}>Cancel</button></div></div>}</article>)}
      <div className={styles.buttons}>{cursor && <button className={styles.secondary} disabled={working} onClick={() => setCursor(null)}>Newest snapshots</button>}{data?.cursor && <button className={styles.secondary} disabled={working} onClick={() => setCursor(data.cursor)}>Next page</button>}</div>
    </>}
  </section>
}
