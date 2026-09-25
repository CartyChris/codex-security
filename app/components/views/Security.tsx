'use client'

import { useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CircleDashed, Plus, ShieldCheck, Sparkles, X } from 'lucide-react'
import { Donut } from '../charts'
import { severityTone, uid, type Finding, type Severity } from '../../lib/harness'
import { attackTactics, findingTechniques, frameworks, type ControlStatus } from '../../lib/security-data'

// ---------- Remediation board ----------
const columns = [
  { id: 'todo', label: 'To do', hint: 'Triaged, not started' },
  { id: 'doing', label: 'In progress', hint: 'Fix underway' },
  { id: 'done', label: 'Verified', hint: 'Fixed and confirmed' },
] as const
type Column = (typeof columns)[number]['id']

export const statusOf = (finding: Finding): Column => finding.status || (finding.resolved ? 'done' : 'todo')

type RemediationProps = { findings: Finding[]; onMove: (id: string, status: Column) => void; onAdd: (finding: Finding) => void; onAsk: (finding: Finding) => void }

export function Remediation({ findings, onMove, onAdd, onAsk }: RemediationProps) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<Column | null>(null)
  const [draft, setDraft] = useState<{ title: string; path: string; severity: Severity } | null>(null)
  const done = findings.filter((finding) => statusOf(finding) === 'done').length

  return <div className="stack">
    <div className="toolbar-row">
      <div className="progress-inline"><span>{done} of {findings.length} verified</span><span className="progress"><span style={{ width: `${findings.length ? (done / findings.length) * 100 : 0}%` }} /></span></div>
      <div className="spacer" />
      <button className="primary small" onClick={() => setDraft({ title: '', path: '', severity: 'Medium' })}><Plus size={14} /> New ticket</button>
    </div>
    {draft && <form className="panel form-row" onSubmit={(event) => { event.preventDefault(); onAdd({ id: uid('T'), title: draft.title, path: draft.path || 'unassigned', severity: draft.severity, category: 'Manual ticket', detail: 'Created on the remediation board.', fix: 'Describe the fix and how it was verified.', status: 'todo' }); setDraft(null) }}>
      <input className="field" autoFocus placeholder="What needs fixing?" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} aria-label="Ticket title" />
      <input className="field" placeholder="File, service, or owner" value={draft.path} onChange={(event) => setDraft({ ...draft, path: event.target.value })} aria-label="Location" />
      <select className="field narrow" value={draft.severity} onChange={(event) => setDraft({ ...draft, severity: event.target.value as Severity })} aria-label="Severity"><option>High</option><option>Medium</option><option>Low</option></select>
      <button className="primary small" disabled={!draft.title.trim()}>Add</button>
      <button type="button" className="icon-button small" onClick={() => setDraft(null)} aria-label="Cancel"><X size={15} /></button>
    </form>}
    <div className="board">{columns.map((column, columnIndex) => {
      const items = findings.filter((finding) => statusOf(finding) === column.id)
      return <section key={column.id} className={over === column.id ? 'board-col over' : 'board-col'} onDragOver={(event) => { event.preventDefault(); setOver(column.id) }} onDragLeave={() => setOver(null)} onDrop={() => { if (dragging) onMove(dragging, column.id); setDragging(null); setOver(null) }}>
        <header><strong>{column.label}</strong><span className="count-pill">{items.length}</span><small>{column.hint}</small></header>
        {items.map((finding) => <article key={finding.id} className={dragging === finding.id ? 'ticket dragging' : 'ticket'} draggable onDragStart={() => setDragging(finding.id)} onDragEnd={() => setDragging(null)}>
          <div className="ticket-top"><span className={`tag ${severityTone[finding.severity]}`}>{finding.severity}</span><span className="mono muted small">{finding.id}</span></div>
          <strong>{finding.title}</strong>
          <span className="mono muted small truncate">{finding.path}</span>
          <div className="ticket-actions">
            <button className="icon-button small" disabled={columnIndex === 0} onClick={() => onMove(finding.id, columns[columnIndex - 1].id)} aria-label={`Move ${finding.title} back`}><ArrowLeft size={14} /></button>
            <button className="icon-button small ask" onClick={() => onAsk(finding)} aria-label={`Ask AI analyst about ${finding.title}`}><Sparkles size={14} /></button>
            <button className="icon-button small" disabled={columnIndex === columns.length - 1} onClick={() => onMove(finding.id, columns[columnIndex + 1].id)} aria-label={`Move ${finding.title} forward`}><ArrowRight size={14} /></button>
          </div>
        </article>)}
        {!items.length && <p className="board-empty">Drop tickets here</p>}
      </section>
    })}</div>
  </div>
}

