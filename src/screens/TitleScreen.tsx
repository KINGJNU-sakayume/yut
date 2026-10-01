import { useState } from 'react'
import { maxDebtLevel, type MetaState } from '../game/meta'
import { randomSeedString } from '../game/rng'
import type { LoadResult } from '../game/save/saveManager'
import { yardOf } from '../game/state'
import type { RunState } from '../game/types'
import { GoblinMask } from '../components/Board/GoblinMask'
import { Modal } from '../components/common/Modal'
import { RulesSummary } from './MenuModal'
import { T, formatNumber } from '../i18n/ko'
import { urlSeed } from '../ui/settings'

interface TitleScreenProps {
  meta: MetaState
  saved: LoadResult<RunState>
  onContinue: () => void
  onNewRun: (seed: string, debt: number) => void
  onDeleteSave: () => void
  onCompendium: () => void
  onSettings: () => void
}

export function TitleScreen({ meta, saved, onContinue, onNewRun, onDeleteSave, onCompendium, onSettings }: TitleScreenProps) {
  const [seed, setSeed] = useState(() => urlSeed() ?? '')
  const [debt, setDebt] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [rules, setRules] = useState(false)
  const maxDebt = maxDebtLevel(meta)
  const hasSave = saved.status === 'ok'
  const start = () => onNewRun(seed.trim() || randomSeedString(), Math.min(debt, maxDebt))

  return (
    <div className="mx-auto flex min-h-[92vh] max-w-4xl flex-col items-center justify-center gap-6 px-3 py-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <svg viewBox="-8 -8 16 16" className="h-24 w-24 drop-shadow-[0_0_18px_rgba(168,38,28,0.6)]" aria-hidden>
          <GoblinMask boss />
        </svg>
        <h1 className="font-serif text-6xl font-black tracking-tight text-brass-light text-shadow-ink md:text-7xl">{T.appTitle}</h1>
        <p className="font-serif text-xl text-paper/90">{T.appSubtitle}</p>
        <p className="max-w-2xl text-sm leading-relaxed text-paper/70">{T.intro}</p>
      </div>

      <div className="grid w-full gap-4 md:grid-cols-2">
        <section className="paper-panel flex flex-col gap-3 p-4">
          {hasSave && saved.status === 'ok' && (
            <button type="button" className="btn text-xl" onClick={onContinue} autoFocus>
              ▶ {T.title.continue}
              <span className="text-xs font-normal">
                ({yardOf(saved.value.boardIndex)}마당 · 씨앗 {saved.value.seed})
              </span>
            </button>
          )}
          {(saved.status === 'corrupt' || saved.status === 'incompatible') && (
            <div className="rounded border-2 border-goblin bg-goblin/10 p-2 text-sm">
              <p className="font-bold text-goblin">{T.title.savedCorrupt}</p>
              <p className="text-xs">{saved.reason}</p>
              <button type="button" className="btn btn-red mt-1 text-sm" onClick={onDeleteSave}>
                {T.title.deleteSave}
              </button>
            </div>
          )}
          <h2 className="font-serif text-xl font-black">{T.title.newRun}</h2>
          <label className="flex flex-col gap-1 text-sm font-bold">
            {T.title.seed}
            <span className="flex gap-2">
              <input
                className="flex-1 rounded border-2 border-wood bg-white/70 px-2 py-1 font-mono"
                value={seed}
                maxLength={40}
                placeholder="예: 12345"
                onChange={(e) => setSeed(e.target.value)}
              />
              <button type="button" className="btn btn-paper text-sm" onClick={() => setSeed(randomSeedString())}>
                🎲 {T.title.randomSeed}
              </button>
            </span>
            <span className="text-xs font-normal text-ink-soft">{T.title.seedHint} (URL ?seed=12345 도 됩니다)</span>
          </label>
          <label className="flex items-center justify-between gap-2 text-sm font-bold">
            {T.title.debtLevel}
            <select className="rounded border-2 border-wood bg-white/70 px-2 py-1" value={Math.min(debt, maxDebt)} onChange={(e) => setDebt(Number(e.target.value))}>
              {Array.from({ length: maxDebt + 1 }, (_, i) => (
                <option key={i} value={i}>
                  {i === 0 ? '0 (기본)' : `${i}단계`}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-red text-xl" onClick={() => (hasSave ? setConfirm(true) : start())}>
            🎋 {T.title.start}
          </button>
        </section>

        <section className="paper-panel flex flex-col gap-3 p-4">
          <h2 className="font-serif text-xl font-black">{T.title.records}</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded bg-white/40 p-2">
              <dt className="text-xs text-ink-soft">{T.title.dokkaebibul}</dt>
              <dd className="font-serif text-2xl font-black text-goblin">🔥 {meta.dokkaebibul}</dd>
            </div>
            <div className="rounded bg-white/40 p-2">
              <dt className="text-xs text-ink-soft">승 / 패</dt>
              <dd className="font-serif text-2xl font-black">
                {meta.stats.wins} / {meta.stats.losses}
              </dd>
            </div>
            <div className="rounded bg-white/40 p-2">
              <dt className="text-xs text-ink-soft">최고 총점</dt>
              <dd className="font-serif text-lg font-black">{formatNumber(meta.stats.highestScore)}</dd>
            </div>
            <div className="rounded bg-white/40 p-2">
              <dt className="text-xs text-ink-soft">최고 퇴근</dt>
              <dd className="font-serif text-lg font-black">{formatNumber(meta.stats.bestCashOut)}</dd>
            </div>
          </dl>
          <div className="mt-auto flex flex-wrap gap-2">
            <button type="button" className="btn btn-paper flex-1" onClick={onCompendium}>
              📜 {T.title.compendium}
            </button>
            <button type="button" className="btn btn-paper flex-1" onClick={() => setRules(true)}>
              📖 규칙
            </button>
            <button type="button" className="btn btn-paper flex-1" onClick={onSettings}>
              ⚙ {T.title.settings}
            </button>
          </div>
        </section>
      </div>

      {confirm && (
        <Modal title={T.title.newRun} onClose={() => setConfirm(false)}>
          <p className="mb-3 text-sm">{T.title.confirmNewRun}</p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-red flex-1" onClick={start}>
              {T.title.start}
            </button>
            <button type="button" className="btn btn-paper flex-1" onClick={() => setConfirm(false)} autoFocus>
              {T.event.confirmNo}
            </button>
          </div>
        </Modal>
      )}
      {rules && (
        <Modal title="규칙 요약" onClose={() => setRules(false)} wide>
          <RulesSummary />
          <button type="button" className="btn mt-3 w-full" onClick={() => setRules(false)}>
            {T.settings.close}
          </button>
        </Modal>
      )}
    </div>
  )
}
