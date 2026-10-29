import { MAX_BYTES, MAX_FILES, sourcePathAllowed, type SourceFile } from './security-review'

export function validateSnapshot(value: unknown): SourceFile[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_FILES) throw new Error('Choose between 1 and 150 source files.')
  let size = 0
  const paths = new Set<string>()
  return value.map((file) => {
    if (!file || typeof file.path !== 'string' || typeof file.content !== 'string' || !sourcePathAllowed(file.path) || file.path.startsWith('/') || file.path.includes('\0') || file.content.includes('\0')) throw new Error('Unsupported source file or unsafe path.')
    if (paths.has(file.path)) throw new Error('Source paths must be unique.')
    paths.add(file.path)
    size += new TextEncoder().encode(file.content).length
    if (size > MAX_BYTES) throw new Error('Source contents exceed the 2 MB review limit.')
    return { path: file.path, content: file.content }
  })
}

export function snapshotPath(userId: string, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw new Error('Invalid snapshot identifier.')
  return `${snapshotPrefix(userId)}${id}.json`
}
export function snapshotPrefix(userId: string) { return `source-snapshots/${encodeURIComponent(userId)}/` }
