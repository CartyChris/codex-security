'use client'

import { useEffect, useRef, type ReactNode } from 'react'

export default function WorkspaceDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} className="workspace-dialog" aria-labelledby="settings-title" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) ref.current?.close() }}>{children}</dialog>
}
