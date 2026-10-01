import { goalDecisionView } from '../../game/selectors'
import type { BoardState, GameAction, RunState } from '../../game/types'
import { T, formatMult, formatNumber } from '../../i18n/ko'
import { Modal } from '../common/Modal'
import { ScoreBreakdownView } from '../ScoreBreakdown/ScoreBreakdown'

interface GoalDecisionModalProps {
  run: RunState
  board: BoardState
  dispatch: (a: GameAction) => void
}

export function GoalDecisionModal({ run, board, dispatch }: GoalDecisionModalProps) {
  const view = goalDecisionView(run, board)
  if (!view) return null
  const { group, cashOut } = view
  return (
    <Modal title={`🏁 ${T.goal.title} — ${group.members.map((m) => m + 1).join('·')}번 말`} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border-2 border-wood bg-white/40 p-3">
          <h3 className="mb-2 font-serif text-lg font-black">{T.goal.cashOut}</h3>
          <ScoreBreakdownView bd={cashOut} animate={false} compact />
          <p className={`mt-2 rounded px-2 py-1 text-sm font-bold ${view.clears ? 'bg-jade/15 text-jade' : 'bg-goblin/10 text-goblin'}`}>
            {view.clears ? `✔ ${T.goal.clears}` : view.lastPieces ? `⚠ ${T.goal.lastPieces}` : `${T.goal.notClear} (${formatNumber(board.score + cashOut.score)} / ${formatNumber(board.target)})`}
          </p>
          <button type="button" className="btn mt-3 w-full text-lg" onClick={() => dispatch({ type: 'GOAL_DECISION', choice: 'cashOut' })} autoFocus>
            {T.goal.cashOut} — {formatNumber(cashOut.score)}점
          </button>
          <p className="mt-1 text-center text-xs text-ink-soft">{T.goal.cashOutHint}</p>
        </div>
        <div className="rounded-lg border-2 border-goblin/60 bg-goblin/5 p-3">
          <h3 className="mb-2 font-serif text-lg font-black text-goblin">{T.goal.oneMore}</h3>
          {view.canLap ? (
            <>
              <ul className="space-y-1 text-sm">
                <li>
                  추가 바퀴 <b>{group.laps}</b> → <b>{view.nextLap}</b> (최대 3)
                </li>
                <li>
                  바퀴 배수 <b>{formatMult(cashOut.lapMult)}</b> → <b className="text-goblin">{formatMult(view.nextLapMult)}</b>
                </li>
                <li>화물·기세는 그대로 들고 집에서 다시 출발 (지나간 칸 기록은 초기화)</li>
                <li className="rounded bg-goblin/10 px-2 py-1 font-bold text-goblin">
                  {T.goal.risk}: {view.risk}
                </li>
                <li className="text-xs text-ink-soft">잡히면 화물은 도깨비에게 넘어간다 (그 도깨비를 잡으면 되찾는다).</li>
              </ul>
              <button type="button" className="btn btn-red mt-3 w-full text-lg" onClick={() => dispatch({ type: 'GOAL_DECISION', choice: 'oneMoreLap' })}>
                {T.goal.oneMore}! {formatMult(view.nextLapMult)}
              </button>
              <p className="mt-1 text-center text-xs text-ink-soft">{T.goal.oneMoreHint(formatMult(view.nextLapMult))}</p>
            </>
          ) : (
            <p className="text-sm font-bold">{T.goal.maxLaps}</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
