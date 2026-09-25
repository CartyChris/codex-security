// Reference data for the ATT&CK, compliance, secrets, and models views.

// ---------- MITRE ATT&CK (Enterprise) ----------
export type Technique = { id: string; name: string }
export type Tactic = { id: string; name: string; techniques: Technique[] }

export const attackTactics: Tactic[] = [
  { id: 'TA0043', name: 'Reconnaissance', techniques: [{ id: 'T1595', name: 'Active Scanning' }, { id: 'T1592', name: 'Gather Victim Host Information' }, { id: 'T1589', name: 'Gather Victim Identity Information' }] },
  { id: 'TA0042', name: 'Resource Development', techniques: [{ id: 'T1583', name: 'Acquire Infrastructure' }, { id: 'T1588', name: 'Obtain Capabilities' }] },
  { id: 'TA0001', name: 'Initial Access', techniques: [{ id: 'T1190', name: 'Exploit Public-Facing Application' }, { id: 'T1566', name: 'Phishing' }, { id: 'T1195', name: 'Supply Chain Compromise' }, { id: 'T1078', name: 'Valid Accounts' }] },
  { id: 'TA0002', name: 'Execution', techniques: [{ id: 'T1059', name: 'Command and Scripting Interpreter' }, { id: 'T1203', name: 'Exploitation for Client Execution' }, { id: 'T1204', name: 'User Execution' }] },
  { id: 'TA0003', name: 'Persistence', techniques: [{ id: 'T1098', name: 'Account Manipulation' }, { id: 'T1136', name: 'Create Account' }, { id: 'T1505', name: 'Server Software Component' }] },
  { id: 'TA0004', name: 'Privilege Escalation', techniques: [{ id: 'T1068', name: 'Exploitation for Privilege Escalation' }, { id: 'T1548', name: 'Abuse Elevation Control Mechanism' }] },
  { id: 'TA0005', name: 'Defense Evasion', techniques: [{ id: 'T1562', name: 'Impair Defenses' }, { id: 'T1070', name: 'Indicator Removal' }, { id: 'T1027', name: 'Obfuscated Files or Information' }] },
  { id: 'TA0006', name: 'Credential Access', techniques: [{ id: 'T1110', name: 'Brute Force' }, { id: 'T1552', name: 'Unsecured Credentials' }, { id: 'T1528', name: 'Steal Application Access Token' }] },
  { id: 'TA0007', name: 'Discovery', techniques: [{ id: 'T1087', name: 'Account Discovery' }, { id: 'T1046', name: 'Network Service Discovery' }, { id: 'T1526', name: 'Cloud Service Discovery' }] },
  { id: 'TA0008', name: 'Lateral Movement', techniques: [{ id: 'T1021', name: 'Remote Services' }, { id: 'T1550', name: 'Use Alternate Authentication Material' }] },
  { id: 'TA0009', name: 'Collection', techniques: [{ id: 'T1530', name: 'Data from Cloud Storage' }, { id: 'T1213', name: 'Data from Information Repositories' }] },
  { id: 'TA0011', name: 'Command and Control', techniques: [{ id: 'T1071', name: 'Application Layer Protocol' }, { id: 'T1105', name: 'Ingress Tool Transfer' }] },
  { id: 'TA0010', name: 'Exfiltration', techniques: [{ id: 'T1041', name: 'Exfiltration Over C2 Channel' }, { id: 'T1567', name: 'Exfiltration Over Web Service' }] },
  { id: 'TA0040', name: 'Impact', techniques: [{ id: 'T1486', name: 'Data Encrypted for Impact' }, { id: 'T1499', name: 'Endpoint Denial of Service' }, { id: 'T1565', name: 'Data Manipulation' }] },
]

// Which techniques each sample finding exposes.
export const findingTechniques: Record<string, string[]> = {
  'F-101': ['T1190', 'T1078', 'T1530'],
  'F-102': ['T1566', 'T1528'],
  'F-103': ['T1195'],
}

export const initialCoverage = ['T1110', 'T1078', 'T1562', 'T1486', 'T1595', 'T1059']

