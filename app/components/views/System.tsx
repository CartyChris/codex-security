'use client'

import { useEffect, useState } from 'react'
import { Activity, Check, Cpu, Gauge as GaugeIcon, HelpCircle, KeyRound, RefreshCw, Search, Wifi } from 'lucide-react'
import { CopyButton } from '../Markdown'
import { formatContext, type Model } from '../../lib/harness'
import { curatedModels } from '../../lib/security-data'

// ---------- Models ----------
type ModelsProps = { models: Model[]; live: boolean; model: string; expert: boolean; hasKey: boolean; loading: boolean; onChoose: (id: string) => void; onLoad: () => void }

export function Models({ models, live, model, expert, hasKey, loading, onChoose, onLoad }: ModelsProps) {
  const [query, setQuery] = useState('')
  const ids = new Set(models.map((item) => item.id))
  const visible = models.filter((item) => `${item.name || ''} ${item.id}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 200)
  const payload = { model, stream: true, temperature: 0.3, messages: [{ role: 'system', content: `OmniForge security assistant${expert ? ' (expert mode)' : ''}` }, { role: 'user', content: '…' }] }
  const curl = `curl https://openrouter.ai/api/v1/chat/completions \\\n  -H "Authorization: Bearer $OPENROUTER_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(payload)}'`

  return <div className="stack">
    <div className="toolbar-row">
      <span className="muted small">{live ? `${models.length} models loaded from OpenRouter` : 'Showing starter models — load the live catalog to see everything.'}</span>
      <div className="spacer" />
      <button className="primary small" onClick={onLoad} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> {hasKey ? (live ? 'Reload catalog' : 'Load live catalog') : 'Add key to load catalog'}</button>
    </div>
    <section className="panel">
      <div className="panel-head"><div><h2>Curated shortlist</h2><p>Picks for security engineering. Availability is confirmed against the live catalog.</p></div></div>
      <div className="model-grid">{curatedModels.map((item) => {
        const available = live ? ids.has(item.id) : null
        return <button key={item.id} className={model === item.id ? 'model-card active' : 'model-card'} onClick={() => onChoose(item.id)}>
          <span className="model-card-top"><span className="tier">{item.tier}</span>
            <span className={`avail ${available === null ? 'unknown' : available ? 'yes' : 'no'}`}>{available === null ? <><HelpCircle size={11} /> Unchecked</> : available ? <><Check size={11} /> Available</> : 'Not listed'}</span></span>
          <strong>{item.name}</strong>
          <span className="mono small muted">{item.id}</span>
          <span>{item.use}</span>
          <span className="tags">{item.tags.map((tag) => <i key={tag}>{tag}</i>)}</span>
        </button>
      })}</div>
    </section>
    <div className="grid-2 wide-left">
      <section className="panel">
        <div className="panel-head"><div><h2>Catalog</h2><p>{visible.length} shown</p></div><label className="search-field"><Search size={14} /><input placeholder="Search models" aria-label="Search models" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
        <div className="table-scroll tall"><table className="data-table"><thead><tr><th>Model</th><th>Context</th><th /></tr></thead>
          <tbody>{visible.map((item) => <tr key={item.id} className={item.id === model ? 'selected-row' : ''}><td><strong>{item.name || item.id}</strong><div className="mono small muted">{item.id}</div></td><td>{formatContext(item.context_length) || '—'}</td><td className="right">{item.id === model ? <span className="tag green">Active</span> : <button className="secondary-button" onClick={() => onChoose(item.id)}>Use</button>}</td></tr>)}</tbody></table></div>
      </section>
      <section className="panel">
        <div className="panel-head"><div><h2>Request preview</h2><p>What the harness sends for the active model (key redacted)</p></div><CopyButton text={curl} /></div>
        <div className="code-block"><div className="code-head"><span>bash</span></div><pre><code>{curl}</code></pre></div>
        <p className="muted small"><KeyRound size={12} /> Requests go through this app&apos;s server route to OpenRouter&apos;s Chat Completions API.</p>
      </section>
    </div>
  </div>
}

// ---------- Diagnostics ----------
type Row = { label: string; value: string }

function collect(): Row[] {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string; downlink?: number } }
  const timing = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return [
    { label: 'Platform', value: nav.platform || 'Unknown' },
    { label: 'Browser', value: nav.userAgent },
    { label: 'Languages', value: nav.languages?.join(', ') || nav.language },
    { label: 'Time zone', value: Intl.DateTimeFormat().resolvedOptions().timeZone },
    { label: 'CPU threads', value: String(nav.hardwareConcurrency || 'Unknown') },
    { label: 'Device memory', value: nav.deviceMemory ? `${nav.deviceMemory} GB (approx.)` : 'Not exposed' },
    { label: 'Screen', value: `${screen.width}×${screen.height} @${window.devicePixelRatio}x` },
    { label: 'Viewport', value: `${window.innerWidth}×${window.innerHeight}` },
    { label: 'Color scheme', value: matchMedia('(prefers-color-scheme: dark)').matches ? 'Dark' : 'Light' },
    { label: 'Reduced motion', value: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'On' : 'Off' },
    { label: 'Network', value: nav.connection?.effectiveType ? `${nav.connection.effectiveType}${nav.connection.downlink ? `, ~${nav.connection.downlink} Mbps` : ''}` : navigator.onLine ? 'Online' : 'Offline' },
    { label: 'Secure context', value: window.isSecureContext ? 'Yes' : 'No' },
    { label: 'Cookies', value: navigator.cookieEnabled ? 'Enabled' : 'Disabled' },
    { label: 'Page load', value: timing ? `${Math.round(timing.duration)} ms` : 'Unknown' },
    { label: 'Desktop app', value: (window as Window & { omniforgeDesktop?: unknown }).omniforgeDesktop ? 'Yes (macOS app)' : 'No (web)' },
  ]
}

