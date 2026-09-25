'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, AlertTriangle, Pause, Play, Radar, ShieldAlert, Sparkles, Timer, Zap } from 'lucide-react'
import { BarList, Donut, Gauge, Heatmap, LineChart, Sparkline, TopologyGraph, compact, fmt, graphGroups, type GraphEdge, type GraphNode } from '../charts'
import { endpoints, nextSample, seedHistory, seeded, simulatedEvents, weeklyHeatmap, type Sample } from '../../lib/telemetry'
import type { AppEvent, Finding, Run, WorkspaceFile } from '../../lib/harness'

const STEP_MS = 5000
const ranges = [{ id: 60, label: '5 min' }, { id: 180, label: '15 min' }, { id: 720, label: '1 hour' }]
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'))

const assets = [
  { id: 'asset:web', label: 'Web app', detail: 'Next.js front end served from the edge', match: /package\.json|app\/|\.tsx?$/ },
  { id: 'asset:api', label: 'Projects API', detail: 'REST handlers under src/api', match: /src\/api/ },
  { id: 'asset:auth', label: 'Auth service', detail: 'OAuth callback and session issuance', match: /auth/ },
  { id: 'asset:db', label: 'Primary database', detail: 'Postgres cluster holding tenant data', match: /schema|\.sql$/ },
  { id: 'asset:cdn', label: 'CDN / WAF', detail: 'Edge network and web application firewall', match: /$^/ },
]

type Props = { findings: Finding[]; runs: Run[]; files: WorkspaceFile[]; events: AppEvent[]; model: string; onAsk: (prompt: string) => void }

