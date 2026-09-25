// Streams a reply from /api/chat. The route sends plain text; an error, if any, follows a NUL marker.
const ERROR_MARK = '\u0000'

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export async function streamChat(options: { apiKey: string; model: string; expert: boolean; messages: ChatTurn[]; signal?: AbortSignal; onUpdate: (text: string, error?: string) => void }) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: options.apiKey, model: options.model, expert: options.expert, messages: options.messages }),
    signal: options.signal,
  })
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}))
    const error = data.error || 'Request failed.'
    options.onUpdate('', error)
    return { text: '', error }
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let received = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    received += decoder.decode(value, { stream: true })
    const [text, error] = received.split(ERROR_MARK)
    options.onUpdate(text, error || undefined)
  }
  const [text, error] = received.split(ERROR_MARK)
  if (!text && !error) {
    const empty = 'The model returned an empty response. Try again or pick another model.'
    options.onUpdate('', empty)
    return { text: '', error: empty }
  }
  return { text, error: error || undefined }
}
