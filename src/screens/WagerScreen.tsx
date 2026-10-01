import { getBoss } from '../data/bosses'
import { targetFor, BOARD_KIND_NAMES } from '../game/board'
import { GOBLINS, WAGERS, WAGER_ORDER } from '../game/config'
import { isSealed, yardOf } from '../game/state'
import type { GameAction, RunState } from '../game/types'
import { TalismanBar } from '../components/Talismans/TalismanBar'
import { ConsumableBar } from '../components/Side/ConsumableBar'
import { T, formatMult, formatNumber } from '../i18n/ko'

export function WagerScreen({ run, dispatch }: { run: RunState; dispatch: (a: GameAction) => void }) {
  const index = run.boardIndex
  const yard = yardOf(index)
  const kind = (['small', 'big', 'boss'] as const)[index % 3]
  const yardBoss = getBoss(run.bosses[yard - 1])
  const boss = kind === 'boss' ? yardBoss : null
  const goblins = Math.min(GOBLINS.maxCount, GOBLINS.baseCount + run.mods.permanentGoblins)
  const sealed = run.pieces.filter((p) => isSealed(run, p.id, yard))
  const yardStart = (yard - 1) * 3
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <section className="paper-panel p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-serif text-2xl font-black">
            {T.hud.yard(yard)} · {BOARD_KIND_NAMES[kind]}
          </h2>
          <ol className="flex gap-2 text-xs">
            {[0, 1, 2].map((k) => (
              <li key={k} className={`rounded border px-2 py-1 ${yardStart + k === index ? 'border-goblin bg-goblin/10 font-black' : yardStart + k < index ? 'border-jade text-jade line-through' : 'border-ink/30'}`}>
                {BOARD_KIND_NAMES[(['small', 'big', 'boss'] as const)[k]]} {formatNumber(targetFor(run, yardStart + k))}
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-2 text-lg">
          {T.wager.target}: <b className="font-serif text-2xl text-goblin">{formatNumber(targetFor(run, index))}</b> · 👹 {T.wager.goblins(goblins + (boss ? 0 : 0))}
          {boss ? ' (그중 하나는 대장)' : ''}
        </p>
        {!boss && yardBoss && (
          <p className="mt-2 rounded border border-goblin/40 bg-goblin/5 px-2 py-1 text-sm">
            이번 마당의 대장: <b className="text-goblin">{yardBoss.glyph} {yardBoss.name}</b> — {yardBoss.rule}
          </p>
        )}
        {boss && (
          <div className="mt-3 rounded-lg border-2 border-goblin bg-goblin/10 p-3">
            <p className="font-serif text-lg font-black text-goblin">
              <span className="mr-1 text-2xl">{boss.glyph}</span> {boss.name}
            </p>
            <p className="font-bold">{T.wager.bossRule}: {boss.rule}</p>
            <p className="text-sm text-ink-soft">{boss.detail}</p>
          </div>
        )}
        {(run.mods.nextBoardThrows > 0 || run.mods.nextBoardMomentum > 0 || sealed.length > 0 || run.mods.baseThrowDelta !== 0) && (
          <p className="mt-2 text-sm">
            {run.mods.nextBoardThrows > 0 && <span className="chip mr-1">{T.wager.nextBonus}: 기본 던지기 +{run.mods.nextBoardThrows}</span>}
            {run.mods.nextBoardMomentum > 0 && <span className="chip mr-1">{T.wager.nextBonus}: 시작 기세 +{run.mods.nextBoardMomentum}</span>}
            {run.mods.baseThrowDelta !== 0 && <span className="chip mr-1">도깨비 장터 계약: 기본 던지기 {run.mods.baseThrowDelta}</span>}
            {sealed.length > 0 && <span className="chip mr-1 text-goblin">봉인: {sealed.map((p) => p.id + 1).join(', ')}번 말</span>}
          </p>
        )}
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        {WAGER_ORDER.map((id) => {
          const w = WAGERS[id]
          const throws = Math.max(1, w.baseThrows + run.mods.baseThrowDelta + run.mods.nextBoardThrows)
          return (
            <div key={id} className={`paper-panel flex flex-col gap-2 p-4 ${id === 'allIn' ? 'border-goblin' : ''}`}>
              <h3 className="font-serif text-xl font-black">{T.wager.names[id]}</h3>
              <p className="text-sm text-ink-soft">{T.wager.desc[id]}</p>
              <ul className="text-sm">
                <li>
                  {T.wager.baseThrows}: <b className="font-serif text-lg">{throws}</b>
                </li>
                <li>
                  {T.wager.rewardMult}: <b>{formatMult(w.rewardMult)}</b>
                </li>
                {w.extraCoins > 0 && <li className="font-bold text-goblin">{T.wager.extraCoins(w.extraCoins)}</li>}
              </ul>
              <button type="button" className={`btn mt-auto ${id === 'allIn' ? 'btn-red' : ''}`} onClick={() => dispatch({ type: 'CHOOSE_WAGER', wager: id })}>
                {T.wager.choose}
              </button>
            </div>
          )
        })}
      </section>
      <section className="wood-panel flex flex-wrap items-end justify-between gap-4 p-3">
        <TalismanBar run={run} board={null} dispatch={dispatch} />
        <ConsumableBar run={run} board={null} dispatch={dispatch} />
      </section>
    </div>
  )
}
