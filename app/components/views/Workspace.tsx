'use client'

import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, FileSearch, FolderOpen, KeyRound, Plus, ScanSearch, Sparkles, Trash2, Upload } from 'lucide-react'
import { BarList } from '../charts'
import { formatBytes, languageOf, uid, type Finding, type WorkspaceFile } from '../../lib/harness'
import { scanForSecrets, secretPatterns, type SecretHit } from '../../lib/security-data'

// Files are read in the browser only. Very large files and dependency/VCS folders are
// skipped so importing a project folder does not freeze the tab.
const MAX_FILE_BYTES = 2 * 1024 * 1024
const skippedDirs = /(^|\/)(node_modules|\.git|\.next|dist|build|vendor|__pycache__|\.venv)(\/|$)/

type WorkspaceProps = { files: WorkspaceFile[]; onAdd: (files: WorkspaceFile[], skipped: number) => void; onClear: () => void; onScan: () => void; onAsk: (prompt: string) => void }

export function Workspace({ files, onAdd, onClear, onScan, onAsk }: WorkspaceProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)

  async function importFiles(list: FileList | File[]) {
    setLoading(true)
    const accepted: WorkspaceFile[] = []
    let skipped = 0
    for (const file of Array.from(list)) {
      const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
      if (skippedDirs.test(path) || file.size > MAX_FILE_BYTES) { skipped++; continue }
      const text = await file.text().catch(() => '')
      if (text.includes('\u0000')) { skipped++; continue }
      accepted.push({ id: uid('file'), name: file.name, path, size: file.size, language: languageOf(file.name), text })
    }
    onAdd(accepted, skipped)
    setLoading(false)
  }

  const languages = useMemo(() => {
    const counts = new Map<string, number>()
    files.forEach((file) => counts.set(file.language, (counts.get(file.language) || 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value }))
  }, [files])
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  const totalLines = files.reduce((sum, file) => sum + file.text.split('\n').length, 0)

  function audit() {
    const tree = files.slice(0, 200).map((file) => `- ${file.path} (${file.language}, ${formatBytes(file.size)})`).join('\n')
    const priority = files.filter((file) => /package\.json|dockerfile|\.env|config|auth|route|server|\.tf$|\.ya?ml$/i.test(file.path)).slice(0, 6)
    const excerpts = priority.map((file) => `### ${file.path}\n\`\`\`\n${file.text.slice(0, 1500)}\n\`\`\``).join('\n\n')
    onAsk(`Audit this workspace for security, architecture, and maintainability risks. Prioritize findings and suggest fixes.\n\nFiles (${files.length}):\n${tree}\n\nKey file excerpts:\n${excerpts}`)
  }

  return <div className="stack">
    <div className={dragging ? 'dropzone active' : 'dropzone'} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void importFiles(event.dataTransfer.files) }}>
      <Upload size={26} />
      <strong>{loading ? 'Reading files…' : 'Drop files here, or choose files or a folder'}</strong>
      <span>Files stay in this browser. Dependency folders, binaries, and files over 2 MB are skipped.</span>
      <div className="detail-actions">
        <button className="primary small" onClick={() => fileInput.current?.click()}><Plus size={14} /> Choose files</button>
        <button className="secondary-button" onClick={() => folderInput.current?.click()}><FolderOpen size={14} /> Choose folder</button>
      </div>
      <input ref={fileInput} type="file" multiple hidden onChange={(event) => { if (event.target.files) void importFiles(event.target.files); event.target.value = '' }} />
      <input ref={folderInput} type="file" multiple hidden {...{ webkitdirectory: '' }} onChange={(event) => { if (event.target.files) void importFiles(event.target.files); event.target.value = '' }} />
    </div>

    {files.length > 0 && <>
      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-head"><span>Files</span></div><strong>{files.length}</strong></div>
        <div className="kpi"><div className="kpi-head"><span>Total size</span></div><strong>{formatBytes(totalBytes)}</strong></div>
        <div className="kpi"><div className="kpi-head"><span>Lines</span></div><strong>{totalLines.toLocaleString()}</strong></div>
        <div className="kpi"><div className="kpi-head"><span>Languages</span></div><strong>{languages.length}</strong></div>
      </div>
      <div className="grid-2 wide-right">
        <section className="panel"><div className="panel-head"><div><h2>Languages</h2><p>Files per language</p></div></div><BarList items={languages} /></section>
        <section className="panel">
          <div className="panel-head"><div><h2>Files</h2><p>Largest first</p></div>
            <div className="detail-actions tight">
              <button className="primary small" onClick={audit}><Sparkles size={14} /> Audit with AI</button>
              <button className="secondary-button" onClick={onScan}><ScanSearch size={14} /> Scan for secrets</button>
              <button className="secondary-button" onClick={onClear}><Trash2 size={14} /> Clear</button>
            </div></div>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Path</th><th>Language</th><th>Size</th></tr></thead>
            <tbody>{[...files].sort((a, b) => b.size - a.size).slice(0, 150).map((file) => <tr key={file.id}><td className="mono truncate">{file.path}</td><td>{file.language}</td><td>{formatBytes(file.size)}</td></tr>)}</tbody></table></div>
        </section>
      </div>
    </>}
  </div>
}

