'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import useSWR from 'swr'
import type { SourceFile, Finding } from '../lib/security-review'
import type { GithubScope } from './github-import'

export type WorkspaceMessage = { role: 'user' | 'assistant'; content: string }
export type ExecutionEvent = { id: string; at: string; actor: string; type: string; detail: string }
export type PatchProposal = { id: string; path: string; before: string; after: string; reason: string; status: 'pending' | 'applied' | 'rejected' }
export type Workspace = { files: SourceFile[]; githubScope: GithubScope | null; findings: Finding[] | null; messages: WorkspaceMessage[]; events: ExecutionEvent[]; patches: PatchProposal[]; report: string; include: string; exclude: string }
const empty: Workspace = { files: [], githubScope: null, findings: null, messages: [], events: [], patches: [], report: '', include: '', exclude: '' }
const storageKey = 'omniforge-workspace-v1'
type Update = (updater: (state: Workspace) => Workspace) => void
const Context = createContext<{ state: Workspace; update: Update; persistent: boolean; persist: (enabled: boolean) => void; storageError: string; event: (actor: string, type: string, detail: string) => void } | null>(null)
export function ConnectedWorkspace({ children }: { children: ReactNode }) {
  const { data: state = empty, mutate } = useSWR<Workspace>('connected-workspace', null, { fallbackData: empty })
  const [ready, setReady] = useState(false), [persistent, setPersistent] = useState(false), [storageError, setStorageError] = useState('')
  const update: Update = updater => { void mutate(current => updater(current || empty), { revalidate: false }) }
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) { const parsed = JSON.parse(saved); if (parsed.version === 1 && Array.isArray(parsed.state?.files) && Array.isArray(parsed.state?.messages)) { void mutate({ ...empty, ...parsed.state }, false); setPersistent(true) } }
    } catch { setStorageError('Browser workspace could not be restored. Export important work before closing.') }
    setReady(true)
  }, [mutate])
  useEffect(() => {
    if (!ready || !persistent) return
    try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, state })); setStorageError('') }
    catch { setStorageError('Browser storage is full or unavailable. Latest changes are only in memory; export your report.') }
  }, [state, ready, persistent])
  function persist(enabled: boolean) {
    setPersistent(enabled)
    if (!enabled) { try { localStorage.removeItem(storageKey) } catch { setStorageError('Unable to clear browser storage.') } }
  }
  function event(actor: string, type: string, detail: string) {
    update(current => ({ ...current, events: [...current.events, { id: crypto.randomUUID(), at: new Date().toISOString(), actor, type, detail }].slice(-250) }))
  }
  return <Context.Provider value={{ state, update, persistent, persist, storageError, event }}>{children}</Context.Provider>
}
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error('Workspace provider is missing'); return value }
