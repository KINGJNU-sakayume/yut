import { getTalismanDef } from '../data/talismans'
import { getBoss } from '../data/bosses'
import { BOARD_KIND_NAMES, WAGER_NAMES } from '../game/board'
import type { BoardEndSummary, GameAction, RunState } from '../game/types'
import { Modal } from '../components/common/Modal'
import { ScoreBreakdownView } from '../components/ScoreBreakdown/ScoreBreakdown'
import { T, formatNumber } from '../i18n/ko'

export function BoardEndModal({ summary, dispatch }: { run: RunState; summary: BoardEndSummary; dispatch: (a: GameAction) => void }) {
  const boss = getBoss(summary.bossId)
  return (
    <Modal
      wide
      title={
        <span className={summary.cleared ? 'text-jade' : 'text-goblin'}>
          {summary.cleared ? `🎉 ${T.boardEnd.cleared}` : `💀 ${T.boardEnd.failed}`}{' '}
          <span className="text-sm font-bold text-ink-soft">
            {summary.yard}번째 마당 · {BOARD_KIND_NAMES[summary.kind]} {boss ? `(${boss.name})` : ''} · 판돈 {WAGER_NAMES[summary.wager]}
          </span>
        </span>
      }
    >
      {!summary.cleared && summary.reason && <p className="mb-2 rounded bg-goblin/10 px-2 py-1 text-sm font-bold text-goblin">{summary.reason}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded bg-white/40 p-2">
            <dt className="text-xs text-ink-soft">{T.boardEnd.score}</dt>
            <dd className="font-serif text-2xl font-black">{formatNumber(summary.score)}</dd>
          </div>
          <div className="rounded bg-white/40 p-2">
            <dt className="text-xs text-ink-soft">{T.boardEnd.target}</dt>
            <dd className="font-serif text-2xl font-black">{formatNumber(summary.target)}</dd>
          </div>
          <div className="rounded bg-white/40 p-2">
            <dt className="text-xs text-ink-soft">{T.boardEnd.throwsLeft}</dt>
            <dd className="font-serif text-xl font-black">{summary.baseThrowsLeft}</dd>
          </div>
          <div className="rounded bg-white/40 p-2">
            <dt className="text-xs text-ink-soft">
              {T.boardEnd.captures} / {T.boardEnd.lost}
            </dt>
            <dd className="font-serif text-xl font-black">
              {summary.captures} / {summary.lostToGoblins}
            </dd>
          </div>
          <div className="col-span-2 rounded bg-white/40 p-2">
            <dt className="text-xs text-ink-soft">{T.boardEnd.coins}</dt>
            <dd>
              {summary.coins.length === 0 && <span className="text-sm">—</span>}
              <ul className="text-xs">
                {summary.coins.map((c, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{c.source}</span>
                    <b>+{c.amount}</b>
                  </li>
                ))}
              </ul>
              {summary.coins.length > 0 && <p className="mt-1 text-right font-serif text-lg font-black">🪙 +{summary.coinsTotal}</p>}
            </dd>
          </div>
          <div className="col-span-2 rounded bg-white/40 p-2">
            <dt className="text-xs text-ink-soft">{T.boardEnd.triggers}</dt>
            <dd className="flex flex-wrap gap-1 pt-1">
              {summary.triggers.length === 0 && <span className="text-sm">—</span>}
              {summary.triggers.slice(0, 5).map((t) => (
                <span key={t.defId} className="chip">
                  {getTalismanDef(t.defId)?.glyph} {getTalismanDef(t.defId)?.name} ×{t.count}
                </span>
              ))}
            </dd>
          </div>
        </dl>
        <div className="rounded border-2 border-wood bg-white/30 p-2">
          <h3 className="mb-1 font-serif font-black">{T.boardEnd.best}</h3>
          {summary.bestCashOut ? (
            <>
              <p className="mb-1 text-xs text-ink-soft">{summary.bestCashOut.members.map((m) => m + 1).join('·')}번 말</p>
              <ScoreBreakdownView bd={summary.bestCashOut.breakdown} animate={false} compact />
            </>
          ) : (
            <p className="text-sm">퇴근한 무리가 없습니다.</p>
          )}
        </div>
      </div>
      <button type="button" className="btn mt-4 w-full text-lg" onClick={() => dispatch({ type: 'CONTINUE' })} autoFocus>
        {summary.cleared ? T.boardEnd.continue : T.boardEnd.toRunEnd}
      </button>
    </Modal>
  )
}
