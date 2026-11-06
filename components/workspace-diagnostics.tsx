'use client'
import { useState } from 'react'
import { useWorkspace } from './connected-workspace'
import styles from './connected-workspace.module.css'
export default function WorkspaceDiagnostics() {
  const { event } = useWorkspace(), [notice, setNotice] = useState('')
  function fingerprint() {
    const profile = { userAgent: navigator.userAgent, language: navigator.language, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, viewport: { width: innerWidth, height: innerHeight }, screen: { width: screen.width, height: screen.height, colorDepth: screen.colorDepth }, hardwareConcurrency: navigator.hardwareConcurrency, collectedAt: new Date().toISOString() }
    event('browser', 'consented-environment-profile', JSON.stringify(profile)); setNotice('Browser characteristics recorded locally in telemetry. No persistent identifier or cross-site tracking was created.')
  }
  async function har(file: File | undefined) {
    if (!file) return
    try {
      if (file.size > 2_000_000) throw new Error('Choose a HAR under 2 MB.')
      const data = JSON.parse(await file.text()); if (!Array.isArray(data.log?.entries)) throw new Error('Expected a browser HAR with log.entries.')
      const entries = data.log.entries.map((e: { request?: { url?: string; method?: string }; response?: { status?: number }; time?: number; startedDateTime?: string }) => ({ at: e.startedDateTime, origin: e.request?.url ? new URL(e.request.url).origin : 'unknown', method: e.request?.method, status: e.response?.status, durationMs: e.time }))
      event('network-import', 'HAR-metadata', JSON.stringify(entries)); setNotice(`${entries.length} recorded HTTP entries imported. Headers, cookies, request bodies, query strings and paths were excluded. This is not live packet capture.`)
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Import failed') }
  }
  return <section className={styles.card}><h2>Browser & network evidence</h2><p>Opt-in diagnostics for your own browser and imported HTTP traces. A web page cannot capture raw network packets; no simulated feed is shown.</p><div className={styles.actions}><button onClick={fingerprint}>Collect my browser profile</button><label>Import HAR metadata<input type="file" accept=".har,.json" onChange={e => { void har(e.target.files?.[0]); e.target.value = '' }} /></label></div><p role="status">{notice}</p></section>
}
