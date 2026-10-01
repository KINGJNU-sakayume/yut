import { useEffect, useState } from 'react'
import type { ScoreBreakdown as Breakdown } from '../../game/types'
import { T, formatMult, formatNumber } from '../../i18n/ko'

interface Line {
  key: string
  label: string
  value: string
  kind: 'base' | 'add' | 'mult' | 'subtotal'
}

function buildLines(bd: Breakdown): Line[] {
  const lines: Line[] = [{ key: 'cargo', label: T.score.cargo, value: formatNumber(bd.baseCargo), kind: 'base' }]
  bd.cargoAdds.forEach((l, i) => lines.push({ key: `ca${i}`, label: l.source, value: `+${formatNumber(l.value)}`, kind: 'add' }))
  bd.cargoMults.forEach((l, i) => lines.push({ key: `cm${i}`, label: l.source, value: formatMult(l.value), kind: 'mult' }))
  if (bd.cargoAdds.length || bd.cargoMults.length) lines.push({ key: 'cargoTotal', label: `= ${T.score.cargo}`, value: formatNumber(bd.cargo), kind: 'subtotal' })
  lines.push({ key: 'mom', label: T.score.momentum, value: `×${formatNumber(bd.baseMomentum)}`, kind: 'base' })
  bd.momentumAdds.forEach((l, i) => lines.push({ key: `ma${i}`, label: l.source, value: `+${formatNumber(l.value)}`, kind: 'add' }))
  if (bd.momentumAdds.length) lines.push({ key: 'momTotal', label: `= ${T.score.momentum}`, value: `×${formatNumber(bd.momentum)}`, kind: 'subtotal' })
  lines.push({ key: 'stack', label: `${T.score.stack} (${bd.stackSize}동)`, value: formatMult(bd.stackMult), kind: 'mult' })
  bd.stackMods.forEach((l, i) => lines.push({ key: `sm${i}`, label: `  ${l.source}`, value: `+${l.value}`, kind: 'add' }))
  lines.push({ key: 'lap', label: `${T.score.lap} (추가 ${bd.laps}바퀴)`, value: formatMult(bd.lapMult), kind: 'mult' })
  bd.lapMods.forEach((l, i) => lines.push({ key: `lm${i}`, label: `  ${l.source}`, value: `${l.value >= 0 ? '+' : ''}${Number(l.value.toFixed(2))}`, kind: 'add' }))
  bd.finalMults.forEach((l, i) => lines.push({ key: `fm${i}`, label: l.source, value: formatMult(l.value), kind: 'mult' }))
  return lines
}

interface ScoreBreakdownProps {
  bd: Breakdown
  animate: boolean
  compact?: boolean
}

/** Score juice: cargo → additions → momentum → stack → lap → talismans → FINAL SCORE. */
export function ScoreBreakdownView({ bd, animate, compact }: ScoreBreakdownProps) {
  const lines = buildLines(bd)
  const [shown, setShown] = useState(animate ? 0 : lines.length + 1)
  const [count, setCount] = useState(animate ? 0 : bd.score)
  useEffect(() => {
    if (!animate) return
    let i = 0
    const timer = window.setInterval(() => {
      i += 1
      setShown(i)
      if (i > lines.length) window.clearInterval(timer)
    }, 130)
    return () => window.clearInterval(timer)
  }, [animate, lines.length])
  const finalShown = shown > lines.length
  useEffect(() => {
    if (!animate || !finalShown) return
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 380)
      setCount(Math.round(bd.score * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animate, finalShown, bd.score])

  return (
    <div className="text-ink">
      <ul className={`space-y-0.5 ${compact ? 'text-xs' : 'text-sm'}`}>
        {lines.map((line, i) =>
          i < shown ? (
            <li
              key={line.key}
              className={`flex justify-between gap-3 ${animate ? 'animate-rise' : ''} ${
                line.kind === 'subtotal' ? 'border-t border-ink/20 pt-0.5 font-black' : line.kind === 'mult' ? 'font-bold text-goblin-dark' : line.kind === 'add' ? 'text-jade' : 'font-bold'
              }`}
            >
              <span className="truncate">{line.label}</span>
              <span className="font-mono">{line.value}</span>
            </li>
          ) : null,
        )}
      </ul>
      <div className={`mt-2 border-t-2 border-ink/30 pt-2 ${finalShown ? '' : 'invisible'}`}>
        <p className="text-[11px] text-ink-soft">
          {formatNumber(bd.cargo)} × {formatNumber(bd.momentum)} × {formatMult(bd.stackMult)} × {formatMult(bd.lapMult)}
          {bd.finalMult !== 1 ? ` × ${formatMult(bd.finalMult)}` : ''}
        </p>
        <p className={`flex items-baseline justify-between font-serif font-black ${compact ? 'text-xl' : 'text-3xl'}`}>
          <span>{T.score.total}</span>
          <span key={finalShown ? 'final' : 'pending'} className={`text-goblin ${animate && finalShown ? 'animate-pop' : ''}`}>
            {formatNumber(animate ? count : bd.score)}
          </span>
        </p>
      </div>
    </div>
  )
}
