'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bot, ChevronDown, Menu, Paperclip, Plus, Send, Settings, ShieldCheck, Sparkles, X } from 'lucide-react'

type Message = { role: 'user' | 'assistant'; content: string }
type Model = { id: string; name: string; context_length?: number; pricing?: { prompt?: string; completion?: string } }

const starterModels: Model[] = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
]

export default function Home() {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState(starterModels[0].id)
  const [models, setModels] = useState(starterModels)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => { setApiKey(sessionStorage.getItem('omniforge-openrouter-key') || '') }, [])
  const selected = useMemo(() => models.find((item) => item.id === model), [model, models])

  async function loadModels() {
    if (!apiKey.trim()) { setNotice('Add your OpenRouter key first.'); return }
    setNotice('Loading every model available to your key…')
    const response = await fetch(`/api/models?key=${encodeURIComponent(apiKey.trim())}`)
    const data = await response.json()
    if (!response.ok) { setNotice(data.error || 'Could not load models.'); return }
    setModels(data.data)
    setNotice(`${data.data.length.toLocaleString()} OpenRouter models loaded.`)
  }

  async function sendMessage(text = input) {
    const content = text.trim()
    if (!content || sending) return
    if (!apiKey.trim()) { setSettingsOpen(true); setNotice('Add your OpenRouter key to chat.'); return }
    const next = [...messages, { role: 'user' as const, content }]
    setMessages(next); setInput(''); setSending(true); setNotice('')
    const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: apiKey.trim(), model, messages: next }) })
    const data = await response.json()
    setMessages([...next, { role: 'assistant', content: response.ok ? data.text : `OpenRouter error: ${data.error}` }])
    setSending(false)
  }

  function saveKey(value: string) { setApiKey(value); sessionStorage.setItem('omniforge-openrouter-key', value); setNotice('Key saved for this browser session.') }

  return <main className="chat-app">
    <header className="chat-topbar"><button className="mobile-only icon-button" onClick={() => setMobileNav(!mobileNav)} aria-label="Open menu"><Menu size={20}/></button><div className="brand"><span className="brand-mark"><ShieldCheck size={18}/></span><span>OmniForge</span><small>CYBER AI</small></div><div className="top-actions"><button className="model-picker"><Bot size={16}/><span>{selected?.name || model}</span><ChevronDown size={15}/></button><button className="icon-button" onClick={() => setSettingsOpen(true)} aria-label="Open settings"><Settings size={19}/></button></div></header>
    <div className="chat-layout"><aside className={mobileNav ? 'chat-sidebar open' : 'chat-sidebar'}><button className="new-chat" onClick={() => setMessages([])}><Plus size={17}/> New chat</button><div className="sidebar-label">Workspace</div><button className="side-link active"><Sparkles size={16}/> AI chat</button><button className="side-link"><ShieldCheck size={16}/> Security analysis</button><div className="side-spacer"/><div className="secure-note"><ShieldCheck size={15}/><span>Keys stay in this browser session.</span></div></aside><section className="chat-main"><div className="conversation">{messages.length === 0 ? <div className="welcome"><div className="welcome-mark"><Sparkles size={26}/></div><h1>How can I help secure your work?</h1><p>Chat with any OpenRouter model for code review, threat modeling, incident response, and security research.</p><div className="suggestions"><button onClick={() => sendMessage('Review this application for the most important security risks and prioritize fixes.')}>Review an application</button><button onClick={() => sendMessage('Create a defensive incident response playbook for a suspected credential leak.')}>Create a response plan</button><button onClick={() => sendMessage('Explain how to harden an API against common web vulnerabilities.')}>Harden an API</button></div></div> : messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><div className="message-avatar">{message.role === 'assistant' ? <Sparkles size={15}/> : 'C'}</div><div className="message-body"><strong>{message.role === 'assistant' ? 'OmniForge AI' : 'You'}</strong><p>{message.content}</p></div></div>)}{sending && <div className="message assistant"><div className="message-avatar"><Sparkles size={15}/></div><div className="message-body"><strong>OmniForge AI</strong><p className="typing">Thinking…</p></div></div>}</div><div className="composer-wrap"><div className="composer"><button className="icon-button" aria-label="Attach file"><Paperclip size={19}/></button><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); sendMessage() } }} placeholder="Message OmniForge AI…" rows={1}/><button className="send-button" onClick={() => sendMessage()} disabled={!input.trim() || sending} aria-label="Send message"><Send size={17}/></button></div><small>AI can make mistakes. Review important security decisions.</small></div></section></div>{notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={14}/></button></div>}{settingsOpen && <div className="modal-backdrop" onClick={() => setSettingsOpen(false)}><section className="settings-modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><h2>OpenRouter settings</h2><p>Connect your key to unlock every model available through OpenRouter.</p></div><button className="icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={18}/></button></div><label htmlFor="api-key">OpenRouter API key</label><input id="api-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-or-v1-…" autoComplete="off"/><p className="security-copy">Your key is sent only to OpenRouter through this app&apos;s server route and kept in session storage on this device. Never share it publicly.</p><div className="modal-actions"><button className="secondary-button" onClick={() => saveKey(apiKey)}>Save key</button><button className="primary" onClick={() => { saveKey(apiKey); loadModels() }}>Save and load models</button></div><label htmlFor="model-select">Active model</label><select id="model-select" value={model} onChange={(event) => setModel(event.target.value)}>{models.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.id}</option>)}</select><p className="model-count">{models.length.toLocaleString()} models available in this session.</p></section></div>}</main>
}
