'use client'

import { useMemo, useState } from 'react'
import { ArrowLeft, Clock, Code2, Download, Eye, FileCode2, Play, Plus, RotateCcw, Search, Sparkles, Square, Trash2, XCircle } from 'lucide-react'
import { CopyButton, Markdown } from '../Markdown'
import { toolCategories, tools, type Tool, type ToolCategory } from '../../lib/tools'
import { extractCodeBlocks, uid, type Artifact, type Message, type Run } from '../../lib/harness'

// ---------- Security tools ----------
type ToolsProps = { runs: Run[]; activeTool: string | null; setActiveTool: (key: string | null) => void; onRun: (tool: Tool, input: string) => void; onStop: () => void; running: boolean; hasKey: boolean; onNeedKey: () => void }

export function Tools({ runs, activeTool, setActiveTool, onRun, onStop, running, hasKey, onNeedKey }: ToolsProps) {
  const [category, setCategory] = useState<ToolCategory | 'all'>('all')
  const [query, setQuery] = useState('')
  const [input, setInput] = useState('')
  const tool = tools.find((item) => item.key === activeTool)
  const visible = tools.filter((item) => (category === 'all' || item.category === category) && `${item.title} ${item.desc} ${item.mode}`.toLowerCase().includes(query.trim().toLowerCase()))
  const toolRuns = runs.filter((run) => run.toolKey === activeTool)
  const latest = toolRuns[0]

  if (tool) return <div className="stack">
    <button className="ghost back" onClick={() => setActiveTool(null)}><ArrowLeft size={15} /> All tools</button>
    <div className="grid-2 wide-left">
      <section className="panel runner">
        <div className="panel-head"><div><p className="eyebrow">{toolCategories.find((item) => item.id === tool.category)?.label}</p><h2 className="runner-title">{tool.title}</h2><p>{tool.desc}</p></div><span className="mode-tag">{tool.mode}</span></div>
        <textarea className="runner-input" value={input} onChange={(event) => setInput(event.target.value)} placeholder={tool.placeholder} rows={9} aria-label={`${tool.title} input`} />
        <div className="detail-actions">
          {running ? <button className="primary small" onClick={onStop}><Square size={13} fill="currentColor" /> Stop</button>
            : <button className="primary small" disabled={!input.trim()} onClick={() => (hasKey ? onRun(tool, input) : onNeedKey())}><Play size={14} fill="currentColor" /> {tool.action}</button>}
          <button className="secondary-button" onClick={() => setInput('')} disabled={!input}>Clear</button>
          {!hasKey && <span className="hint">Add your OpenRouter key in Settings to run tools.</span>}
        </div>
        {latest && <div className="run-output">
          <div className="run-meta"><span className={`run-status ${latest.status}`}>{latest.status}</span><span>{latest.model}</span><span>{new Date(latest.started).toLocaleTimeString()}</span>{latest.output && <CopyButton text={latest.output} />}</div>
          {latest.output ? <Markdown text={latest.output} /> : latest.status === 'running' && <p className="typing">Working<span>.</span><span>.</span><span>.</span></p>}
          {latest.error && <div className="message-error"><XCircle size={15} /><span>{latest.error}</span></div>}
        </div>}
      </section>
      <section className="panel">
        <div className="panel-head"><div><h2>Previous runs</h2><p>{toolRuns.length} saved for this tool</p></div></div>
        {toolRuns.slice(1).map((run) => <button key={run.id} className="run-row" onClick={() => setInput(run.input)}><span className={`run-status ${run.status}`}>{run.status}</span><span className="run-row-text">{run.input.slice(0, 90)}</span><RotateCcw size={13} /></button>)}
        {toolRuns.length < 2 && <p className="muted small">Runs you make here are saved in this browser and appear in the Runs tab.</p>}
      </section>
    </div>
  </div>

  return <div className="stack">
    <div className="toolbar-row">
      <div className="chips" role="group" aria-label="Tool category">
        <button className={category === 'all' ? 'chip active' : 'chip'} onClick={() => setCategory('all')}>All <span>{tools.length}</span></button>
        {toolCategories.map((item) => <button key={item.id} className={category === item.id ? 'chip active' : 'chip'} onClick={() => setCategory(item.id)}>{item.label}<span>{tools.filter((tool) => tool.category === item.id).length}</span></button>)}
      </div>
      <label className="search-field"><Search size={14} /><input placeholder="Search tools" aria-label="Search tools" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    </div>
    <div className="tool-grid">{visible.map((item) => {
      const count = runs.filter((run) => run.toolKey === item.key).length
      return <button key={item.key} className={`tool-card cat-${item.category}`} onClick={() => { setActiveTool(item.key); setInput('') }}>
        <span className="tool-top"><span className="tool-badge">{item.title.slice(0, 2).toUpperCase()}</span>{count > 0 && <span className="tool-count">{count} run{count > 1 ? 's' : ''}</span>}</span>
        <strong>{item.title}</strong>
        <span>{item.desc}</span>
        <em>{item.action} →</em>
      </button>
    })}</div>
    {!visible.length && <p className="muted">No tools match that search.</p>}
  </div>
}

