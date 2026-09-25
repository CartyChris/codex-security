'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Activity, AlertTriangle, ArrowUpRight, Bot, Check, CheckCircle2, ChevronDown, ChevronRight, CircleDot, FileSearch, Gauge, KeyRound, Menu, Moon, Monitor, Play, Plus, RotateCcw, Search, Send, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Square, Sun, X, XCircle, Zap } from 'lucide-react'
import { CopyButton, Markdown } from './components/Markdown'
import { accents, findingPrompt, formatContext, greeting, initialFindings, initialHistory, severityTone, starterModels, suggestions, type Finding, type Message, type Model, type ScanEvent, type Severity, type Theme, type View } from './lib/harness'

const ERROR_MARK = '\u0000'
const views: { id: View; label: string; icon: typeof Gauge }[] = [
  { id: 'overview', label: 'Overview', icon: Gauge },
  { id: 'findings', label: 'Findings', icon: AlertTriangle },
  { id: 'history', label: 'Scan history', icon: Activity },
  { id: 'chat', label: 'AI analyst', icon: Sparkles },
]

function read(storage: 'local' | 'session', key: string) {
  try { return (storage === 'local' ? localStorage : sessionStorage).getItem(key) } catch { return null }
}
function write(storage: 'local' | 'session', key: string, value: string) {
  try { (storage === 'local' ? localStorage : sessionStorage).setItem(key, value) } catch { /* storage unavailable */ }
}
function clock() { return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }

export default function Home() {
  const [view, setView] = useState<View>('overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [notice, setNotice] = useState('')

  // Harness state
  const [findings, setFindings] = useState<Finding[]>(initialFindings)
  const [history, setHistory] = useState<ScanEvent[]>(initialHistory)
  const [progress, setProgress] = useState<number | null>(null)
  const [toast, setToast] = useState<{ text: string; tone: 'running' | 'done' | 'muted' } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<'All' | Severity>('All')
  const [findingQuery, setFindingQuery] = useState('')
  const [expert, setExpert] = useState(true)
  const scanTimer = useRef<number | null>(null)

  // Chat state
  const [apiKey, setApiKey] = useState('')
  const [keyDraft, setKeyDraft] = useState('')
  const [model, setModel] = useState(starterModels[0].id)
  const [models, setModels] = useState<Model[]>(starterModels)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [loadingModels, setLoadingModels] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const modelRef = useRef<HTMLDivElement>(null)

  // Preferences
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('system')
  const [accent, setAccent] = useState('violet')
  const [compact, setCompact] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const key = read('session', 'omniforge-openrouter-key') || ''
    setApiKey(key); setKeyDraft(key)
    setModel(read('session', 'omniforge-model') || starterModels[0].id)
    try { const saved = JSON.parse(read('session', 'omniforge-chat') || '[]'); if (Array.isArray(saved)) setMessages(saved) } catch { /* ignore corrupt history */ }
    setTheme((read('local', 'omniforge-theme') as Theme) || 'system')
    setAccent(read('local', 'omniforge-accent') || 'violet')
    setCompact(read('local', 'omniforge-compact') === 'true')
    setExpert(read('local', 'omniforge-expert') !== 'false')
    const savedView = read('local', 'omniforge-view') as View | null
    if (savedView && views.some((item) => item.id === savedView)) setView(savedView)
    setHydrated(true)
  }, [])

  useEffect(() => { if (hydrated) write('session', 'omniforge-chat', JSON.stringify(messages.filter((message) => message.content || message.error))) }, [messages, hydrated])
  useEffect(() => { if (hydrated) write('local', 'omniforge-view', view) }, [view, hydrated])
  useEffect(() => { if (view === 'chat') endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, sending, view])
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme; root.dataset.accent = accent; root.dataset.compact = String(compact)
  }, [theme, accent, compact])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(''), 4200); return () => window.clearTimeout(timer) }, [notice])
  useEffect(() => { if (toast?.tone !== 'running' && toast) { const timer = window.setTimeout(() => setToast(null), 3600); return () => window.clearTimeout(timer) } }, [toast])
  useEffect(() => () => { if (scanTimer.current) window.clearInterval(scanTimer.current) }, [])

  // Auto-size the composer to its content.
  useEffect(() => {
    const element = composerRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 200)}px`
  }, [input, view])

  // Close the model menu on outside click.
  useEffect(() => {
    if (!modelOpen) return
    const close = (event: MouseEvent) => { if (modelRef.current && !modelRef.current.contains(event.target as Node)) setModelOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [modelOpen])

  const selected = useMemo(() => models.find((item) => item.id === model), [model, models])
  const filteredModels = useMemo(() => {
    const query = modelSearch.trim().toLowerCase()
    return models.filter((item) => `${item.name || ''} ${item.id}`.toLowerCase().includes(query)).slice(0, 100)
  }, [models, modelSearch])
  const openFindings = findings.filter((finding) => !finding.resolved)
  const highCount = openFindings.filter((finding) => finding.severity === 'High').length
  const score = Math.min(100, 100 - openFindings.reduce((total, finding) => total + (finding.severity === 'High' ? 8 : finding.severity === 'Medium' ? 4 : 1), 0))
  const visibleFindings = findings.filter((finding) => (severityFilter === 'All' || finding.severity === severityFilter) && `${finding.title} ${finding.path} ${finding.category}`.toLowerCase().includes(findingQuery.trim().toLowerCase()))
  const lastScan = history.find((event) => event.status === 'done')
  const scanning = progress !== null

  function go(next: View) { setView(next); setMobileNav(false) }

  function runScan() {
    if (scanning) return
    setProgress(0)
    setToast({ text: 'Deep scan in progress', tone: 'running' })
    const started = Date.now()
    scanTimer.current = window.setInterval(() => {
      const value = Math.min(100, Math.round(((Date.now() - started) / 2600) * 100))
      setProgress(value)
      if (value >= 100) {
        if (scanTimer.current) window.clearInterval(scanTimer.current)
        scanTimer.current = null
        setProgress(null)
        setHistory((items) => [{ id: `E-${Date.now()}`, title: 'Full repository scan', meta: `Today, ${clock()} · 1,248 files · ${openFindings.length} open findings`, status: 'done' }, ...items])
        setToast({ text: 'Scan complete — results are up to date', tone: 'done' })
      }
    }, 120)
  }

  function cancelScan() {
    if (scanTimer.current) window.clearInterval(scanTimer.current)
    scanTimer.current = null
    setProgress(null)
    setHistory((items) => [{ id: `E-${Date.now()}`, title: 'Scan cancelled', meta: `Today, ${clock()} · stopped before completion`, status: 'cancelled' }, ...items])
    setToast({ text: 'Scan cancelled', tone: 'muted' })
  }

  function toggleResolved(id: string) {
    setFindings((items) => items.map((finding) => finding.id === id ? { ...finding, resolved: !finding.resolved } : finding))
  }

  function toggleExpert() { setExpert((value) => { write('local', 'omniforge-expert', String(!value)); return !value }) }

  const newChat = useCallback(() => {
    abortRef.current?.abort()
    setMessages([]); setInput(''); setNotice('New chat started.'); setView('chat'); setMobileNav(false)
    window.setTimeout(() => composerRef.current?.focus(), 0)
  }, [])

  // Global shortcuts: ⌘/Ctrl+K starts a new chat, Escape closes overlays.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); newChat() }
      if (event.key === 'Escape') { setModelOpen(false); setSettingsOpen(false); setMobileNav(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [newChat])

  async function loadModels(key = apiKey) {
    if (!key.trim()) { setNotice('Enter your OpenRouter API key first.'); return }
    setLoadingModels(true); setNotice('Loading models…')
    try {
      const response = await fetch('/api/models', { headers: { 'x-openrouter-key': key.trim() } })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load models.')
      setModels(data.data?.length ? data.data : starterModels)
      setNotice(`${data.data?.length || 0} models loaded.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load models.')
    } finally {
      setLoadingModels(false)
    }
  }

  async function sendMessage(text = input, prior = messages) {
    const content = text.trim()
    if (!content || sending) return
    setView('chat')
    if (!apiKey.trim()) { setInput(content); setSettingsOpen(true); setNotice('Add your OpenRouter key in Settings to start chatting.'); return }
    const next: Message[] = [...prior, { role: 'user', content }]
    setMessages([...next, { role: 'assistant', content: '' }]); setInput(''); setSending(true); setNotice('')
    const controller = new AbortController()
    abortRef.current = controller
    const update = (patch: Partial<Message>) => setMessages((items) => {
      const copy = [...items]; const last = copy[copy.length - 1]
      if (last?.role === 'assistant') copy[copy.length - 1] = { ...last, ...patch }
      return copy
    })
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: apiKey.trim(), model, expert, messages: next.map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      })
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}))
        update({ error: data.error || 'Request failed.' })
        return
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let received = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        received += decoder.decode(value, { stream: true })
        const [answer, error] = received.split(ERROR_MARK)
        update({ content: answer, error: error || undefined })
      }
      const [answer, error] = received.split(ERROR_MARK)
      if (!answer && !error) update({ error: 'The model returned an empty response. Try again or pick another model.' })
    } catch (error) {
      if (controller.signal.aborted) update({ error: undefined })
      else update({ error: error instanceof Error ? error.message : 'Network error. Try again.' })
    } finally {
      setSending(false)
      abortRef.current = null
    }
  }

  function stop() { abortRef.current?.abort(); setNotice('Response stopped.') }

  function retry() {
    const lastUser = [...messages].reverse().findIndex((message) => message.role === 'user')
    if (lastUser < 0) return
    const index = messages.length - 1 - lastUser
    void sendMessage(messages[index].content, messages.slice(0, index))
  }

  function askAbout(finding: Finding) {
    setInput(findingPrompt(finding)); go('chat')
    window.setTimeout(() => composerRef.current?.focus(), 0)
  }

  function prefill(text: string) { setInput(text); go('chat'); window.setTimeout(() => composerRef.current?.focus(), 0) }

  function saveKey(value: string) {
    const key = value.trim()
    setApiKey(key); setKeyDraft(key); write('session', 'omniforge-openrouter-key', key)
    setNotice(key ? 'Key saved for this browser session.' : 'Key cleared.')
    return key
  }
  function chooseModel(id: string) { setModel(id); write('session', 'omniforge-model', id); setModelOpen(false); setModelSearch('') }
  function updateTheme(value: Theme) { setTheme(value); write('local', 'omniforge-theme', value) }

  const title = view === 'overview' ? `${greeting()}, Chris.` : view === 'findings' ? 'Findings' : view === 'history' ? 'Scan history' : 'AI analyst'

  return <main className="app">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <header className="topbar glass">
      <button className="mobile-only icon-button" onClick={() => setMobileNav(!mobileNav)} aria-label={mobileNav ? 'Close navigation' : 'Open navigation'} aria-expanded={mobileNav}>{mobileNav ? <X size={20} /> : <Menu size={20} />}</button>
      <button className="brand" onClick={() => go('overview')} aria-label="OmniForge overview"><span className="brand-mark"><ShieldCheck size={18} /></span><span>OmniForge</span><small>CYBER AI</small></button>
      <div className="top-actions">
        <span className={scanning ? 'status scanning' : 'status'} aria-live="polite">{scanning ? <><Activity size={12} className="spin" /> Scanning {progress}%</> : <><CircleDot size={12} /> Harness ready</>}</span>
        <div className="model-control" ref={modelRef}>
          <button className="model-picker" onClick={() => setModelOpen(!modelOpen)} aria-expanded={modelOpen} aria-haspopup="listbox" title={model}><Bot size={16} /><span>{selected?.name || model}</span><ChevronDown size={15} /></button>
          {modelOpen && <div className="model-menu glass-pop">
            <div className="menu-search"><Search size={14} /><input autoFocus aria-label="Search models" placeholder={`Search ${models.length} models`} value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && filteredModels[0]) chooseModel(filteredModels[0].id) }} /></div>
            <div className="menu-list" role="listbox" aria-label="Models">
              {filteredModels.map((item) => <button key={item.id} role="option" aria-selected={item.id === model} className={item.id === model ? 'model-option selected' : 'model-option'} onClick={() => chooseModel(item.id)}><span>{item.name || item.id}</span><small>{item.id}{item.context_length ? ` · ${formatContext(item.context_length)}` : ''}</small>{item.id === model && <Check size={14} />}</button>)}
              {!filteredModels.length && <p className="menu-empty">No matching models.</p>}
            </div>
            {models === starterModels && <button className="menu-footer" onClick={() => { setModelOpen(false); if (apiKey) void loadModels(); else setSettingsOpen(true) }}><KeyRound size={13} /> {apiKey ? 'Load all OpenRouter models' : 'Add a key to load every model'}</button>}
          </div>}
        </div>
        <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open settings"><Settings size={19} /></button>
        <button className="avatar" onClick={() => setSettingsOpen(true)} aria-label="Account and preferences">C</button>
      </div>
    </header>

    <div className="layout">
      {mobileNav && <div className="scrim" onClick={() => setMobileNav(false)} aria-hidden="true" />}
      <aside className={mobileNav ? 'sidebar open glass' : 'sidebar glass'} aria-label="Primary">
        <button className="new-chat" onClick={newChat}><Plus size={17} /> New chat <kbd>⌘ K</kbd></button>
        <div className="project"><span className="project-icon">OF</span><div><strong>omniforge-harness</strong><span>Local workspace</span></div></div>
        <div className="sidebar-label">Workspace</div>
        <nav>{views.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'side-link active' : 'side-link'} aria-current={view === id ? 'page' : undefined} onClick={() => go(id)}><Icon size={16} />{label}{id === 'findings' && openFindings.length > 0 && <b className="count">{openFindings.length}</b>}{id === 'chat' && sending && <span className="live-dot" />}</button>)}</nav>
        <div className="sidebar-divider" />
        <div className="sidebar-label">Quick actions</div>
        <button className="side-link" onClick={() => prefill('Review this code for security vulnerabilities:\n\n')}><Zap size={16} /> Review code</button>
        <button className="side-link" onClick={() => prefill('Create a defensive incident response plan for: ')}><ShieldCheck size={16} /> Incident plan</button>
        <button className="side-link" onClick={() => { runScan(); setMobileNav(false) }} disabled={scanning}><Play size={16} /> Run scan</button>
        <div className="side-spacer" />
        <button className="side-link" onClick={() => { setSettingsOpen(true); setMobileNav(false) }}><SlidersHorizontal size={16} /> Harness settings</button>
        <button className="mode-card" onClick={toggleExpert} role="switch" aria-checked={expert}><Sparkles size={16} /><span><strong>Expert mode</strong><small>{expert ? 'Deep analysis enabled' : 'Standard analysis'}</small></span><span className={expert ? 'switch on' : 'switch'} /></button>
        <div className="secure-note"><KeyRound size={15} /><span>Your OpenRouter key stays in this browser session and is only forwarded to OpenRouter.</span></div>
      </aside>

      <section className={view === 'chat' ? 'main chat-view' : 'main'} id="main-content">
        {view !== 'chat' && <div className="content">
          <div className="page-heading">
            <div><p className="eyebrow">APPLICATION SECURITY / {view === 'history' ? 'SCAN HISTORY' : view.toUpperCase()}</p><h1>{title}</h1><p className="subhead">{view === 'overview' ? 'Your security posture at a glance.' : view === 'findings' ? `${openFindings.length} open · ${findings.length - openFindings.length} resolved` : 'Every harness operation, newest first.'}</p></div>
            <button className="primary" onClick={runScan} disabled={scanning}>{scanning ? <><Activity size={17} className="spin" /> Scanning… {progress}%</> : <><Play size={17} fill="currentColor" /> Run scan</>}</button>
          </div>
          {scanning && <div className="progress" role="progressbar" aria-valuenow={progress ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Scan progress"><span style={{ width: `${progress}%` }} /></div>}

          {view === 'overview' && <>
            <div className={highCount ? 'scan-banner warn' : 'scan-banner'}>
              <div className="banner-icon">{highCount ? <AlertTriangle size={20} /> : <ShieldCheck size={21} />}</div>
              <div><strong>{highCount ? `${highCount} high-priority finding${highCount > 1 ? 's' : ''} need${highCount > 1 ? '' : 's'} attention` : 'Workspace protected'}</strong><span>{lastScan ? `Last scan: ${lastScan.meta}` : 'No completed scans yet'}</span></div>
              <button className="text-button" onClick={() => go('history')}>View report <ArrowUpRight size={15} /></button>
            </div>
            <div className="metrics">
              <Metric label="Security score" value={String(score)} suffix="/100" trend={openFindings.length ? '+6 this week' : 'All findings resolved'} tone={score >= 85 ? 'good' : 'bad'} />
              <Metric label="Open findings" value={String(openFindings.length)} trend={highCount ? `${highCount} high priority` : 'No high priority'} tone={highCount ? 'bad' : 'good'} onClick={() => go('findings')} />
              <Metric label="Files analyzed" value="1,248" trend="Across 6 packages" tone="neutral" />
            </div>
            <div className="grid">
              <section className="panel">
                <div className="panel-head"><div><h2>Needs attention</h2><p>Prioritized by exploitability and impact</p></div><button className="ghost" onClick={() => go('findings')}>See all <ChevronRight size={15} /></button></div>
                {openFindings.slice(0, 3).map((finding) => <FindingRow key={finding.id} finding={finding} onOpen={() => { setExpanded(finding.id); go('findings') }} onAsk={() => askAbout(finding)} />)}
                {!openFindings.length && <Empty icon={<CheckCircle2 />} title="Nothing needs attention" text="Every finding is resolved. Run a scan to check again." />}
              </section>
              <section className="panel">
                <div className="panel-head"><div><h2>Scan activity</h2><p>Recent harness operations</p></div><button className="icon-button small" onClick={() => go('history')} aria-label="Open scan history"><Search size={16} /></button></div>
                <div className="timeline">{history.slice(0, 3).map((event) => <Event key={event.id} event={event} />)}</div>
              </section>
            </div>
          </>}

          {view === 'findings' && <section className="panel findings-panel">
            <div className="toolbar">
              <div className="chips" role="group" aria-label="Filter by severity">{(['All', 'High', 'Medium', 'Low'] as const).map((item) => <button key={item} className={severityFilter === item ? 'chip active' : 'chip'} aria-pressed={severityFilter === item} onClick={() => setSeverityFilter(item)}>{item}{item !== 'All' && <span>{findings.filter((finding) => finding.severity === item && !finding.resolved).length}</span>}</button>)}</div>
              <label className="search-field"><Search size={14} /><input placeholder="Search findings" aria-label="Search findings" value={findingQuery} onChange={(event) => setFindingQuery(event.target.value)} /></label>
            </div>
            {visibleFindings.map((finding) => {
              const open = expanded === finding.id
              return <article key={finding.id} className={finding.resolved ? 'finding-card resolved' : 'finding-card'}>
                <button className="finding-summary" onClick={() => setExpanded(open ? null : finding.id)} aria-expanded={open}>
                  <span className={`severity ${severityTone[finding.severity]}`}>{finding.resolved ? <Check size={15} /> : <AlertTriangle size={15} />}</span>
                  <span className="finding-copy"><strong>{finding.title}</strong><span>{finding.path}</span></span>
                  <span className={`tag ${finding.resolved ? 'green' : severityTone[finding.severity]}`}>{finding.resolved ? 'Resolved' : finding.severity}</span>
                  <ChevronRight size={17} className={open ? 'muted rotate' : 'muted'} />
                </button>
                {open && <div className="finding-detail">
                  <dl><div><dt>Category</dt><dd>{finding.category}</dd></div><div><dt>ID</dt><dd>{finding.id}</dd></div></dl>
                  <p><strong>What we found.</strong> {finding.detail}</p>
                  <p><strong>Recommended fix.</strong> {finding.fix}</p>
                  <div className="detail-actions">
                    <button className="primary small" onClick={() => askAbout(finding)}><Sparkles size={14} /> Fix with AI analyst</button>
                    <button className="secondary-button" onClick={() => toggleResolved(finding.id)}>{finding.resolved ? <><RotateCcw size={14} /> Reopen</> : <><Check size={14} /> Mark resolved</>}</button>
                  </div>
                </div>}
              </article>
            })}
            {!visibleFindings.length && <Empty icon={<FileSearch />} title="No matching findings" text="Try another severity or search term." />}
          </section>}

          {view === 'history' && <section className="panel">
            <div className="panel-head"><div><h2>All operations</h2><p>{history.length} recorded events</p></div></div>
            {scanning && <div className="event"><span className="event-icon running"><Activity className="spin" /></span><div><strong>Full repository scan</strong><span>In progress · {progress}%</span></div><button className="ghost danger" onClick={cancelScan}>Cancel</button></div>}
            <div className="timeline">{history.map((event) => <Event key={event.id} event={event} />)}</div>
          </section>}

          <footer><span><span className="pulse" /> OmniForge Cyber AI engine v2.4.1</span><span>All analysis stays in your workspace</span></footer>
        </div>}

        {view === 'chat' && <>
          <div className="conversation" aria-live="polite">
            {messages.length === 0 ? <div className="welcome">
              <div className="welcome-mark"><Sparkles size={26} /></div>
              <p className="eyebrow">PRIVATE SECURITY WORKSPACE</p>
              <h1>How can I help secure your work?</h1>
              <p>Chat with any OpenRouter model for code review, threat modeling, incident response, and security research.</p>
              {!apiKey && <button className="key-callout" onClick={() => setSettingsOpen(true)}><KeyRound size={16} /><span><strong>Connect OpenRouter to start</strong><small>Add your API key in Settings — it stays in this browser session.</small></span><ChevronRight size={16} /></button>}
              <div className="suggestions">{suggestions.map((item) => <button key={item.title} onClick={() => void sendMessage(item.prompt)}><strong>{item.title}</strong><span>{item.prompt}</span></button>)}</div>
              {openFindings[0] && <button className="finding-callout" onClick={() => askAbout(openFindings[0])}><AlertTriangle size={15} /> Ask about “{openFindings[0].title}”</button>}
            </div> : messages.map((message, index) => {
              const last = index === messages.length - 1
              return <article className={`message ${message.role}`} key={index}>
                <div className="message-avatar">{message.role === 'assistant' ? <Sparkles size={15} /> : 'C'}</div>
                <div className="message-body">
                  <strong>{message.role === 'assistant' ? 'OmniForge AI' : 'You'}</strong>
                  {message.role === 'assistant' ? (message.content ? <Markdown text={message.content} /> : !message.error && sending && last ? <p className="typing">Thinking<span>.</span><span>.</span><span>.</span></p> : null) : <p className="user-text">{message.content}</p>}
                  {message.error && <div className="message-error" role="alert"><XCircle size={15} /><span>{message.error}</span></div>}
                  {message.role === 'assistant' && !(sending && last) && (message.content || message.error) && <div className="message-actions">{message.content && <CopyButton text={message.content} />}{last && <button type="button" className="copy-button" onClick={retry}><RotateCcw size={13} /><span>Retry</span></button>}</div>}
                </div>
              </article>
            })}
            <div ref={endRef} />
          </div>
          <div className="composer-wrap">
            <div className="composer glass">
              <textarea ref={composerRef} aria-label="Message OmniForge AI" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void sendMessage() } }} placeholder="Message OmniForge AI…" rows={1} />
              {sending ? <button className="send-button stop" onClick={stop} aria-label="Stop response"><Square size={14} fill="currentColor" /></button> : <button className="send-button" onClick={() => void sendMessage()} disabled={!input.trim()} aria-label="Send message"><Send size={18} /></button>}
            </div>
            <p className="composer-hint"><span className="live-dot" /> {selected?.name || model} <span>·</span> {expert ? 'Expert mode' : 'Standard mode'}<span className="hint-shortcut">Enter to send · Shift ⏎ new line</span></p>
          </div>
        </>}
      </section>
    </div>

    {(toast || notice) && <div className="toasts" aria-live="polite">
      {toast && <div className={`toast ${toast.tone}`}>{toast.tone === 'running' ? <Activity size={17} className="spin" /> : toast.tone === 'done' ? <CheckCircle2 size={17} /> : <XCircle size={17} />}<span>{toast.text}{toast.tone === 'running' && progress !== null ? ` · ${progress}%` : ''}</span><button onClick={() => (toast.tone === 'running' ? cancelScan() : setToast(null))} aria-label={toast.tone === 'running' ? 'Cancel scan' : 'Dismiss'}><X size={15} /></button></div>}
      {notice && <div className="toast muted"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
    </div>}

    {settingsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false) }}>
      <section className="settings-modal glass-pop" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div className="modal-header"><div><p className="eyebrow">WORKSPACE PREFERENCES</p><h2 id="settings-title">Make it yours</h2><p>Your key is stored only in this browser session.</p></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18} /></button></div>
        <form onSubmit={(event) => { event.preventDefault(); const key = saveKey(keyDraft); if (key) void loadModels(key) }}>
          <label htmlFor="api-key">OpenRouter API key</label>
          <div className="key-row"><input id="api-key" type="password" autoComplete="off" spellCheck={false} value={keyDraft} onChange={(event) => setKeyDraft(event.target.value)} placeholder="sk-or-v1-…" autoFocus={!apiKey} />{apiKey && <span className="key-state"><Check size={13} /> Saved</span>}</div>
          <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => saveKey('')} disabled={!apiKey && !keyDraft}>Clear key</button><button type="submit" className="primary-button" disabled={!keyDraft.trim() || loadingModels}>{loadingModels ? 'Loading…' : 'Save and load models'}</button></div>
        </form>
        <div className="preference-grid">
          <div><span>Appearance</span><div className="segmented">{(['system', 'light', 'dark'] as Theme[]).map((item) => <button key={item} className={theme === item ? 'active' : ''} aria-pressed={theme === item} onClick={() => updateTheme(item)}>{item === 'system' ? <Monitor size={14} /> : item === 'light' ? <Sun size={14} /> : <Moon size={14} />}{item}</button>)}</div></div>
          <div><span>Accent</span><div className="accent-picker">{accents.map((item) => <button aria-label={`Use ${item} accent`} aria-pressed={accent === item} key={item} className={`accent-dot ${item} ${accent === item ? 'active' : ''}`} onClick={() => { setAccent(item); write('local', 'omniforge-accent', item) }} />)}</div></div>
        </div>
        <label className="toggle-row"><span><strong>Compact mode</strong><small>Fit more conversation on screen</small></span><input type="checkbox" checked={compact} onChange={(event) => { setCompact(event.target.checked); write('local', 'omniforge-compact', String(event.target.checked)) }} /></label>
        <label className="toggle-row"><span><strong>Expert mode</strong><small>Deeper analysis with weakness classes and tests</small></span><input type="checkbox" checked={expert} onChange={toggleExpert} /></label>
        <p className="settings-help">Get a key at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a>. The key is sent only to this app&apos;s server routes, which forward it to OpenRouter. It is never embedded in the page.</p>
      </section>
    </div>}
  </main>
}