export function Monitoring({ findings, runs, files, events, model, onAsk }: Props) {
  const [samples, setSamples] = useState<Sample[]>(() => seedHistory(720, STEP_MS))
  const [live, setLive] = useState(true)
  const [range, setRange] = useState(180)
  const [selected, setSelected] = useState<string | null>(null)
  const [feed, setFeed] = useState<{ id: string; t: number; kind: string; text: string }[]>(() => simulatedEvents.slice(0, 4).map((event, index) => ({ id: `seed-${index}`, t: Date.now() - (index + 1) * 47000, kind: event.kind, text: event.text })))
  const random = useRef(seeded(Date.now() % 100000))

  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => {
      setSamples((items) => [...items.slice(-719), nextSample(items[items.length - 1], Date.now(), random.current)])
      if (random.current() > 0.55) {
        const event = simulatedEvents[Math.floor(random.current() * simulatedEvents.length)]
        setFeed((items) => [{ id: `${Date.now()}`, t: Date.now(), kind: event.kind, text: event.text }, ...items].slice(0, 30))
      }
    }, STEP_MS / 2)
    return () => window.clearInterval(timer)
  }, [live])

  const view = samples.slice(-range)
  const previous = samples.slice(-range * 2, -range)
  const sum = (items: Sample[], key: keyof Sample) => items.reduce((total, item) => total + (item[key] as number), 0)
  const average = (items: Sample[], key: keyof Sample) => (items.length ? sum(items, key) / items.length : 0)
  const p95 = (items: Sample[]) => { const sorted = items.map((item) => item.latency).sort((a, b) => a - b); return sorted[Math.floor(sorted.length * 0.95)] || 0 }
  const errorRate = (items: Sample[]) => (sum(items, 'requests') ? (sum(items, 'errors') / sum(items, 'requests')) * 100 : 0)
  const delta = (now: number, before: number) => (before ? ((now - before) / before) * 100 : 0)

  const open = useMemo(() => findings.filter((finding) => !finding.resolved), [findings])
  const severity = { High: open.filter((f) => f.severity === 'High').length, Medium: open.filter((f) => f.severity === 'Medium').length, Low: open.filter((f) => f.severity === 'Low').length }
  const runErrors = runs.filter((run) => run.status === 'error').length
  const risk = Math.min(100, severity.High * 18 + severity.Medium * 9 + severity.Low * 3 + runErrors * 6 + Math.round(errorRate(view) * 6))
  const riskTone = risk >= 60 ? 'var(--status-critical)' : risk >= 30 ? 'var(--status-warning)' : 'var(--status-good)'

  const kpis = [
    { label: 'Requests / min', icon: Activity, value: compact.format(average(view, 'requests') * 12), change: delta(average(view, 'requests'), average(previous, 'requests')), goodWhenUp: true, values: view.map((item) => item.requests), color: 'var(--series-1)' },
    { label: 'Threats blocked', icon: ShieldAlert, value: fmt.format(sum(view, 'blocked')), change: delta(sum(view, 'blocked'), sum(previous, 'blocked')), goodWhenUp: false, values: view.map((item) => item.blocked), color: 'var(--series-2)' },
    { label: 'Error rate', icon: AlertTriangle, value: `${errorRate(view).toFixed(2)}%`, change: delta(errorRate(view), errorRate(previous)), goodWhenUp: false, values: view.map((item) => item.errors), color: 'var(--series-3)' },
    { label: 'p95 latency', icon: Timer, value: `${p95(view)} ms`, change: delta(p95(view), p95(previous)), goodWhenUp: false, values: view.map((item) => item.latency), color: 'var(--series-4)' },
  ]

  const graph = useMemo(() => {
    const nodes: GraphNode[] = assets.map((asset) => ({ id: asset.id, label: asset.label, group: 'asset', detail: asset.detail, source: 'Harness asset inventory' }))
    const edges: GraphEdge[] = [
      { from: 'asset:cdn', to: 'asset:web', label: 'routes' }, { from: 'asset:web', to: 'asset:api', label: 'calls' },
      { from: 'asset:api', to: 'asset:db', label: 'queries' }, { from: 'asset:web', to: 'asset:auth', label: 'authenticates' },
    ]
    for (const finding of open) {
      nodes.push({ id: finding.id, label: finding.title, group: 'finding', detail: `${finding.severity} · ${finding.category} · ${finding.path}`, source: `Findings (${finding.id})` })
      const asset = assets.find((item) => item.match.test(finding.path)) || assets[0]
      edges.push({ from: finding.id, to: asset.id, label: 'affects' })
    }
    const models = new Set<string>()
    for (const run of runs.slice(0, 8)) {
      nodes.push({ id: run.id, label: run.title, group: 'activity', detail: `${run.status} · ${new Date(run.started).toLocaleString()}`, source: 'Tool runs' })
      models.add(run.model)
      edges.push({ from: run.id, to: `model:${run.model}`, label: 'uses' })
    }
    models.add(model)
    for (const id of models) nodes.push({ id: `model:${id}`, label: id.split('/').pop() || id, group: 'model', detail: id, source: 'Model routing' })
    for (const file of files.slice(0, 8)) {
      nodes.push({ id: file.id, label: file.name, group: 'activity', detail: `${file.language} · ${file.path}`, source: 'Workspace import' })
      const asset = assets.find((item) => item.match.test(file.path)) || assets[0]
      edges.push({ from: file.id, to: asset.id, label: 'belongs to' })
    }
    return { nodes, edges }
  }, [open, runs, files, model])

  const selectedNode = graph.nodes.find((node) => node.id === selected)
  const heat = useMemo(() => weeklyHeatmap(), [])
  const ledger = graphGroups.map((group) => ({ ...group, count: graph.nodes.filter((node) => node.group === group.id).length }))
  const combinedFeed = [...events.map((event) => ({ id: event.id, t: event.t, kind: event.kind, text: event.text, real: true })), ...feed.map((item) => ({ ...item, real: false }))].sort((a, b) => b.t - a.t).slice(0, 14)

  function summarize() {
    onAsk(`Summarize this security monitoring snapshot and recommend the next three actions.\n\nWindow: last ${ranges.find((item) => item.id === range)?.label}\nRequests/min: ${kpis[0].value}\nThreats blocked: ${kpis[1].value}\nError rate: ${kpis[2].value}\np95 latency: ${kpis[3].value}\nRisk score: ${risk}/100\nOpen findings: ${open.map((finding) => `${finding.severity} ${finding.title} (${finding.path})`).join('; ') || 'none'}\nMost targeted endpoints: ${endpoints.map((item) => `${item.path} ${item.hits}`).join(', ')}`)
  }

  return <div className="stack">
    <div className="toolbar-row">
      <div className="segmented inline" role="group" aria-label="Time range">{ranges.map((item) => <button key={item.id} className={range === item.id ? 'active' : ''} aria-pressed={range === item.id} onClick={() => setRange(item.id)}>{item.label}</button>)}</div>
      <span className={live ? 'live-pill on' : 'live-pill'}><span className="live-dot" />{live ? 'Streaming demo telemetry' : 'Paused'}</span>
      <div className="spacer" />
      <button className="secondary-button" onClick={() => setLive(!live)}>{live ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Resume</>}</button>
      <button className="primary small" onClick={summarize}><Sparkles size={14} /> Summarize with AI</button>
    </div>

    <div className="kpi-grid">{kpis.map((kpi) => {
      const up = kpi.change >= 0
      const good = up === kpi.goodWhenUp
      return <div className="kpi" key={kpi.label}>
        <div className="kpi-head"><span><kpi.icon size={14} /> {kpi.label}</span><em className={Math.abs(kpi.change) < 0.5 ? 'flat' : good ? 'good' : 'bad'}>{up ? '↑' : '↓'} {Math.abs(kpi.change).toFixed(1)}%</em></div>
        <strong>{kpi.value}</strong>
        <Sparkline values={kpi.values.slice(-60)} color={kpi.color} />
      </div>
    })}</div>

    <div className="grid-2">
      <section className="panel"><div className="panel-head"><div><h2>Request volume</h2><p>Requests per 5-second window</p></div></div>
        <LineChart times={view.map((item) => item.t)} series={[{ id: 'requests', label: 'Requests', color: 'var(--series-1)', values: view.map((item) => item.requests), area: true }]} />
      </section>
      <section className="panel"><div className="panel-head"><div><h2>Threats & errors</h2><p>Blocked requests and server errors per window</p></div></div>
        <LineChart times={view.map((item) => item.t)} series={[{ id: 'blocked', label: 'Blocked', color: 'var(--series-2)', values: view.map((item) => item.blocked) }, { id: 'errors', label: 'Errors', color: 'var(--series-3)', values: view.map((item) => item.errors) }]} />
      </section>
    </div>

    <div className="grid-3">
      <section className="panel center"><div className="panel-head"><div><h2>Risk score</h2><p>Open findings, failed runs, and error rate</p></div></div>
        <Gauge value={risk} label={risk >= 60 ? 'Elevated risk' : risk >= 30 ? 'Moderate risk' : 'Low risk'} tone={riskTone} />
      </section>
      <section className="panel"><div className="panel-head"><div><h2>Open findings</h2><p>By severity</p></div></div>
        <Donut centerLabel="open" segments={[
          { label: 'High', value: severity.High, color: 'var(--status-critical)', icon: <AlertTriangle size={12} /> },
          { label: 'Medium', value: severity.Medium, color: 'var(--status-warning)', icon: <AlertTriangle size={12} /> },
          { label: 'Low', value: severity.Low, color: 'var(--status-low)', icon: <AlertTriangle size={12} /> },
        ]} />
      </section>
      <section className="panel"><div className="panel-head"><div><h2>Most targeted endpoints</h2><p>Hostile requests, last 24 hours</p></div></div>
        <BarList items={endpoints.map((item) => ({ label: item.path, value: item.hits }))} />
      </section>
    </div>

    <section className="panel topology-panel">
      <div className="panel-head"><div><h2>Harness topology</h2><p>Every node links back to the record that produced it. Click a node to inspect it.</p></div>
        <div className="legend">{graphGroups.map((group) => <span key={group.id}><i className={`dot-${group.id}`} />{group.label}</span>)}</div></div>
      <div className="topology-layout">
        <TopologyGraph nodes={graph.nodes} edges={graph.edges} selected={selected} onSelect={setSelected} />
        <aside className="inspector">
          {selectedNode ? <>
            <p className="eyebrow">{graphGroups.find((group) => group.id === selectedNode.group)?.label}</p>
            <h3>{selectedNode.label}</h3>
            <p>{selectedNode.detail}</p>
            <dl><div><dt>Source</dt><dd>{selectedNode.source}</dd></div><div><dt>Connections</dt><dd>{graph.edges.filter((edge) => edge.from === selectedNode.id || edge.to === selectedNode.id).map((edge) => `${edge.label} ${graph.nodes.find((node) => node.id === (edge.from === selectedNode.id ? edge.to : edge.from))?.label}`).join(', ') || 'None'}</dd></div></dl>
            <button className="secondary-button" onClick={() => onAsk(`Assess the security posture of "${selectedNode.label}" in my harness. Context: ${selectedNode.detail}. Suggest monitoring signals and mitigations.`)}><Sparkles size={14} /> Ask AI about this node</button>
          </> : <>
            <p className="eyebrow">Data provenance</p>
            <h3>Select a node</h3>
            <p>The graph is built from your findings, tool runs, workspace files, and model routing.</p>
            <table className="mini-table"><tbody>{ledger.map((row) => <tr key={row.id}><td><i className={`dot-${row.id}`} /> {row.label}</td><td>{row.count}</td></tr>)}</tbody></table>
          </>}
        </aside>
      </div>
    </section>

    <div className="grid-2 wide-left">
      <section className="panel"><div className="panel-head"><div><h2>Weekly attack activity</h2><p>Hostile events by weekday and hour (UTC)</p></div></div>
        <Heatmap matrix={heat} rows={days} columns={hours} />
      </section>
      <section className="panel"><div className="panel-head"><div><h2>Live activity</h2><p>Your harness actions plus streamed demo events</p></div><Radar size={16} className="muted" /></div>
        <ul className="feed">{combinedFeed.map((item) => <li key={item.id}>
          <span className={`feed-dot ${item.kind}`} />
          <div><span>{item.text}</span><small>{new Date(item.t).toLocaleTimeString()} · {item.real ? 'Harness' : 'Demo'}</small></div>
        </li>)}{!combinedFeed.length && <li className="muted">Waiting for events…</li>}</ul>
      </section>
    </div>

    <section className="panel"><div className="panel-head"><div><h2>Latency</h2><p>Average response time per window</p></div><Zap size={16} className="muted" /></div>
      <LineChart times={view.map((item) => item.t)} height={180} unit=" ms" series={[{ id: 'latency', label: 'Latency', color: 'var(--series-4)', values: view.map((item) => item.latency), area: true }]} />
    </section>
  </div>
}
