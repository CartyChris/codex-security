import type { SourceFile } from './security-review'

export function searchSources(files: SourceFile[], query: string, caseSensitive: boolean) {
  const needle = caseSensitive ? query : query.toLowerCase()
  const hits: { fileIndex: number; path: string; line: number; excerpt: string }[] = []
  let matchingLines = 0
  if (!needle) return { hits, matchingLines, truncated: false }
  for (const [fileIndex, file] of files.entries()) {
    for (const [index, line] of file.content.split('\n').entries()) {
      const position = (caseSensitive ? line : line.toLowerCase()).indexOf(needle)
      if (position < 0) continue
      matchingLines++
      if (hits.length < 100) {
        const start = Math.max(0, position - 60), end = Math.min(line.length, start + 240)
        hits.push({ fileIndex, path: file.path, line: index + 1, excerpt: `${start ? '…' : ''}${line.slice(start, end)}${end < line.length ? '…' : ''}` })
      }
    }
  }
  return { hits, matchingLines, truncated: matchingLines > hits.length }
}
