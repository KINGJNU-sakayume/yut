import { getTrait } from '../../data/pieceTraits'
import { pieceLabel } from '../../game/state'
import type { PieceState } from '../../game/types'
import { useUiSettings } from '../../ui/settings'

interface PieceTokenProps {
  members: number[]
  pieces: PieceState[]
  highlight?: boolean
  selected?: boolean
  dim?: boolean
  cargo?: number
  protectedMark?: boolean
}

/** A stack of player pieces centered on (0,0) in board units. */
export function PieceToken({ members, pieces, highlight, selected, dim, cargo, protectedMark }: PieceTokenProps) {
  const skin = useUiSettings().pieceSkin
  const shown = members.slice(0, 4)
  return (
    <g opacity={dim ? 0.5 : 1}>
      {(highlight || selected) && (
        <circle
          r={selected ? 5.2 : 4.6}
          fill="none"
          stroke={selected ? '#7fd1c7' : '#e8c46a'}
          strokeWidth={selected ? 1.1 : 0.8}
          className="animate-pulse-ring"
        />
      )}
      {shown.map((pid, i) => {
        const offset = (shown.length - 1 - i) * 0.9
        const trait = getTrait(pieces[pid]?.traitId)
        return (
          <g key={pid} transform={`translate(${offset * 0.35} ${-offset})`}>
            <circle r="3" fill={skin.colors[pid % 4]} stroke="#1b120c" strokeWidth="0.45" />
            <circle r="2.25" fill="none" stroke={skin.ink} strokeOpacity="0.55" strokeWidth="0.25" />
            {i === shown.length - 1 && (
              <text y="1.05" textAnchor="middle" fontSize="2.9" fontWeight="900" fill={skin.ink} style={{ fontFamily: 'var(--font-serif)' }}>
                {trait ? trait.glyph : pieceLabel(pid)}
              </text>
            )}
          </g>
        )
      })}
      {members.length > 1 && (
        <g transform="translate(3 -3.6)">
          <circle r="1.9" fill="#e8c46a" stroke="#1b120c" strokeWidth="0.35" />
          <text y="0.75" textAnchor="middle" fontSize="2.1" fontWeight="900" fill="#1b120c">
            {members.length}
          </text>
        </g>
      )}
      {protectedMark && (
        <text x="-3.6" y="-2.6" fontSize="2.6" aria-hidden>
          🛡
        </text>
      )}
      {cargo != null && cargo > 0 && (
        <g transform="translate(0 4.6)">
          <rect x="-3.4" y="-1.25" width="6.8" height="2.5" rx="1.2" fill="#2a1d14" opacity="0.85" />
          <text y="0.75" textAnchor="middle" fontSize="1.9" fontWeight="700" fill="#f2d36b">
            {cargo}
          </text>
        </g>
      )}
    </g>
  )
}
