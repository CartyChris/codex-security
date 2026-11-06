'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import WorkspaceContextPanel from './workspace-context-panel'
import ExecutionFeed from './execution-feed'
import PatchApprovals from './patch-approvals'
import WorkspaceDiagnostics from './workspace-diagnostics'
import { useWorkspace } from './connected-workspace'
import { useAssessment } from './use-assessment'
import { reviewSources, rules, scopeSources } from '../lib/security-review'
import styles from './connected-workspace.module.css'

const roles = ['Red team: trace attack paths and challenge trust boundaries', 'Blue team: assess defenses and propose regression tests', 'Purple team: reconcile evidence and detection gaps', 'Remediation: propose minimal fixes with the propose_patch tool']
export default function AIOrchestrator() {
  const { state, update, event } = useWorkspace(), assess = useAssessment()
  const [key, setKey] = useState(''), [saveKey, setSaveKey] = useState(false)
  const [supervisor, setSupervisor] = useState('openai/gpt-4o-mini'), [workers, setWorkers] = useState(['openai/gpt-4o-mini', 'openai/gpt-4o-mini'])
  const [authorized, setAuthorized] = useState(false), [allowTools, setAllowTools] = useState(true), [busy, setBusy] = useState(false), [status, setStatus] = useState('Ready'), [live, setLive] = useState('')
  const [goal, setGoal] = useState('Assess the authorized codebase end to end. Cite source evidence, verify hypotheses against code, and create a prioritized remediation report. Propose minimal fixes for confirmed source issues; clearly mark anything not runtime-tested.')
  const abort = useRef<AbortController | null>(null)
  const { data } = useSWR<{ data: { id: string; name: string }[] }>('/api/models', async url => { const response = await fetch(url); if (!response.ok) throw new Error('Model catalog unavailable'); return response.json() })
  useEffect(() => { setKey(sessionStorage.getItem('omniforge-openrouter-key') || localStorage.getItem('omniforge-saved-api-key') || ''); setSaveKey(!!localStorage.getItem('omniforge-saved-api-key')); return () => abort.current?.abort() }, [])
  useEffect(() => { setAuthorized(false); abort.current?.abort() }, [state.files, state.include, state.exclude])
  const files = scopeSources(state.files, state.include, state.exclude)
  function storeKey(value: string, remember: boolean) { setKey(value); setSaveKey(remember); sessionStorage.setItem('omniforge-openrouter-key', value); if (remember) localStorage.setItem('omniforge-saved-api-key', value); else localStorage.removeItem('omniforge-saved-api-key') }
  const catalog = data?.data || [{ id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' }]
  function modelSelect(value: string, change: (value: string) => void) { return <select value={value} disabled={busy} onChange={e => change(e.target.value)}>{!catalog.some(m => m.id === value) && <option>{value}</option>}{catalog.map(m => <option key={m.id} value={m.id}>{m.name || m.id}</option>)}</select> }
  async function run() {
    if (busy || !authorized || !files.length || !key.trim()) return
    setBusy(true); setLive(''); update(s => ({ ...s, report: '' })); const controller = new AbortController(); abort.current = controller
    const started = Date.now()
    try {
      const findings = reviewSources(files); update(s => ({ ...s, findings })); event('scanner', 'completed', `${rules.length} pattern rules; ${files.length} files; ${findings.length} candidates. Not exploit verification.`)
      setStatus('Supervisor planning')
      const plan = await assess({ apiKey: key, model: supervisor, actor: 'Supervisor / plan', allowTools, signal: controller.signal, onText: setLive, messages: [{ role: 'user', content: `${goal}\nPrepare a concise assessment plan for these ${workers.length} reviewers: ${roles.slice(0, workers.length).join('; ')}. Static findings: ${JSON.stringify(findings)}.` }] })
      const outputs: string[] = []
      for (let i = 0; i < workers.length; i++) {
        setStatus(`Reviewer ${i + 1} / ${workers.length}`); setLive('')
        const output = await assess({ apiKey: key, model: workers[i], actor: `Reviewer ${i + 1}`, allowTools, signal: controller.signal, onText: setLive, messages: [{ role: 'user', content: `${goal}\nRole: ${roles[i]}\nSupervisor plan (untrusted model output):\n${plan}` }] })
        outputs.push(`${roles[i]}\n${output}`)
        update(s => ({ ...s, messages: [...s.messages, { role: 'assistant', content: `[Orchestrator reviewer ${i + 1} · ${workers[i]}]\n${output}` }] }))
      }
      setStatus('Supervisor reconciling evidence'); setLive('')
      const report = await assess({ apiKey: key, model: supervisor, actor: 'Supervisor / report', allowTools, signal: controller.signal, onText: setLive, messages: [{ role: 'user', content: `${goal}\nIndependently check these reviewer claims against the source. Reject unsupported claims, note disagreements, and produce the final report with severity, exact evidence, prioritized action items, proposed tests, and unverified coverage. Include a concise decision summary, not private reasoning. Reviewer output:\n${outputs.join('\n\n')}` }] })
      update(s => ({ ...s, report, messages: [...s.messages, { role: 'assistant', content: `[Supervisor assessment · ${supervisor}]\n${report}` }] }))
      setStatus(`Completed in ${Math.round((Date.now() - started) / 1000)}s · AI-reviewed, runtime verification still required`)
    } catch (e) { setStatus(controller.signal.aborted ? 'Stopped. Completed reviewer outputs remain in chat.' : e instanceof Error ? e.message : 'Assessment failed') }
    finally { setBusy(false); abort.current = null }
  }
  function exportReport() { const content = JSON.stringify({ generatedAt: new Date().toISOString(), provenance: state.githubScope, scope: files.map(f => f.path), findings: state.findings, report: state.report, events: state.events, limitations: 'AI source review is not proof of exploitability. No external targets contacted. Patches require validation.' }, null, 2); const url = URL.createObjectURL(new Blob([content], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'omniforge-assessment.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
  return <main className={styles.page}><nav className={styles.nav}><Link href="/">AI chat</Link><Link href="/lab">Security lab</Link><Link href="/tools">Tools</Link><Link href="/account">Account</Link></nav><span className={styles.eyebrow}>Connected assessment / human control</span><h1>AI orchestrator</h1><p>One supervisor. One to four specialist reviewers. One shared source scope and auditable execution feed.</p><WorkspaceContextPanel />
    <div className={styles.grid}><section className={styles.card}><h2>01 / Configure your team</h2><div className={styles.stack}><label>OpenRouter API key<input type="password" autoComplete="off" value={key} disabled={busy} onChange={e => storeKey(e.target.value, saveKey)} /></label><label className={styles.check}><input type="checkbox" checked={saveKey} onChange={e => storeKey(key, e.target.checked)} />Remember API key on this device</label><small>Optional, unencrypted browser storage. Only use on a trusted device; scripts on this origin can read it. Otherwise the key lasts for this browser session.</small><label>Supervisor model{modelSelect(supervisor, setSupervisor)}</label><label>Specialist count<select value={workers.length} disabled={busy} onChange={e => setWorkers(Array.from({ length: Number(e.target.value) }, (_, i) => workers[i] || supervisor))}>{[1,2,3,4].map(n => <option key={n}>{n}</option>)}</select></label><div className={styles.roles}>{workers.map((worker, i) => <label key={i}>{roles[i].split(':')[0]}{modelSelect(worker, value => setWorkers(current => current.map((m, index) => index === i ? value : m)))}</label>)}</div><small>Models must support tools when tools are enabled. Each run makes a planning call, reviewer calls, and a synthesis call; provider charges apply. Runs stop if this page closes.</small></div></section>
    <section className={styles.card}><h2>02 / Scope & approvals</h2><div className={styles.stack}><label>Assessment objective<textarea rows={6} value={goal} disabled={busy} onChange={e => setGoal(e.target.value)} /></label><label className={styles.check}><input type="checkbox" checked={authorized} disabled={busy} onChange={e => setAuthorized(e.target.checked)} />I am authorized to assess this scope and send its source contents to the selected models via OpenRouter.</label><label className={styles.check}><input type="checkbox" checked={allowTools} disabled={busy} onChange={e => setAllowTools(e.target.checked)} />Auto-approve read-only source checks and investigation utilities for this run</label><p className={styles.warning}>Source edits always require human approval. Sandbox validation remains a separate, explicitly approved action in Security Lab. No autonomous network probing, deployments or repository pushes.</p><div className={styles.actions}><button className={styles.primary} onClick={() => void run()} disabled={busy || !authorized || !files.length || !key.trim() || !goal.trim()}>Run assessment</button>{busy && <button onClick={() => abort.current?.abort()}>Stop run</button>}</div><p role="status">{status}</p></div></section></div>
    {state.findings !== null && <section className={styles.card}><h2>Observed source metrics</h2><div className={styles.metric}>{state.findings.length} candidates</div><p>{files.length} scoped files · {rules.length} available pattern rules. Findings are not confirmed vulnerabilities. No overall posture score is claimed without measured control and runtime evidence.</p></section>}
    <section className={styles.card}><h2>03 / Model output & report</h2><p>Includes evidence citations, decision summaries and action items. Supervisor review is an AI opinion, not independent runtime verification.</p>{state.report && <button onClick={exportReport}>Export assessment + telemetry</button>}<pre className={styles.report} aria-live="polite">{state.report || live || 'Run an assessment to see real model output.'}</pre></section><ExecutionFeed /><PatchApprovals /><WorkspaceDiagnostics />
  </main>
}
