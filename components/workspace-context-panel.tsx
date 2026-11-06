'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import GithubImport from './github-import'
import { useWorkspace } from './connected-workspace'
import { MAX_BYTES, MAX_FILES, sourcePathAllowed } from '../lib/security-review'
import styles from './connected-workspace.module.css'

export default function WorkspaceContextPanel({ compact = false }: { compact?: boolean }) {
  const { state, update, persistent, persist, storageError } = useWorkspace()
  const input = useRef<HTMLInputElement>(null), folder = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState('')
  async function importFiles(files: FileList | null) {
    if (!files) return
    try {
      const selected = Array.from(files).filter(f => sourcePathAllowed(f.webkitRelativePath || f.name))
      if (!selected.length) throw new Error('Choose supported text or source files.')
      if (selected.length > MAX_FILES || selected.reduce((n, f) => n + f.size, 0) > MAX_BYTES) throw new Error('Maximum 150 files / 2 MB.')
      const sources = await Promise.all(selected.map(async f => ({ path: f.webkitRelativePath || f.name, content: await f.text() })))
      if (sources.some(f => f.content.includes('\0'))) throw new Error('Binary files are not supported.')
      update(s => ({ ...s, files: sources, githubScope: null, findings: null, patches: [], report: '', include: '', exclude: '' }))
      setNotice(`${sources.length} files shared across chat, lab, and orchestrator. Previous source scope replaced.`)
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Import failed') }
  }
  return <details id="shared-source-context" className={styles.context} open={compact ? undefined : true}><summary>{compact ? '+ Attach / shared workspace' : 'Shared workspace'} <span>{state.files.length} files</span></summary><div className={styles.stack}>
    <p>One scope across all tabs. Imports replace the current source set. Files stay local until you explicitly send them to AI or save a private snapshot. AI requests also include recent shared investigation results and imported diagnostic evidence.</p>
    <div className={styles.actions}><button onClick={() => input.current?.click()}>Select files</button><button onClick={() => folder.current?.click()}>Project folder</button><Link href="/lab">Define scope</Link><Link href="/orchestrator">AI orchestrator</Link></div>
    <input hidden multiple type="file" ref={input} onChange={e => { void importFiles(e.target.files); e.target.value = '' }} /><input hidden multiple type="file" ref={folder} {...{ webkitdirectory: '' }} onChange={e => { void importFiles(e.target.files); e.target.value = '' }} />
    <GithubImport onImport={(files, githubScope) => { update(s => ({ ...s, files, githubScope, findings: null, patches: [], report: '', include: '', exclude: '' })); setNotice('Commit-pinned repository shared with every workspace tab.') }} />
    {state.githubScope && <small>Repository: {state.githubScope.repository} · {state.githubScope.commit}</small>}
    {state.files.length > 0 && <details><summary>Source inventory</summary>{state.files.map(f => <div key={f.path} className={styles.file}>{f.path}</div>)}</details>}
    <label className={styles.check}><input type="checkbox" checked={persistent} onChange={e => persist(e.target.checked)} />Save sources, chat, reports and events in this browser without an account</label>
    <small>{persistent ? 'Sensitive data is saved unencrypted on this device. Disable to delete the saved workspace copy.' : 'Memory only: refreshing clears workspace history. Appearance settings remain separate.'} Account-based private snapshots and transcript storage remain available in the lab and conversation tools.</small>
    <p role="status">{storageError || notice}</p>
  </div></details>
}
