import { useEffect, useRef, type ReactNode } from 'react'

interface ModalProps {
  title?: ReactNode
  children: ReactNode
  onClose?: () => void
  wide?: boolean
  labelledBy?: string
}

/** Accessible paper modal. Escape closes when `onClose` is provided. */
export function Modal({ title, children, onClose, wide }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-3" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={`paper-panel animate-rise max-h-[92vh] w-full overflow-y-auto p-4 outline-none ${wide ? 'max-w-3xl' : 'max-w-lg'}`}
      >
        {title && <h2 className="mb-3 font-serif text-xl font-black text-ink">{title}</h2>}
        {children}
      </div>
    </div>
  )
}
