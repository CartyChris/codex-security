import type { Metadata, Viewport } from 'next'
import './globals.css'
import WorkspaceTheme from '../components/workspace-theme'

export const metadata: Metadata = { title: 'OmniForge | Security Workspace', description: 'Evidence-led source review, granular security checks, and red, blue, and purple team verification plans for authorized codebases.', manifest: '/manifest.webmanifest' }
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f6f7fb' }, { media: '(prefers-color-scheme: dark)', color: '#0b101b' }] }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" suppressHydrationWarning><head><WorkspaceTheme /></head><body>{children}</body></html> }
