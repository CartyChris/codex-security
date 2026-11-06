'use client'
import { useState } from 'react'
import { useWorkspace } from './connected-workspace'
import styles from './connected-workspace.module.css'
export default function PatchApprovals() {
  const { state, update, event } = useWorkspace(), [notice, setNotice] = useState('')
  function apply(id: string) {
    const patch = state.patches.find(p => p.id === id)
    if (!patch || patch.status !== 'pending') return
    if (state.files.find(f => f.path === patch.path)?.content !== patch.before) { setNotice('Source changed since this proposal. Generate a fresh patch; stale changes were not applied.'); return }
    update(s => s.files.find(f => f.path === patch.path)?.content !== patch.before || s.patches.find(p => p.id === id)?.status !== 'pending' ? s : ({ ...s, files: s.files.map(f => f.path === patch.path ? { ...f, content: patch.after } : f), findings: null, report: '', patches: s.patches.map(p => p.id === id ? { ...p, status: 'applied' } : p) }))
    event('human', 'patch-approved', `${patch.path}: applied to workspace copy only. Re-scan and test before deploying.`)
    setNotice('Workspace copy updated. Previous findings/report cleared. Re-scan and validate; original repository was not changed.')
  }
  function download(path: string, content: string) { const url = URL.createObjectURL(new Blob([content], { type: 'text/plain' })); const a = document.createElement('a'); a.href = url; a.download = path.split('/').pop() || 'source.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
  return <section className={styles.card}><h2>Change approval queue</h2><p>AI can propose fixes, never push, deploy or overwrite your repository. Every workspace edit requires human approval and an unchanged original.</p><p role="status">{notice}</p>{!state.patches.length && <small>No proposed changes.</small>}{state.patches.map(p => <article key={p.id}><h3>{p.path}</h3><p>{p.reason}</p><small>{p.status}</small><details><summary>Review original and replacement</summary><h4>Original</h4><pre className={styles.diff}>{p.before}</pre><h4>Proposed replacement</h4><pre className={styles.diff}>{p.after}</pre></details><div className={styles.actions}>{p.status === 'pending' ? <><button onClick={() => apply(p.id)}>Approve workspace edit</button><button onClick={() => { update(s => ({ ...s, patches: s.patches.map(item => item.id === p.id ? { ...item, status: 'rejected' } : item) })); event('human', 'patch-rejected', p.path) }}>Reject</button></> : p.status === 'applied' && <button onClick={() => download(p.path, p.after)}>Download changed file</button>}</div></article>)}</section>
}
