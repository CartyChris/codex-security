import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewSources, sourcePathAllowed, toSarif } from './security-review.ts'

test('reports rule and exact line without retaining source contents', () => {
  const results = reviewSources([{ path: 'src/example.ts', content: '// fixture\nconst output = eval(input)\n' }])
  assert.equal(results.length, 1)
  assert.equal(results[0].rule, 'dynamic-eval')
  assert.equal(results[0].line, 2)
  assert.equal(results[0].path, 'src/example.ts')
  assert.ok(!JSON.stringify(results).includes('const output'))
})
test('safe code does not generate pattern findings', () => {
  assert.deepEqual(reviewSources([{ path: 'example.ts', content: 'const value = JSON.parse(input)' }]), [])
})
test('detects each supported pattern independently', () => {
  const examples = ['eval(input)', 'node.innerHTML = value', 'rejectUnauthorized: false', 'shell: true', 'shell=True', 'DEBUG=True', '"Access-Control-Allow-Origin": "*"']
  assert.equal(new Set(reviewSources(examples.map((content, index) => ({ path: `${index}.txt`, content }))).map((finding) => finding.rule)).size, 7)
})
test('excludes credential files, generated code, traversal and unsupported binary types', () => {
  for (const path of ['.env', 'app/.env.local', 'keys/private.pem', 'node_modules/a.js', '../src/a.ts', 'app.zip', 'image.png', '.git/config', 'src/../a.ts']) assert.equal(sourcePathAllowed(path), false, path)
  for (const path of ['src/a.tsx', 'src/main.py', 'Dockerfile', 'config.yaml']) assert.equal(sourcePathAllowed(path), true, path)
})
test('SARIF contains portable encoded paths and one-based line references', () => {
  const report = toSarif(reviewSources([{ path: 'src/my file.ts', content: '\n\neval(input)' }]))
  assert.equal(report.version, '2.1.0')
  assert.equal(report.runs[0].results[0].locations[0].physicalLocation.region.startLine, 3)
  assert.equal(report.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri, 'src/my%20file.ts')
  assert.match(report.runs[0].results[0].message.text, /manual verification/)
})
