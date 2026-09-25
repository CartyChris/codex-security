export type Severity = 'High' | 'Medium' | 'Low'
export type View = 'overview' | 'findings' | 'history' | 'chat'
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
}

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

export const accents = ['violet', 'teal', 'blue', 'coral']

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
