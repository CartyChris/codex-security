export type TranscriptMessage = { role: 'user' | 'assistant'; content: string }
export const MAX_TRANSCRIPT_BYTES = 2 * 1024 * 1024

export function exportTranscript(messages: readonly TranscriptMessage[]) {
  return { format: 'omniforge-transcript', version: 1, exportedAt: new Date().toISOString(), messages: messages.map(({ role, content }) => ({ role, content })) }
}
export function transcriptMarkdown(messages: readonly TranscriptMessage[]) {
  return ['# OmniForge conversation', 'Transcript only. Assistant statements are not verified test results.', ...messages.flatMap(message => [`## ${message.role === 'user' ? 'User' : 'Assistant'}`, message.content])].join('\n\n')
}
export function parseTranscript(text: string): TranscriptMessage[] {
  if (new TextEncoder().encode(text).byteLength > MAX_TRANSCRIPT_BYTES) throw new Error('Transcript must be 2 MB or smaller.')
  const data = JSON.parse(text)
  if (!data || data.format !== 'omniforge-transcript' || data.version !== 1 || !Array.isArray(data.messages)) throw new Error('Choose an OmniForge version 1 JSON transcript. Provider settings and keys are never imported.')
  if (data.messages.length > 200) throw new Error('Import up to 200 messages to keep the conversation usable on mobile.')
  return data.messages.map((message: unknown) => {
    if (!message || typeof message !== 'object' || !('role' in message) || !('content' in message) || (message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') throw new Error('Each message must contain a user or assistant role and text content. System and tool messages are not imported.')
    return { role: message.role, content: message.content }
  })
}