// ---------- ATT&CK coverage ----------
type AttackProps = { findings: Finding[]; coverage: string[]; onToggle: (id: string) => void; onAsk: (prompt: string) => void }

export function AttackMap({ findings, coverage, onToggle, onAsk }: AttackProps) {
  const [selected, setSelected] = useState<{ id: string; name: string; tactic: string } | null>(null)
  const exposed = new Map<string, Finding[]>()
  findings.filter((finding) => !finding.resolved).forEach((finding) => (findingTechniques[finding.id] || []).forEach((id) => exposed.set(id, [...(exposed.get(id) || []), finding])))
  const total = attackTactics.reduce((sum, tactic) => sum + tactic.techniques.length, 0)
  const covered = attackTactics.flatMap((tactic) => tactic.techniques).filter((technique) => coverage.includes(technique.id)).length
  const gaps = [...exposed.keys()].filter((id) => !coverage.includes(id)).length

  return <div className="stack">
    <div className="kpi-grid">
      <div className="kpi"><div className="kpi-head"><span>Detection coverage</span></div><strong>{Math.round((covered / total) * 100)}%</strong><span className="progress"><span style={{ width: `${(covered / total) * 100}%` }} /></span></div>
      <div className="kpi"><div className="kpi-head"><span>Techniques covered</span></div><strong>{covered}<small> / {total}</small></strong></div>
      <div className="kpi"><div className="kpi-head"><span>Exposed by findings</span></div><strong>{exposed.size}</strong></div>
      <div className="kpi"><div className="kpi-head"><span className="sev critical"><AlertTriangle size={13} /> Uncovered exposures</span></div><strong>{gaps}</strong></div>
    </div>
    <div className="legend spaced">
      <span><i className="swatch covered" />Detection in place</span>
      <span><i className="swatch exposed" />Exposed by an open finding</span>
      <span><i className="swatch gap" />Exposed and not detected</span>
    </div>
    <div className="attack-scroll"><div className="attack-matrix">{attackTactics.map((tactic) => <section key={tactic.id} className="tactic">
      <header><strong>{tactic.name}</strong><span className="mono">{tactic.id}</span></header>
      {tactic.techniques.map((technique) => {
        const isCovered = coverage.includes(technique.id)
        const isExposed = exposed.has(technique.id)
        const state = isExposed && !isCovered ? 'gap' : isExposed ? 'exposed' : isCovered ? 'covered' : ''
        return <button key={technique.id} className={`technique ${state} ${selected?.id === technique.id ? 'on' : ''}`} onClick={() => setSelected({ ...technique, tactic: tactic.name })} aria-label={`${technique.id} ${technique.name}${isCovered ? ', covered' : ''}${isExposed ? ', exposed' : ''}`}>
          <span className="mono">{technique.id}</span>{technique.name}
          {isCovered && <Check size={12} />}{isExposed && <AlertTriangle size={12} />}
        </button>
      })}
    </section>)}</div></div>
    {selected && <section className="panel technique-detail">
      <div className="panel-head"><div><p className="eyebrow">{selected.tactic}</p><h2>{selected.id} · {selected.name}</h2>
        <p>{exposed.get(selected.id)?.length ? `Exposed by: ${exposed.get(selected.id)!.map((finding) => finding.title).join(', ')}` : 'Not linked to an open finding.'}</p></div>
        <button className="icon-button small" onClick={() => setSelected(null)} aria-label="Close technique"><X size={15} /></button></div>
      <div className="detail-actions">
        <button className="secondary-button" onClick={() => onToggle(selected.id)}>{coverage.includes(selected.id) ? <><CircleDashed size={14} /> Mark not covered</> : <><ShieldCheck size={14} /> Mark covered</>}</button>
        <button className="primary small" onClick={() => onAsk(`Write detection logic for MITRE ATT&CK ${selected.id} (${selected.name}, ${selected.tactic}). Include a Sigma rule, a KQL query, the telemetry sources needed, benign false positives, and a test to validate the detection.`)}><Sparkles size={14} /> Build detection with AI</button>
      </div>
    </section>}
  </div>
}

