export const MAX_TOOL_CHARS = 100_000
export const toolCatalog = [
  { id: 'jwt', name: 'JWT inspector', category: 'Identity', description: 'Decode header, claims, and expiry. Never verifies a signature.', placeholder: 'Paste a synthetic or redacted JWT', options: [] },
  { id: 'codec', name: 'Text codecs', category: 'Utilities', description: 'Strict UTF-8 Base64, hexadecimal, and URL component conversions.', placeholder: 'Text to encode or decode', options: ['Base64 encode', 'Base64 decode', 'Hex encode', 'Hex decode', 'URL encode', 'URL decode'] },
  { id: 'hash', name: 'Digest & entropy', category: 'Utilities', description: 'Web Crypto digests and byte-frequency entropy. Not a password-strength score.', placeholder: 'Text to hash (exact whitespace is preserved)', options: ['SHA-256', 'SHA-384', 'SHA-512'] },
  { id: 'cidr', name: 'IPv4 subnet calculator', category: 'Network', description: 'Network boundaries and address counts. No scanning or network requests.', placeholder: '192.0.2.17/24', options: [] },
  { id: 'ioc', name: 'Indicator extractor', category: 'Detection', description: 'Find and defang candidate URLs, domains, IPv4 addresses, emails, and hashes. No reputation verdict.', placeholder: 'Paste log text or incident notes', options: [] },
  { id: 'headers', name: 'HTTP response review', category: 'Hardening', description: 'Inspect pasted security headers, CSP, and cookie attributes without fetching a URL.', placeholder: 'HTTP/1.1 200 OK\nContent-Type: text/html\nContent-Security-Policy: default-src \'self\'', options: [] },
  { id: 'secrets', name: 'Credential-pattern review', category: 'Exposure', description: 'Locate recognizable credential patterns. Results contain locations, never matched values.', placeholder: 'Paste source or logs. Use synthetic credentials when possible.', options: [] },
  { id: 'json', name: 'JSON formatter', category: 'Utilities', description: 'Validate and pretty-print JSON locally. Input is treated only as data.', placeholder: '{"status":"review"}', options: [] },
  { id: 'diff', name: 'Line diff', category: 'Utilities', description: 'Insertion-aware comparison of two texts, up to 500 lines each.', placeholder: 'Original text', options: [] },
] as const
export type ToolId = typeof toolCatalog[number]['id']

