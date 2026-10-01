import { getTrait } from '../../data/pieceTraits'
import { NODE_MAP } from '../../game/boardGraph'
import type { GoblinPlan } from '../../game/ai/goblinIntent'
import { BACKDO_FALLBACK_RULE, hasAnyLegalMove } from '../../game/movement'
import { RESULT_STEPS } from '../../game/config'
import { predictedCashOut, type PendingView } from '../../game/selectors'
import type { BoardState, Group, RunState } from '../../game/types'
import { RESULT_LABELS, T, formatMult, formatNumber } from '../../i18n/ko'
import type { PathOptionView } from '../Board/YutBoard'

const nodeName = (id: string | null) => (id ? (NODE_MAP[id]?.name ?? id) : '')

export function PendingResults({
  views,
  selectedId,
  onSelect,
  onDiscard,
}: {
  views: PendingView[]
  selectedId: number | null
  onSelect: (id: number) => void
  onDiscard: (id: number) => void
}) {
  if (views.length === 0) return null
  const selected = views.find((v) => v.result.id === selectedId)
  return (
    <section className="paper-panel p-2">
      <h3 className="mb-1 font-serif text-sm font-black">{T.play.results}</h3>
      <div className="flex flex-wrap gap-1.5" role="listbox" aria-label={T.play.pickResult}>
        {views.map(({ result, legal }) => {
          const usable = hasAnyLegalMove(legal)
          const isSel = result.id === selectedId
          return (
            <button
              key={result.id}
              type="button"
              role="option"
              aria-selected={isSel}
              onClick={() => onSelect(result.id)}
              className={`rounded-lg border-2 px-2.5 py-1 text-left font-serif font-black shadow-sm ${
                isSel ? 'border-indigo bg-indigo text-paper' : usable ? 'border-wood bg-paper-2 text-ink' : 'border-goblin bg-goblin/10 text-goblin'
              }`}
            >
              <span className="text-lg">{RESULT_LABELS[result.kind]}</span>
              <span className="ml-1 text-xs">{RESULT_STEPS[result.kind] > 0 ? `${RESULT_STEPS[result.kind]}칸` : '뒤로 1'}</span>
              {result.heung > 0 && <span className="ml-1 rounded bg-spirit/40 px-1 text-[10px]">흥{result.heung}</span>}
              {result.goldCargo > 0 && <span className="ml-1 rounded bg-brass/40 px-1 text-[10px]">금+{result.goldCargo}</span>}
              {result.conversions.length > 0 && <span className="ml-1 block text-[10px] font-normal">({RESULT_LABELS[result.originalKind]}→{RESULT_LABELS[result.kind]})</span>}
            </button>
          )
        })}
      </div>
      {selected && !hasAnyLegalMove(selected.legal) && (
        <div className="mt-2 rounded border border-goblin bg-goblin/10 p-2 text-sm">
          <p className="font-bold text-goblin">{T.play.noMoves}</p>
          {selected.legal.moves.flatMap((m) => m.illegal).slice(0, 2).map((il, i) => (
            <p key={i} className="text-xs">
              {il.reason}
            </p>
          ))}
          <button type="button" className="btn btn-red mt-1 w-full text-sm" onClick={() => onDiscard(selected.result.id)}>
            {T.play.discard}
          </button>
        </div>
      )}
      {selected?.legal.fallback && (
        <p className="mt-2 rounded border border-indigo/50 bg-indigo/10 p-1.5 text-xs">
          <b>{T.play.fallback}:</b> {BACKDO_FALLBACK_RULE}
        </p>
      )}
    </section>
  )
}