// ---------- Compliance ----------
type ComplianceProps = { overrides: Record<string, ControlStatus>; onSet: (key: string, status: ControlStatus) => void; onAsk: (prompt: string) => void }
const statusLabel: Record<ControlStatus, string> = { met: 'Met', partial: 'Partial', gap: 'Gap' }
const nextStatus: Record<ControlStatus, ControlStatus> = { gap: 'partial', partial: 'met', met: 'gap' }

export function Compliance({ overrides, onSet, onAsk }: ComplianceProps) {
  const [active, setActive] = useState(frameworks[0].id)
  const withStatus = frameworks.map((framework) => ({ ...framework, controls: framework.controls.map((control) => ({ ...control, status: overrides[`${framework.id}:${control.id}`] || control.status })) }))
  const framework = withStatus.find((item) => item.id === active)!
  const tally = (items: { status: ControlStatus }[]) => ({ met: items.filter((item) => item.status === 'met').length, partial: items.filter((item) => item.status === 'partial').length, gap: items.filter((item) => item.status === 'gap').length })
  const score = (items: { status: ControlStatus }[]) => Math.round(((tally(items).met + tally(items).partial * 0.5) / items.length) * 100)
  const current = tally(framework.controls)

  return <div className="stack">
    <div className="framework-grid">{withStatus.map((item) => {
      const counts = tally(item.controls)
      return <button key={item.id} className={active === item.id ? 'framework-card active' : 'framework-card'} onClick={() => setActive(item.id)}>
        <span className="framework-top"><strong>{item.name}</strong><b>{score(item.controls)}%</b></span>
        <span className="stacked" aria-label={`${counts.met} met, ${counts.partial} partial, ${counts.gap} gaps`}>
          <span className="st-met" style={{ flex: counts.met }} /><span className="st-partial" style={{ flex: counts.partial }} /><span className="st-gap" style={{ flex: counts.gap }} />
        </span>
        <small>{counts.met} met · {counts.partial} partial · {counts.gap} gaps</small>
      </button>
    })}</div>
    <div className="grid-2 wide-right">
      <section className="panel"><div className="panel-head"><div><h2>{framework.name}</h2><p>Control status</p></div></div>
        <Donut centerLabel="controls" segments={[
          { label: 'Met', value: current.met, color: 'var(--status-good)', icon: <Check size={12} /> },
          { label: 'Partial', value: current.partial, color: 'var(--status-warning)', icon: <CircleDashed size={12} /> },
          { label: 'Gap', value: current.gap, color: 'var(--status-critical)', icon: <X size={12} /> },
        ]} />
      </section>
      <section className="panel">
        <div className="panel-head"><div><h2>Controls</h2><p>Click a status to cycle it</p></div>
          <button className="primary small" onClick={() => onAsk(`Create a ${framework.name} gap remediation plan. Prioritize by risk and effort, list the evidence an auditor would expect, and suggest owners.\n\n${framework.controls.map((control) => `- ${control.id} ${control.name}: ${statusLabel[control.status]}`).join('\n')}`)}><Sparkles size={14} /> Gap plan with AI</button></div>
        <table className="data-table"><tbody>{framework.controls.map((control) => <tr key={control.id}>
          <td className="mono">{control.id}</td><td>{control.name}</td>
          <td className="right"><button className={`status-pill ${control.status}`} onClick={() => onSet(`${framework.id}:${control.id}`, nextStatus[control.status])}>{control.status === 'met' ? <Check size={12} /> : control.status === 'partial' ? <CircleDashed size={12} /> : <X size={12} />} {statusLabel[control.status]}</button></td>
        </tr>)}</tbody></table>
      </section>
    </div>
  </div>
}