// ---------- Runs ----------
export function Runs({ runs, onOpen, onDelete, onClear }: { runs: Run[]; onOpen: (run: Run) => void; onDelete: (id: string) => void; onClear: () => void }) {
  const [filter, setFilter] = useState<'all' | Run['status']>('all')
  const visible = runs.filter((run) => filter === 'all' || run.status === filter)
  const duration = (run: Run) => (run.finished ? `${((run.finished - run.started) / 1000).toFixed(1)}s` : '—')
  return <div className="stack">
    <div className="toolbar-row">
      <div className="chips">{(['all', 'done', 'running', 'error'] as const).map((item) => <button key={item} className={filter === item ? 'chip active' : 'chip'} onClick={() => setFilter(item)}>{item === 'all' ? 'All' : item}<span>{item === 'all' ? runs.length : runs.filter((run) => run.status === item).length}</span></button>)}</div>
      <div className="spacer" />
      <button className="secondary-button" onClick={onClear} disabled={!runs.length}><Trash2 size={14} /> Clear runs</button>
    </div>
    <section className="panel table-panel">
      <table className="data-table">
        <thead><tr><th>Tool</th><th>Input</th><th>Model</th><th>Status</th><th>Started</th><th>Duration</th><th /></tr></thead>
        <tbody>{visible.map((run) => <tr key={run.id}>
          <td><button className="link" onClick={() => onOpen(run)}>{run.title}</button></td>
          <td className="truncate">{run.input}</td>
          <td className="mono">{run.model}</td>
          <td><span className={`run-status ${run.status}`}>{run.status}</span></td>
          <td><Clock size={12} /> {new Date(run.started).toLocaleString()}</td>
          <td>{duration(run)}</td>
          <td><button className="icon-button small" onClick={() => onDelete(run.id)} aria-label={`Delete run ${run.title}`}><Trash2 size={14} /></button></td>
        </tr>)}</tbody>
      </table>
      {!visible.length && <div className="empty"><span><Play /></span><strong>No runs yet</strong><p>Open Security tools and run one — results are saved here.</p></div>}
    </section>
  </div>
}

// ---------- Artifacts ----------
type ArtifactsProps = { runs: Run[]; messages: Message[]; saved: Artifact[]; onSave: (artifact: Artifact) => void; onDelete: (id: string) => void }

