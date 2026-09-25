// Packages OmniForge.app for Apple Silicon and Intel Macs, signs each bundle ad hoc, and zips it.
// Usage: node scripts/package-mac.mjs [--arch=arm64|x64|all] [--platform=darwin|linux]
//   ELECTRON_ZIP_DIR=<dir> uses Electron release zips already downloaded to <dir>.
//   --platform=linux builds a Linux copy of the same app, used to smoke-test the shell off a Mac.
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packager } from '@electron/packager'

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(desktop, 'dist')
const option = (name, fallback) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ?? fallback
const platform = option('platform', 'darwin')
const archOption = option('arch', 'all')
const arch = archOption === 'all' ? (platform === 'darwin' ? ['arm64', 'x64'] : ['x64']) : [archOption]

if (!existsSync(join(desktop, 'server', 'server.js'))) {
  throw new Error('desktop/server is missing. Run "npm run prepare-server" first.')
}

const appPaths = await packager({
  dir: desktop,
  out: dist,
  platform,
  arch,
  name: 'OmniForge',
  executableName: platform === 'darwin' ? 'OmniForge' : 'omniforge',
  appBundleId: 'app.omniforge.harness',
  appCategoryType: 'public.app-category.developer-tools',
  appCopyright: 'OmniForge Cyber AI',
  icon: join(desktop, 'build', 'icon.icns'),
  darwinDarkModeSupport: true,
  asar: true,
  overwrite: true,
  ...(process.env.ELECTRON_ZIP_DIR ? { electronZipDir: process.env.ELECTRON_ZIP_DIR } : {}),
  prune: true,
  extraResource: [join(desktop, 'server')],
  ignore: [/^\/server($|\/)/, /^\/dist($|\/)/, /^\/scripts($|\/)/, /^\/build($|\/)/, /^\/README\.md$/],
  extendInfo: { NSHumanReadableCopyright: 'OmniForge Cyber AI security harness', LSMinimumSystemVersion: '12.0' },
})

function adHocSign(appPath) {
  if (process.platform === 'darwin') {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
    return
  }
  const rcodesign = process.env.RCODESIGN || 'rcodesign'
  execFileSync(rcodesign, ['sign', appPath], { stdio: 'inherit' })
}

for (const out of appPaths) {
  if (platform !== 'darwin') {
    console.log(`Built ${out}`)
    continue
  }
  const bundle = join(out, 'OmniForge.app')
  adHocSign(bundle)
  const archName = out.endsWith('arm64') ? 'apple-silicon' : 'intel'
  const zip = join(dist, `OmniForge-macOS-${archName}.zip`)
  rmSync(zip, { force: true })
  // -y keeps the framework symlinks that macOS app bundles depend on.
  execFileSync('zip', ['-qry', zip, 'OmniForge.app'], { cwd: out, stdio: 'inherit' })
  console.log(`Built ${zip}`)
}