export function GroupInfo({ run, group }: { run: RunState; group: Group | null }) {
  if (!group) return <p className="paper-panel p-2 text-xs text-ink-soft">{T.play.noSelection}</p>
  const predicted = group.zone === 'finished' ? null : predictedCashOut(run, group.id)
  const traits = group.members.map((m) => getTrait(run.pieces[m]?.traitId)).filter((t) => t != null)
  const where = group.zone === 'home' ? '집' : group.zone === 'finished' ? '퇴근함' : group.zone === 'goal' ? '참먹이' : nodeName(group.node)
  return (
    <section className="paper-panel p-2 text-sm" aria-label={T.play.selected}>
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif font-black">
          {group.members.map((m) => m + 1).join('·')}번 말 <span className="text-xs font-normal text-ink-soft">@{where}</span>
        </h3>
        {group.sneak && <span className="chip">🛡 살금살금</span>}
      </div>
      <dl className="mt-1 grid grid-cols-4 gap-1 text-center">
        <div className="rounded bg-white/40 p-1">
          <dt className="text-[10px] text-ink-soft">{T.play.cargo}</dt>
          <dd className="font-serif text-lg font-black">{formatNumber(group.cargo)}</dd>
        </div>
        <div className="rounded bg-white/40 p-1">
          <dt className="text-[10px] text-ink-soft">{T.play.momentum}</dt>
          <dd className="font-serif text-lg font-black">{formatNumber(group.momentum)}</dd>
        </div>
        <div className="rounded bg-white/40 p-1">
          <dt className="text-[10px] text-ink-soft">{T.play.stack}</dt>
          <dd className="font-serif text-lg font-black">{group.members.length}</dd>
        </div>
        <div className="rounded bg-white/40 p-1">
          <dt className="text-[10px] text-ink-soft">{T.play.laps}</dt>
          <dd className="font-serif text-lg font-black">{group.laps}/3</dd>
        </div>
      </dl>
      {traits.length > 0 && (
        <p className="mt-1 text-xs">
          {traits.map((t) => (
            <span key={t.id} className="chip mr-1" title={t.description}>
              {t.glyph} {t.name}
            </span>
          ))}
        </p>
      )}
      <p className="mt-1 text-[11px] text-ink-soft">
        이번 바퀴에 걷은 칸 {group.visited.length}개{group.usedShortcut ? ' · 지름길 사용함' : ''}
      </p>
      {predicted && (
        <p className="mt-1 rounded bg-brass/20 px-2 py-1 text-sm">
          {T.play.predicted}: <b className="font-serif text-base">{formatNumber(predicted.score)}점</b>
          <span className="block text-[11px] text-ink-soft">
            {formatNumber(predicted.cargo)} × {formatNumber(predicted.momentum)} × {formatMult(predicted.stackMult)} × {formatMult(predicted.lapMult)}
            {predicted.finalMult !== 1 ? ` × ${formatMult(predicted.finalMult)}` : ''}
          </span>
        </p>
      )}
    </section>
  )
}

