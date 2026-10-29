import test from 'node:test'
import assert from 'node:assert/strict'
import { scanSemgrep } from './semgrep-scan.ts'

test('installs first, blocks network before source upload, and excludes source snippets from reports', async () => {
  const events = []
  const sandbox = {
    async runCommand(command) {
      if (command === 'python') { events.push('install'); return {exitCode:0} }
      events.push('scan')
      assert.ok(command.args.includes('--metrics=off'))
      return {exitCode:0, stdout:async()=>JSON.stringify({version:'test-version',results:[{check_id:'test-rule',path:'example.js',start:{line:1},extra:{severity:'WARNING',message:'Review dynamic evaluation',lines:'private source snippet'}}],errors:[],paths:{scanned:['example.js']}})}
    },
    async updateNetworkPolicy(policy) { assert.equal(policy,'deny-all'); events.push('deny') },
    async writeFiles(files) { assert.equal(files[1].path,'/vercel/sandbox/scope/example.js'); events.push('upload') },
  }
  const result = await scanSemgrep(sandbox,[{path:'example.js',content:'eval(input)'}])
  assert.deepEqual(events,['install','deny','upload','scan'])
  assert.equal(result.findings.length,1)
  assert.ok(!JSON.stringify(result).includes('private source snippet'))
})
test('installation failure never uploads source', async () => {
  await assert.rejects(scanSemgrep({runCommand:async()=>({exitCode:1}),writeFiles:()=>assert.fail('source uploaded')},[]), /installation failed/)
})
test('scanner errors cannot produce a clean report', async () => {
  await assert.rejects(scanSemgrep({runCommand:async command=>({exitCode:command==='python'?0:2}),updateNetworkPolicy:async()=>{},writeFiles:async()=>{}},[]), /did not complete/)
})
