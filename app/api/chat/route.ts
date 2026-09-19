import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const apiKey = typeof body.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : process.env.OPENROUTER_API_KEY
    const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : 'openai/gpt-4o-mini'
    const messages = Array.isArray(body.messages) ? body.messages : []

    if (!apiKey) return NextResponse.json({ error: 'Add an OpenRouter API key in Settings first.' }, { status: 400 })
    if (!messages.length) return NextResponse.json({ error: 'Send a message to start the conversation.' }, { status: 400 })

    const openrouter = createOpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1', headers: { 'HTTP-Referer': 'https://omniforge-harness.vercel.app', 'X-Title': 'OmniForge Harness' } })
    const result = await generateText({ model: openrouter(model), messages: messages.slice(-30), temperature: 0.3 })
    return NextResponse.json({ text: result.text, usage: result.usage })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenRouter request failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