export function Diagnostics() {
  const [rows, setRows] = useState<Row[]>([])
  const [storage, setStorage] = useState('Checking…')
  const [health, setHealth] = useState<{ ok: boolean; ms: number } | null>(null)

  async function check() {
    setRows(collect())
    try {
      const estimate = await navigator.storage?.estimate()
      setStorage(estimate?.quota ? `${((estimate.usage || 0) / 1024 / 1024).toFixed(1)} MB of ${(estimate.quota / 1024 / 1024 / 1024).toFixed(1)} GB` : 'Not exposed')
    } catch { setStorage('Not exposed') }
    const started = performance.now()
    try {
      // Without a key the models route answers 400 immediately, which proves the server route is up.
      const response = await fetch('/api/models', { cache: 'no-store' })
      setHealth({ ok: response.status === 400 || response.ok, ms: Math.round(performance.now() - started) })
    } catch { setHealth({ ok: false, ms: Math.round(performance.now() - started) }) }
  }

  useEffect(() => { void check() }, [])
  const all = [...rows, { label: 'Storage used', value: storage }]
  const report = JSON.stringify(Object.fromEntries(all.map((row) => [row.label, row.value])), null, 2)

  return <div className="stack">
    <div className="kpi-grid">
      <div className="kpi"><div className="kpi-head"><span><Activity size={14} /> API route</span></div><strong className={health?.ok ? 'good-text' : health ? 'bad-text' : ''}>{health ? (health.ok ? 'Healthy' : 'Unreachable') : '…'}</strong><small className="muted">{health ? `${health.ms} ms round trip` : 'Checking'}</small></div>
      <div className="kpi"><div className="kpi-head"><span><Cpu size={14} /> CPU threads</span></div><strong>{rows.find((row) => row.label === 'CPU threads')?.value || '…'}</strong></div>
      <div className="kpi"><div className="kpi-head"><span><Wifi size={14} /> Network</span></div><strong className="small-strong">{rows.find((row) => row.label === 'Network')?.value || '…'}</strong></div>
      <div className="kpi"><div className="kpi-head"><span><GaugeIcon size={14} /> Page load</span></div><strong>{rows.find((row) => row.label === 'Page load')?.value || '…'}</strong></div>
    </div>
    <section className="panel">
      <div className="panel-head"><div><h2>Environment</h2><p>What this browser exposes to the page. Nothing here leaves your device.</p></div>
        <div className="detail-actions tight"><button className="secondary-button" onClick={() => void check()}><RefreshCw size={14} /> Refresh</button><CopyButton text={report} label="Copy JSON" /></div></div>
      <table className="data-table"><tbody>{all.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td className="mono wrap">{row.value}</td></tr>)}</tbody></table>
    </section>
  </div>
}
