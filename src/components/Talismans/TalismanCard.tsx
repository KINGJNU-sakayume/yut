import { useState } from 'react'
import { RARITY_LABELS, TAG_LABELS, getTalismanDef, type TalismanDef } from '../../data/talismans'
import { RARITY_STYLE, RARITY_TEXT } from './talismanStyles'
import type { TalismanInstance } from '../../game/types'
import { T } from '../../i18n/ko'

/** Full talisman description: trigger, condition, effect, downside, rarity, tags, live value. */
export function TalismanDetails({ def, inst }: { def: TalismanDef; inst?: TalismanInstance }) {
  const state = inst && def.stateText ? def.stateText(inst) : null
  return (
    <div className="space-y-1 text-left text-xs leading-snug text-ink">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-serif text-sm font-black">{def.name}</span>
        <span className={`text-[11px] font-bold ${RARITY_TEXT[def.rarity]}`}>{RARITY_LABELS[def.rarity]}</span>
      </div>
      <p>
        <b>{T.talisman.trigger}</b> {def.trigger}
      </p>
      <p>
        <b>{T.talisman.condition}</b> {def.condition}
      </p>
      <p>
        <b>{T.talisman.effect}</b> {def.effect}
      </p>
      {def.downside && (
        <p className="rounded bg-goblin/10 px-1 py-0.5 font-bold text-goblin">
          <b>{T.talisman.downside}</b> {def.downside}
        </p>
      )}
      {state && (
        <p className="font-bold text-jade">
          {T.talisman.current}: {state}
        </p>
      )}
      {inst && inst.power > 1 && <p className="font-bold text-indigo">{T.talisman.doubled}</p>}
      <div className="flex flex-wrap gap-1 pt-0.5">
        {def.tags.map((t) => (
          <span key={t} className="chip">
            {TAG_LABELS[t]}
          </span>
        ))}
      </div>
    </div>
  )
}

interface TalismanCardProps {
  inst?: TalismanInstance
  defId?: string
  flashKey?: number | null
  suppressed?: boolean
  index?: number
  count?: number
  onMove?: (from: number, to: number) => void
  compact?: boolean
  tooltipAlign?: 'left' | 'center' | 'right'
}

export function TalismanCard({ inst, defId, flashKey, suppressed, index = 0, count = 0, onMove, compact, tooltipAlign = 'center' }: TalismanCardProps) {
  const def = getTalismanDef(inst?.defId ?? defId ?? '')
  const [dragOver, setDragOver] = useState(false)
  if (!def) return null
  const align = tooltipAlign === 'left' ? 'left-0' : tooltipAlign === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2'
  return (
    <div
      className="group relative"
      draggable={Boolean(onMove)}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/talisman-index', String(index))
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => {
        if (!onMove) return
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        setDragOver(false)
        const from = Number(e.dataTransfer.getData('text/talisman-index'))
        if (onMove && Number.isFinite(from) && from !== index) onMove(from, index)
      }}
    >
      <div
        key={flashKey ?? 'still'}
        tabIndex={0}
        aria-label={`${index + 1}번째 부적 ${def.name}: ${def.trigger} — ${def.effect}${def.downside ? ` — 대가: ${def.downside}` : ''}`}
        onKeyDown={(e) => {
          if (!onMove) return
          if (e.key === 'ArrowLeft' && index > 0) {
            e.preventDefault()
            onMove(index, index - 1)
          }
          if (e.key === 'ArrowRight' && index < count - 1) {
            e.preventDefault()
            onMove(index, index + 1)
          }
        }}
        className={`talisman-paper relative flex flex-col items-center justify-between rounded-md border-2 px-1 py-1 ${RARITY_STYLE[def.rarity]} ${
          compact ? 'h-[74px] w-[58px]' : 'h-[92px] w-[70px]'
        } ${flashKey != null ? 'animate-flash' : ''} ${dragOver ? 'ring-2 ring-spirit' : ''}`}
      >
        <span className="absolute left-1 top-0.5 text-[9px] font-bold text-goblin-dark/70">{index + 1}</span>
        {inst && inst.power > 1 && <span className="absolute right-0.5 top-0.5 rounded bg-indigo px-0.5 text-[9px] font-black text-paper">×2</span>}
        <span className={`font-serif font-black leading-none text-goblin ${compact ? 'mt-2 text-2xl' : 'mt-2.5 text-3xl'}`} aria-hidden>
          {def.glyph}
        </span>
        <span className="w-full truncate text-center font-serif text-[10px] font-black leading-tight text-ink">{def.name}</span>
        {suppressed && (
          <span className="absolute inset-0 flex items-center justify-center rounded bg-[#b98a3e]/80 text-xs font-black text-ink" title={T.talisman.suppressed}>
            🍬 엿
          </span>
        )}
      </div>
      {onMove && (
        <div className="mt-0.5 flex justify-between">
          <button
            type="button"
            className="rounded px-1 text-[11px] font-bold text-paper/80 hover:bg-paper/10 disabled:opacity-20"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            aria-label={`${def.name} ${T.talisman.moveLeft}`}
          >
            ◀
          </button>
          <button
            type="button"
            className="rounded px-1 text-[11px] font-bold text-paper/80 hover:bg-paper/10 disabled:opacity-20"
            disabled={index >= count - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label={`${def.name} ${T.talisman.moveRight}`}
          >
            ▶
          </button>
        </div>
      )}
      <div
        role="tooltip"
        className={`paper-panel pointer-events-none invisible absolute bottom-full z-30 mb-2 w-64 p-2 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 ${align}`}
      >
        <TalismanDetails def={def} inst={inst} />
        {suppressed && <p className="mt-1 text-xs font-bold text-goblin">{T.talisman.suppressed}</p>}
      </div>
    </div>
  )
}
