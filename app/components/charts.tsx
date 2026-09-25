'use client'

import { useId, useMemo, useRef, useState, type ReactNode } from 'react'

// Lightweight SVG charts. Colors come from CSS tokens (--series-*, --status-*) so light and
// dark mode each use their own validated steps.

const fmt = new Intl.NumberFormat()
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })

function niceMax(value: number) {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((candidate) => candidate * power >= value) ?? 10
  return step * power
}

function useWidth(initial = 600) {
  const [width, setWidth] = useState(initial)
  const observer = useRef<ResizeObserver | null>(null)
  const ref = (element: HTMLDivElement | null) => {
    observer.current?.disconnect()
    if (!element) return
    observer.current = new ResizeObserver(([entry]) => setWidth(Math.max(120, Math.floor(entry.contentRect.width))))
    observer.current.observe(element)
  }
  return [width, ref] as const
}

// ---------- Sparkline ----------
export function Sparkline({ values, color = 'var(--series-1)', height = 34 }: { values: number[]; color?: string; height?: number }) {
  const id = useId()
  const width = 120
  if (values.length < 2) return <svg width="100%" height={height} />
  const max = Math.max(...values), min = Math.min(...values)
  const span = max - min || 1
  const points = values.map((value, index) => [(index / (values.length - 1)) * width, height - 3 - ((value - min) / span) * (height - 6)])
  const line = points.map(([x, y], index) => `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('')
  return <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" height={height} aria-hidden="true">
    <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
    <path d={`${line}L${width},${height}L0,${height}Z`} fill={`url(#${id})`} />
    <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
  </svg>
}

// ---------- Line / area chart with crosshair tooltip ----------
export type Series = { id: string; label: string; color: string; values: number[]; area?: boolean }

export function LineChart({ series, times, height = 220, unit = '', format = (value: number) => fmt.format(value) }: { series: Series[]; times: number[]; height?: number; unit?: string; format?: (value: number) => string }) {
  const [width, ref] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const gradient = useId()
  const pad = { top: 12, right: 12, bottom: 26, left: 44 }
  const innerW = Math.max(10, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom
  const count = times.length
  const max = niceMax(Math.max(1, ...series.flatMap((item) => item.values)))
  const x = (index: number) => pad.left + (count > 1 ? (index / (count - 1)) * innerW : 0)
  const y = (value: number) => pad.top + innerH - (value / max) * innerH
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ratio * max)
  const labelEvery = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(innerW / 90))))
  const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  function onMove(event: React.PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - box.left) / box.width
    setHover(Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1)))))
  }

  return <div className="chart" ref={ref}>
    {series.length > 1 && <div className="legend">{series.map((item) => <span key={item.id}><i style={{ background: item.color }} />{item.label}</span>)}</div>}
    <svg width={width} height={height} role="img" aria-label={series.map((item) => item.label).join(', ')}>
      <defs>{series.filter((item) => item.area).map((item) => <linearGradient key={item.id} id={`${gradient}-${item.id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={item.color} stopOpacity=".24" /><stop offset="1" stopColor={item.color} stopOpacity="0" /></linearGradient>)}</defs>
      {ticks.map((tick) => <g key={tick}><line className="grid-line" x1={pad.left} x2={width - pad.right} y1={y(tick)} y2={y(tick)} /><text className="axis-label" x={pad.left - 8} y={y(tick) + 4} textAnchor="end">{compact.format(tick)}</text></g>)}
      {times.map((t, index) => index % labelEvery === 0 && <text key={t} className="axis-label" x={x(index)} y={height - 6} textAnchor="middle">{time(t)}</text>)}
      {series.map((item) => {
        const line = item.values.map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join('')
        return <g key={item.id}>
          {item.area && <path d={`${line}L${x(count - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={`url(#${gradient}-${item.id})`} />}
          <path d={line} fill="none" stroke={item.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        </g>
      })}
      {hover !== null && <g>
        <line className="crosshair" x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} />
        {series.map((item) => <circle key={item.id} cx={x(hover)} cy={y(item.values[hover])} r="4.5" fill={item.color} stroke="var(--solid)" strokeWidth="2" />)}
      </g>}
      <rect x={pad.left} y={pad.top} width={innerW} height={innerH} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
    </svg>
    {hover !== null && <div className="chart-tip" style={{ left: Math.min(width - 160, Math.max(0, x(hover) + 12)), top: pad.top }}>
      <strong>{time(times[hover])}</strong>
      {series.map((item) => <span key={item.id}><i style={{ background: item.color }} />{item.label}<b>{format(item.values[hover])}{unit}</b></span>)}
    </div>}
  </div>
}

// ---------- Donut (part-to-whole, few segments) ----------
export type Segment = { label: string; value: number; color: string; icon?: ReactNode }

