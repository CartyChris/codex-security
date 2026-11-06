import type { Metadata } from 'next'
import InvestigationWorkbench from '../../components/investigation-workbench'

export const metadata: Metadata = { title: 'Investigation Tools | OmniForge', description: 'Local JWT inspection, UTF-8 codecs, hashing, subnet math, indicator extraction, response-header review, secret-pattern review, and text comparison.' }

export default function ToolsPage() { return <InvestigationWorkbench /> }
