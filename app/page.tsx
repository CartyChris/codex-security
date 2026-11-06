'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import WorkspaceWelcome from '../components/workspace-welcome'
import WorkspaceDialog from '../components/workspace-dialog'
import TranscriptTools from '../components/transcript-tools'
import { useWorkspace } from '../components/connected-workspace'
import WorkspaceContextPanel from '../components/workspace-context-panel'
import ExecutionFeed from '../components/execution-feed'
import PatchApprovals from '../components/patch-approvals'
import { useAssessment } from '../components/use-assessment'
import { Bot, Check, ChevronDown, Menu, Moon, Plus, Send, Settings, ShieldCheck, Sparkles, Sun, X, Zap } from 'lucide-react'

type Message = { role: 'user' | 'assistant'; content: string }
type Model = { id: string; name?: string; context_length?: number }

type Theme = 'light' | 'dark' | 'system'
const starterModels: Model[] = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large' },
]
const accents = ['violet', 'teal', 'blue', 'coral']

export default function Home() {
  const [apiKey, setApiKey] = useState(''); const [model, setModel] = useState(starterModels[0].id); const [models, setModels] = useState(starterModels)
  const { state, update } = useWorkspace()
  const assess = useAssessment()
  const messages = state.messages
  const setMessages = (messages: Message[]) => update(s => ({ ...s, messages }))
  const [shareSources, setShareSources] = useState(false)
  const [allowTools, setAllowTools] = useState(true)
  useEffect(() => { setShareSources(false) }, [state.files, state.include, state.exclude])
  const [input, setInput] = useState(''); const [sending, setSending] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false); const [modelOpen, setModelOpen] = useState(false); const [mobileNav, setMobileNav] = useState(false)
  const [notice, setNotice] = useState(''); const [modelSearch, setModelSearch] = useState(''); const [theme, setTheme] = useState<Theme>('system'); const [accent, setAccent] = useState('violet'); const [compact, setCompact] = useState(false)
  const [themeReady, setThemeReady] = useState(false)
  const [transcriptBusy, setTranscriptBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function dismiss(event: KeyboardEvent) { if (event.key === 'Escape') { setMobileNav(false); setModelOpen(false) } }
    window.addEventListener('keydown', dismiss)
    return () => window.removeEventListener('keydown', dismiss)
  }, [])
  useEffect(() => { setApiKey(sessionStorage.getItem('omniforge-openrouter-key') || localStorage.getItem('omniforge-saved-api-key') || ''); setModel(sessionStorage.getItem('omniforge-model') || starterModels[0].id); setTheme((localStorage.getItem('omniforge-theme') as Theme) || 'system'); setAccent(localStorage.getItem('omniforge-accent') || 'violet'); setCompact(localStorage.getItem('omniforge-compact') === 'true'); setThemeReady(true) }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])
  useEffect(() => { if (!themeReady) return; document.documentElement.dataset.theme = theme; document.documentElement.dataset.accent = accent; document.documentElement.dataset.compact = String(compact) }, [theme, accent, compact, themeReady])
  const selected = useMemo(() => models.find((item) => item.id === model), [model, models])
  const filteredModels = useMemo(() => models.filter((item) => `${item.name || ''} ${item.id}`.toLowerCase().includes(modelSearch.toLowerCase())).slice(0, 100), [models, modelSearch])
  async function loadModels() { if (!apiKey.trim()) { setNotice('Enter your OpenRouter API key first.'); return }; setNotice('Loading models…'); try { const response = await fetch('/api/models'); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Could not load models.'); setModels(data.data?.length ? data.data : starterModels); setNotice(`${data.data?.length || 0} models loaded.`) } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load models.') } }
  async function sendMessage(text = input) {
    const content = text.trim()
    if (!content || sending || transcriptBusy) return
    if (!apiKey.trim()) { setSettingsOpen(true); setNotice('Add your OpenRouter key in Settings to start chatting.'); return }
    if (state.files.length && !shareSources) { setNotice('Confirm authorization and source sharing below before sending this shared scope to AI.'); return }
    const next = [...messages, { role: 'user' as const, content }]
    setMessages(next); setInput(''); setSending(true); setNotice('')
    try { const text = await assess({ apiKey: apiKey.trim(), model, actor: 'AI chat', messages: next, allowTools, onText: partial => setMessages([...next, { role: 'assistant', content: partial }]) }); setMessages([...next, { role: 'assistant', content: text }]) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Network error. Try again.') }
    finally { setSending(false) }
  }
  function saveKey(value: string) { setApiKey(value); sessionStorage.setItem('omniforge-openrouter-key', value); if (!value) localStorage.removeItem('omniforge-saved-api-key'); else if (localStorage.getItem('omniforge-saved-api-key')) localStorage.setItem('omniforge-saved-api-key', value); setNotice(value ? 'Key saved using your selected retention preference.' : 'Key cleared from session and saved browser storage.') }
  function chooseModel(id: string) { setModel(id); sessionStorage.setItem('omniforge-model', id); setModelOpen(false) }
  function updateTheme(value: Theme) { setTheme(value); localStorage.setItem('omniforge-theme', value) }
  function newChat() { setMessages([]); setInput(''); setNotice('New chat started.'); setMobileNav(false) }
  return <main className="chat-app">
    <header className="chat-topbar glass"><button className="mobile-only icon-button" onClick={() => setMobileNav(!mobileNav)} aria-label={mobileNav ? 'Close menu' : 'Open menu'} aria-expanded={mobileNav} aria-controls="workspace-navigation"><Menu size={20} /></button><div className="brand"><span className="brand-mark"><ShieldCheck size={18} /></span><span>OmniForge</span><small>CYBER AI</small></div><div className="top-actions"><div className="model-control"><button className="model-picker" onClick={() => setModelOpen(!modelOpen)} aria-expanded={modelOpen}><Bot size={16} /><span>{selected?.name || model}</span><ChevronDown size={15} /></button>{modelOpen && <div className="model-menu glass-pop"><input aria-label="Search models" placeholder="Search all models" value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} />{filteredModels.map((item) => <button key={item.id} className={item.id === model ? 'model-option selected' : 'model-option'} onClick={() => chooseModel(item.id)}><span>{item.name || item.id}</span><small>{item.id}</small>{item.id === model && <Check size={14} />}</button>)}{!filteredModels.length && <p className="menu-empty">No matching models.</p>}</div>}</div><button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open settings"><Settings size={19} /></button></div></header>
    <div className="chat-layout"><aside id="workspace-navigation" className={mobileNav ? 'chat-sidebar open glass' : 'chat-sidebar glass'}><button className="new-chat" onClick={newChat} disabled={sending || transcriptBusy}><Plus size={17} /> New chat</button><div className="sidebar-label">Workspace</div><button className="side-link active"><Sparkles size={16} /> AI chat</button><Link className="side-link" href="/lab" style={{ textDecoration: 'none' }}><ShieldCheck size={16} /> Security lab</Link><Link className="side-link" href="/tools" style={{ textDecoration: 'none' }}><Zap size={16} /> Investigation tools</Link><Link className="side-link" href="/orchestrator" style={{ textDecoration: 'none' }}><Bot size={16} /> AI orchestrator</Link><div className="sidebar-divider" /><div className="sidebar-label">Quick actions</div><button className="side-link" onClick={() => setInput('Review this code for security vulnerabilities: ')}><Zap size={16} /> Review code</button><button className="side-link" onClick={() => setInput('Create a defensive incident response plan for: ')}><ShieldCheck size={16} /> Incident plan</button><div className="side-spacer" /><div className="secure-note"><ShieldCheck size={15} /><span>Shared workspace<br />AI messages go to OpenRouter.</span></div></aside>
      <section className="chat-main"><div className="conversation">{messages.length === 0 ? <WorkspaceWelcome onPrompt={(text) => { setInput(text); document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus() }} /> : messages.map((message, index) => <article className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="message-avatar">{message.role === 'assistant' ? <Sparkles size={15} /> : 'Y'}</div><div className="message-body"><strong>{message.role === 'assistant' ? 'OmniForge AI' : 'You'}</strong><p>{message.content}</p></div></article>)}{sending && <article className="message assistant"><div className="message-avatar"><Sparkles size={15} /></div><div className="message-body"><strong>OmniForge AI</strong><p className="typing">Thinking<span>.</span><span>.</span><span>.</span></p></div></article>}<div ref={endRef} /></div><div className="composer-wrap"><WorkspaceContextPanel compact /><ExecutionFeed />{state.patches.length > 0 && <PatchApprovals />}{state.files.length > 0 && <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, fontSize: 14 }}><input type="checkbox" checked={shareSources} onChange={e => setShareSources(e.target.checked)} />I am authorized to share this source scope with the selected AI model.</label>}<label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44, fontSize: 14 }}><input type="checkbox" checked={allowTools} onChange={e => setAllowTools(e.target.checked)} />Auto-approve read-only tools; source edits require review</label><TranscriptTools messages={messages} onBusyChange={setTranscriptBusy} disabled={sending} onImport={(imported) => { setMessages(imported); setInput(''); setNotice('Transcript imported. Nothing was sent to a model.') }} /><div className="composer glass"><button className="icon-button" aria-label="Attach files or GitHub repository" onClick={() => { const panel = document.getElementById('shared-source-context') as HTMLDetailsElement | null; if (panel) { panel.open = !panel.open; panel.scrollIntoView({ block: 'nearest' }) } }}><Plus size={20} /></button><textarea aria-label="Message OmniForge AI" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void sendMessage() } }} placeholder="Message OmniForge AI…" rows={1} /><button className="send-button" onClick={() => void sendMessage()} disabled={!input.trim() || sending || transcriptBusy} aria-label="Send message"><Send size={18} /></button></div><p className="composer-hint">{notice || <><span className="live-dot" /> {selected?.name || model} <span>·</span> Via OpenRouter</>}<span className="hint-shortcut">Shift ⏎ for new line</span></p></div></section></div>
    {settingsOpen && <WorkspaceDialog onClose={() => setSettingsOpen(false)}><section className="settings-modal glass-pop"><div className="modal-header"><div><p className="eyebrow">WORKSPACE PREFERENCES</p><h2 id="settings-title">Make it yours</h2><p>Your key is stored only in this browser session.</p></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18} /></button></div><label htmlFor="api-key">OpenRouter API key</label><input id="api-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-or-v1-…" /><div className="modal-actions"><button className="secondary-button" onClick={() => saveKey('')}>Clear key</button><button className="primary-button" onClick={() => { saveKey(apiKey); void loadModels() }}>Save and load models</button></div><div className="preference-grid"><div><span>Appearance</span><div className="segmented">{(['system', 'light', 'dark'] as Theme[]).map((item) => <button key={item} className={theme === item ? 'active' : ''} onClick={() => updateTheme(item)}>{item === 'system' ? <Sun size={14} /> : item === 'light' ? <Sun size={14} /> : <Moon size={14} />}{item}</button>)}</div></div><div><span>Accent</span><div className="accent-picker">{accents.map((item) => <button aria-label={`Use ${item} accent`} key={item} className={`accent-dot ${item} ${accent === item ? 'active' : ''}`} onClick={() => { setAccent(item); localStorage.setItem('omniforge-accent', item) }} />)}</div></div></div><label className="toggle-row"><span><strong>Compact mode</strong><small>Fit more conversation on screen</small></span><input type="checkbox" checked={compact} onChange={(event) => { setCompact(event.target.checked); localStorage.setItem('omniforge-compact', String(event.target.checked)) }} /></label><p className="settings-help">Get a key at openrouter.ai/keys. The key is sent to the app&apos;s server route and forwarded to OpenRouter to authenticate requests. Messages are processed by OpenRouter and your selected model provider.</p></section></WorkspaceDialog>}
  </main>
}
