import { getStickMod } from '../../data/yutMods'
import { STICKS } from '../../game/config'
import type { StickFace, StickState } from '../../game/types'
import type { ThrowSetup } from '../../game/yut'
import { T } from '../../i18n/ko'
import { useUiSettings } from '../../ui/settings'

interface YutSticksProps {
  faces: StickFace[] | null
  seq: number | null
  sticks: StickState[]
  setup: ThrowSetup | null
  compact?: boolean
}

function Stick({ face, marked, skin }: { face: StickFace | null; marked: boolean; skin: { flat: string; round: string; edge: string } }) {
  const flat = face === 'back'
  return (
    <svg viewBox="0 0 24 110" className="h-full w-full" aria-hidden>
      <rect x="2" y="2" width="20" height="106" rx="10" fill={flat ? skin.flat : skin.round} stroke={skin.edge} strokeWidth="2" />
      {flat ? (
        <>
          {[28, 55, 82].map((y) => (
            <path key={y} d={`M7 ${y - 5} L17 ${y + 5} M17 ${y - 5} L7 ${y + 5}`} stroke={skin.edge} strokeWidth="2.2" strokeLinecap="round" />
          ))}
          {marked && (
            <g>
              <circle cx="12" cy="98" r="4.5" fill="#a8261c" />
              <text x="12" y="100.5" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#fff">
                빽
              </text>
            </g>
          )}
        </>
      ) : (
        <>
          <path d="M8 10 Q6 55 8 100" stroke="rgba(255,255,255,0.28)" strokeWidth="3" fill="none" />
          <path d="M15 14 Q17 55 15 96" stroke="rgba(0,0,0,0.18)" strokeWidth="1.5" fill="none" />
          {marked && <circle cx="12" cy="98" r="2.6" fill="none" stroke="#a8261c" strokeWidth="1.2" />}
        </>
      )}
    </svg>
  )
}

export function YutSticks({ faces, seq, sticks, setup, compact }: YutSticksProps) {
  const { yutSkin, showOdds } = useUiSettings()
  return (
    <div className="flex items-end gap-2" aria-label={T.sticks.title}>
      {Array.from({ length: STICKS.count }, (_, i) => {
        const mod = getStickMod(sticks[i]?.modId)
        const lock = setup?.locks[i]
        return (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <div key={seq ?? 'idle'} className={`${compact ? 'h-16 w-4' : 'h-24 w-6'} ${seq != null ? 'animate-tumble' : ''}`} style={{ animationDelay: `${i * 40}ms` }}>
              <Stick face={faces?.[i] ?? null} marked={i === STICKS.markedIndex} skin={yutSkin} />
            </div>
            <span className="text-[10px] font-bold text-paper/80" title={mod ? `${mod.name}: ${mod.description}` : undefined}>
              {mod ? mod.glyph : i === STICKS.markedIndex ? '표' : '·'}
              {lock ? (lock === 'back' ? '🔒배' : '🔒등') : ''}
            </span>
            {showOdds && setup && (
              <span className="text-[9px] text-paper/60" title={T.sticks.backChance}>
                {Math.round(setup.backProb[i] * 100)}%
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
