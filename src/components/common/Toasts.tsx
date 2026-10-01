import type { Toast } from '../../hooks/useGameStore'

export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed right-3 top-16 z-50 flex max-w-[min(92vw,380px)] flex-col items-end gap-2" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={`animate-rise rounded-lg border-2 px-4 py-2 font-bold shadow-xl ${
            t.kind === 'error'
              ? 'border-goblin-dark bg-goblin text-paper'
              : t.kind === 'achievement'
                ? 'border-brass bg-night-2 text-brass-light'
                : 'border-wood bg-paper text-ink'
          }`}
        >
          {t.kind === 'achievement' ? '🏮 ' : t.kind === 'error' ? '⚠ ' : ''}
          {t.text}
        </div>
      ))}
    </div>
  )
}
