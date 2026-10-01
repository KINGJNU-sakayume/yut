import { useState } from 'react'
import { getTrait } from '../../data/pieceTraits'
import { getStickMod, type StickModDef } from '../../data/yutMods'
import { STICKS } from '../../game/config'
import type { PieceState, StickState } from '../../game/types'
import { T } from '../../i18n/ko'

/** Choose a stick (and a mirror target for 쌍둥이 윷). */
export function StickPicker({
  sticks,
  mod,
  onPick,
  exclude = [],
}: {
  sticks: StickState[]
  mod: StickModDef
  onPick: (stickIndex: number, twinOf?: number) => void
  exclude?: number[]
}) {
  const [stick, setStick] = useState<number | null>(mod.markedOnly ? STICKS.markedIndex : null)
  const [twin, setTwin] = useState<number | null>(null)
  const ready = stick != null && (!mod.twin || (twin != null && twin !== stick))
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold">{T.shop.pickStick}</p>
      <div className="flex flex-wrap gap-2">
        {sticks.map((s, i) => {
          const current = getStickMod(s.modId)
          const disabled = exclude.includes(i) || (mod.markedOnly && i !== STICKS.markedIndex)
          return (
            <button key={i} type="button" disabled={disabled} className={`btn ${stick === i ? '' : 'btn-paper'} text-sm`} onClick={() => setStick(i)}>
              {i + 1}번{i === STICKS.markedIndex ? '(표)' : ''} {current ? `· ${current.name}` : ''}
            </button>
          )
        })}
      </div>
      {mod.twin && (
        <>
          <p className="text-sm font-bold">{T.shop.pickTwin}</p>
          <div className="flex flex-wrap gap-2">
            {sticks.map((s, i) => (
              <button key={i} type="button" disabled={i === stick || Boolean(getStickMod(s.modId)?.twin)} className={`btn ${twin === i ? '' : 'btn-paper'} text-sm`} onClick={() => setTwin(i)}>
                {i + 1}번
              </button>
            ))}
          </div>
        </>
      )}
      {stick != null && getStickMod(sticks[stick]?.modId) && <p className="text-xs text-goblin">기존 개조 「{getStickMod(sticks[stick]?.modId)?.name}」은(는) 사라집니다.</p>}
      <button type="button" className="btn w-full" disabled={!ready} onClick={() => stick != null && onPick(stick, twin ?? undefined)}>
        이 막대에 달기
      </button>
    </div>
  )
}

export function PiecePicker({ pieces, onPick, label = T.shop.pickPiece, disabled = [] }: { pieces: PieceState[]; onPick: (pieceId: number) => void; label?: string; disabled?: number[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {pieces.map((p) => {
          const trait = getTrait(p.traitId)
          return (
            <button key={p.id} type="button" disabled={disabled.includes(p.id)} className="btn btn-paper text-sm" onClick={() => onPick(p.id)}>
              {p.id + 1}번 말 {trait ? `· ${trait.name}` : '· 특성 없음'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