// ---------- Compliance ----------
export type ControlStatus = 'met' | 'partial' | 'gap'
export type Control = { id: string; name: string; status: ControlStatus }
export type Framework = { id: string; name: string; controls: Control[] }

export const frameworks: Framework[] = [
  { id: 'soc2', name: 'SOC 2', controls: [
    { id: 'CC6.1', name: 'Logical access security', status: 'partial' },
    { id: 'CC6.6', name: 'Boundary protection', status: 'met' },
    { id: 'CC7.1', name: 'Vulnerability detection', status: 'met' },
    { id: 'CC7.2', name: 'Security event monitoring', status: 'partial' },
    { id: 'CC7.4', name: 'Incident response', status: 'gap' },
    { id: 'CC8.1', name: 'Change management', status: 'met' },
  ] },
  { id: 'iso27001', name: 'ISO 27001', controls: [
    { id: 'A.5.15', name: 'Access control', status: 'partial' },
    { id: 'A.5.23', name: 'Cloud services security', status: 'met' },
    { id: 'A.8.8', name: 'Technical vulnerabilities', status: 'met' },
    { id: 'A.8.16', name: 'Monitoring activities', status: 'partial' },
    { id: 'A.8.25', name: 'Secure development lifecycle', status: 'met' },
    { id: 'A.8.28', name: 'Secure coding', status: 'gap' },
  ] },
  { id: 'nist', name: 'NIST CSF 2.0', controls: [
    { id: 'GV.RM', name: 'Risk management strategy', status: 'partial' },
    { id: 'ID.AM', name: 'Asset management', status: 'met' },
    { id: 'PR.AA', name: 'Identity & access control', status: 'partial' },
    { id: 'DE.CM', name: 'Continuous monitoring', status: 'met' },
    { id: 'RS.MA', name: 'Incident management', status: 'gap' },
    { id: 'RC.RP', name: 'Recovery plan execution', status: 'gap' },
  ] },
  { id: 'asvs', name: 'OWASP ASVS', controls: [
    { id: 'V2', name: 'Authentication', status: 'met' },
    { id: 'V4', name: 'Access control', status: 'gap' },
    { id: 'V5', name: 'Validation & encoding', status: 'partial' },
    { id: 'V7', name: 'Error handling & logging', status: 'met' },
    { id: 'V13', name: 'API & web service', status: 'partial' },
    { id: 'V14', name: 'Configuration', status: 'met' },
  ] },
  { id: 'pci', name: 'PCI DSS 4.0', controls: [
    { id: '6.2', name: 'Bespoke software security', status: 'partial' },
    { id: '6.3', name: 'Vulnerability management', status: 'met' },
    { id: '7.2', name: 'Access by need to know', status: 'gap' },
    { id: '10.2', name: 'Audit logging', status: 'met' },
    { id: '11.3', name: 'Vulnerability scanning', status: 'met' },
    { id: '12.10', name: 'Incident response plan', status: 'partial' },
  ] },
]

// ---------- Secrets & PII patterns (run locally in the browser) ----------
export type SecretPattern = { id: string; label: string; kind: 'secret' | 'pii'; severity: 'High' | 'Medium' | 'Low'; regex: RegExp }

