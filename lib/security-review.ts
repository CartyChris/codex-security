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
] as const

export function reviewSources(files: SourceFile[]): Finding[] {
  const findings: Finding[] = []
  for (const file of files) {
    file.content.split(/\r?\n/).forEach((line, index) => {
      for (const rule of rules) {
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

export function toSarif(findings: Finding[]) {
  return { version: '2.1.0', $schema: 'https://json.schemastore.org/sarif-2.1.0.json', runs: [{ tool: { driver: { name: 'OmniForge local pattern review', rules: rules.map((rule) => ({ id: rule.id, shortDescription: { text: rule.title } })) } }, results: findings.map((finding) => ({ ruleId: finding.rule, level: 'warning', message: { text: `${finding.title}. ${finding.remediation} Requires manual verification.` }, locations: [{ physicalLocation: { artifactLocation: { uri: finding.path.split('/').map(encodeURIComponent).join('/') }, region: { startLine: finding.line } } }] })) }] }
}
