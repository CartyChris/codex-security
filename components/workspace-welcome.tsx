'use client'

import Link from 'next/link'
import { ArrowRight, Crosshair, FlaskConical, GitBranch, Shield, Sparkles } from 'lucide-react'

export default function WorkspaceWelcome({ onPrompt }: { onPrompt: (text: string) => void }) {
  return <div className="welcome">
    <div className="workspace-kicker"><span className="live-dot" /> SECURITY WORKSPACE <span className="workspace-index">01 / EXPLORE</span></div>
    <h1>Think adversarial.<br /><span>Build resilient.</span></h1>
    <p>Your code. Your scope. Explore the attack surface, validate defenses, and turn evidence into action.</p>
    <div className="mission-cards">
      <Link href="/lab?team=red" className="mission-card" data-team="red"><div className="mission-icon"><Crosshair size={19} /><span>01</span></div><strong>Red team</strong><span>Challenge the attack surface</span><ArrowRight size={16} className="mission-arrow" /></Link>
      <Link href="/lab?team=blue" className="mission-card" data-team="blue"><div className="mission-icon"><Shield size={19} /><span>02</span></div><strong>Blue team</strong><span>Verify the defenses</span><ArrowRight size={16} className="mission-arrow" /></Link>
      <Link href="/lab?team=purple" className="mission-card" data-team="purple"><div className="mission-icon"><FlaskConical size={19} /><span>03</span></div><strong>Purple team</strong><span>Connect attack & detection</span><ArrowRight size={16} className="mission-arrow" /></Link>
    </div>
    <Link href="/lab" className="scope-entry"><span className="scope-entry-icon"><GitBranch size={20} /></span><span><strong>Start with your codebase</strong><small>GitHub repo, local files, or a project folder</small></span><ArrowRight size={18} /></Link>
    <div className="prompt-heading"><Sparkles size={13} /> OR THINK IT THROUGH WITH AI</div>
    <div className="suggestions"><button onClick={() => onPrompt('Help me threat-model an application. First ask about its assets, trust boundaries, authentication, and deployment architecture.')}>Threat model <ArrowRight size={13} /></button><button onClick={() => onPrompt('Help me create an incident response plan for a suspected credential leak. Start by asking about the environment and available evidence.')}>Incident response <ArrowRight size={13} /></button><button onClick={() => onPrompt('Help me review an API security design. Ask me for its authorization model, endpoints, and source code before making findings.')}>API hardening <ArrowRight size={13} /></button></div>
  </div>
}
