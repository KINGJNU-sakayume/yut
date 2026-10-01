import { getTalismanDef } from '../../data/talismans'
import { isSuppressed } from '../../game/effects/effectEngine'
import type { BoardState, GameAction, RunState } from '../../game/types'
import { T } from '../../i18n/ko'
import { TalismanCard } from './TalismanCard'

interface TalismanBarProps {
  run: RunState
  board: BoardState | null
  dispatch: (a: GameAction) => void
  compact?: boolean
}

export function TalismanBar({ run, board, dispatch, compact }: TalismanBarProps) {
  const flash = board?.lastTriggers
  const slots = Array.from({ length: run.talismanCapacity }, (_, i) => run.talismans[i] ?? null)
  const move = (from: number, to: number) => dispatch({ type: 'REORDER_TALISMAN', from, to })
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-[11px] text-paper/70">
        <span className="font-serif font-bold text-paper/90">부적 {run.talismans.length}/{run.talismanCapacity}</span>
        <span className="hidden sm:inline" title={T.talisman.order}>
          ← 왼쪽부터 발동
        </span>
      </div>
      <div className="flex items-start gap-1.5">
        {slots.map((inst, i) =>
          inst ? (
            <TalismanCard
              key={inst.uid}
              inst={inst}
              index={i}
              count={run.talismans.length}
              onMove={move}
              compact={compact}
              suppressed={isSuppressed(board, inst)}
              flashKey={flash && flash.uids.includes(inst.uid) ? flash.seq : null}
              tooltipAlign={i === 0 ? 'left' : i >= slots.length - 2 ? 'right' : 'center'}
            />
          ) : (
            <div
              key={`empty-${i}`}
              className={`flex items-center justify-center rounded-md border-2 border-dashed border-paper/20 text-[10px] text-paper/30 ${compact ? 'h-[74px] w-[58px]' : 'h-[92px] w-[70px]'}`}
            >
              {T.talisman.empty}
            </div>
          ),
        )}
        {run.blessings.length > 0 && (
          <div className="ml-1 flex flex-col gap-1" aria-label={T.talisman.blessings}>
            {run.blessings.map((b) => {
              const def = getTalismanDef(b.defId)
              return (
                <span key={b.uid} className="group relative rounded border border-spirit/60 bg-spirit/10 px-1 text-sm text-spirit" tabIndex={0} aria-label={`${def?.name}: ${def?.effect}`}>
                  {def?.glyph}
                  <span className="paper-panel pointer-events-none invisible absolute bottom-full right-0 z-30 mb-1 w-52 p-2 text-xs text-ink opacity-0 group-focus:visible group-focus:opacity-100 group-hover:visible group-hover:opacity-100">
                    <b>{def?.name}</b> — {def?.trigger}: {def?.effect}
                  </span>
                </span>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
