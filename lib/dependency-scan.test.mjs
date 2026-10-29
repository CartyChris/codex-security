import test from 'node:test'
import assert from 'node:assert/strict'
import { lockedDependencies, scanDependencies } from './dependency-scan.ts'

const files = [{ path: 'pnpm-lock.yaml', content: "lockfileVersion: '9.0'\npackages:\n  '@example/library@1.2.3':\n    resolution: {integrity: sha512-fixture}\n  'example@2.0.0':\n    resolution: {integrity: sha512-fixture}\n" }]
test('reads scoped registry packages without interpreting manifests or running scripts', () => {
  const result = lockedDependencies(files)
  assert.deepEqual(result.packages.map(p => [p.name, p.version]), [['@example/library', '1.2.3'], ['example', '2.0.0']])
  assert.throws(() => lockedDependencies([{path:'package.json', content:'{"dependencies":{"example":"^2"}}'}]), /lockfile/)
})
test('npm aliases use the actual name and duplicate versions are queried once', () => {
  const content = JSON.stringify({ lockfileVersion: 3, packages: { '': { name: 'project' }, 'node_modules/alias': {name:'example',version:'1.2.3',integrity:'sha512-fixture'}, 'node_modules/x/node_modules/example': {version:'1.2.3',integrity:'sha512-fixture'}, 'node_modules/local': {link:true} } })
  const scope = lockedDependencies([{path:'package-lock.json',content}])
  assert.equal(scope.packages.length, 1)
  assert.equal(scope.packages[0].name, 'example')
  assert.equal(scope.skipped.length, 1)
})
test('follows OSV pagination and sends only names, versions and ecosystem', async () => {
  const calls = []
  const request = async (url, options) => {
    const body = JSON.parse(options.body); calls.push(body)
    assert.equal(url, 'https://api.osv.dev/v1/querybatch')
    return Response.json(calls.length === 1 ? {results:[{vulns:[{id:'GHSA-example-one'}],next_page_token:'next'},{ }]} : {results:[{vulns:[{id:'GHSA-example-two'}]}]})
  }
  const result = await scanDependencies(lockedDependencies(files), request)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].queries.length, 1)
  assert.equal(calls[1].queries[0].page_token, 'next')
  assert.ok(!JSON.stringify(calls).includes('pnpm-lock'))
  assert.deepEqual(result.findings[0].advisories,['GHSA-example-one','GHSA-example-two'])
})
test('an upstream failure cannot become a clean scan', async () => {
  await assert.rejects(scanDependencies(lockedDependencies(files), async () => new Response('', {status:503})), /OSV query failed/)
  await assert.rejects(scanDependencies(lockedDependencies(files), async () => Response.json({results:[]})), /incomplete batch/)
})