export function MoveOptions({
  options,
  focused,
  onChoose,
  onFocus,
}: {
  options: PathOptionView[]
  focused: number | null
  onChoose: (i: number) => void
  onFocus: (i: number | null) => void
}) {
  if (options.length === 0) return null
  return (
    <section className="paper-panel p-2">
      <h3 className="mb-1 font-serif text-sm font-black">{T.play.pickPath}</h3>
      <div className="flex flex-col gap-1.5">
        {options.map((view) => {
          const p = view.preview
          const danger = p?.destThreatened && !p.destProtected
          return (
            <button
              key={view.index}
              type="button"
              onClick={() => onChoose(view.index)}
              onMouseEnter={() => onFocus(view.index)}
              onMouseLeave={() => onFocus(null)}
              onFocus={() => onFocus(view.index)}
              className={`rounded-lg border-2 px-2 py-1.5 text-left text-sm ${danger ? 'border-goblin bg-goblin/10' : 'border-wood bg-white/50'} ${focused === view.index ? 'ring-2 ring-indigo' : ''}`}
            >
              <span className="font-serif font-black">→ {view.label}</span>
              {p && (
                <span className="mt-0.5 flex flex-wrap gap-1 text-[11px]">
                  <span className="chip">화물 +{p.cargoGained}</span>
                  <span className="chip">기세 +{p.momentumGained}</span>
                  {p.captured > 0 && <span className="chip bg-jade/20">🎯 {T.play.captureHere(p.captured)} (+{p.stolen}, 한 번 더)</span>}
                  {p.stackedWith && <span className="chip bg-indigo/15">🤝 {T.play.stackHere(p.stackSize)}</span>}
                  {p.reachesGoal && <span className="chip bg-brass/30">🏁 {T.play.reachGoal}</span>}
                  {p.toHome && <span className="chip">{T.play.toHome}</span>}
                  {p.coinsDelta > 0 && <span className="chip">🪙 +{p.coinsDelta}</span>}
                  {danger ? (
                    <span className="chip border-goblin bg-goblin text-paper">✕ {T.play.destDanger}</span>
                  ) : p.destThreatened ? (
                    <span className="chip">{T.play.protected(p.destProtected ?? '')}</span>
                  ) : null}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function GoblinIntents({ plans, board }: { plans: GoblinPlan[]; board: BoardState }) {
  return (
    <section className="paper-panel p-2 text-xs" aria-label={T.play.threats}>
      <h3 className="mb-1 font-serif text-sm font-black text-goblin">👹 {T.play.threats}</h3>
      <ul className="space-y-1">
        {plans.map((plan) => {
          const goblin = board.goblins.find((g) => g.id === plan.goblinId)
          if (!goblin) return null
          const target = plan.targetGroupId ? board.groups.find((g) => g.id === plan.targetGroupId) : null
          return (
            <li key={plan.goblinId} className="rounded border border-goblin/30 bg-goblin/5 px-1.5 py-1">
              <div className="flex flex-wrap items-baseline gap-x-1.5">
                <b>{goblin.boss ? '도깨비 대장' : '도깨비'}</b>
                <span className="text-ink-soft">@{nodeName(goblin.node)}</span>
                <span className="chip">화물 {goblin.cargo}</span>
                {goblin.heldCargo > 0 && <span className="chip border-jade text-jade">내 화물 {goblin.heldCargo} 보관 중 → 잡으면 되찾음</span>}
              </div>
              {plan.resting ? (
                <p className="text-ink-soft">{T.play.resting}</p>
              ) : (
                <p>
                  <b className="text-goblin">
                    {RESULT_LABELS[plan.result ?? 'do']} → {plan.steps}칸
                  </b>
                  {plan.parts.length > 0 && <span className="text-ink-soft"> ({plan.parts.map((p) => `${p.source} ${p.value > 0 ? '+' : ''}${p.value}`).join(', ')})</span>}
                  {plan.aimed && <span className="ml-1 text-goblin">🎯 노림수</span>}
                  <br />
                  길: {plan.path.map(nodeName).join(' → ') || '제자리'} · 착지 <b>{nodeName(plan.landing)}</b>{' '}
                  {target ? (
                    plan.targetProtected ? (
                      <span className="font-bold text-jade">({target.members.map((m) => m + 1).join('·')}번 말 — {T.play.protected(plan.targetProtected)})</span>
                    ) : (
                      <span className="font-black text-goblin">✕ {target.members.map((m) => m + 1).join('·')}번 말을 잡는다!</span>
                    )
                  ) : (
                    <span className="text-ink-soft">(빈 칸)</span>
                  )}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export function LogPanel({ board }: { board: BoardState }) {
  const entries = board.log.slice(-14).reverse()
  const color: Record<string, string> = {
    capture: 'text-jade',
    captured: 'text-goblin font-bold',
    score: 'text-indigo font-bold',
    talisman: 'text-[#8a5a00]',
    boss: 'text-goblin',
    goblin: 'text-goblin-dark',
  }
  return (
    <section className="paper-panel max-h-48 overflow-y-auto p-2 text-[11px]" aria-label={T.play.log} aria-live="polite">
      <h3 className="mb-1 font-serif text-sm font-black">{T.play.log}</h3>
      <ul className="space-y-0.5">
        {entries.map((e) => (
          <li key={e.id} className={color[e.kind] ?? ''}>
            {e.text}
          </li>
        ))}
      </ul>
    </section>
  )
}
