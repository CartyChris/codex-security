import type { Sandbox } from '@vercel/sandbox'
import type { SourceFile } from './security-review'

export const SEMGREP_VERSION = '1.182.1'
export const semgrepRules = { rules: [
  { id: 'js-dynamic-eval', languages: ['javascript', 'typescript'], severity: 'WARNING', message: 'Dynamic evaluation requires review for untrusted input.', pattern: 'eval($INPUT)' },
  { id: 'js-dom-html', languages: ['javascript', 'typescript'], severity: 'WARNING', message: 'HTML assignment requires review for untrusted input.', pattern: '$EL.innerHTML = $HTML' },
  { id: 'js-disabled-tls', languages: ['javascript', 'typescript'], severity: 'WARNING', message: 'TLS certificate verification is disabled.', pattern: '{rejectUnauthorized: false, ...}' },
  { id: 'python-eval', languages: ['python'], severity: 'WARNING', message: 'Dynamic evaluation requires review for untrusted input.', pattern: 'eval(...)' },
  { id: 'python-shell', languages: ['python'], severity: 'WARNING', message: 'Shell execution requires review for untrusted input.', pattern: 'subprocess.$METHOD(..., shell=True, ...)' },
] }

export async function scanSemgrep(sandbox: Sandbox, files: SourceFile[]) {
  const installed = await sandbox.runCommand('python', ['-m', 'pip', 'install', '--disable-pip-version-check', `semgrep==${SEMGREP_VERSION}`])
  if (installed.exitCode !== 0) throw new Error('Semgrep installation failed before source upload.')
  await sandbox.updateNetworkPolicy('deny-all')
  const root = '/vercel/sandbox/scope'
  await sandbox.writeFiles([
    { path: '/vercel/sandbox/rules.json', content: Buffer.from(JSON.stringify(semgrepRules)) },
    ...files.map(file => ({ path: `${root}/${file.path}`, content: Buffer.from(file.content) })),
  ])
  const command = await sandbox.runCommand({ cmd: 'semgrep', args: ['scan', '--config', '/vercel/sandbox/rules.json', '--json', '--metrics=off', '--disable-version-check', '--no-git-ignore', '.'], cwd: root })
  if (command.exitCode !== 0) throw new Error('Semgrep did not complete successfully. No complete scan verdict is available.')
  const output = JSON.parse(await command.stdout()) as { results: { check_id: string; path: string; start: { line: number }; extra: { severity: string; message: string } }[]; errors: unknown[]; paths: { scanned: string[] }; version: string }
  return {
    engine: 'Semgrep CE', version: output.version, ruleIds: semgrepRules.rules.map(rule => rule.id),
    scannedPaths: output.paths.scanned, errorCount: output.errors.length,
    findings: output.results.map(result => ({ rule: result.check_id, path: result.path, line: result.start.line, severity: result.extra.severity, message: result.extra.message })),
  }
}
