export type Severity = 'High' | 'Medium' | 'Low'
export type View = 'overview' | 'monitoring' | 'findings' | 'remediation' | 'attack' | 'compliance' | 'history' | 'chat' | 'tools' | 'runs' | 'artifacts' | 'workspace' | 'secrets' | 'models' | 'diagnostics'
export type Theme = 'light' | 'dark' | 'system'

export type Finding = {
  id: string
  title: string
  path: string
  severity: Severity
  category: string
  detail: string
  fix: string
  resolved?: boolean
  status?: 'todo' | 'doing' | 'done'
}

export type Run = { id: string; toolKey: string; title: string; input: string; output: string; error?: string; model: string; status: 'running' | 'done' | 'error'; started: number; finished?: number }
export type Artifact = { id: string; name: string; language: string; content: string; source: string; created: number }
export type WorkspaceFile = { id: string; name: string; path: string; size: number; language: string; text: string }
export type AppEvent = { id: string; t: number; kind: 'scan' | 'tool' | 'chat' | 'file' | 'finding' | 'secret' | 'system'; text: string }

export type ScanEvent = {
  id: string
  title: string
  meta: string
  status: 'done' | 'cancelled' | 'info'
}

export type Message = { role: 'user' | 'assistant'; content: string; error?: string }
export type Model = { id: string; name?: string; context_length?: number }

export const severityTone: Record<Severity, string> = { High: 'coral', Medium: 'amber', Low: 'blue' }

export const initialFindings: Finding[] = [
  {
    id: 'F-101',
    title: 'Missing authorization check',
    path: 'src/api/projects/[id]/route.ts',
    severity: 'High',
    category: 'Broken access control',
    detail: 'The project update handler loads a project by ID and writes changes without confirming the caller belongs to the owning workspace.',
    fix: 'Resolve the session user, verify workspace membership before the write, and return 404 for projects outside the caller’s workspace.',
  },
  {
    id: 'F-102',
    title: 'Unvalidated redirect target',
    path: 'src/auth/callback.ts',
    severity: 'Medium',
    category: 'Open redirect',
    detail: 'The OAuth callback redirects to the “next” query parameter without checking that it points back to this application.',
    fix: 'Accept only relative paths that start with a single “/”, or match against an allowlist of known routes.',
  },
  {
    id: 'F-103',
    title: 'Dependency update available',
    path: 'package.json',
    severity: 'Low',
    category: 'Vulnerable dependency',
    detail: 'A transitive dependency has a patched release that addresses a published advisory.',
    fix: 'Update the dependency to the patched version and re-run the test suite.',
  },
]

export const initialHistory: ScanEvent[] = [
  { id: 'E-3', title: 'Full repository scan', meta: 'Today, 09:42 · 1,248 files · 2m 18s', status: 'done' },
  { id: 'E-2', title: 'Threat model refreshed', meta: 'Yesterday, 16:18 · 6 attack paths', status: 'done' },
  { id: 'E-1', title: 'Baseline configured', meta: 'Sep 14, 11:06 · OmniForge Cyber AI', status: 'info' },
]

export const starterModels: Model[] = [
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
  { id: 'mistralai/mistral-large', name: 'Mistral Large' },
]

export const accents = ['violet', 'blue', 'cyan', 'teal', 'emerald', 'amber', 'coral', 'rose']

export const suggestions = [
  { title: 'Review an application', prompt: 'Review this application for the most important security risks and prioritize fixes.' },
  { title: 'Create a response plan', prompt: 'Create a defensive incident response playbook for a suspected credential leak.' },
  { title: 'Harden an API', prompt: 'Explain how to harden an API against common web vulnerabilities.' },
]

export function findingPrompt(finding: Finding) {
  return `Help me fix this ${finding.severity.toLowerCase()} severity finding.\n\nTitle: ${finding.title}\nCategory: ${finding.category}\nLocation: ${finding.path}\nDetails: ${finding.detail}\nSuggested direction: ${finding.fix}\n\nExplain the risk, then give a concrete patch and a test that proves the fix.`
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

export function formatContext(tokens?: number) {
  if (!tokens) return ''
  return tokens >= 1000 ? `${Math.round(tokens / 1000)}K context` : `${tokens} context`
}

const extensions: Record<string, string> = {
  ts: 'TypeScript', tsx: 'TypeScript', js: 'JavaScript', jsx: 'JavaScript', mjs: 'JavaScript', cjs: 'JavaScript', py: 'Python', go: 'Go', rs: 'Rust', java: 'Java', kt: 'Kotlin', swift: 'Swift', rb: 'Ruby', php: 'PHP', cs: 'C#', c: 'C', h: 'C', cpp: 'C++', hpp: 'C++',
  html: 'HTML', css: 'CSS', scss: 'CSS', json: 'JSON', yml: 'YAML', yaml: 'YAML', toml: 'TOML', md: 'Markdown', sql: 'SQL', sh: 'Shell', bash: 'Shell', tf: 'Terraform', dockerfile: 'Dockerfile', env: 'Env', xml: 'XML', lua: 'Lua', gd: 'GDScript',
}

export function languageOf(name: string) {
  const lower = name.toLowerCase()
  if (lower === 'dockerfile' || lower.endsWith('.dockerfile')) return 'Dockerfile'
  if (lower.startsWith('.env')) return 'Env'
  return extensions[lower.split('.').pop() || ''] || 'Other'
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function extractCodeBlocks(text: string) {
  return [...text.matchAll(/```([\w+-]*)\n([\s\S]*?)```/g)].map((match) => ({ language: match[1] || 'text', content: match[2].trimEnd() }))
}

export function uid(prefix: string) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` }