export function Donut({ segments, centerLabel }: { segments: Segment[]; centerLabel: string }) {
  const [active, setActive] = useState<number | null>(null)
  const total = segments.reduce((sum, item) => sum + item.value, 0)
  const radius = 58, stroke = 16, circumference = 2 * Math.PI * radius
  const gap = total > 0 && segments.filter((item) => item.value > 0).length > 1 ? 3 : 0
  let offset = 0
  return <div className="donut">
    <svg viewBox="0 0 160 160" width="160" height="160" role="img" aria-label={`${centerLabel}: ${segments.map((item) => `${item.label} ${item.value}`).join(', ')}`}>
      <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      {total > 0 && segments.map((item, index) => {
        const length = (item.value / total) * circumference
        const dash = Math.max(0, length - gap)
        const element = item.value > 0 && <circle key={item.label} cx="80" cy="80" r={radius} fill="none" stroke={item.color} strokeWidth={active === index ? stroke + 4 : stroke} strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset} transform="rotate(-90 80 80)" onPointerEnter={() => setActive(index)} onPointerLeave={() => setActive(null)} style={{ transition: 'stroke-width .15s' }} />
        offset += length
        return element
      })}
      <text x="80" y="78" textAnchor="middle" className="donut-value">{active === null ? total : segments[active].value}</text>
      <text x="80" y="98" textAnchor="middle" className="donut-label">{active === null ? centerLabel : segments[active].label}</text>
    </svg>
    <ul className="donut-legend">{segments.map((item, index) => <li key={item.label} onPointerEnter={() => setActive(index)} onPointerLeave={() => setActive(null)}><i style={{ background: item.color }} />{item.icon}<span>{item.label}</span><b>{item.value}</b></li>)}</ul>
  </div>
}

// ---------- Horizontal bar list (one series, one color) ----------
export function BarList({ items, color = 'var(--series-1)', format = (value: number) => fmt.format(value) }: { items: { label: string; value: number }[]; color?: string; format?: (value: number) => string }) {
  const max = Math.max(1, ...items.map((item) => item.value))
  return <ul className="bar-list">{items.map((item) => <li key={item.label} title={`${item.label}: ${format(item.value)}`}>
    <span className="bar-label">{item.label}</span>
    <span className="bar-track"><span style={{ width: `${(item.value / max) * 100}%`, background: color }} /></span>
    <b>{format(item.value)}</b>
  </li>)}</ul>
}

// ---------- Heatmap (sequential, single hue) ----------
export function Heatmap({ matrix, rows, columns, unit = 'events' }: { matrix: number[][]; rows: string[]; columns: string[]; unit?: string }) {
  const [tip, setTip] = useState<{ row: number; column: number } | null>(null)
  const max = Math.max(1, ...matrix.flat())
  return <div className="heatmap-wrap">
    <div className="heatmap" style={{ gridTemplateColumns: `36px repeat(${columns.length}, 1fr)` }} onPointerLeave={() => setTip(null)}>
      <span />
      {columns.map((column, index) => <span key={column} className="heat-col">{index % 3 === 0 ? column : ''}</span>)}
      {matrix.map((row, rowIndex) => <div key={rows[rowIndex]} className="heat-row">
        <span className="heat-rowlabel">{rows[rowIndex]}</span>
        {row.map((value, columnIndex) => <span key={columnIndex} className="heat-cell" style={{ background: `color-mix(in oklab, var(--series-1) ${Math.round(8 + (value / max) * 92)}%, var(--solid))` }} onPointerEnter={() => setTip({ row: rowIndex, column: columnIndex })} />)}
      </div>)}
    </div>
    <div className="heat-footer">
      <span>{tip ? `${rows[tip.row]} ${columns[tip.column]}:00 — ${matrix[tip.row][tip.column]} ${unit}` : 'Hover a cell for details'}</span>
      <span className="heat-scale">Fewer<i />More</span>
    </div>
  </div>
}

// ---------- Gauge (single headline number) ----------
export function Gauge({ value, label, tone }: { value: number; label: string; tone: string }) {
  const clamped = Math.max(0, Math.min(100, value))
  const radius = 64, length = Math.PI * radius
  return <div className="gauge">
    <svg viewBox="0 0 160 96" width="180" height="108" role="img" aria-label={`${label}: ${clamped} of 100`}>
      <path d="M16 84 A64 64 0 0 1 144 84" fill="none" stroke="var(--line)" strokeWidth="14" strokeLinecap="round" />
      <path d="M16 84 A64 64 0 0 1 144 84" fill="none" stroke={tone} strokeWidth="14" strokeLinecap="round" strokeDasharray={`${(clamped / 100) * length} ${length}`} style={{ transition: 'stroke-dasharray .5s ease' }} />
      <text x="80" y="76" textAnchor="middle" className="gauge-value">{clamped}</text>
    </svg>
    <span>{label}</span>
  </div>
}

