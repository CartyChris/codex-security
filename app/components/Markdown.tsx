'use client'

import { Fragment, useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'

// Renders the small Markdown subset models usually return. Output is built as React
// elements, so model text is always treated as text and never injected as HTML.

type Block =
  | { type: 'code'; lang: string; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'paragraph'; text: string }

const listItem = /^\s*(?:[-*+]|\d+[.)])\s+/

function parse(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const fence = line.match(/^\s*```\s*([\w+-]*)/)
    if (fence) {
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++])
      i++
      blocks.push({ type: 'code', lang: fence[1], text: body.join('\n') })
      continue
    }
    if (!line.trim()) { i++; continue }
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) { blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] }); i++; continue }
    if (listItem.test(line)) {
      const ordered = /^\s*\d/.test(line)
      const items: string[] = []
      while (i < lines.length && listItem.test(lines[i])) {
        let item = lines[i++].replace(listItem, '')
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !listItem.test(lines[i])) item += ' ' + lines[i++].trim()
        items.push(item)
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = []
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''))
      blocks.push({ type: 'quote', text: body.join(' ') })
      continue
    }
    const body: string[] = []
    while (i < lines.length && lines[i].trim() && !/^\s*```/.test(lines[i]) && !/^#{1,4}\s/.test(lines[i]) && !listItem.test(lines[i])) body.push(lines[i++])
    blocks.push({ type: 'paragraph', text: body.join('\n') })
  }
  return blocks
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={index}>{part.slice(1, -1)}</code>
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>
    return <Fragment key={index}>{part}</Fragment>
  })
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }
  return <button type="button" className="copy-button" onClick={copy} aria-label={copied ? 'Copied' : label}>{copied ? <Check size={13} /> : <Copy size={13} />}<span>{copied ? 'Copied' : label}</span></button>
}

export function Markdown({ text }: { text: string }) {
  return <div className="markdown">{parse(text).map((block, index) => {
    switch (block.type) {
      case 'code':
        return <div className="code-block" key={index}><div className="code-head"><span>{block.lang || 'code'}</span><CopyButton text={block.text} /></div><pre><code>{block.text}</code></pre></div>
      case 'heading':
        return <p className={`md-heading h${block.level}`} key={index}>{inline(block.text)}</p>
      case 'list': {
        const List = block.ordered ? 'ol' : 'ul'
        return <List key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}</List>
      }
      case 'quote':
        return <blockquote key={index}>{inline(block.text)}</blockquote>
      default:
        return <p key={index}>{inline(block.text)}</p>
    }
  })}</div>
}
