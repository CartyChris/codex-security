import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'OmniForge Harness', description: 'OmniForge Cyber AI application security testing harness' }
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f4f5f8' }, { media: '(prefers-color-scheme: dark)', color: '#101014' }],
}

// Applies saved appearance before first paint so the page does not flash the wrong theme.
const preferences = `try{var d=document.documentElement;d.dataset.theme=localStorage.getItem('omniforge-theme')||'system';d.dataset.accent=localStorage.getItem('omniforge-accent')||'violet';d.dataset.compact=localStorage.getItem('omniforge-compact')==='true'?'true':'false'}catch(e){}`

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: preferences }} /></head><body>{children}</body></html>
}
