import type { NextConfig } from 'next'

// The macOS app bundles a self-contained server; web deployments keep Vercel's default output.
const desktop = process.env.OMNIFORGE_DESKTOP_BUILD === '1'

const nextConfig: NextConfig = desktop
  ? { output: 'standalone', images: { unoptimized: true }, outputFileTracingExcludes: { '*': ['**/node_modules/sharp/**', '**/node_modules/@img/**', '**/node_modules/.pnpm/sharp@*/**', '**/node_modules/.pnpm/@img+*/**'] } }
  : {}

export default nextConfig
