import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get('key') || process.env.OPENROUTER_API_KEY
  if (!key) return NextResponse.json({ error: 'Add an OpenRouter API key to load models.' }, { status: 400 })
  const response = await fetch('https://openrouter.ai/api/v1/models', { headers: { Authorization: `Bearer ${key}` }, cache: 'no-store' })
  const data = await response.json()
  if (!response.ok) return NextResponse.json({ error: data?.error?.message || 'Could not load models.' }, { status: response.status })
  return NextResponse.json({ data: data.data || [] })
}
