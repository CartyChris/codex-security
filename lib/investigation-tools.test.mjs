import test from 'node:test'
import assert from 'node:assert/strict'
import { codec, inspectJwt, inspectCidr, digestText, extractIndicators, inspectSecrets, reviewHeaders, lineDiff, runInvestigationTool, MAX_TOOL_CHARS } from './investigation-tools.ts'
const segment = data => Buffer.from(JSON.stringify(data)).toString('base64url')

test('UTF-8 codecs round-trip non-ASCII data without stripping invalid characters', () => {
  const input = '日本語 · café'
  for (const format of ['Base64', 'Hex', 'URL']) assert.equal(codec(codec(input, `${format} encode`), `${format} decode`), input)
  for (const input of ['0', 'xx', '12!3']) assert.throws(() => codec(input, 'Hex decode'))
  for (const input of ['a', 'YQ=', '!!!!', 'YR==']) assert.throws(() => codec(input, 'Base64 decode'))
  assert.throws(() => codec('ff', 'Hex decode'))
  assert.throws(() => codec('%zz', 'URL decode'))
})
test('JWT inspector explicitly reports unverified Unicode claims and expiry', () => {
  const result = inspectJwt(`${segment({alg:'none'})}.${segment({sub:'試験',exp:0,nbf:20})}.`, 10_000)
  assert.equal(result.signatureVerified, false)
  assert.equal(result.claims.sub, '試験')
  assert.equal(result.dates.exp, '1970-01-01T00:00:00.000Z')
  assert.ok(result.warnings.some(value => value.includes('past')))
  assert.ok(result.warnings.some(value => value.includes('not yet valid')))
  assert.ok(result.warnings.some(value => value.includes('Unsigned')))
})
test('JWT inspector rejects malformed tokens and warns on invalid NumericDates', () => {
  for (const token of ['a.b', 'a.b.c.d.e', `${segment([])}.${segment({})}.`, 'x.x.x']) assert.throws(() => inspectJwt(token))
  const result = inspectJwt(`${segment({alg:'RS256'})}.${segment({exp:'tomorrow'})}.AA`)
  assert.equal(result.signatureBytes, 1)
  assert.ok(result.warnings.some(value => value.includes('not a valid NumericDate')))
})
test('CIDR handles full range and point-to-point/host edge cases', () => {
  assert.equal(inspectCidr('192.0.2.17/24').network, '192.0.2.0/24')
  assert.equal(inspectCidr('192.0.2.17/24').usableAddresses, 254)
  assert.equal(inspectCidr('192.0.2.1/31').usableAddresses, 2)
  assert.equal(inspectCidr('192.0.2.1/32').firstUsable, '192.0.2.1')
  assert.equal(inspectCidr('255.255.255.255/0').totalAddresses, 4294967296)
  for (const value of ['256.1.1.1/24', '01.2.3.4/24', '192.0.2.1/33', '192.0.2.1', '::1/128']) assert.throws(() => inspectCidr(value))
})
test('hashes match known vectors and do not relabel algorithms', async () => {
  const result = await digestText('abc', 'SHA-256')
  assert.equal(result.digest, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  assert.equal((await digestText('', 'SHA-512')).digest.length, 128)
  assert.equal((await digestText('', 'SHA-256')).shannonBitsPerByte, 0)
  await assert.rejects(digestText('abc', 'MD5'))
})
test('indicator extraction validates IPs, deduplicates, and defangs output', () => {
  const result = extractIndicators('192.0.2.1 192.0.2.1 999.2.3.4 https://user:pass@example.test/path?token=private#fragment')
  assert.equal(result.indicators.filter(item => item.kind === 'ipv4').length, 1)
  const url = result.indicators.find(item => item.kind === 'url').defanged
  assert.equal(url, 'hxxps://example[.]test/path')
  assert.ok(!JSON.stringify(result).includes('private'))
  assert.ok(!JSON.stringify(result).includes('pass[@]'))
})
test('credential review returns locations, not credential values', () => {
  const token = 'ghp_' + 'A'.repeat(36)
  const result = inspectSecrets(`safe\nconst key = '${token}'`)
  assert.equal(result.hits[0].line, 2)
  assert.ok(!JSON.stringify(result).includes(token))
  assert.equal(inspectSecrets('nothing recognizable').hits.length, 0)
})
test('header review distinguishes report-only and redacts cookie values', () => {
  const result = reviewHeaders('HTTP/1.1 200 OK\r\nContent-Security-Policy-Report-Only: default-src \'self\'\r\nSet-Cookie: session=private; SameSite=None\r\nSet-Cookie: other=secret; Secure; HttpOnly; SameSite=Lax')
  assert.ok(result.checks.some(check => check.observation.includes('does not enforce')))
  assert.equal(result.cookies.length, 2)
  assert.ok(result.cookies[0].observations.includes('SameSite=None requires Secure.'))
  assert.equal(result.cookies[1].httpOnly, true)
  assert.ok(!JSON.stringify(result).includes('private'))
  assert.ok(!JSON.stringify(result).includes('secret'))
})
test('diff uses sequence alignment rather than cascading false changes', () => {
  const result = lineDiff('a\nb\nc', 'a\ninsert\nb\nc')
  assert.equal(result.added, 1); assert.equal(result.removed, 0)
  assert.equal(lineDiff('', '').lines.length, 0)
  assert.equal(lineDiff('', 'x').removed, 0)
  assert.equal(lineDiff('a\r\nb', 'a\nb').added, 0)
  assert.throws(() => lineDiff('x\n'.repeat(501), ''))
})
test('dispatcher validates input limits and JSON without executing content', async () => {
  await assert.rejects(runInvestigationTool('json', 'not json'))
  await assert.rejects(runInvestigationTool('json', 'a'.repeat(MAX_TOOL_CHARS + 1)))
  assert.deepEqual(await runInvestigationTool('json', '{"html":"<script>bad()</script>"}'), {html:'<script>bad()</script>'})
  await assert.rejects(runInvestigationTool('unknown', ''))
})
