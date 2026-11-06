'use client'

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, FileCode2, Search } from 'lucide-react'
import type { SourceFile } from '../lib/security-review'
import { searchSources } from '../lib/source-inspection'
import styles from './source-explorer.module.css'

export default function SourceExplorer({ files }: { files: SourceFile[] }) {
  const [query, setQuery] = useState(''), [caseSensitive, setCaseSensitive] = useState(false)
  const [fileIndex, setFileIndex] = useState(0), [page, setPage] = useState(0), [highlight, setHighlight] = useState<number | null>(null)
  const viewer = useRef<HTMLDivElement>(null)
  const deferredQuery = useDeferredValue(query)
  const result = useMemo(() => searchSources(files, deferredQuery, caseSensitive), [files, deferredQuery, caseSensitive])
  const file = files[fileIndex]
  const lines = useMemo(() => file?.content.split('\n') || [], [file])
  const pages = Math.max(1, Math.ceil(lines.length / 100))
  useEffect(() => { setFileIndex(0); setPage(0); setHighlight(null); setQuery('') }, [files])
  function jump(index: number, line: number) { setFileIndex(index); setPage(Math.floor((line - 1) / 100)); setHighlight(line); requestAnimationFrame(() => viewer.current?.focus()) }
  return <details className={styles.explorer}>
    <summary><FileCode2 size={17} /><span>Inspect scoped source</span><small>{files.length} files</small></summary>
    <div className={styles.body}>
      <p>Read-only, local inspection. Search is literal—not executable regex. Only files in the current path scope are shown.</p>
      {!files.length ? <p>No files in the current scope. Import source and adjust your path filters.</p> : <>
        <label><Search size={14} /> Search source<input type="search" value={query} maxLength={500} onChange={event => setQuery(event.target.value)} placeholder="e.g. rejectUnauthorized" /></label>
        <label className={styles.check}><input type="checkbox" checked={caseSensitive} onChange={event => setCaseSensitive(event.target.checked)} /> Match case</label>
        {query && <div className={styles.hits} aria-busy={query !== deferredQuery}><p role="status">{result.matchingLines} matching lines{result.truncated ? ' · showing first 100' : ''}</p>{result.hits.map(hit => <button key={`${hit.fileIndex}:${hit.line}`} onClick={() => jump(hit.fileIndex, hit.line)}><strong>{hit.path}:{hit.line}</strong><code>{hit.excerpt}</code></button>)}</div>}
        <label>Source file<select value={fileIndex} onChange={event => { setFileIndex(Number(event.target.value)); setPage(0); setHighlight(null) }}>{files.map((source, index) => <option key={`${source.path}:${index}`} value={index}>{source.path}</option>)}</select></label>
        <div className={styles.pagination}><button aria-label="Previous source page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></button><span>Lines {page * 100 + 1}–{Math.min((page + 1) * 100, lines.length)} of {lines.length}</span><button aria-label="Next source page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></button></div>
        <div ref={viewer} tabIndex={0} className={styles.source} role="region" aria-label={`Source preview: ${file?.path || ''}`}>{lines.slice(page * 100, (page + 1) * 100).map((line, index) => <div key={page * 100 + index} data-highlight={highlight === page * 100 + index + 1}><span aria-hidden="true">{page * 100 + index + 1}</span><code>{line || ' '}</code></div>)}</div>
        <p>Source content stays out of scan exports. It may contain sensitive data; be careful when copying it.</p>
      </>}
    </div>
  </details>
}