export function Artifacts({ runs, messages, saved, onSave, onDelete }: ArtifactsProps) {
  const derived = useMemo(() => {
    const items: Artifact[] = []
    runs.forEach((run) => extractCodeBlocks(run.output).forEach((block, index) => items.push({ id: `${run.id}-${index}`, name: `${run.title} #${index + 1}`, language: block.language, content: block.content, source: 'Tool run', created: run.started })))
    messages.forEach((message, messageIndex) => message.role === 'assistant' && extractCodeBlocks(message.content).forEach((block, index) => items.push({ id: `chat-${messageIndex}-${index}`, name: `AI analyst reply ${messageIndex + 1} #${index + 1}`, language: block.language, content: block.content, source: 'AI analyst', created: Date.now() })))
    return items
  }, [runs, messages])
  const all = [...saved, ...derived]
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [draft, setDraft] = useState<{ name: string; language: string; content: string } | null>(null)
  const selected = all.find((item) => item.id === selectedId) || all[0]
  const isHtml = selected && /^(html|htm|svg)$/i.test(selected.language)

  function download(artifact: Artifact) {
    const ext: Record<string, string> = { typescript: 'ts', ts: 'ts', tsx: 'tsx', javascript: 'js', js: 'js', python: 'py', py: 'py', html: 'html', css: 'css', json: 'json', yaml: 'yaml', yml: 'yml', bash: 'sh', sh: 'sh', go: 'go', rust: 'rs', sql: 'sql', markdown: 'md', md: 'md' }
    const blob = new Blob([artifact.content], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${artifact.name.replace(/[^\w-]+/g, '-').toLowerCase()}.${ext[artifact.language.toLowerCase()] || 'txt'}`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return <div className="grid-2 wide-right artifacts">
    <section className="panel">
      <div className="panel-head"><div><h2>Artifacts</h2><p>{all.length} code blocks from runs, chats, and saves</p></div><button className="icon-button small" onClick={() => setDraft({ name: 'New artifact', language: 'html', content: '' })} aria-label="New artifact"><Plus size={16} /></button></div>
      <div className="artifact-list">{all.map((item) => <button key={item.id} className={selected?.id === item.id ? 'artifact-row active' : 'artifact-row'} onClick={() => { setSelectedId(item.id); setPreview(false); setDraft(null) }}>
        <FileCode2 size={16} /><span><strong>{item.name}</strong><small>{item.language} · {item.source}</small></span>
      </button>)}</div>
      {!all.length && <div className="empty"><span><Code2 /></span><strong>No artifacts yet</strong><p>Code blocks from tool runs and AI replies collect here automatically.</p></div>}
    </section>
    <section className="panel">
      {draft ? <form className="stack tight" onSubmit={(event) => { event.preventDefault(); const artifact = { id: uid('artifact'), ...draft, source: 'Saved', created: Date.now() }; onSave(artifact); setSelectedId(artifact.id); setDraft(null) }}>
        <div className="panel-head"><div><h2>New artifact</h2><p>Paste code or markup to keep it with your workspace.</p></div></div>
        <div className="form-row"><input className="field" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} aria-label="Artifact name" /><input className="field narrow" value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value })} aria-label="Language" /></div>
        <textarea className="runner-input mono" rows={14} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} aria-label="Artifact content" />
        <div className="detail-actions"><button className="primary small" disabled={!draft.content.trim()}>Save artifact</button><button type="button" className="secondary-button" onClick={() => setDraft(null)}>Cancel</button></div>
      </form> : selected ? <>
        <div className="panel-head"><div><h2>{selected.name}</h2><p>{selected.language} · {selected.source}</p></div>
          <div className="detail-actions tight">
            {isHtml && <button className={preview ? 'chip active' : 'chip'} onClick={() => setPreview(!preview)}><Eye size={13} /> Preview</button>}
            <CopyButton text={selected.content} />
            <button className="copy-button" onClick={() => download(selected)}><Download size={13} /><span>Download</span></button>
            {selected.source === 'Saved' ? <button className="copy-button" onClick={() => onDelete(selected.id)}><Trash2 size={13} /><span>Delete</span></button>
              : <button className="copy-button" onClick={() => onSave({ ...selected, id: uid('artifact'), source: 'Saved', created: Date.now() })}><Plus size={13} /><span>Keep</span></button>}
          </div></div>
        {preview && isHtml ? <iframe className="artifact-frame" title={`${selected.name} preview`} sandbox="allow-scripts" srcDoc={selected.content} />
          : <div className="code-block"><div className="code-head"><span>{selected.language}</span></div><pre><code>{selected.content}</code></pre></div>}
        {isHtml && <p className="muted small"><Sparkles size={12} /> Previews run in a sandboxed frame with no access to this app.</p>}
      </> : <p className="muted">Select an artifact.</p>}
    </section>
  </div>
}
