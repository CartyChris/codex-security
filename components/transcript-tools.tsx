'use client'

import { useRef, useState, type ChangeEvent } from 'react'
import Link from 'next/link'
import { Download, Upload, Wrench } from 'lucide-react'
import { exportTranscript, MAX_TRANSCRIPT_BYTES, parseTranscript, transcriptMarkdown, type TranscriptMessage } from '../lib/transcripts'
import styles from './transcript-tools.module.css'

export default function TranscriptTools({ messages, onImport, onBusyChange, disabled }: { messages: TranscriptMessage[]; onImport: (messages: TranscriptMessage[]) => void; onBusyChange: (busy: boolean) => void; disabled: boolean }) {
  const picker = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState(''), [importing, setImporting] = useState(false)
  function download(format: 'json' | 'md') {
    const content = format === 'json' ? JSON.stringify(exportTranscript(messages), null, 2) : transcriptMarkdown(messages)
    const url = URL.createObjectURL(new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown' }))
    const link = document.createElement('a'); link.href = url; link.download = `omniforge-transcript.${format}`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Exported conversation text only. Settings and stored API keys were not included.')
  }
  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file || disabled || importing) return
    setImporting(true); onBusyChange(true); setStatus('')
    try {
      if (file.size > MAX_TRANSCRIPT_BYTES) throw new Error('Transcript must be 2 MB or smaller.')
      const imported = parseTranscript(await file.text())
      if (messages.length && !window.confirm('Replace this conversation with the imported transcript? Export the current conversation first if you need to keep it.')) return
      onImport(imported); setStatus(`Imported ${imported.length} messages into this view. Nothing was sent to a model.`)
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not import transcript.') }
    finally { setImporting(false); onBusyChange(false) }
  }
  return <details className={styles.tools}><summary>Conversation tools</summary><div className={styles.body}>
    <div className={styles.actions}><button disabled={disabled || importing || !messages.length} onClick={() => download('md')}><Download size={14} /> Markdown</button><button disabled={disabled || importing || !messages.length} onClick={() => download('json')}><Download size={14} /> JSON</button><button disabled={disabled || importing} onClick={() => picker.current?.click()}><Upload size={14} />{importing ? 'Importing…' : 'Import JSON'}</button><Link href="/tools"><Wrench size={14} /> Local tools</Link></div>
    <input ref={picker} hidden type="file" accept="application/json,.json" onChange={importFile} />
    <p>Exports contain your message text, including anything sensitive you pasted. They exclude stored keys and settings. Imports stay in this view until you send a message; then up to the last 30 messages go to OpenRouter. Refreshing clears the conversation.</p>
    {status && <p role="status">{status}</p>}
  </div></details>
}
