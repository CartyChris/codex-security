import { createOpenAI } from '@ai-sdk/openai'
import { streamText, type ModelMessage } from 'ai'
import { NextResponse } from 'next/server'

export const maxDuration = 60

// Marks the start of an error message inside the plain-text stream.
const ERROR_MARK = '\u0000'

const basePrompt = 'You are OmniForge AI, a defensive application security assistant. Help with secure code review, threat modeling, hardening, and incident response. Prefer concrete, prioritized guidance with code examples in fenced blocks. Keep advice defensive and focused on protecting systems the user is responsible for.'
const expertPrompt = ' Expert mode is on: go deep, cite the relevant weakness class (for example CWE IDs), explain exploitability and impact, and include tests that prove each fix.'

function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message
  return typeof error === 'string' ? error : 'OpenRouter request failed.'
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const apiKey = typeof body.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : process.env.OPENROUTER_API_KEY
  const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : 'openai/gpt-4o-mini'
  const messages: ModelMessage[] = (Array.isArray(body.messages) ? body.messages : [])
    .filter((message): message is { role: 'user' | 'assistant'; content: string } => (message?.role === 'user' || message?.role === 'assistant') && typeof message.content === 'string' && message.content.length > 0)
    .map(({ role, content }) => ({ role, content }))

  if (!apiKey) return NextResponse.json({ error: 'Add an OpenRouter API key in Settings first.' }, { status: 400 })
  if (!messages.length) return NextResponse.json({ error: 'Send a message to start the conversation.' }, { status: 400 })

  const openrouter = createOpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1', headers: { 'HTTP-Referer': 'https://omniforge-harness.vercel.app', 'X-Title': 'OmniForge Harness' } })
  // OpenRouter serves the Chat Completions API; the provider's default model uses the Responses API.
  const result = streamText({
    model: openrouter.chat(model),
    system: basePrompt + (body.expert === true ? expertPrompt : ''),
    messages: messages.slice(-30),
    temperature: 0.3,
    abortSignal: request.signal,
  })

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (text: string) => { try { controller.enqueue(encoder.encode(text)) } catch { /* client disconnected */ } }
      try {
        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') send(part.text)
          else if (part.type === 'error') send(ERROR_MARK + errorText(part.error))
        }
      } catch (error) {
        if (!request.signal.aborted) send(ERROR_MARK + errorText(error))
      } finally {
        try { controller.close() } catch { /* already closed */ }
      }
    },
  })

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
}