export const secretPatterns: SecretPattern[] = [
  { id: 'private-key', label: 'Private key block', kind: 'secret', severity: 'High', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g },
  { id: 'aws-access-key', label: 'AWS access key ID', kind: 'secret', severity: 'High', regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'github-token', label: 'GitHub token', kind: 'secret', severity: 'High', regex: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g },
  { id: 'openai-key', label: 'OpenAI / OpenRouter style key', kind: 'secret', severity: 'High', regex: /\bsk-(?:or-v1-|proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { id: 'anthropic-key', label: 'Anthropic API key', kind: 'secret', severity: 'High', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { id: 'stripe-key', label: 'Stripe secret key', kind: 'secret', severity: 'High', regex: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/g },
  { id: 'slack-token', label: 'Slack token', kind: 'secret', severity: 'High', regex: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { id: 'google-api-key', label: 'Google API key', kind: 'secret', severity: 'Medium', regex: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'jwt', label: 'JSON Web Token', kind: 'secret', severity: 'Medium', regex: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { id: 'connection-string', label: 'Credentialed connection string', kind: 'secret', severity: 'High', regex: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@/]+@[^\s/]+/gi },
  { id: 'password-assignment', label: 'Hard-coded password', kind: 'secret', severity: 'Medium', regex: /\b(?:password|passwd|pwd|secret|api_?key|token)\s*[:=]\s*["'][^"'\s]{6,}["']/gi },
  { id: 'email', label: 'Email address', kind: 'pii', severity: 'Low', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { id: 'us-ssn', label: 'US Social Security number', kind: 'pii', severity: 'High', regex: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g },
  { id: 'card-number', label: 'Payment card number', kind: 'pii', severity: 'High', regex: /\b(?:\d[ -]?){13,19}\b/g },
]

export function luhn(value: string) {
  const digits = value.replace(/\D/g, '')
  if (digits.length < 13 || digits.length > 19) return false
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) { digit *= 2; if (digit > 9) digit -= 9 }
    sum += digit
  }
  return sum % 10 === 0
}

export function redact(value: string) {
  if (value.length <= 8) return '•'.repeat(value.length)
  return `${value.slice(0, 4)}${'•'.repeat(Math.min(12, value.length - 6))}${value.slice(-2)}`
}

export type SecretHit = { pattern: SecretPattern; line: number; preview: string; file: string }

export function scanForSecrets(text: string, file = 'pasted input'): SecretHit[] {
  const hits: SecretHit[] = []
  const lines = text.split('\n')
  lines.forEach((line, index) => {
    for (const pattern of secretPatterns) {
      pattern.regex.lastIndex = 0
      for (const match of line.matchAll(pattern.regex)) {
        if (pattern.id === 'card-number' && !luhn(match[0])) continue
        hits.push({ pattern, line: index + 1, preview: redact(match[0].trim()), file })
      }
    }
  })
  return hits
}

// ---------- Curated models (availability is confirmed against the live OpenRouter catalog) ----------
export type CuratedModel = { id: string; name: string; tier: string; use: string; tags: string[] }

export const curatedModels: CuratedModel[] = [
  { id: '~openai/gpt-astra-latest', name: 'GPT Astra Latest', tier: 'Frontier', use: 'Deep audits, architecture, long-context review', tags: ['tools', 'vision', 'reasoning'] },
  { id: '~openai/gpt-sol-latest', name: 'GPT Sol Latest', tier: 'Default', use: 'Balanced security engineering, coding, reports', tags: ['tools', 'vision', 'reasoning'] },
  { id: 'anthropic/claude-opus-5', name: 'Claude Opus 5', tier: 'Frontier', use: 'Complex codebases, multi-step remediation', tags: ['tools', 'vision', 'reasoning'] },
  { id: 'anthropic/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', tier: 'Builder', use: 'Fast implementation, code review, refactors', tags: ['tools', 'vision', 'code'] },
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro', tier: 'Vision', use: 'Large multimodal reviews and diagrams', tags: ['tools', 'vision', 'long-context'] },
  { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash', tier: 'Fast', use: 'High-throughput triage and monitoring summaries', tags: ['tools', 'vision', 'fast'] },
  { id: '~deepseek/deepseek-pro-latest', name: 'DeepSeek Pro Latest', tier: 'Reasoning', use: 'Large code reasoning and static analysis planning', tags: ['tools', 'long-context'] },
  { id: 'qwen/qwen3-coder', name: 'Qwen3 Coder', tier: 'Code', use: 'Code repair, modernization, test generation', tags: ['tools', 'code'] },
  { id: 'x-ai/grok-4-fast', name: 'Grok 4 Fast', tier: 'Research', use: 'Fast research synthesis and adversarial review', tags: ['tools', 'fast'] },
  { id: 'mistralai/codestral-latest', name: 'Codestral Latest', tier: 'Code', use: 'Code generation, patches, typed refactors', tags: ['code', 'fast'] },
  { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', tier: 'Open', use: 'Open-weight security review and coding', tags: ['tools', 'vision', 'open'] },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', tier: 'Budget', use: 'Low-cost everyday questions and summaries', tags: ['tools', 'fast'] },
]
