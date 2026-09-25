import { NextResponse } from 'next/server'

type OpenRouterModel = { id: string; name?: string; context_length?: number }

export async function GET(request: Request) {
  // The key travels in a header so it never lands in request URLs or access logs.
  const key = request.headers.get('x-openrouter-key')?.trim() || process.env.OPENROUTER_API_KEY
  if (!key) return NextResponse.json({ error: 'Add an OpenRouter API key to load models.' }, { status: 400 })
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) return NextResponse.json({ error: data?.error?.message || 'Could not load models.' }, { status: response.status })
    const models = ((data.data || []) as OpenRouterModel[]).map(({ id, name, context_length }) => ({ id, name, context_length }))
    return NextResponse.json({ data: models })
  } catch {
    return NextResponse.json({ error: 'Could not reach OpenRouter.' }, { status: 502 })
  }
}
