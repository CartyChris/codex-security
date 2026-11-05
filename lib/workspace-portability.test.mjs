import test from 'node:test'
import assert from 'node:assert/strict'
import { searchSources } from './source-inspection.ts'
import { exportTranscript, parseTranscript, transcriptMarkdown } from './transcripts.ts'

test('source search is literal, reports correct lines, and respects case', () => {
  const files = [{path:'src/app.ts', content:'safe\nEval(input)\n[a-z]'}]
  assert.equal(searchSources(files, 'eval', false).hits[0].line, 2)
  assert.equal(searchSources(files, 'eval', true).hits.length, 0)
  assert.equal(searchSources(files, '[a-z]', false).hits[0].line, 3)
  assert.equal(searchSources(files, '', false).matchingLines, 0)
})
test('source search caps rendered results without misreporting totals', () => {
  const result = searchSources([{path:'test.txt',content:('needle\n').repeat(150)}], 'needle', false)
  assert.equal(result.hits.length, 100)
  assert.equal(result.matchingLines, 150)
  assert.equal(result.truncated, true)
})
test('transcripts round-trip only messages, never settings or stored keys', () => {
  const messages = [{role:'user',content:'Test fixture',apiKey:'not-a-real-key'}, {role:'assistant',content:'Review needed'}]
  const exported = exportTranscript(messages)
  assert.ok(!JSON.stringify(exported).includes('not-a-real-key'))
  assert.deepEqual(parseTranscript(JSON.stringify({...exported,settings:{apiKey:'not-a-real-key'}})), messages.map(({role,content}) => ({role,content})))
  assert.match(transcriptMarkdown(messages), /not verified test results/)
})
test('transcript imports reject elevated roles and unsupported schemas', () => {
  for (const role of ['system','tool','developer']) assert.throws(() => parseTranscript(JSON.stringify({format:'omniforge-transcript',version:1,messages:[{role,content:'no'}]})))
  assert.throws(() => parseTranscript('{"messages":[]}'))
  assert.throws(() => parseTranscript(JSON.stringify({format:'omniforge-transcript',version:1,messages:[{role:'user',content:{}}]})))
  assert.throws(() => parseTranscript(JSON.stringify({format:'omniforge-transcript',version:1,messages:Array(201).fill({role:'user',content:'x'})})))
})