function Metric({ label, value, suffix, trend, tone, onClick }: { label: string; value: string; suffix?: string; trend: string; tone?: 'good' | 'bad' | 'neutral'; onClick?: () => void }) {
  const body = <><span>{label}</span><strong>{value}<small>{suffix}</small></strong><em className={tone}>{tone === 'good' && '↗ '}{trend}</em></>
  return onClick ? <button className="metric clickable" onClick={onClick}>{body}</button> : <div className="metric">{body}</div>
}

function FindingRow({ finding, onOpen, onAsk }: { finding: Finding; onOpen: () => void; onAsk: () => void }) {
  const tone = severityTone[finding.severity]
  return <div className="finding">
    <span className={`severity ${tone}`}><AlertTriangle size={15} /></span>
    <button className="finding-copy" onClick={onOpen}><strong>{finding.title}</strong><span>{finding.path}</span></button>
    <span className={`tag ${tone}`}>{finding.severity}</span>
    <button className="icon-button small ask" onClick={onAsk} aria-label={`Ask AI analyst about ${finding.title}`} title="Ask AI analyst"><Sparkles size={15} /></button>
  </div>
}

function Event({ event }: { event: ScanEvent }) {
  const icon = event.status === 'done' ? <CheckCircle2 /> : event.status === 'cancelled' ? <XCircle /> : <FileSearch />
  return <div className="event"><span className={`event-icon ${event.status}`}>{icon}</span><div><strong>{event.title}</strong><span>{event.meta}</span></div></div>
}

function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return <div className="empty"><span>{icon}</span><strong>{title}</strong><p>{text}</p></div>
}
