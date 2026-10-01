import { useState, type ReactNode } from 'react'
import { GAMBLE_PAYOUT, GAMBLE_WAGERS, MARKET_OFFERS, getEvent } from '../data/events'
import { getTalismanDef, talismanSellValue } from '../data/talismans'
import { getStickMod } from '../data/yutMods'
import { DAEJANG_REROLL_PRICE, JUMAK_PRICES } from '../game/events'
import { gambleOdds } from '../game/selectors'
import { isSealed, yardOf } from '../game/state'
import { RESULT_KINDS, type EventParams, type GameAction, type RunState } from '../game/types'
import { Modal } from '../components/common/Modal'
import { PiecePicker, StickPicker } from '../components/common/Pickers'
import { TalismanDetails } from '../components/Talismans/TalismanCard'
import { TalismanBar } from '../components/Talismans/TalismanBar'
import { YutSticks } from '../components/Yut/YutSticks'
import { RESULT_LABELS, T } from '../i18n/ko'

type Dispatch = (a: GameAction) => void

function Option({ title, desc, children }: { title: ReactNode; desc?: ReactNode; children?: ReactNode }) {
  return (
    <div className="paper-panel flex flex-col gap-2 p-3">
      <h3 className="font-serif text-lg font-black">{title}</h3>
      {desc && <div className="text-sm">{desc}</div>}
      {children}
    </div>
  )
}

function OwnedTalismanList({ run, onPick, filter, valueLabel }: { run: RunState; onPick: (i: number) => void; filter?: (defId: string, power: number) => boolean; valueLabel?: (defId: string) => string }) {
  if (run.talismans.length === 0) return <p className="text-sm text-ink-soft">가진 부적이 없습니다.</p>
  return (
    <div className="flex flex-wrap gap-2">
      {run.talismans.map((inst, i) => {
        const def = getTalismanDef(inst.defId)
        const ok = !filter || filter(inst.defId, inst.power)
        return (
          <button key={inst.uid} type="button" className="btn btn-paper text-sm" disabled={!ok} onClick={() => onPick(i)}>
            {def?.glyph} {def?.name}
            {valueLabel ? ` ${valueLabel(inst.defId)}` : ''}
          </button>
        )
      })}
    </div>
  )
}

export function EventScreen({ run, dispatch }: { run: RunState; dispatch: Dispatch }) {
  const ev = run.event
  const def = ev ? getEvent(ev.id) : null
  if (!ev || !def) return null
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <header className="paper-panel flex items-center gap-4 p-4">
        <span className="talisman-paper flex h-20 w-16 items-center justify-center rounded border-2 font-serif text-4xl font-black">{def.glyph}</span>
        <div>
          <h2 className="font-serif text-3xl font-black">{def.name}</h2>
          <p className="text-sm text-ink-soft">{def.description}</p>
          <p className="mt-1 font-serif font-black">🪙 {run.coins}</p>
        </div>
      </header>
      {ev.message && <p className="animate-rise rounded-lg border-2 border-brass bg-night-2 p-3 text-center font-bold text-brass-light">{ev.message}</p>}
      {ev.stage === 'done' && ev.id !== 'goblinMarket' ? (
        <div className="flex flex-col items-center gap-3">
          {ev.gamble && (
            <div className="wood-panel flex items-center gap-4 p-3">
              <YutSticks faces={ev.gamble.faces} seq={1} sticks={run.sticks} setup={null} />
              <p className="font-serif text-2xl font-black text-brass-light">
                {RESULT_LABELS[ev.gamble.kind]} → 🪙 {ev.gamble.payout}
              </p>
            </div>
          )}
          <button type="button" className="btn text-lg" onClick={() => dispatch({ type: 'EVENT_LEAVE' })} autoFocus>
            {T.event.done} →
          </button>
        </div>
      ) : (
        <EventBody run={run} dispatch={dispatch} />
      )}
      <section className="wood-panel p-3">
        <TalismanBar run={run} board={null} dispatch={dispatch} />
      </section>
    </div>
  )
}

