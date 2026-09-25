// Builds the Next.js app as a self-contained server and copies it into desktop/server,
// which the Electron shell starts on a local port.
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(desktop, '..')
const out = join(desktop, 'server')

if (!process.argv.includes('--skip-build')) {
  execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit', env: { ...process.env, OMNIFORGE_DESKTOP_BUILD: '1', NEXT_TELEMETRY_DISABLED: '1' } })
}

const standalone = join(root, '.next', 'standalone')
if (!existsSync(join(standalone, 'server.js'))) throw new Error('Standalone build missing. Run without --skip-build.')

// pnpm's layout relies on symlinks. Keep links that stay inside the bundle as relative links,
// drop links whose targets were excluded from the trace, and copy anything pointing outside.
function copyTree(from, to) {
  const info = lstatSync(from)
  if (info.isSymbolicLink()) {
    const target = resolve(dirname(from), readlinkSync(from))
    if (!existsSync(target)) return
    const inside = relative(standalone, target)
    if (!inside.startsWith('..')) return symlinkSync(relative(dirname(from), target), to)
    return cpSync(target, to, { recursive: true, dereference: true })
  }
  if (info.isDirectory()) {
    mkdirSync(to, { recursive: true })
    for (const name of readdirSync(from)) copyTree(join(from, name), join(to, name))
    return
  }
  cpSync(from, to)
}

rmSync(out, { recursive: true, force: true })
copyTree(standalone, out)
cpSync(join(root, '.next', 'static'), join(out, '.next', 'static'), { recursive: true })
if (existsSync(join(root, 'public'))) cpSync(join(root, 'public'), join(out, 'public'), { recursive: true })

const size = (dir) => readdirSync(dir).reduce((total, name) => {
  const path = join(dir, name); const info = lstatSync(path)
  return total + (info.isDirectory() ? size(path) : info.isSymbolicLink() ? 0 : info.size)
}, 0)
console.log(`Server ready at ${out} (${(size(out) / 1e6).toFixed(1)} MB)`)
