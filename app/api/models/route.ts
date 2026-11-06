export async function GET() {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', { next: { revalidate: 3600 } })
    if (!response.ok) return Response.json({ error: 'Could not load model catalog.' }, { status: 502 })
    const data = await response.json()
    return Response.json({ data: data.data || [] })
  } catch { return Response.json({ error: 'Model catalog is unavailable.' }, { status: 502 }) }
}
