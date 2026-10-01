import { canRewind, throwAvailability } from '../../game/board'
import { throwView } from '../../game/selectors'
import { RESULT_KINDS, type BoardState, type GameAction, type RunState } from '../../game/types'
import { RESULT_LABELS, T } from '../../i18n/ko'
import { useUiSettings } from '../../ui/settings'
import { YutSticks } from './YutSticks'

interface ThrowPanelProps {
  run: RunState
  board: BoardState
  dispatch: (a: GameAction) => void
}

export function ThrowPanel({ run, board, dispatch }: ThrowPanelProps) {
  const { showOdds } = useUiSettings()
  const availability = throwAvailability(board)
  const view = throwView(run, board)
  const last = board.lastThrow
  const rewind = canRewind(run, board)
  return (
    <div className="flex flex-wrap items-end gap-3">
      <YutSticks faces={last?.faces ?? null} seq={last?.seq ?? null} sticks={run.sticks} setup={view.setup} />
      <div className="flex min-w-[150px] flex-col gap-1.5">
        <div className="h-8 font-serif text-2xl font-black text-brass-light text-shadow-ink" aria-live="polite">
          {last ? (
            <span key={last.seq} className="animate-pop inline-block">
              {RESULT_LABELS[last.kind]}!{last.grantedExtra && <span className="ml-1 text-base text-spirit">한 번 더!</span>}
            </span>
          ) : (
            <span className="text-base text-paper/50">윷을 던져라</span>
          )}
        </div>
        <button
          type="button"
          className={`btn text-lg ${availability.can && availability.kind === 'extra' ? 'btn-red' : ''}`}
          disabled={!availability.can}
          onClick={() => dispatch({ type: 'THROW' })}
          title={availability.can ? 'Space' : availability.reason}
          aria-keyshortcuts="Space"
        >
          🎋 {availability.can && availability.kind === 'extra' ? T.play.throwExtra : T.play.throw}
        </button>
        {!availability.can && board.phase === 'play' && <span className="text-[11px] text-paper/60">{availability.reason}</span>}
        {rewind && (
          <button type="button" className="btn btn-ghost border-spirit text-xs text-spirit" onClick={() => dispatch({ type: 'REWIND' })}>
            ⏪ {T.play.rewind}
          </button>
        )}
      </div>
      {showOdds && (
        <table className="text-[10px] text-paper/80" aria-label={T.sticks.odds}>
          <tbody>
            {RESULT_KINDS.map((k) => (
              <tr key={k}>
                <td className="pr-1 font-bold">{RESULT_LABELS[k]}</td>
                <td className="text-right font-mono">{(view.distribution[k] * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
