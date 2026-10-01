import { getBoss } from '../../data/bosses'
import { BOARD_KIND_NAMES } from '../../game/board'
import { yardOf } from '../../game/state'
import type { BoardState, RunState } from '../../game/types'
import { T, formatNumber } from '../../i18n/ko'

interface TopHudProps {
  run: RunState
  board: BoardState | null
  onMenu: () => void
  onCopySeed: () => void
}

function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: React.ReactNode; accent?: string }) {
  return (
    <div className="flex min-w-0 flex-col items-start leading-tight">
      <span className="text-[10px] font-bold tracking-wide text-paper/60">{label}</span>
      <span className={`font-serif text-lg font-black ${accent ?? 'text-paper'}`}>{value}</span>
      {sub && <span className="text-[10px] text-paper/60">{sub}</span>}
    </div>
  )
}

export function TopHud({ run, board, onMenu, onCopySeed }: TopHudProps) {
  const yard = board?.yard ?? yardOf(run.boardIndex)
  const kind = board?.kind ?? (['small', 'big', 'boss'] as const)[run.boardIndex % 3]
  const boss = getBoss(board?.bossId ?? (kind === 'boss' ? run.bosses[yard - 1] : null))
  const progress = board ? Math.min(1, board.score / Math.max(1, board.target)) : 0
  return (
    <header className="wood-panel flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2">
      <div className="flex flex-col leading-tight">
        <span className="font-serif text-base font-black text-brass-light">{T.hud.yard(yard)} / 8</span>
        <span className="text-xs text-paper/80">{BOARD_KIND_NAMES[kind]}</span>
      </div>
      {board && (
        <>
          <div className="flex min-w-[170px] flex-1 flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3">
              <Stat label={T.hud.score} value={formatNumber(board.score)} accent="text-brass-light" />
              <Stat label={T.hud.target} value={formatNumber(board.target)} />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/40" role="progressbar" aria-valuemin={0} aria-valuemax={board.target} aria-valuenow={board.score} aria-label="목표 진행도">
              <div className="h-full rounded-full bg-gradient-to-r from-brass to-brass-light transition-all duration-500" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
          <Stat
            label={T.hud.throws}
            value={
              <span>
                {board.baseThrowsLeft}
                <span className="text-sm text-paper/50">/{board.baseThrowsTotal}</span>
              </span>
            }
            sub={board.extraThrows > 0 ? <span className="font-bold text-spirit">{T.play.extraThrows(board.extraThrows)}</span> : T.hud.turn(board.turn)}
          />
          {board.heung > 0 && <Stat label={T.play.heung} value={`${board.heung}`} accent="text-spirit" />}
        </>
      )}
      <Stat label={T.hud.coins} value={<span>🪙 {run.coins}</span>} accent="text-brass-light" />
      <button type="button" onClick={onCopySeed} className="flex flex-col items-start leading-tight" title="씨앗 복사">
        <span className="text-[10px] font-bold text-paper/60">{T.hud.seed}</span>
        <span className="font-mono text-sm text-paper/90">{run.seed}</span>
      </button>
      {boss && (
        <div className="group relative max-w-xs" tabIndex={0} aria-label={`${T.hud.boss}: ${boss.name} — ${boss.rule}`}>
          <span className="flex items-center gap-1 rounded-md border border-goblin bg-goblin/25 px-2 py-1 text-xs font-bold text-[#ffd3c9]">
            <span className="font-serif text-base">{boss.glyph}</span> {boss.name}
          </span>
          <div className="paper-panel pointer-events-none invisible absolute right-0 top-full z-30 mt-1 w-72 p-2 text-xs opacity-0 group-focus:visible group-focus:opacity-100 group-hover:visible group-hover:opacity-100">
            <b className="font-serif">{boss.name}</b>
            <p className="mt-1 font-bold text-goblin">{boss.rule}</p>
            <p className="mt-1 text-ink-soft">{boss.detail}</p>
          </div>
        </div>
      )}
      <button type="button" className="btn btn-ghost ml-auto px-3 py-1 text-sm" onClick={onMenu}>
        ☰ {T.hud.menu}
      </button>
    </header>
  )
}
