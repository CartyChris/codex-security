export type SourceFile = { path: string; content: string }
export type Finding = { id: string; rule: string; title: string; severity: 'high' | 'medium'; path: string; line: number; remediation: string; red: string; blue: string }
export const MAX_FILES = 150
export const MAX_BYTES = 2_000_000
export const rules = [
  { id: 'dynamic-eval', title: 'Dynamic code evaluation', severity: 'high', pattern: /\beval\s*\(/, remediation: 'Replace eval with explicit parsing and allowlisted operations.', red: 'In an isolated test fixture, determine whether untrusted input can reach this call. Use a harmless marker, not system commands.', blue: 'Add a regression test rejecting untrusted expressions and verify the replacement parser.' },
  { id: 'html-sink', title: 'Raw HTML injection sink', severity: 'medium', pattern: /dangerouslySetInnerHTML|\.innerHTML\s*=/, remediation: 'Prefer text rendering. If HTML is required, sanitize it with a maintained allowlist-based sanitizer.', red: 'Trace input to this sink. Use a local inert HTML marker to check whether untrusted markup is rendered.', blue: 'Add tests for escaped markup and unsafe URL protocols. Check sanitizer configuration.' },
  { id: 'tls-disabled', title: 'TLS verification disabled', severity: 'high', pattern: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/, remediation: 'Enable certificate validation and configure the correct certificate authority.', red: 'In an isolated fixture, test whether a self-signed certificate is incorrectly accepted.', blue: 'Add a test requiring rejection of invalid certificates and successful use of the trusted CA.' },
  { id: 'shell-option', title: 'Shell execution enabled', severity: 'high', pattern: /shell\s*:\s*true/, remediation: 'Use argument arrays without shell expansion and validate inputs.', red: 'Trace user-controlled input into the process arguments. Only use inert metacharacter fixtures in a disposable sandbox.', blue: 'Add argument-boundary tests and verify shell expansion is disabled.' },
  { id: 'python-shell', title: 'Python shell execution enabled', severity: 'high', pattern: /shell\s*=\s*True/, remediation: 'Use subprocess argument lists with shell=False.', red: 'Review whether external input reaches the command. Design a harmless argument-separation test.', blue: 'Verify subprocess receives an explicit list of arguments and rejects unexpected inputs.' },
  { id: 'debug-mode', title: 'Debug mode enabled', severity: 'medium', pattern: /\bDEBUG\s*=\s*True|debug\s*=\s*True/, remediation: 'Disable debugging in production and isolate development configuration.', red: 'Check a local error fixture for stack traces and sensitive configuration disclosure.', blue: 'Add a production configuration test asserting debug mode is disabled.' },
  { id: 'wildcard-cors', title: 'Wildcard CORS policy', severity: 'medium', pattern: /Access-Control-Allow-Origin['"]?\s*[:,=]\s*['"]\*/, remediation: 'Confirm public cross-origin access is intentional; use an origin allowlist for private APIs.', red: 'Use a local cross-origin fixture to check whether non-public responses are accessible.', blue: 'Test allowed and denied origins, credentials behavior, and preflight responses.' },
  { id: 'jwt-none', title: 'Unsigned JWT algorithm allowed', severity: 'high', pattern: /algorithms\s*:\s*\[[^\]]*['"]none['"]/, remediation: 'Allow only the expected signature algorithm and verify issuer, audience, and expiry.', red: 'Use a locally generated unsigned token fixture against the verifier; expect rejection.', blue: 'Add rejection tests for unsigned tokens, wrong algorithms, wrong audiences, and expired tokens.' },
  { id: 'weak-hash', title: 'Legacy cryptographic hash', severity: 'medium', pattern: /createHash\s*\(\s*['"](?:md5|sha1)['"]|hashlib\.(?:md5|sha1)\s*\(/i, remediation: 'Determine whether this hash protects security-sensitive data. Use modern hashes for integrity and a password hashing library for passwords.', red: 'Trace the digest to its consumer; distinguish non-security checksums from authentication or integrity decisions.', blue: 'Add tests for the replacement algorithm and document any non-security use that remains.' },
  { id: 'insecure-cookie', title: 'Cookie protection explicitly disabled', severity: 'medium', pattern: /(?:httpOnly|secure)\s*:\s*false/, remediation: 'For session cookies, enable HttpOnly and Secure and choose an appropriate SameSite policy.', red: 'Inspect a local session response and establish whether the affected options actually configure a sensitive cookie.', blue: 'Assert cookie attributes in authentication integration tests over HTTPS.' },
  { id: 'unsafe-yaml', title: 'Potentially unsafe YAML deserialization', severity: 'high', pattern: /yaml\.(?:unsafe_load|load)\s*\(/, remediation: 'Use safe_load for untrusted YAML. A safe Loader on yaml.load may make this match a false positive.', red: 'Trace YAML provenance and inspect the loader. Use a harmless custom-tag fixture in an isolated environment.', blue: 'Assert custom object tags are rejected and ordinary data still parses.' },
  { id: 'pickle-load', title: 'Pickle deserialization boundary', severity: 'high', pattern: /pickle\.loads?\s*\(/, remediation: 'Never deserialize untrusted pickle data. Prefer a data-only format with schema validation.', red: 'Map every producer of this serialized data and identify whether untrusted users can supply it.', blue: 'Add tests that reject untrusted serialized objects before parsing; migrate the boundary to a data-only format.' },
  { id: 'php-unserialize', title: 'PHP object deserialization', severity: 'high', pattern: /\bunserialize\s*\(/, remediation: 'Prefer JSON plus schema validation for untrusted data and avoid PHP object deserialization.', red: 'Trace input provenance and inspect allowed_classes. Use inert object fixtures in a disposable test environment.', blue: 'Test malformed input and object rejection and verify migration to a data-only format.' },
  { id: 'sql-template', title: 'Interpolated SQL statement', severity: 'high', pattern: /\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^\r\n]*\$\{/i, remediation: 'Check whether this is a parameterizing SQL tag. Otherwise replace interpolation with bound parameters.', red: 'Trace interpolated values to their source and verify parameter binding with an inert quote-containing fixture.', blue: 'Assert query text and bound values are sent separately; include input with quotes in regression fixtures.' },
  { id: 'privileged-container', title: 'Privileged container configuration', severity: 'high', pattern: /\bprivileged\s*:\s*true\b/, remediation: 'Remove privileged mode where possible; explicitly grant only required capabilities.', red: 'Review the effective container capabilities and host mounts without attempting a breakout.', blue: 'Assert privileged mode is absent in deployment manifests and test the workload with least privilege.' },
  { id: 'public-acl', title: 'Public object-storage ACL', severity: 'medium', pattern: /(?:acl|ACL)\s*[:=]\s*['"]public-read(?:-write)?['"]/, remediation: 'Confirm public access is intended. Use private storage and scoped access for sensitive objects.', red: 'Check access to a synthetic object without credentials in an authorized test environment.', blue: 'Assert private objects deny anonymous access and enforce block-public-access settings where appropriate.' },
] as const

export const checkGroups = [
  { name: 'Injection & rendering', ids: ['dynamic-eval', 'html-sink', 'shell-option', 'python-shell', 'sql-template'] },
  { name: 'Identity & cryptography', ids: ['jwt-none', 'weak-hash', 'insecure-cookie'] },
  { name: 'Transport & configuration', ids: ['tls-disabled', 'debug-mode', 'wildcard-cors'] },
  { name: 'Deserialization', ids: ['unsafe-yaml', 'pickle-load', 'php-unserialize'] },
  { name: 'Infrastructure & exposure', ids: ['privileged-container', 'public-acl'] },
]

export function scopeSources(files: SourceFile[], include: string, exclude: string): SourceFile[] {
  const paths = (value: string) => value.split('\n').map(path => path.trim().replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/$/, '')).filter(Boolean)
  const included = paths(include), excluded = paths(exclude)
  const matches = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`)
  return files.filter(file => {
    const path = file.path.replaceAll('\\', '/').replace(/^\.\//, '')
    return (!included.length || included.some(prefix => matches(path, prefix))) && !excluded.some(prefix => matches(path, prefix))
  })
}

export function reviewSources(files: SourceFile[], ruleIds: readonly string[] = rules.map(rule => rule.id)): Finding[] {
  const findings: Finding[] = []
  const selectedRules = rules.filter(rule => ruleIds.includes(rule.id))
  for (const file of files) {
    file.content.split(/\r?\n/).forEach((line, index) => {
      for (const rule of selectedRules) {
        if (rule.pattern.test(line)) findings.push({ id: `${file.path}:${index + 1}:${rule.id}`, rule: rule.id, title: rule.title, severity: rule.severity, path: file.path, line: index + 1, remediation: rule.remediation, red: rule.red, blue: rule.blue })
      }
    })
  }
  return findings
}

export function sourcePathAllowed(path: string): boolean {
  const parts = path.replaceAll('\\', '/').split('/')
  return !parts.some((part) => ['..', '.git', 'node_modules', '.next', 'dist', 'vendor'].includes(part)) && !parts.some((part) => /^\.env(?:\.|$)/i.test(part) || /\.(?:pem|key|p12|pfx)$/i.test(part)) && /(?:\.(?:[cm]?[jt]sx?|py|rb|go|rs|java|cs|php|json|ya?ml|toml|sh|html|css|tf|md|txt)|Dockerfile)$/i.test(path)
}

export function toSarif(findings: Finding[], ruleIds: readonly string[] = rules.map(rule => rule.id), paths: readonly string[] = []) {
  return { version: '2.1.0', $schema: 'https://json.schemastore.org/sarif-2.1.0.json', runs: [{ artifacts: paths.map(path => ({ location: { uri: path.split('/').map(encodeURIComponent).join('/') } })), tool: { driver: { name: 'OmniForge local pattern review', rules: rules.filter(rule => ruleIds.includes(rule.id)).map((rule) => ({ id: rule.id, shortDescription: { text: rule.title } })) } }, results: findings.map((finding) => ({ ruleId: finding.rule, level: 'warning', message: { text: `${finding.title}. ${finding.remediation} Requires manual verification.` }, locations: [{ physicalLocation: { artifactLocation: { uri: finding.path.split('/').map(encodeURIComponent).join('/') }, region: { startLine: finding.line } } }] })) }] }
}
