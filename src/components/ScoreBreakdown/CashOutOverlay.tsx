import { useEffect } from 'react'
import type { CashOutRecord } from '../../game/types'
import { T } from '../../i18n/ko'
import { useUiSettings } from '../../ui/settings'
import { ScoreBreakdownView } from './ScoreBreakdown'

/** Short, punchy cash-out presentation. Click (or wait) to continue. */
export function CashOutOverlay({ record, onDone }: { record: CashOutRecord; onDone: () => void }) {
  const { reducedMotion } = useUiSettings()
  const bd = record.breakdown
  const lineCount = 4 + bd.cargoAdds.length + bd.cargoMults.length + bd.momentumAdds.length + bd.finalMults.length + bd.stackMods.length + bd.lapMods.length
  useEffect(() => {
    const ms = reducedMotion ? 2600 : Math.min(4200, 1400 + lineCount * 130 + 900)
    const timer = window.setTimeout(onDone, ms)
    return () => window.clearTimeout(timer)
  }, [onDone, reducedMotion, lineCount])
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/55 p-3" onClick={onDone} role="dialog" aria-label={T.score.title}>
      <div className="paper-panel animate-pop w-full max-w-md p-4">
        <h2 className="mb-2 flex items-baseline justify-between font-serif text-xl font-black">
          <span>💰 {T.score.title}</span>
          <span className="text-sm font-bold text-ink-soft">{record.members.map((m) => m + 1).join('·')}번 말</span>
        </h2>
        <ScoreBreakdownView bd={bd} animate={!reducedMotion} />
        <p className="mt-2 text-center text-[11px] text-ink-soft">{T.score.skip}</p>
      </div>
    </div>
  )
}