export function validateToolInput(input: string) {
  if (input.length > MAX_TOOL_CHARS) throw new Error('Keep each input under 100,000 characters to avoid blocking the browser.')
}
function decodeBytes(value: string, url = false) {
  const normalized = url ? value.replace(/-/g, '+').replace(/_/g, '/') : value.replace(/\s/g, '')
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized) || normalized.replace(/=+$/, '').length % 4 === 1 || (normalized.includes('=') && normalized.length % 4 !== 0)) throw new Error('Invalid Base64 encoding.')
  const bytes = Uint8Array.from(atob(normalized), char => char.charCodeAt(0))
  const canonical = btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/=+$/, '')
  if (canonical !== normalized.replace(/=+$/, '')) throw new Error('Non-canonical Base64 encoding.')
  return bytes
}
const textDecoder = () => new TextDecoder('utf-8', { fatal: true })
export function codec(input: string, mode: string) {
  validateToolInput(input)
  if (mode === 'Base64 encode') return btoa(Array.from(new TextEncoder().encode(input), byte => String.fromCharCode(byte)).join(''))
  if (mode === 'Base64 decode') return textDecoder().decode(decodeBytes(input))
  if (mode === 'Hex encode') return Array.from(new TextEncoder().encode(input), byte => byte.toString(16).padStart(2, '0')).join('')
  if (mode === 'Hex decode') {
    const hex = input.replace(/\s/g, '')
    if (!/^(?:[\da-f]{2})*$/i.test(hex)) throw new Error('Hex requires complete byte pairs and hexadecimal characters only.')
    return textDecoder().decode(Uint8Array.from(hex.match(/../g) || [], byte => parseInt(byte, 16)))
  }
  if (mode === 'URL encode') return encodeURIComponent(input)
  if (mode === 'URL decode') return decodeURIComponent(input)
  throw new Error('Choose a supported codec.')
}
export function inspectJwt(input: string, now = Date.now()) {
  validateToolInput(input)
  const parts = input.trim().split('.')
  if (parts.length !== 3 || !parts[0] || !parts[1] || parts.some(part => !/^[\w-]*$/.test(part))) throw new Error('Expected three Base64URL JWT segments. Encrypted JWE tokens are not supported.')
  const parse = (part: string) => {
    const value = JSON.parse(textDecoder().decode(decodeBytes(part, true)))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('JWT header and payload must be JSON objects.')
    return value as Record<string, unknown>
  }
  const header = parse(parts[0]), claims = parse(parts[1])
  const warnings = ['UNVERIFIED: decoded claims are attacker-controlled until the signature, issuer, and audience are verified.']
  if (header.alg === 'none' || !parts[2]) warnings.push('Unsigned or empty-signature token; never accept it as proof of identity.')
  const dates: Record<string, string> = {}
  for (const claim of ['exp', 'nbf', 'iat']) {
    if (claims[claim] === undefined) continue
    const value = claims[claim]
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value * 1000) > 8.64e15) { warnings.push(`${claim} is not a valid NumericDate.`); continue }
    dates[claim] = new Date(value * 1000).toISOString()
    if (claim === 'exp' && value * 1000 <= now) warnings.push('Token expiry is in the past.')
    if (claim === 'nbf' && value * 1000 > now) warnings.push('Token is not yet valid by its nbf claim.')
  }
  return { signatureVerified: false, header, claims, dates, signatureBytes: decodeBytes(parts[2], true).length, warnings }
}
function ipv4Number(input: string) {
  if (!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(input)) throw new Error('Enter a dotted-decimal IPv4 address without leading zeroes.')
  const octets = input.split('.').map(Number)
  if (octets.some(value => value > 255)) throw new Error('IPv4 octets must be between 0 and 255.')
  return octets.reduce((total, byte) => total * 256 + byte, 0)
}
const ipv4Text = (value: number) => [24, 16, 8, 0].map(shift => (value >>> shift) & 255).join('.')
export function inspectCidr(input: string) {
  const match = /^(\S+)\/(\d{1,2})$/.exec(input.trim())
  if (!match || Number(match[2]) > 32) throw new Error('Use IPv4 CIDR notation with a prefix from /0 through /32.')
  const address = ipv4Number(match[1]), prefix = Number(match[2]), count = 2 ** (32 - prefix)
  const start = Math.floor(address / count) * count, end = start + count - 1
  return { network: `${ipv4Text(start)}/${prefix}`, netmask: ipv4Text(2 ** 32 - count), lastAddress: ipv4Text(end), totalAddresses: count, usableAddresses: prefix >= 31 ? count : count - 2, firstUsable: ipv4Text(prefix >= 31 ? start : start + 1), lastUsable: ipv4Text(prefix >= 31 ? end : end - 1), note: prefix === 31 ? 'RFC 3021 point-to-point semantics: both addresses usable.' : prefix === 32 ? 'Single-host route.' : 'Conventional subnet network and broadcast addresses excluded from usable count.' }
}
export async function digestText(input: string, algorithm: string) {
  validateToolInput(input)
  if (!['SHA-256', 'SHA-384', 'SHA-512'].includes(algorithm)) throw new Error('Unsupported digest algorithm.')
  const bytes = new TextEncoder().encode(input), frequency = new Map<number, number>()
  for (const byte of bytes) frequency.set(byte, (frequency.get(byte) || 0) + 1)
  let entropy = 0
  for (const count of frequency.values()) { const p = count / bytes.length; entropy -= p * Math.log2(p) }
  const digest = await crypto.subtle.digest(algorithm, bytes)
  return { algorithm, digest: Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''), utf8Bytes: bytes.length, shannonBitsPerByte: Number(entropy.toFixed(4)), note: 'Entropy is a sample statistic, not evidence of randomness or password strength.' }
}
export function extractIndicators(input: string) {
  validateToolInput(input)
  const patterns: [string, RegExp][] = [
    ['url', /https?:\/\/[^\s"'<>()[\]]+/gi], ['email', /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi],
    ['ipv4', /\b(?:\d{1,3}\.){3}\d{1,3}\b/g], ['sha256', /\b[a-f0-9]{64}\b/gi], ['sha1', /\b[a-f0-9]{40}\b/gi], ['md5', /\b[a-f0-9]{32}\b/gi],
    ['domain', /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}\b/gi],
  ]
  const text = input.replace(/https?:\/\/[^\s"'<>()[\]]+/gi, raw => {
    try { const url = new URL(raw); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.toString() }
    catch { return '' }
  })
  const indicators: { kind: string; defanged: string }[] = [], seen = new Set<string>()
  for (const [kind, pattern] of patterns) for (const match of text.matchAll(pattern)) {
    let value = match[0]
    if (kind === 'ipv4') { try { ipv4Number(value) } catch { continue } }
    if (kind === 'url') { try { const url = new URL(value); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; value = url.toString() } catch { continue } }
    const key = `${kind}:${value.toLowerCase()}`
    if (seen.has(key)) continue
    if (indicators.length === 200) return { indicators, truncated: true, note: 'Candidate indicators only. URL credentials, queries, and fragments omitted. Nested indicators may appear separately.' }
    seen.add(key); indicators.push({ kind, defanged: value.replace(/^http/i, 'hxxp').replaceAll('.', '[.]').replaceAll('@', '[@]') })
  }
  return { indicators, truncated: false, note: 'Candidate indicators only, not evidence of compromise. URL credentials, queries, and fragments omitted. Nested indicators may appear separately.' }
}
export function inspectSecrets(input: string) {
  validateToolInput(input)
  const patterns: [string, RegExp][] = [
    ['AWS access key ID', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g],
    ['GitHub token', /\b(?:gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255})\b/g],
    ['Private key marker', /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/g],
    ['Credential assignment', /\b(?:api[_-]?key|password|client[_-]?secret|access[_-]?token)\s*[:=]\s*["'][^"'\r\n]{8,}["']/gi],
  ]
  const hits: { type: string; line: number; column: number }[] = []
  for (const [index, line] of input.split('\n').entries()) {
    for (const [type, regex] of patterns) for (const match of line.matchAll(regex)) {
      if (hits.length === 200) return { hits, truncated: true, note: 'Values omitted. Heuristic matches may be fixtures; no matches does not rule out secrets.' }
      hits.push({ type, line: index + 1, column: match.index + 1 })
    }
  }
  return { hits, truncated: false, note: 'Values omitted. Heuristic matches may be fixtures; no matches does not rule out secrets.' }
}
export function reviewHeaders(input: string) {
  validateToolInput(input)
  const entries = input.split(/\r?\n/).flatMap(line => { const at = line.indexOf(':'); return at > 0 ? [[line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim()]] : [] })
  const values = (name: string) => entries.filter(([key]) => key === name).map(([, value]) => value)
  const checks: { control: string; observation: string }[] = []
  const hsts = values('strict-transport-security')
  checks.push({ control: 'HTTPS transport', observation: hsts.some(value => /(?:^|;)\s*max-age\s*=\s*[1-9]\d*\s*(?:;|$)/i.test(value)) ? 'Positive HSTS max-age observed; HTTPS and deployment scope still require verification.' : 'No positive HSTS max-age observed. Required for HTTPS sites, not HTTP-only local fixtures.' })
  checks.push({ control: 'MIME sniffing', observation: values('x-content-type-options').some(value => value.toLowerCase() === 'nosniff') ? 'nosniff observed.' : 'nosniff not observed.' })
  const csp = values('content-security-policy')
  const reportOnly = values('content-security-policy-report-only').length > 0
  const issues: string[] = []
  if (!csp.length) issues.push(reportOnly ? 'Report-only CSP is present but does not enforce restrictions.' : 'No enforcing CSP observed. Applicability depends on response type.')
  for (const policy of csp) {
    const directives = policy.split(';').map(value => value.trim().split(/\s+/))
    if (directives.some(([, ...sources]) => sources.includes("'unsafe-eval'"))) issues.push('unsafe-eval permits string-to-code evaluation.')
    if (directives.some(([name, ...sources]) => ['script-src', 'default-src', 'script-src-elem'].includes(name) && sources.includes("'unsafe-inline'"))) issues.push('unsafe-inline observed; inspect nonce/hash and browser semantics before judging exploitability.')
    if (!directives.some(([name]) => name === 'frame-ancestors') && !values('x-frame-options').some(value => /^(DENY|SAMEORIGIN)$/i.test(value))) issues.push('No framing restriction observed. May be intentional for embeddable pages.')
  }
  checks.push({ control: 'Content Security Policy', observation: issues.length ? [...new Set(issues)].join(' ') : 'Enforcing CSP observed; this limited review does not prove it is effective.' })
  checks.push({ control: 'Referrer policy', observation: values('referrer-policy').length ? 'Policy present; review the value against data exposure requirements.' : 'No explicit Referrer-Policy observed; browser defaults apply.' })
  const cookies = values('set-cookie').map((value, index) => {
    const attributes = value.split(';').slice(1).map(part => part.trim().toLowerCase())
    const secure = attributes.includes('secure'), httpOnly = attributes.includes('httponly'), sameSite = attributes.find(part => /^samesite\s*=/.test(part))?.split('=')[1]?.trim()
    return { cookie: index + 1, secure, httpOnly, sameSite: sameSite || 'not specified', observations: [!secure ? 'Secure missing.' : '', !httpOnly ? 'HttpOnly missing; verify whether JavaScript access is intentional.' : '', sameSite === 'none' && !secure ? 'SameSite=None requires Secure.' : '', sameSite && !['none', 'strict', 'lax'].includes(sameSite) ? 'Unrecognized SameSite value.' : ''].filter(Boolean) }
  })
  return { checks, cookies, note: 'Pasted response only. Missing headers may reflect an incomplete capture. Cookie names and values omitted. No live requests or overall security score.' }
}
export function lineDiff(before: string, after: string) {
  validateToolInput(before); validateToolInput(after)
  const a = before ? before.replace(/\r\n/g, '\n').split('\n') : [], b = after ? after.replace(/\r\n/g, '\n').split('\n') : []
  if (a.length > 500 || b.length > 500) throw new Error('Diff supports up to 500 lines per input to bound quadratic comparison work.')
  const table = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1))
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
  const lines: { kind: 'same' | 'added' | 'removed'; text: string }[] = []
  let i = 0, j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { lines.push({ kind: 'same', text: a[i] }); i++; j++ }
    else if (j < b.length && (i === a.length || table[i][j + 1] >= table[i + 1][j])) lines.push({ kind: 'added', text: b[j++] })
    else lines.push({ kind: 'removed', text: a[i++] })
  }
  return { added: lines.filter(line => line.kind === 'added').length, removed: lines.filter(line => line.kind === 'removed').length, lines, note: 'CRLF normalized to LF. Whitespace and trailing newline differences otherwise preserved.' }
}
export async function runInvestigationTool(id: ToolId, input: string, option = '', second = ''): Promise<unknown> {
  validateToolInput(input); validateToolInput(second)
  switch (id) {
    case 'jwt': return inspectJwt(input)
    case 'codec': return codec(input, option)
    case 'hash': return digestText(input, option)
    case 'cidr': return inspectCidr(input)
    case 'ioc': return extractIndicators(input)
    case 'headers': return reviewHeaders(input)
    case 'secrets': return inspectSecrets(input)
    case 'json': return JSON.parse(input)
    case 'diff': return lineDiff(input, second)
    default: throw new Error('Unknown investigation tool.')
  }
}
