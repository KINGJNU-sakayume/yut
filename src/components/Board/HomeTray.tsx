import { isSealed } from '../../game/state'
import { sortedGroups } from '../../game/selectors'
import type { BoardState, RunState } from '../../game/types'
import { T } from '../../i18n/ko'
import { PieceToken } from './PieceToken'

interface HomeTrayProps {
  run: RunState
  board: BoardState
  legalGroupIds: ReadonlySet<string>
  selectedGroupId: string | null
  onSelectGroup: (id: string) => void
}

export function HomeTray({ run, board, legalGroupIds, selectedGroupId, onSelectGroup }: HomeTrayProps) {
  const home = sortedGroups(board).filter((g) => g.zone === 'home')
  const finished = sortedGroups(board).filter((g) => g.zone === 'finished')
  const sealed = run.pieces.filter((p) => isSealed(run, p.id, board.yard))
  return (
    <div className="flex flex-wrap items-stretch gap-2 text-sm">
      <div className="wood-panel flex min-h-[64px] flex-1 items-center gap-2 px-2 py-1">
        <span className="font-serif text-xs font-bold text-paper/80">{T.play.home}</span>
        {home.length === 0 && <span className="text-xs text-paper/40">—</span>}
        {home.map((g) => {
          const legal = legalGroupIds.has(g.id)
          const selected = g.id === selectedGroupId
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelectGroup(g.id)}
              className={`flex items-center gap-1 rounded-md border px-1 py-0.5 ${selected ? 'border-spirit bg-spirit/15' : legal ? 'border-brass-light bg-brass/15' : 'border-transparent'}`}
              aria-label={`${g.members.map((m) => m + 1).join('·')}번 말 (집)${legal ? ', 움직일 수 있음' : ''}${g.cargo ? `, 화물 ${g.cargo}` : ''}`}
            >
              <svg viewBox="-6 -9 12 15" className="h-11 w-9">
                <PieceToken members={g.members} pieces={run.pieces} highlight={legal} selected={selected} />
              </svg>
              {(g.cargo > 0 || g.laps > 0 || g.momentum > 1) && (
                <span className="text-left text-[10px] leading-tight text-paper/85">
                  {g.cargo > 0 && <span className="block">화물 {g.cargo}</span>}
                  <span className="block">기세 {g.momentum}</span>
                  {g.laps > 0 && <span className="block text-brass-light">+{g.laps}바퀴</span>}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {(finished.length > 0 || sealed.length > 0) && (
        <div className="wood-panel flex items-center gap-2 px-2 py-1">
          {finished.length > 0 && <span className="font-serif text-xs font-bold text-paper/80">{T.play.finished}</span>}
          {finished.map((g) => (
            <svg key={g.id} viewBox="-6 -9 12 15" className="h-10 w-8" aria-label={`${g.members.map((m) => m + 1).join('·')}번 말 퇴근`}>
              <PieceToken members={g.members} pieces={run.pieces} dim />
            </svg>
          ))}
          {sealed.length > 0 && <span className="font-serif text-xs font-bold text-goblin">{T.play.sealed}</span>}
          {sealed.map((p) => (
            <svg key={p.id} viewBox="-6 -9 12 15" className="h-10 w-8" aria-label={`${p.id + 1}번 말 봉인됨`}>
              <PieceToken members={[p.id]} pieces={run.pieces} dim />
              <text x="0" y="1" textAnchor="middle" fontSize="5" fill="#a8261c">
                封
              </text>
            </svg>
          ))}
        </div>
      )}
    </div>
  )
}