function EventBody({ run, dispatch }: { run: RunState; dispatch: Dispatch }) {
  const ev = run.event!
  const choose = (optionId: string, params?: EventParams) => dispatch({ type: 'EVENT_CHOOSE', optionId, params })
  const leave = (
    <button type="button" className="btn btn-ghost self-center" onClick={() => dispatch({ type: 'EVENT_LEAVE' })}>
      {T.event.leave}
    </button>
  )
  switch (ev.id) {
    case 'seonghwang':
      return <Seonghwang run={run} choose={choose} leave={leave} />
    case 'jumak':
      return (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Option title={`국밥 — 🪙${JUMAK_PRICES.throws}`} desc="다음 판 기본 던지기 +2">
              <button type="button" className="btn" disabled={run.coins < JUMAK_PRICES.throws} onClick={() => choose('throws')}>
                사 먹는다
              </button>
            </Option>
            <Option title={`막걸리 — 🪙${JUMAK_PRICES.momentum}`} desc="다음 판 모든 말 기세 +3으로 시작">
              <button type="button" className="btn" disabled={run.coins < JUMAK_PRICES.momentum} onClick={() => choose('momentum')}>
                마신다
              </button>
            </Option>
            <Option title={`주모의 보따리 — 🪙${JUMAK_PRICES.consumable}`} desc="무작위 소모품 하나">
              <button type="button" className="btn" disabled={run.coins < JUMAK_PRICES.consumable || run.consumables.length >= run.consumableCapacity} onClick={() => choose('consumable')}>
                받는다
              </button>
            </Option>
          </div>
          {leave}
        </div>
      )
    case 'daejang':
      return <Daejang run={run} choose={choose} leave={leave} />
    case 'nolum':
      return <Nolum run={run} choose={choose} leave={leave} />
    case 'sansin':
      return (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 md:grid-cols-3">
            {ev.blessingOffers.map((id, i) => {
              const d = getTalismanDef(id)
              if (!d) return null
              return (
                <Option key={id} title={`${d.glyph} ${d.name}`} desc={<TalismanDetails def={d} />}>
                  <button type="button" className="btn" onClick={() => choose('bless', { offerIndex: i })}>
                    축복을 받는다
                  </button>
                </Option>
              )
            })}
          </div>
          {leave}
        </div>
      )
    case 'goblinMarket':
      return <GoblinMarket run={run} choose={choose} leave={leave} />
    default:
      return leave
  }
}

type Choose = (optionId: string, params?: EventParams) => void

