'use client'

import { checkGroups, rules } from '../lib/security-review'
import styles from './security-lab.module.css'

type Props = {
  selected: string[]; onSelect: (ids: string[]) => void;
  include: string; exclude: string; onScope: (include: string, exclude: string) => void;
  total: number; scoped: number;
}

export default function TestConfiguration({ selected, onSelect, include, exclude, onScope, total, scoped }: Props) {
  return <section className={styles.configuration} aria-labelledby="check-title">
    <div className={styles.sectionHeading}><span className={styles.step}>03</span><div><h2 id="check-title">Choose exactly what to check</h2><p>{selected.length} of {rules.length} local heuristics · no code execution</p></div></div>
    <div className={styles.presets} role="group" aria-label="Check presets">
      <button onClick={() => onSelect(rules.map(rule => rule.id))}>All checks</button>
      <button onClick={() => onSelect(checkGroups.slice(0, 3).flatMap(group => group.ids))}>Web & API</button>
      <button onClick={() => onSelect([...checkGroups[2].ids, ...checkGroups[4].ids])}>Infrastructure</button>
      <button onClick={() => onSelect([])}>Clear</button>
    </div>
    <div className={styles.checkGroups}>{checkGroups.map(group => <details key={group.name}><summary><span>{group.name}</span><span>{group.ids.filter(id => selected.includes(id)).length}/{group.ids.length}</span></summary><div className={styles.checkOptions}>{rules.filter(rule => group.ids.includes(rule.id)).map(rule => <label key={rule.id}><input type="checkbox" checked={selected.includes(rule.id)} onChange={event => onSelect(event.target.checked ? [...selected, rule.id] : selected.filter(id => id !== rule.id))} /><span><strong>{rule.title}</strong><small>{rule.severity} priority · {rule.id}</small></span></label>)}</div></details>)}</div>
    <details className={styles.scopeSettings}><summary>File & folder targeting <span>{scoped}/{total} files</span></summary><p className={styles.disclaimer}>Exact file paths or folder prefixes, one per line, relative to the imported root. No wildcards. Exclusions win. This scope also applies to isolated validation.</p><label>Include paths<textarea rows={2} placeholder={'src/api\nsrc/auth.ts'} value={include} onChange={event => onScope(event.target.value, exclude)} /></label><label>Exclude paths<textarea rows={2} placeholder={'src/api/fixtures'} value={exclude} onChange={event => onScope(include, event.target.value)} /></label><p className={styles.disclaimer}>Leave includes empty for all imported files. Folder uploads may include the folder name in each path; check the file list above.</p></details>
    {total > 0 && scoped === 0 && <p role="status" className={styles.status}>No files match these paths. Adjust the scope before running.</p>}
    {selected.length === 0 && <p role="status" className={styles.status}>Select at least one check to run a local review.</p>}
  </section>
}