// ---------- Secrets & PII scanner ----------
type SecretsProps = { files: WorkspaceFile[]; onAddFindings: (findings: Finding[]) => void; onAsk: (prompt: string) => void; onScanned: (count: number) => void }

const severityTone = { High: 'critical', Medium: 'warning', Low: 'low' } as const

export function Secrets({ files, onAddFindings, onAsk, onScanned }: SecretsProps) {
  const [source, setSource] = useState<'paste' | 'workspace'>(files.length ? 'workspace' : 'paste')
  const [text, setText] = useState('')
  const [hits, setHits] = useState<SecretHit[] | null>(null)
  const [added, setAdded] = useState(false)

  function scan() {
    const results = source === 'paste' ? scanForSecrets(text) : files.flatMap((file) => scanForSecrets(file.text, file.path))
    setHits(results); setAdded(false); onScanned(results.length)
  }

  const byType = useMemo(() => {
    const counts = new Map<string, number>()
    hits?.forEach((hit) => counts.set(hit.pattern.label, (counts.get(hit.pattern.label) || 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))
  }, [hits])
  const count = (severity: 'High' | 'Medium' | 'Low') => hits?.filter((hit) => hit.pattern.severity === severity).length || 0

  function addFindings() {
    if (!hits) return
    const grouped = new Map<string, SecretHit[]>()
    hits.forEach((hit) => { const key = `${hit.pattern.id}|${hit.file}`; grouped.set(key, [...(grouped.get(key) || []), hit]) })
    onAddFindings([...grouped.values()].map((group) => ({
      id: uid('S'),
      title: `${group[0].pattern.label} exposed`,
      path: `${group[0].file}:${group[0].line}`,
      severity: group[0].pattern.severity,
      category: group[0].pattern.kind === 'pii' ? 'Sensitive data exposure' : 'Secret exposure',
      detail: `${group.length} match${group.length > 1 ? 'es' : ''} (${group.map((hit) => `line ${hit.line}`).join(', ')}). Values are redacted in the harness.`,
      fix: group[0].pattern.kind === 'pii' ? 'Remove or mask the personal data and confirm it is not logged or committed.' : 'Revoke and rotate the credential, move it to a secrets manager, and purge it from history.',
      status: 'todo',
    })))
    setAdded(true)
  }

  return <div className="stack">
    <section className="panel">
      <div className="toolbar-row">
        <div className="segmented inline" role="group" aria-label="Scan source">
          <button className={source === 'paste' ? 'active' : ''} onClick={() => setSource('paste')}>Paste text</button>
          <button className={source === 'workspace' ? 'active' : ''} onClick={() => setSource('workspace')}>Workspace ({files.length} files)</button>
        </div>
        <span className="muted small"><KeyRound size={12} /> {secretPatterns.length} detectors · runs locally, nothing is uploaded</span>
      </div>
      {source === 'paste' ? <textarea className="runner-input mono" rows={8} value={text} onChange={(event) => setText(event.target.value)} placeholder="Paste code, logs, .env files, or config to scan for credentials and personal data." aria-label="Text to scan" />
        : !files.length && <p className="muted">Import files in the Workspace tab first.</p>}
      <div className="detail-actions"><button className="primary small" onClick={scan} disabled={source === 'paste' ? !text.trim() : !files.length}><ScanSearch size={14} /> Scan</button></div>
    </section>

    {hits && <>
      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-head"><span>Matches</span></div><strong>{hits.length}</strong></div>
        {(['High', 'Medium', 'Low'] as const).map((severity) => <div className="kpi" key={severity}><div className="kpi-head"><span className={`sev ${severityTone[severity]}`}><AlertTriangle size={13} /> {severity}</span></div><strong>{count(severity)}</strong></div>)}
      </div>
      {hits.length ? <div className="grid-2 wide-right">
        <section className="panel"><div className="panel-head"><div><h2>By detector</h2><p>Matches per pattern</p></div></div><BarList items={byType} /></section>
        <section className="panel">
          <div className="panel-head"><div><h2>Matches</h2><p>Values are redacted</p></div>
            <div className="detail-actions tight">
              <button className="primary small" onClick={addFindings} disabled={added}><Plus size={14} /> {added ? 'Added to findings' : 'Add to findings'}</button>
              <button className="secondary-button" onClick={() => onAsk(`Create a secret rotation and cleanup plan for these redacted findings. Do not ask for the secret values.\n\n${hits.slice(0, 60).map((hit) => `- ${hit.pattern.label} in ${hit.file} line ${hit.line} (${hit.pattern.severity})`).join('\n')}`)}><Sparkles size={14} /> Rotation plan</button>
            </div></div>
          <div className="table-scroll"><table className="data-table"><thead><tr><th>Severity</th><th>Type</th><th>Location</th><th>Preview</th></tr></thead>
            <tbody>{hits.slice(0, 300).map((hit, index) => <tr key={index}><td><span className={`sev ${severityTone[hit.pattern.severity]}`}><AlertTriangle size={12} /> {hit.pattern.severity}</span></td><td>{hit.pattern.label}</td><td className="mono truncate">{hit.file}:{hit.line}</td><td className="mono">{hit.preview}</td></tr>)}</tbody></table></div>
        </section>
      </div> : <div className="panel empty"><span><FileSearch /></span><strong>No secrets or personal data found</strong><p>{secretPatterns.length} detectors ran with no matches.</p></div>}
    </>}
  </div>
}
