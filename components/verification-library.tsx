'use client'

import { useState } from 'react'
import { Download, BookOpen } from 'lucide-react'
import { buildVerificationPlan, verificationPlans, type TeamMode } from '../lib/verification-plans'
import styles from './security-lab.module.css'

export default function VerificationLibrary({ mode, paths }: { mode: TeamMode; paths: string[] }) {
  const [selected, setSelected] = useState<string[]>([])
  function download() {
    const url = URL.createObjectURL(new Blob([buildVerificationPlan(mode, selected, paths)], { type: 'text/markdown' }))
    const anchor = document.createElement('a')
    anchor.href = url; anchor.download = 'omniforge-verification-plan.md'; anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return <section className={styles.library} aria-labelledby="library-title" data-team={mode}>
    <div className={styles.sectionHeading}><span className={styles.step}><BookOpen size={17} /></span><div><h2 id="library-title">Go beyond pattern matching</h2><p>Expert test procedures · guided, not executed</p></div></div>
    <p className={styles.disclaimer}>Build a {mode}-team verification plan for authorization, runtime behavior, and detection coverage. Expand a test to inspect its procedure. Exported plans contain paths, not source code.</p>
    <div className={styles.libraryGrid}>{verificationPlans.map(plan => <article key={plan.id} className={styles.playbook}><label><input type="checkbox" checked={selected.includes(plan.id)} onChange={event => setSelected(event.target.checked ? [...selected, plan.id] : selected.filter(id => id !== plan.id))} /><span><strong>{plan.title}</strong><small>{plan.reference}</small></span></label><details><summary>View procedure</summary>{mode !== 'blue' && <div className={styles.plan} data-team="red"><strong>Adversarial validation</strong><p>{plan.red}</p></div>}{mode !== 'red' && <div className={styles.plan} data-team="blue"><strong>Defensive validation</strong><p>{plan.blue}</p></div>}<div className={styles.plan}><strong>Required evidence</strong><p>{plan.evidence}</p></div></details></article>)}</div>
    <div className={styles.libraryFooter}><span>{selected.length} procedures selected · not run</span><button className={styles.secondary} disabled={!selected.length} onClick={download}><Download size={15} /> Export test plan</button></div>
  </section>
}
