import test from 'node:test'
import assert from 'node:assert/strict'
import { runModel } from './assessment-client.ts'

test('streams split NDJSON and UTF-8 without losing final events', async () => {
  const previous = globalThis.fetch
  const bytes = new TextEncoder().encode('{"type":"text","text":"héllo"}\n{"type":"completed","detail":"done"}')
  globalThis.fetch = async () => new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 2) c.enqueue(bytes.slice(i, i + 2)); c.close() } }))
  try { const events = []; const text = await runModel({}, undefined, e => events.push(e)); assert.equal(text, 'héllo'); assert.equal(events.at(-1).type, 'completed') }
  finally { globalThis.fetch = previous }
})
test('provider failures cannot become successful reports', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => new Response('{"type":"error","detail":"provider unavailable"}\n')
  try { await assert.rejects(runModel({}, undefined, () => {}), /provider unavailable/) }
  finally { globalThis.fetch = previous }
})
test('truncated streams do not produce completed reports', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => new Response('{"type":"text","text":"partial"}\n')
  try { await assert.rejects(runModel({}, undefined, () => {}), /before completion/) }
  finally { globalThis.fetch = previous }
})
test('validation errors are surfaced before consuming stream', async () => {
  const previous = globalThis.fetch
  globalThis.fetch = async () => Response.json({ error: 'Authorize scope first' }, { status: 403 })
  try { await assert.rejects(runModel({}, undefined, () => {}), /Authorize scope first/) }
  finally { globalThis.fetch = previous }
})
