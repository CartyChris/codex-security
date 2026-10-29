'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Check, Download, FileCode2, FlaskConical, FolderOpen, LockKeyhole, Search, Shield, Swords, Upload, X } from 'lucide-react'
import { MAX_BYTES, MAX_FILES, reviewSources, rules, sourcePathAllowed, toSarif, type SourceFile, type Finding } from '../lib/security-review'
import styles from './security-lab.module.css'
import SourceSnapshots from './source-snapshots'

export default function SecurityLab() {
  const [files, setFiles] = useState<SourceFile[]>([])
  const [findings, setFindings] = useState<Finding[] | null>(null)
  const [mode, setMode] = useState<'purple' | 'red' | 'blue'>('purple')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [completed, setCompleted] = useState<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const visible = findings?.filter((finding) => (filter === 'all' || finding.severity === filter) && `${finding.title} ${finding.path}`.toLowerCase().includes(query.toLowerCase())) ?? []

  async function importFiles(incoming: FileList | File[]) {
    setBusy(true)
    setNotice('Reading supported source files locally…')
    try {
      const all = Array.from(incoming)
      const selected = all.filter((file) => sourcePathAllowed(file.webkitRelativePath || file.name))
      if (!selected.length) throw new Error('No supported source files. Choose text/code files or a folder; archives and binaries are not supported yet.')
      if (selected.length > MAX_FILES || selected.reduce((size, file) => size + file.size, 0) > MAX_BYTES) throw new Error('Local review supports up to 150 source files and 2 MB total. Choose a smaller source folder.')
      const sources = await Promise.all(selected.map(async (file) => ({ path: file.webkitRelativePath || file.name, content: await file.text() })))
      const textSources = sources.filter((file) => !file.content.includes('\0'))
      if (!textSources.length) throw new Error('No readable text files found.')
      setFiles(textSources)
      setFindings(null)
      setCompleted([])
      setNotice(`${textSources.length} files ready. ${all.length - textSources.length} unsupported, generated, or credential files skipped. Nothing was uploaded.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not read files.') }
    finally { setBusy(false) }
  }
  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) void importFiles(event.target.files)
    event.target.value = ''
  }
  function runReview() {
    setFindings(reviewSources(files))
    setCompleted([])
    setNotice(`Completed ${rules.length} pattern checks across ${files.length} files. Manual verification is required.`)
  }
  function exportReport(format: 'json' | 'sarif') {
    if (!findings) return
    const report = format === 'sarif' ? toSarif(findings) : { tool: 'OmniForge local pattern review', generatedAt: new Date().toISOString(), mode, scope: files.map(({ path }) => path), checks: rules.map(({ id }) => id), limitations: 'Heuristic source patterns only. No code execution, dependency analysis, or verified exploitability. Completed checkboxes are user-reported, not test results.', findings, userReviewed: completed }
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `omniforge-review.${format === 'sarif' ? 'sarif' : 'json'}`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('Report exported. Source contents are not included; file paths and findings are included.')
  }
  return <main className={styles.lab}>
    <header className={styles.header}><Link href="/" aria-label="Back to AI chat" className={styles.back}><ArrowLeft size={18} /></Link><Link href="/" className={styles.brand}><Shield size={22} /> OmniForge</Link><Link href="/account" className={styles.badge} style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>ACCOUNT</Link></header>
    <div className={styles.workspace}>
      <section className={styles.hero}><div className={styles.eyebrow}><span /> YOUR CODE. A CLOSER LOOK.</div><h1>Build confidence.<br /><span>Before you ship.</span></h1><p>A focused workbench for source review, adversarial thinking, and defensive validation. Evidence first. No imaginary test results.</p><div className={styles.heroMeta}><span><LockKeyhole size={14} /> Local-only review</span><span><FlaskConical size={14} /> {rules.length} source checks</span></div></section>
      <div className={styles.columns}><section className={styles.panel} aria-labelledby="scope-title">
        <div className={styles.sectionHeading}><span className={styles.step}>01</span><div><h2 id="scope-title">Define your scope</h2><p>Start with the code you want to review.</p></div></div>
        <div className={styles.dropzone} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!busy) void importFiles(event.dataTransfer.files) }}><span className={styles.uploadIcon}><Upload size={24} /></span><h3>Bring your code</h3><p>Select source files or a project folder.<br />Reviewed locally. Uploaded only when you choose to save privately.</p><div className={styles.buttons}><button onClick={() => fileInput.current?.click()} disabled={busy} className={styles.primary}><FileCode2 size={16} /> Select files</button><button onClick={() => folderInput.current?.click()} disabled={busy} className={styles.secondary}><FolderOpen size={16} /> Folder</button></div><small>Text/code · 150 files · 2 MB · No ZIPs or binaries</small><input ref={fileInput} type="file" multiple hidden onChange={selectFiles} /><input ref={folderInput} type="file" multiple hidden {...{ webkitdirectory: '' }} onChange={selectFiles} /></div>
        {files.length > 0 && <details className={styles.fileList}><summary>{files.length} files in scope</summary>{files.map((file, index) => <div key={`${file.path}-${index}`}><FileCode2 size={14} /><span>{file.path}</span><button aria-label={`Remove ${file.path}`} onClick={() => { setFiles(files.filter((_, position) => position !== index)); setFindings(null); setCompleted([]) }}><X size={14} /></button></div>)}</details>}
        <SourceSnapshots files={files} authorized={authorized} onOpen={(saved) => { setFiles(saved); setFindings(null); setCompleted([]); setAuthorized(false); setNotice('Private snapshot loaded. Previous findings cleared.') }} />
        <div className={styles.sectionHeading}><span className={styles.step}>02</span><div><h2>Choose your perspective</h2><p>Same evidence. Different verification plans.</p></div></div>
        <div className={styles.modes} role="group" aria-label="Review perspective">{([{ id: 'red', label: 'Red team', Icon: Swords, description: 'Challenge assumptions' }, { id: 'blue', label: 'Blue team', Icon: Shield, description: 'Strengthen defenses' }, { id: 'purple', label: 'Purple team', Icon: FlaskConical, description: 'Connect both sides' }] as const).map(({ id, label, Icon, description }) => <button key={id} aria-pressed={mode === id} data-active={mode === id} onClick={() => setMode(id)}><Icon size={18} /><strong>{label}</strong><small>{description}</small></button>)}</div>
        <label className={styles.consent}><input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} /><span>I own this code or have permission to assess it.</span></label><button className={`${styles.primary} ${styles.run}`} disabled={!files.length || !authorized || busy} onClick={runReview}><Search size={17} /> Run local review</button>
        <p className={styles.disclaimer}>Pattern checks do not execute code or establish exploitability. Comments and test fixtures may match. No matches does not mean an application is secure.</p>
      </section>
      <section className={styles.results} aria-labelledby="results-title"><div className={styles.sectionHeading}><span className={styles.step}>03</span><div><h2 id="results-title">Evidence & next steps</h2><p>{findings === null ? 'Your findings will appear here.' : `${findings.length} potential issues · ${completed.length} marked reviewed`}</p></div></div>
        <p role="status" className={styles.status}>{notice || 'Ready when you are. Select code to begin.'}</p>
        {findings === null ? <div className={styles.empty}><div className={styles.orbit}><Shield size={38} /></div><h3>Clarity, not a security score.</h3><p>Get file and line references, suggested remediation, and concrete verification plans. No source code is included in exported reports.</p><div className={styles.coverage}>{rules.map((rule) => <span key={rule.id}><Check size={12} /> {rule.title}</span>)}</div></div> : <>
          <div className={styles.filters}><label><span className={styles.srOnly}>Search findings</span><input placeholder="Search findings or paths…" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label><span className={styles.srOnly}>Severity</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option></select></label></div>
          <div className={styles.buttons}><button className={styles.secondary} onClick={() => exportReport('json')}><Download size={15} /> JSON</button><button className={styles.secondary} onClick={() => exportReport('sarif')}><Download size={15} /> SARIF</button></div>
          {!visible.length && <div className={styles.empty}><Shield size={32} /><h3>{findings.length ? 'No matching findings' : 'No patterns matched'}</h3><p>{findings.length ? 'Try a different search or priority filter.' : 'These checks cover a limited set of source patterns. Continue with dependency and runtime testing before drawing security conclusions.'}</p></div>}
          {visible.map((finding) => <article className={styles.finding} key={finding.id}><div className={styles.findingTop}><span data-severity={finding.severity} className={styles.severity}>{finding.severity}</span><small>NEEDS VERIFICATION</small></div><h3>{finding.title}</h3><code>{finding.path}:{finding.line}</code><p>{finding.remediation}</p><details><summary>Verification plan</summary>{mode !== 'blue' && <div className={styles.plan}><strong><Swords size={14} /> Red-team hypothesis</strong><p>{finding.red}</p></div>}{mode !== 'red' && <div className={styles.plan}><strong><Shield size={14} /> Blue-team validation</strong><p>{finding.blue}</p></div>}<label className={styles.consent}><input type="checkbox" checked={completed.includes(finding.id)} onChange={(event) => setCompleted((current) => event.target.checked ? [...current, finding.id] : current.filter((id) => id !== finding.id))} />I manually reviewed this finding</label></details></article>)}
        </>}
      </section></div>
      <section className={styles.roadmap}><div><p className={styles.eyebrow}>NEXT: CONNECTED EXECUTION</p><h2>From review to real validation.</h2><p>These capabilities require backend setup. They are not active in this local review.</p></div><div className={styles.roadmapGrid}>{[{ title: 'Repository workspaces', text: 'Read-only GitHub access, commit-pinned scopes, and saved run history. Private source snapshots are available above.', href: 'https://vercel.com/docs/vercel-connect', label: 'Managed access' }, { title: 'Disposable sandboxes', text: 'Isolated Linux microVMs, deny-by-default networking, bounded runs, and cleanup.', href: 'https://vercel.com/docs/vercel-sandbox', label: 'Isolation architecture' }, { title: 'Deeper test suites', text: 'Semgrep static analysis, OSV dependency checks, and explicit local runtime test scenarios.', href: 'https://google.github.io/osv-scanner/', label: 'Dependency analysis' }].map((item) => <article key={item.title}><span className={styles.setupBadge}>SETUP REQUIRED</span><h3>{item.title}</h3><p>{item.text}</p><a href={item.href} target="_blank" rel="noreferrer">{item.label}<ArrowUpRight size={14} /></a></article>)}</div></section>
      <footer className={styles.footer}>Only assess authorized code. Local review never runs imported code or contacts its services.</footer>
    </div>
  </main>
}
