'use client'
import { useWorkspace } from './connected-workspace'
import styles from './connected-workspace.module.css'
export default function ExecutionFeed() {
  const { state } = useWorkspace()
  return <details className={styles.context}><summary>Execution telemetry <span>{state.events.length} events</span></summary><p>Actual model lifecycle, tool inputs/results and reported token usage. Decision summaries appear in model output; private chain-of-thought is not exposed. Latest 250 events retained.</p><div className={styles.feed}>{state.events.length ? state.events.slice().reverse().map(e => <article key={e.id}><small>{e.at} · {e.actor}</small><strong>{e.type}</strong><pre>{e.detail}</pre></article>) : <p>No execution events yet.</p>}</div></details>
}
