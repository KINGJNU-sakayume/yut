import { runReward } from '../game/meta'
import { yardOf } from '../game/state'
import type { RunState } from '../game/types'
import { T, formatNumber } from '../i18n/ko'

export function RunEndScreen({ run, onNewRun, onTitle, onCopySeed }: { run: RunState; onNewRun: () => void; onTitle: () => void; onCopySeed: () => void }) {
  const victory = run.phase === 'victory'
  const yard = yardOf(run.boardIndex)
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-6 text-center">
      <h2 className={`font-serif text-4xl font-black text-shadow-ink ${victory ? 'text-brass-light' : 'text-[#ff9c8c]'}`}>{victory ? `🎊 ${T.runEnd.victory}` : `👹 ${T.runEnd.defeat}`}</h2>
      <div className="paper-panel grid w-full grid-cols-2 gap-3 p-4 text-left">
        <div>
          <p className="text-xs text-ink-soft">{T.runEnd.reached}</p>
          <p className="font-serif text-2xl font-black">{victory ? '8마당 완주' : `${yard}번째 마당 · ${['작은 판', '큰 판', '대장 판'][run.boardIndex % 3]}`}</p>
        </div>
        <div>
          <p className="text-xs text-ink-soft">{T.runEnd.totalScore}</p>
          <p className="font-serif text-2xl font-black">{formatNumber(run.stats.totalScore)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-soft">{T.runEnd.bestCashOut}</p>
          <p className="font-serif text-2xl font-black">{formatNumber(run.stats.bestCashOut)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-soft">{T.runEnd.captures}</p>
          <p className="font-serif text-2xl font-black">{run.stats.captures}</p>
        </div>
        <div>
          <p className="text-xs text-ink-soft">{T.runEnd.reward}</p>
          <p className="font-serif text-2xl font-black text-goblin">🔥 {runReward(run)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-soft">{T.runEnd.seed}</p>
          <button type="button" className="font-mono text-lg underline" onClick={onCopySeed}>
            {run.seed}
          </button>
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" className="btn text-lg" onClick={onNewRun} autoFocus>
          {T.runEnd.newRun}
        </button>
        <button type="button" className="btn btn-ghost text-lg" onClick={onTitle}>
          {T.runEnd.toTitle}
        </button>
      </div>
    </div>
  )
}
