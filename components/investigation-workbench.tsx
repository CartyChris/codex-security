'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Copy, Download, LockKeyhole, Play, Shield, Wrench } from 'lucide-react'
import { MAX_TOOL_CHARS, runInvestigationTool, toolCatalog, type ToolId } from '../lib/investigation-tools'
import styles from './investigation-workbench.module.css'

export default function InvestigationWorkbench() {
  const [tool, setTool] = useState<ToolId>('jwt')
  const [input, setInput] = useState(''), [second, setSecond] = useState(''), [option, setOption] = useState('')
  const [output, setOutput] = useState<string | null>(null), [error, setError] = useState(''), [status, setStatus] = useState(''), [busy, setBusy] = useState(false)
  const definition = toolCatalog.find(item => item.id === tool)!
  function clearResult() { setOutput(null); setError(''); setStatus('') }
  function choose(id: ToolId) { setTool(id); setInput(''); setSecond(''); setOption(toolCatalog.find(item => item.id === id)!.options[0] || ''); clearResult() }
  async function run() {
    if (busy) return
    clearResult(); setBusy(true)
    try { const result = await runInvestigationTool(tool, input, option, second); setOutput(tool === 'codec' ? String(result) : JSON.stringify(result, null, 2)); setStatus('Completed locally. No network requests were made.') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to process input.') }
    finally { setBusy(false) }
  }
  async function copy() { try { await navigator.clipboard.writeText(output || ''); setStatus('Result copied. Treat it as potentially sensitive.') } catch { setStatus('Clipboard unavailable. Select and copy the result text instead.') } }
  function download() {
    if (output === null) return
    const url = URL.createObjectURL(new Blob([output], { type: tool === 'codec' ? 'text/plain' : 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `omniforge-${tool}.${tool === 'codec' ? 'txt' : 'json'}`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Result exported. Input text is not added to the export; decoded or transformed content may still be sensitive.')
  }
  return <main className={styles.page}>
    <header className={styles.header}><Link href="/" aria-label="Back to workspace"><ArrowLeft size={18} /></Link><Link href="/" className={styles.brand}><Shield size={20} /> OmniForge</Link><Link href="/lab">Security lab</Link></header>
    <div className={styles.content}>
      <div className={styles.eyebrow}><Wrench size={14} /> INVESTIGATION / LOCAL TOOLS</div>
      <h1>Inspect. Decode.<br /><span>Understand.</span></h1><p className={styles.intro}>Small, precise tools for the evidence in front of you. No agents, silent requests, or invented verdicts.</p>
      <p className={styles.boundary}><LockKeyhole size={15} /><span>Runs in this browser · inputs are not saved · outputs may contain sensitive data</span></p>
      <nav className={styles.tools} aria-label="Investigation tools">{toolCatalog.map(item => <button key={item.id} aria-pressed={tool === item.id} disabled={busy} onClick={() => choose(item.id)}><small>{item.category}</small><span>{item.name}{tool === item.id && <Check size={14} />}</span></button>)}</nav>
      <div className={styles.workspace}>
        <section className={styles.panel} aria-labelledby="tool-title"><div className={styles.sectionLabel}>01 / INPUT</div><h2 id="tool-title">{definition.name}</h2><p>{definition.description}</p>
          {definition.options.length > 0 && <label>Operation<select value={option} disabled={busy} onChange={event => { setOption(event.target.value); clearResult() }}>{definition.options.map(value => <option key={value}>{value}</option>)}</select></label>}
          <label htmlFor="tool-input">{tool === 'diff' ? 'Original text' : 'Input'}<textarea id="tool-input" value={input} maxLength={MAX_TOOL_CHARS} disabled={busy} onChange={event => { setInput(event.target.value); clearResult() }} spellCheck={false} autoComplete="off" autoCapitalize="none" placeholder={definition.placeholder} rows={7} /></label>
          <small className={styles.counter}>{input.length.toLocaleString()} / {MAX_TOOL_CHARS.toLocaleString()} characters</small>
          {tool === 'diff' && <label>Updated text<textarea value={second} disabled={busy} maxLength={MAX_TOOL_CHARS} onChange={event => { setSecond(event.target.value); clearResult() }} spellCheck={false} rows={6} /></label>}
          <div className={styles.actions}><button className={styles.primary} onClick={run} disabled={busy}><Play size={15} />{busy ? 'Processing…' : 'Run locally'}</button><button onClick={() => { setInput(''); setSecond(''); clearResult() }} disabled={busy}>Clear input & result</button></div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </section>
        <section className={styles.panel} aria-labelledby="output-title"><div className={styles.sectionLabel}>02 / RESULT</div><h2 id="output-title">Observed output</h2><p role="status">{status || 'Nothing has run yet. Edit any input to clear an earlier result.'}</p>
          {output !== null ? <><div className={styles.actions}><button onClick={copy}><Copy size={14} /> Copy</button><button onClick={download}><Download size={14} /> Export</button></div><pre tabIndex={0} aria-label="Tool output">{output || '(empty string)'}</pre></> : <div className={styles.empty}><Shield size={28} /><strong>Evidence, not a score.</strong><p>Results appear only after you run a tool. Imported text and HTML are never executed.</p></div>}
        </section>
      </div>
      <details className={styles.notes}><summary>What was brought over—and what was not</summary><p>Inspired by OPERATOR&apos;s local inspection tools, Astra&apos;s utilities, and Liquid X&apos;s portable transcripts. Source browsing and literal search are in Security Lab; transcript import/export is in AI chat.</p><p>These tools replace silent parsing failures with errors, handle UTF-8 correctly, preserve insertions in diffs, and distinguish JWT decoding from verification. Credential matches report locations, not secret values.</p><p>Mock model output, simulated packet feeds, fabricated posture scores, browser fingerprinting, and unattended target requests were not imported. Live telemetry and multi-model orchestration are not provided by this workbench.</p></details>
    </div>
  </main>
}
