export type ModelEvent = { type: string; detail?: string; text?: string; proposal?: { path: string; before: string; after: string; reason: string }; usage?: unknown }
export async function runModel(body: unknown, signal: AbortSignal | undefined, receive: (event: ModelEvent) => void) {
  const response = await fetch('/api/assessment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal })
  if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'Assessment request failed') }
  if (!response.body) throw new Error('Streaming is unavailable')
  const reader = response.body.getReader(), decoder = new TextDecoder()
  let buffer = '', text = '', completed = false
  function consume(line: string) { if (!line.trim()) return; const event: ModelEvent = JSON.parse(line); if (event.type === 'error') throw new Error(event.detail || 'Model failed'); if (event.type === 'text') text += event.text || ''; if (event.type === 'completed') completed = true; receive(event) }
  try { while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split('\n'); buffer = lines.pop() || ''; for (const line of lines) consume(line) } buffer += decoder.decode(); consume(buffer) }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  if (!completed) throw new Error('Model stream ended before completion. Partial output is not a completed assessment.')
  return text
}