// ---------- Topology graph (force layout, clickable nodes) ----------
export type GraphNode = { id: string; label: string; group: 'asset' | 'activity' | 'model' | 'finding'; detail: string; source: string }
export type GraphEdge = { from: string; to: string; label: string }

const groupColor: Record<GraphNode['group'], string> = { asset: 'var(--series-1)', activity: 'var(--series-2)', model: 'var(--series-3)', finding: 'var(--status-critical)' }
const groupGlyph: Record<GraphNode['group'], string> = { asset: 'A', activity: 'R', model: 'M', finding: '!' }
export const graphGroups: { id: GraphNode['group']; label: string }[] = [
  { id: 'asset', label: 'Assets & services' },
  { id: 'activity', label: 'Runs & files' },
  { id: 'model', label: 'Models' },
  { id: 'finding', label: 'Findings' },
]

function layout(nodes: GraphNode[], edges: GraphEdge[], width: number, height: number) {
  const position = new Map(nodes.map((node, index) => {
    const angle = (index / Math.max(1, nodes.length)) * Math.PI * 2
    return [node.id, { x: width / 2 + Math.cos(angle) * width * 0.3, y: height / 2 + Math.sin(angle) * height * 0.3 }]
  }))
  for (let step = 0; step < 220; step++) {
    const force = new Map(nodes.map((node) => [node.id, { x: 0, y: 0 }]))
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = position.get(nodes[i].id)!, b = position.get(nodes[j].id)!
      const dx = a.x - b.x, dy = a.y - b.y
      const distance = Math.max(12, Math.hypot(dx, dy))
      const push = 7200 / (distance * distance)
      force.get(nodes[i].id)!.x += (dx / distance) * push; force.get(nodes[i].id)!.y += (dy / distance) * push
      force.get(nodes[j].id)!.x -= (dx / distance) * push; force.get(nodes[j].id)!.y -= (dy / distance) * push
    }
    for (const edge of edges) {
      const a = position.get(edge.from), b = position.get(edge.to)
      if (!a || !b) continue
      const dx = b.x - a.x, dy = b.y - a.y
      const distance = Math.max(1, Math.hypot(dx, dy))
      const pull = (distance - 150) * 0.02
      force.get(edge.from)!.x += (dx / distance) * pull; force.get(edge.from)!.y += (dy / distance) * pull
      force.get(edge.to)!.x -= (dx / distance) * pull; force.get(edge.to)!.y -= (dy / distance) * pull
    }
    for (const node of nodes) {
      const point = position.get(node.id)!, push = force.get(node.id)!
      point.x += Math.max(-24, Math.min(24, push.x)) + (width / 2 - point.x) * 0.006
      point.y += Math.max(-24, Math.min(24, push.y)) + (height / 2 - point.y) * 0.012
      point.x = Math.max(40, Math.min(width - 40, point.x))
      point.y = Math.max(28, Math.min(height - 28, point.y))
    }
  }
  return position
}

export function TopologyGraph({ nodes, edges, selected, onSelect, height = 380 }: { nodes: GraphNode[]; edges: GraphEdge[]; selected: string | null; onSelect: (id: string | null) => void; height?: number }) {
  const [width, ref] = useWidth(700)
  const position = useMemo(() => layout(nodes, edges, width, height), [nodes, edges, width, height])
  const linked = new Set(selected ? edges.flatMap((edge) => (edge.from === selected || edge.to === selected ? [edge.from, edge.to] : [])) : [])
  return <div className="topology" ref={ref}>
    <svg width={width} height={height} role="img" aria-label="Harness topology graph" onClick={(event) => { if (event.target === event.currentTarget) onSelect(null) }}>
      {edges.map((edge, index) => {
        const a = position.get(edge.from), b = position.get(edge.to)
        if (!a || !b) return null
        const on = selected && (edge.from === selected || edge.to === selected)
        return <line key={index} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={on ? 'edge on' : selected ? 'edge dim' : 'edge'} />
      })}
      {nodes.map((node) => {
        const point = position.get(node.id)!
        const dim = selected && node.id !== selected && !linked.has(node.id)
        return <g key={node.id} transform={`translate(${point.x},${point.y})`} className={dim ? 'node dim' : node.id === selected ? 'node on' : 'node'} onClick={() => onSelect(node.id === selected ? null : node.id)} role="button" tabIndex={0} aria-label={`${node.label}, ${node.group}`} onKeyDown={(event) => { if (event.key === 'Enter') onSelect(node.id) }}>
          <circle r="20" className="node-hit" />
          <circle r={node.group === 'finding' ? 13 : 11} fill={groupColor[node.group]} stroke="var(--solid)" strokeWidth="2" />
          <text className="node-glyph" y="4" textAnchor="middle">{groupGlyph[node.group]}</text>
          <text className="node-label" y="28" textAnchor="middle">{node.label.length > 20 ? `${node.label.slice(0, 19)}…` : node.label}</text>
        </g>
      })}
    </svg>
  </div>
}

export { fmt, compact }
