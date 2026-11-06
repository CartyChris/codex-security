'use client'
import { useWorkspace } from './connected-workspace'
import { runModel } from '../lib/assessment-client'
import { scopeSources } from '../lib/security-review'
export function useAssessment() {
  const { state, update, event } = useWorkspace()
  return async function assess(options: { apiKey: string; model: string; actor: string; messages: { role: 'user' | 'assistant'; content: string }[]; allowTools: boolean; signal?: AbortSignal; onText?: (text: string) => void }) {
    let output = ''
    try {
      return await runModel({ ...options, signal: undefined, onText: undefined, files: scopeSources(state.files, state.include, state.exclude), evidence: state.events.filter(e => ['investigation', 'network-import', 'browser'].includes(e.actor)).slice(-10).map(e => ({ actor: e.actor, type: e.type, detail: e.detail.slice(0, 20000) })), authorized: true }, options.signal, item => {
        if (item.type === 'text') { output += item.text || ''; options.onText?.(output) }
        else if (item.type === 'proposal' && item.proposal) { const proposal = item.proposal; update(s => s.files !== state.files || s.include !== state.include || s.exclude !== state.exclude ? s : ({ ...s, patches: [...s.patches, { ...proposal, id: crypto.randomUUID(), status: 'pending' }] })) }
        else event(options.actor, item.type, item.detail || '')
      })
    } catch (error) { event(options.actor, 'failed', error instanceof Error ? error.message : 'Request failed'); throw error }
  }
}