function Seonghwang({ run, choose, leave }: { run: RunState; choose: Choose; leave: ReactNode }) {
  const ev = run.event!
  const [mode, setMode] = useState<'talisman' | 'coins' | null>(null)
  const [sacrifice, setSacrifice] = useState<number | null>(null)
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Option title="부적을 바치고 귀한 부적을 받는다" desc="가진 부적 하나를 바치면, 아래의 희귀·전설 부적 중 하나를 받는다.">
          <div className="grid gap-2 md:grid-cols-2">
            {ev.talismanOffers.map((id) => {
              const d = getTalismanDef(id)
              return d ? (
                <div key={id} className="rounded border border-wood bg-white/40 p-2">
                  <TalismanDetails def={d} />
                </div>
              ) : null
            })}
          </div>
          <button type="button" className="btn" disabled={run.talismans.length === 0 || ev.talismanOffers.length === 0} onClick={() => setMode('talisman')}>
            바칠 부적 고르기
          </button>
        </Option>
        <Option title="부적을 바치고 엽전을 받는다" desc="가진 부적 하나를 바치면 그 값의 두 배를 엽전으로 받는다.">
          <button type="button" className="btn" disabled={run.talismans.length === 0} onClick={() => setMode('coins')}>
            바칠 부적 고르기
          </button>
        </Option>
      </div>
      {leave}
      {mode && (
        <Modal title="성황당에 바칠 부적" onClose={() => (setMode(null), setSacrifice(null))}>
          {sacrifice == null ? (
            <OwnedTalismanList
              run={run}
              valueLabel={mode === 'coins' ? (id) => `(🪙${(getTalismanDef(id)?.price ?? 1) * 2})` : undefined}
              onPick={(i) => (mode === 'coins' ? choose('offerCoins', { talismanIndex: i }) : setSacrifice(i))}
            />
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-bold">받을 부적:</p>
              {ev.talismanOffers.map((id, i) => (
                <button key={id} type="button" className="btn btn-paper w-full" onClick={() => choose('offerTalisman', { talismanIndex: sacrifice, offerIndex: i })}>
                  {getTalismanDef(id)?.glyph} {getTalismanDef(id)?.name}
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

function Daejang({ run, choose, leave }: { run: RunState; choose: Choose; leave: ReactNode }) {
  const ev = run.event!
  const [picked, setPicked] = useState<number | null>(null)
  const mod = picked != null ? getStickMod(ev.modOffers[picked]) : null
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-3">
        {ev.modOffers.map((id, i) => {
          const m = getStickMod(id)
          if (!m) return null
          return (
            <Option key={`${id}-${i}`} title={`${m.glyph} ${m.name}`} desc={m.description}>
              <button type="button" className="btn" onClick={() => setPicked(i)}>
                이걸로 (무료)
              </button>
            </Option>
          )
        })}
      </div>
      <div className="flex justify-center gap-3">
        <button type="button" className="btn btn-paper" disabled={ev.rerolled || run.coins < DAEJANG_REROLL_PRICE} onClick={() => choose('reroll')}>
          다른 것 보기 (🪙{DAEJANG_REROLL_PRICE}, 1번)
        </button>
        {leave}
      </div>
      {mod && picked != null && (
        <Modal title={`${mod.name} 달기`} onClose={() => setPicked(null)}>
          <StickPicker sticks={run.sticks} mod={mod} onPick={(stickIndex, twinOf) => choose('mod', { offerIndex: picked, stickIndex, twinOf })} />
        </Modal>
      )}
    </div>
  )
}

function Nolum({ run, choose, leave }: { run: RunState; choose: Choose; leave: ReactNode }) {
  const odds = gambleOdds(run)
  const ev = 1 * RESULT_KINDS.reduce((s, k) => s + odds[k] * (GAMBLE_PAYOUT[k] ?? 0), 0)
  return (
    <div className="flex flex-col gap-3">
      <Option title="배당표 (내 윷가락 기준 확률)" desc="엽전을 걸고 한 번 던진다. 걸, 윷, 모만 돈을 돌려준다.">
        <table className="w-full max-w-sm text-sm">
          <thead>
            <tr className="text-left text-ink-soft">
              <th>결과</th>
              <th>확률</th>
              <th>배당</th>
            </tr>
          </thead>
          <tbody>
            {RESULT_KINDS.map((k) => (
              <tr key={k}>
                <td className="font-bold">{RESULT_LABELS[k]}</td>
                <td className="font-mono">{(odds[k] * 100).toFixed(1)}%</td>
                <td className="font-mono">×{GAMBLE_PAYOUT[k]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-ink-soft">기대값: 건 돈의 {(ev * 100).toFixed(0)}%</p>
        <div className="flex flex-wrap gap-2">
          {GAMBLE_WAGERS.map((w) => (
            <button key={w} type="button" className="btn" disabled={run.coins < w} onClick={() => choose('gamble', { wager: w })}>
              🪙{w} 걸기
            </button>
          ))}
        </div>
      </Option>
      {leave}
    </div>
  )
}

function GoblinMarket({ run, choose, leave }: { run: RunState; choose: Choose; leave: ReactNode }) {
  const ev = run.event!
  const [pending, setPending] = useState<{ optionId: string; params?: EventParams } | null>(null)
  const [setup, setSetup] = useState<string | null>(null)
  const [piece, setPiece] = useState<number | null>(null)
  const [stick1, setStick1] = useState<number | null>(null)
  const yard = yardOf(run.boardIndex)
  const offers = MARKET_OFFERS.filter((o) => ev.marketOffers.includes(o.id))

  const startOffer = (id: string) => {
    if (id === 'goblinForScore') setPending({ optionId: id })
    else setSetup(id)
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-serif text-xl font-black text-goblin">교환 (한 번만, 되돌릴 수 없음)</h3>
      {offers.length === 0 && <p className="text-paper/70">오늘의 교환은 끝났다.</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {offers.map((o) => (
          <Option
            key={o.id}
            title={o.reward}
            desc={
              <p className="rounded bg-goblin/10 px-2 py-1 font-bold text-goblin">
                {T.talisman.downside}: {o.cost}
              </p>
            }
          >
            {o.id === 'throwsForLegend' && (
              <ul className="text-xs">
                {ev.talismanOffers.map((id) => (
                  <li key={id}>
                    · {getTalismanDef(id)?.name}: {getTalismanDef(id)?.effect}
                  </li>
                ))}
              </ul>
            )}
            {o.id === 'sealForMods' && <p className="text-xs">개조: {ev.modOffers.map((m) => getStickMod(m)?.name).join(', ')}</p>}
            <button type="button" className="btn btn-red" onClick={() => startOffer(o.id)}>
              거래하기
            </button>
          </Option>
        ))}
      </div>

      <h3 className="font-serif text-xl font-black text-goblin">저주 부적</h3>
      <div className="grid gap-3 md:grid-cols-2">
        {ev.cursedOffers.length === 0 && <p className="text-paper/70">남은 저주 부적이 없다.</p>}
        {ev.cursedOffers.map((offer, i) => {
          const d = getTalismanDef(offer.defId)
          if (!d) return null
          return (
            <Option key={offer.defId} title={`${d.glyph} ${d.name} — 🪙${offer.price}`} desc={<TalismanDetails def={d} />}>
              <button
                type="button"
                className="btn btn-red"
                disabled={run.coins < offer.price || run.talismans.length >= run.talismanCapacity}
                onClick={() => setPending({ optionId: 'buyCursed', params: { offerIndex: i } })}
              >
                {run.talismans.length >= run.talismanCapacity ? T.shop.full : '저주를 산다'}
              </button>
            </Option>
          )
        })}
      </div>
      {leave}

      {setup && (
        <Modal title={MARKET_OFFERS.find((o) => o.id === setup)?.reward} onClose={() => (setSetup(null), setPiece(null), setStick1(null))}>
          {setup === 'throwsForLegend' && (
            <div className="space-y-2">
              {ev.talismanOffers.map((id, i) => (
                <button key={id} type="button" className="btn btn-paper w-full" disabled={run.talismans.length >= run.talismanCapacity} onClick={() => (setPending({ optionId: setup, params: { offerIndex: i } }), setSetup(null))}>
                  {getTalismanDef(id)?.glyph} {getTalismanDef(id)?.name}
                </button>
              ))}
              {run.talismans.length >= run.talismanCapacity && <p className="text-sm text-goblin">부적 칸이 가득 찼습니다.</p>}
            </div>
          )}
          {setup === 'slotForPower' && (
            <OwnedTalismanList run={run} filter={(_id, power) => power === 1} onPick={(i) => (setPending({ optionId: setup, params: { talismanIndex: i } }), setSetup(null))} />
          )}
          {setup === 'coinsForCopy' && (
            <OwnedTalismanList
              run={run}
              filter={(id) => !['legendary', 'cursed'].includes(getTalismanDef(id)?.rarity ?? '')}
              valueLabel={(id) => `(값 ${talismanSellValue(getTalismanDef(id)!)})`}
              onPick={(i) => (setPending({ optionId: setup, params: { talismanIndex: i } }), setSetup(null))}
            />
          )}
          {setup === 'sealForMods' &&
            (piece == null ? (
              <PiecePicker
                pieces={run.pieces}
                label="다음 마당 동안 봉인할 말"
                disabled={run.pieces.filter((p) => isSealed(run, p.id, yard + 1)).map((p) => p.id)}
                onPick={setPiece}
              />
            ) : stick1 == null ? (
              <StickPicker sticks={run.sticks} mod={getStickMod(ev.modOffers[0])!} onPick={(s) => setStick1(s)} />
            ) : (
              <StickPicker
                sticks={run.sticks}
                mod={getStickMod(ev.modOffers[1])!}
                exclude={[stick1]}
                onPick={(s) => (setPending({ optionId: setup, params: { pieceId: piece, stickIndex: stick1, stickIndex2: s } }), setSetup(null), setPiece(null), setStick1(null))}
              />
            ))}
        </Modal>
      )}

      {pending && (
        <Modal title={T.event.confirm} onClose={() => setPending(null)}>
          <p className="mb-3 text-sm">
            {pending.optionId === 'buyCursed'
              ? `저주 부적 「${getTalismanDef(ev.cursedOffers[pending.params?.offerIndex ?? 0]?.defId ?? '')?.name}」의 대가: ${getTalismanDef(ev.cursedOffers[pending.params?.offerIndex ?? 0]?.defId ?? '')?.downside}`
              : `대가: ${MARKET_OFFERS.find((o) => o.id === pending.optionId)?.cost}`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-red flex-1"
              onClick={() => {
                choose(pending.optionId, pending.params)
                setPending(null)
              }}
            >
              {T.event.confirmYes}
            </button>
            <button type="button" className="btn btn-paper flex-1" onClick={() => setPending(null)} autoFocus>
              {T.event.confirmNo}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
