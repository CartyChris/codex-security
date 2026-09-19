'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, ChevronDown, Menu, Plus, Send, Settings, ShieldCheck, Sparkles, X } from 'lucide-react'

type Message = { role: 'user' | 'assistant'; content: string }
type Model = { id: string; name?: string; context_length?: number; pricing?: { prompt?: string; completion?: string } }

const starterModels: Model[] = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large' },
]

export default function Home() {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(starterModels[0].id)
  const [models, setModels] = useState(starterModels)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [notice, setNotice] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const savedKey = sessionStorage.getItem('omniforge-openrouter-key') || ''
    const savedModel = sessionStorage.getItem('omniforge-model') || starterModels[0].id
    setApiKey(savedKey)
    setModel(savedModel)
  }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, sending])

  const selected = useMemo(() => models.find((item) => item.id === model), [model, models])
  const filteredModels = useMemo(() => models.filter((item) => `${item.name || ''} ${item.id}`.toLowerCase().includes(modelSearch.toLowerCase())).slice(0, 100), [models, modelSearch])

  async function loadModels() {
    if (!apiKey.trim()) { setNotice('Enter your OpenRouter API key first.'); return }
    setNotice('Loading models available to your key…')
    try {
      const response = await fetch(`/api/models?key=${encodeURIComponent(apiKey.trim())}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load models.')
      setModels(data.data?.length ? data.data : starterModels)
      setNotice(`${data.data?.length || 0} models loaded.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not load models.') }
  }

  async function sendMessage(text = input) {
    const content = text.trim()
    if (!content || sending) return
    if (!apiKey.trim()) { setSettingsOpen(true); setNotice('Add your OpenRouter key in Settings to start chatting.'); return }
    const next = [...messages, { role: 'user' as const, content }]
    setMessages(next); setInput(''); setSending(true); setNotice('')
    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: apiKey.trim(), model, messages: next }) })
      const data = await response.json()
      setMessages([...next, { role: 'assistant', content: response.ok ? data.text : `OpenRouter error: ${data.error || 'Request failed.'}` }])
    } catch (error) { setMessages([...next, { role: 'assistant', content: error instanceof Error ? error.message : 'Network error. Try again.' }]) }
    finally { setSending(false) }
  }

  function saveKey(value: string) { setApiKey(value); sessionStorage.setItem('omniforge-openrouter-key', value); setNotice(value ? 'Key saved for this browser session.' : 'Key cleared.') }
  function chooseModel(id: string) { setModel(id); sessionStorage.setItem('omniforge-model', id); setModelOpen(false) }
  function newChat() { setMessages([]); setInput(''); setNotice('New chat started.'); setMobileNav(false) }

  return <main className="chat-app">
    <header className="chat-topbar">
      <button className="mobile-only icon-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Open menu"><Menu size={20} /></button>
      <div className="brand"><span className="brand-mark"><ShieldCheck size={18} /></span><span>OmniForge</span><small>CYBER AI</small></div>
      <div className="top-actions">
        <div className="model-control"><button className="model-picker" onClick={() => setModelOpen(!modelOpen)} aria-expanded={modelOpen}><Bot size={16} /><span>{selected?.name || model}</span><ChevronDown size={15} /></button>{modelOpen && <div className="model-menu"><input aria-label="Search models" placeholder="Search all models" value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} />{filteredModels.map((item) => <button key={item.id} className={item.id === model ? 'model-option selected' : 'model-option'} onClick={() => chooseModel(item.id)}><span>{item.name || item.id}</span><small>{item.id}</small></button>)}{!filteredModels.length && <p className="menu-empty">No matching models.</p>}</div>}</div>
        <button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open settings"><Settings size={19} /></button>
      </div>
    </header>
    <div className="chat-layout">
      <aside className={mobileNav ? 'chat-sidebar open' : 'chat-sidebar'}><button className="new-chat" onClick={newChat}><Plus size={17} /> New chat</button><div className="sidebar-label">Workspace</div><button className="side-link active"><Sparkles size={16} /> AI chat</button><button className="side-link" onClick={() => setNotice('Security analysis tools are available through the chat composer.') }><ShieldCheck size={16} /> Security analysis</button><div className="side-spacer" /><div className="secure-note"><ShieldCheck size={15} /><span>Keys stay in this browser session.</span></div></aside>
      <section className="chat-main"><div className="conversation">{messages.length === 0 ? <div className="welcome"><div className="welcome-mark"><Sparkles size={26} /></div><h1>How can I help secure your work?</h1><p>Chat with any OpenRouter model for code review, threat modeling, incident response, and security research.</p><div className="suggestions"><button onClick={() => sendMessage('Review this application for the most important security risks and prioritize fixes.')}>Review an application</button><button onClick={() => sendMessage('Create a defensive incident response playbook for a suspected credential leak.')}>Create a response plan</button><button onClick={() => sendMessage('Explain how to harden an API against common web vulnerabilities.')}>Harden an API</button></div></div> : messages.map((message, index) => <article className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="message-avatar">{message.role === 'assistant' ? <Sparkles size={15} /> : 'Y'}</div><div className="message-body"><strong>{message.role === 'assistant' ? 'OmniForge AI' : 'You'}</strong><p>{message.content}</p></div></article>)}{sending && <article className="message assistant"><div className="message-avatar"><Sparkles size={15} /></div><div className="message-body"><strong>OmniForge AI</strong><p className="typing">Thinking…</p></div></article>}<div ref={endRef} /></div><div className="composer-wrap"><div className="composer"><textarea aria-label="Message OmniForge AI" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); void sendMessage() } }} placeholder="Message OmniForge AI…" rows={1} /><button className="send-button" onClick={() => void sendMessage()} disabled={!input.trim() || sending} aria-label="Send message"><Send size={18} /></button></div><p className="composer-hint">{notice || `${selected?.name || model} · OpenRouter`} · Enter to send, Shift+Enter for a new line</p></div></section>
    </div>
    {settingsOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSettingsOpen(false) }}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="modal-header"><div><h2 id="settings-title">OpenRouter settings</h2><p>Your key is stored only in this browser session.</p></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18} /></button></div><label htmlFor="api-key">OpenRouter API key</label><input id="api-key" type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-or-v1-…" /><div className="modal-actions"><button className="secondary-button" onClick={() => saveKey('')}>Clear key</button><button className="secondary-button" onClick={() => { saveKey(apiKey); void loadModels() }}>Save and load models</button></div><p className="settings-help">Get a key at openrouter.ai/keys. The key is sent only to the app&apos;s server route for your request and never embedded in the page.</p></section></div>}
  </main>
}
