import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewSources, sourcePathAllowed, toSarif, scopeSources, rules, checkGroups } from './security-review.ts'

test('reports rule and exact line without retaining source contents', () => {
  const results = reviewSources([{ path: 'src/example.ts', content: '// fixture\nconst output = eval(input)\n' }])
  assert.equal(results.length, 1)
  assert.equal(results[0].rule, 'dynamic-eval')
  assert.equal(results[0].line, 2)
  assert.equal(results[0].path, 'src/example.ts')
  assert.ok(!JSON.stringify(results).includes('const output'))
})
test('selected checks do not execute unselected rules', () => {
  const files = [{ path: 'app.ts', content: 'eval(input); node.innerHTML = input' }]
  assert.deepEqual(reviewSources(files, ['html-sink']).map(finding => finding.rule), ['html-sink'])
  assert.deepEqual(reviewSources(files, []), [])
  assert.deepEqual(reviewSources(files, ['unknown']), [])
})
test('path scope matches whole folders or exact files and exclusions win', () => {
  const files = ['src/api/a.ts', 'src/api/fixtures/test.ts', 'src/apis/b.ts', 'src/auth.ts'].map(path => ({ path, content: '' }))
  assert.deepEqual(scopeSources(files, 'src/api/\nsrc/auth.ts', 'src/api/fixtures').map(file => file.path), ['src/api/a.ts', 'src/auth.ts'])
  assert.equal(scopeSources(files, '', '').length, 4)
  assert.equal(scopeSources(files, 'missing', '').length, 0)
  assert.equal(scopeSources(files, 'src/api', 'src').length, 0)
  assert.equal(scopeSources(files, './src\\api', '').length, 2)
})
test('new checks detect representative risky configurations', () => {
  const fixtures = {
    'jwt-none': 'algorithms: ["none"]', 'weak-hash': 'createHash("md5")',
    'insecure-cookie': 'httpOnly: false', 'unsafe-yaml': 'yaml.load(data)',
    'pickle-load': 'pickle.loads(data)', 'php-unserialize': 'unserialize($input)',
    'sql-template': 'SELECT * FROM users WHERE id = ${input}',
    'privileged-container': 'privileged: true', 'public-acl': 'acl: "public-read"',
  }
  for (const [id, content] of Object.entries(fixtures)) {
    assert.equal(reviewSources([{ path: 'fixture.txt', content }], [id])[0]?.rule, id)
  }
})
test('check groups cover each rule exactly once', () => {
  const grouped = checkGroups.flatMap(group => group.ids)
  assert.equal(new Set(grouped).size, rules.length)
  assert.equal(grouped.length, rules.length)
  assert.deepEqual([...grouped].sort(), rules.map(rule => rule.id).sort())
})
test('SARIF records the selected coverage even when no patterns match', () => {
  const run = toSarif([], ['tls-disabled'], ['src/api.ts']).runs[0]
  assert.deepEqual(run.tool.driver.rules.map(rule => rule.id), ['tls-disabled'])
  assert.equal(run.artifacts[0].location.uri, 'src/api.ts')
  assert.equal(run.results.length, 0)
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
