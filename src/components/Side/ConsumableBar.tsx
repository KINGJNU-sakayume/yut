import { useState } from 'react'
import { CONSUMABLE_MAP } from '../../data/consumables'
import { getTalismanDef } from '../../data/talismans'
import { canUseFan } from '../../game/board'
import { STICKS } from '../../game/config'
import { RESULT_KINDS, type BoardState, type GameAction, type RunState } from '../../game/types'
import { RESULT_LABELS, T } from '../../i18n/ko'
import { Modal } from '../common/Modal'

interface ConsumableBarProps {
  run: RunState
  board: BoardState | null
  dispatch: (a: GameAction) => void
}

export function ConsumableBar({ run, board, dispatch }: ConsumableBarProps) {
  const [using, setUsing] = useState<number | null>(null)
  const [stick, setStick] = useState(0)
  const [face, setFace] = useState<'back' | 'front'>('back')
  const playing = run.phase === 'board' && board?.phase === 'play'

  const usable = (id: string): boolean => {
    if (id === 'luckyPouch') return true
    if (!playing || !board) return false
    if (id === 'fan') return canUseFan(board)
    if (id === 'salt') return board.goblins.some((g) => g.intent && !g.resting) || Boolean(board.suppression || board.blockade)
    return true
  }

  const use = (slot: number) => {
    const id = run.consumables[slot]
    if (id === 'fan') dispatch({ type: 'USE_CONSUMABLE', slot })
    else setUsing(slot)
  }

  const current = using != null ? CONSUMABLE_MAP[run.consumables[using]] : null
  const done = (action: GameAction) => {
    dispatch(action)
    setUsing(null)
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="font-serif text-[11px] font-bold text-paper/90">
        {T.consumable.title} {run.consumables.length}/{run.consumableCapacity}
      </span>
      <div className="flex gap-1.5">
        {Array.from({ length: run.consumableCapacity }, (_, i) => {
          const id = run.consumables[i]
          const def = id ? CONSUMABLE_MAP[id] : null
          if (!def) {
            return (
              <div key={`empty-${i}`} className="flex h-[70px] w-[58px] items-center justify-center rounded-md border-2 border-dashed border-paper/20 text-[10px] text-paper/30">
                {T.talisman.empty}
              </div>
            )
          }
          const ok = usable(def.id)
          return (
            <div key={`${def.id}-${i}`} className="group relative">
              <button
                type="button"
                onClick={() => use(i)}
                disabled={!ok}
                className="flex h-[70px] w-[58px] flex-col items-center justify-center rounded-md border-2 border-[#4f6b3f] bg-[#e7efd6] text-ink shadow disabled:opacity-50"
                aria-label={`${def.name} ${T.consumable.use}: ${def.description}`}
              >
                <span className="font-serif text-2xl font-black text-jade">{def.glyph}</span>
                <span className="text-[10px] font-black">{def.name}</span>
              </button>
              <div role="tooltip" className="paper-panel pointer-events-none invisible absolute bottom-full right-0 z-30 mb-2 w-56 p-2 text-xs opacity-0 group-hover:visible group-hover:opacity-100">
                <b className="font-serif">{def.name}</b>
                <p className="mt-1">{def.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      {current && using != null && (
        <Modal title={`${current.name} — ${current.description}`} onClose={() => setUsing(null)}>
          {current.target === 'stickFace' && (
            <div className="space-y-3">
              <div>
                <p className="mb-1 text-sm font-bold">{T.consumable.pickStick}</p>
                <div className="flex gap-2">
                  {Array.from({ length: STICKS.count }, (_, i) => (
                    <button key={i} type="button" className={`btn ${stick === i ? '' : 'btn-paper'}`} onClick={() => setStick(i)}>
                      {i + 1}번{i === STICKS.markedIndex ? ' (표)' : ''}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm font-bold">{T.consumable.pickFace}</p>
                <div className="flex gap-2">
                  <button type="button" className={`btn ${face === 'back' ? '' : 'btn-paper'}`} onClick={() => setFace('back')}>
                    {T.consumable.back}
                  </button>
                  <button type="button" className={`btn ${face === 'front' ? '' : 'btn-paper'}`} onClick={() => setFace('front')}>
                    {T.consumable.front}
                  </button>
                </div>
              </div>
              <button type="button" className="btn w-full" onClick={() => done({ type: 'USE_CONSUMABLE', slot: using, params: { stickIndex: stick, face } })}>
                {T.consumable.use}
              </button>
            </div>
          )}
          {current.target === 'result' && (
            <div>
              <p className="mb-2 text-sm font-bold">{T.consumable.pickResult}</p>
              <div className="grid grid-cols-3 gap-2">
                {RESULT_KINDS.map((r) => (
                  <button key={r} type="button" className="btn btn-paper" onClick={() => done({ type: 'USE_CONSUMABLE', slot: using, params: { result: r } })}>
                    {RESULT_LABELS[r]} <span className="text-xs">(+{run.mods.momentumBonus[r]})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {current.target === 'goblinOrStatus' && board && (
            <div className="space-y-2">
              <p className="text-sm font-bold">{T.consumable.pickGoblin}</p>
              <div className="flex flex-wrap gap-2">
                {board.goblins
                  .filter((g) => g.intent && !g.resting)
                  .map((g) => (
                    <button key={g.id} type="button" className="btn btn-paper" onClick={() => done({ type: 'USE_CONSUMABLE', slot: using, params: { goblinId: g.id } })}>
                      {g.boss ? '대장' : '도깨비'} @{g.node} ({RESULT_LABELS[g.intent!.result]} {g.intent!.steps}
                      {g.intent!.weaken ? ` -${g.intent!.weaken}` : ''})
                    </button>
                  ))}
              </div>
              {board.suppression && (
                <button type="button" className="btn btn-paper w-full" onClick={() => done({ type: 'USE_CONSUMABLE', slot: using, params: { status: 'suppression' } })}>
                  {T.consumable.statusSuppression}: {getTalismanDef(run.talismans.find((t) => t.uid === board.suppression?.uid)?.defId ?? '')?.name}
                </button>
              )}
              {board.blockade && (
                <button type="button" className="btn btn-paper w-full" onClick={() => done({ type: 'USE_CONSUMABLE', slot: using, params: { status: 'blockade' } })}>
                  {T.consumable.statusBlockade}
                </button>
              )}
            </div>
          )}
          <div className="mt-4 flex justify-between">
            <button type="button" className="btn btn-red text-sm" onClick={() => done({ type: 'DISCARD_CONSUMABLE', slot: using })}>
              {T.consumable.discard}
            </button>
            <button type="button" className="btn btn-paper text-sm" onClick={() => setUsing(null)}>
              {T.consumable.cancel}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
