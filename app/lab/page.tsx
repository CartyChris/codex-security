import type { Metadata } from 'next'
import SecurityLab from '../../components/security-lab'

export const metadata: Metadata = {
  title: 'Security Lab | OmniForge',
  description: 'Review source code locally with line-level evidence, red and blue team verification plans, and portable SARIF reports.',
}

export default async function LabPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const { team } = await searchParams
  return <SecurityLab initialMode={team === 'red' || team === 'blue' ? team : 'purple'} />
}
