// Event resolution (성황당, 주막, 대장간, 노름판, 산신령, 도깨비 장터).

import { CONSUMABLES } from '../data/consumables'
import { EVENTS, GAMBLE_PAYOUT, GAMBLE_WAGERS, MARKET_OFFERS } from '../data/events'
import { TALISMANS, getTalismanDef, type TalismanDef } from '../data/talismans'
import { STICK_MODS, getStickMod } from '../data/yutMods'
import { RESULT_NAMES } from './board'
import { runHook, silentEnv } from './effects/effectEngine'
import { EngineError, invariant } from './errors'
import { draw, drawInt } from './rng'
import { discoverTalisman, installStickMod, isUnlocked, newTalismanInstance, priceOf } from './shop'
import { yardOf } from './state'
import type { EventParams, EventState, RunState } from './types'
import { baseThrowSetup, facesToResult, finalizeSetup, rollThrow } from './yut'

export const JUMAK_PRICES = { throws: 5, momentum: 3, consumable: 3 } as const
export const DAEJANG_REROLL_PRICE = 2
export const GOBLIN_SCORE_FACTOR = 1.25

function pickDistinct<T>(run: RunState, items: readonly T[], count: number): T[] {
  const pool = [...items]
  const out: T[] = []
  while (out.length < count && pool.length > 0) {
    const i = drawInt(run.rng, 'event', pool.length)
    out.push(pool.splice(i, 1)[0])
  }
  return out
}

function ownedIds(run: RunState): Set<string> {
  return new Set([...run.talismans, ...run.blessings].map((t) => t.defId))
}

function talismanChoices(run: RunState, filter: (d: TalismanDef) => boolean, count: number): string[] {
  const owned = ownedIds(run)
  const pool = TALISMANS.filter((d) => filter(d) && isUnlocked(run, d.unlock) && !owned.has(d.id))
  const picks = pickDistinct(run, pool, count).map((d) => d.id)
  picks.forEach((id) => discoverTalisman(run, id))
  return picks
}

export function pickRandomEvent(run: RunState): string {
  const last = run.eventHistory[run.eventHistory.length - 1]
  const pool = EVENTS.filter((e) => !e.special && isUnlocked(run, e.unlock) && e.id !== last)
  return pool[drawInt(run.rng, 'event', pool.length)]?.id ?? 'jumak'
}

export function createEvent(run: RunState, id: string): EventState {
  const ev: EventState = {
    id,
    stage: 'choose',
    talismanOffers: [],
    modOffers: [],
    blessingOffers: [],
    marketOffers: [],
    cursedOffers: [],
    traitOffers: [],
    rerolled: false,
    message: null,
    gamble: null,
  }
  switch (id) {
    case 'seonghwang':
      ev.talismanOffers = talismanChoices(run, (d) => d.pool === 'shop' && (d.rarity === 'rare' || d.rarity === 'legendary'), 2)
      break
    case 'daejang':
      ev.modOffers = pickDistinct(run, STICK_MODS, 3).map((m) => m.id)
      break
    case 'sansin':
      ev.blessingOffers = talismanChoices(run, (d) => d.pool === 'blessing', 3)
      break
    case 'goblinMarket': {
      ev.marketOffers = pickDistinct(run, MARKET_OFFERS, 3).map((m) => m.id)
      ev.cursedOffers = talismanChoices(run, (d) => d.pool === 'market', 2).map((defId) => ({
        defId,
        price: priceOf(run, getTalismanDef(defId)?.price ?? 4),
      }))
      ev.talismanOffers = talismanChoices(run, (d) => d.pool === 'shop' && d.rarity === 'legendary', 2)
      if (ev.talismanOffers.length < 2) {
        ev.talismanOffers.push(...talismanChoices(run, (d) => d.pool === 'shop' && d.rarity === 'rare', 2 - ev.talismanOffers.length))
      }
      ev.modOffers = pickDistinct(
        run,
        STICK_MODS.filter((m) => !m.twin && !m.markedOnly),
        2,
      ).map((m) => m.id)
      break
    }
    default:
      break
  }
  if (!run.discovered.events.includes(id)) run.discovered.events.push(id)
  run.eventHistory.push(id)
  return ev
}

function requireSlot(run: RunState): void {
  if (run.talismans.length >= run.talismanCapacity) throw new EngineError('부적 칸이 가득 찼습니다')
}

function pay(run: RunState, amount: number): void {
  if (run.coins < amount) throw new EngineError('엽전이 부족합니다')
  run.coins -= amount
}

function finish(ev: EventState, message: string): void {
  ev.stage = 'done'
  ev.message = message
}

export function chooseEvent(run: RunState, optionId: string, params: EventParams = {}): void {
  const ev = run.event
  invariant(ev && run.phase === 'event', '진행 중인 만남이 없습니다')
  invariant(ev.stage === 'choose' || ev.id === 'goblinMarket', '이미 선택했습니다')
  switch (ev.id) {
    case 'seonghwang': {
      const idx = params.talismanIndex ?? -1
      const inst = run.talismans[idx]
      invariant(inst, '바칠 부적을 고르세요')
      const def = getTalismanDef(inst.defId)
      if (optionId === 'offerTalisman') {
        const offer = ev.talismanOffers[params.offerIndex ?? -1]
        invariant(offer, '받을 부적을 고르세요')
        run.talismans.splice(idx, 1)
        run.talismans.push(newTalismanInstance(run, offer))
        finish(ev, `「${def?.name}」을(를) 바치고 「${getTalismanDef(offer)?.name}」을(를) 받았다.`)
      } else if (optionId === 'offerCoins') {
        const coins = (def?.price ?? 2) * 2
        run.talismans.splice(idx, 1)
        run.coins += coins
        finish(ev, `「${def?.name}」을(를) 바치고 엽전 ${coins}냥을 받았다.`)
      } else throw new EngineError('알 수 없는 선택입니다')
      return
    }
    case 'jumak': {
      if (optionId === 'throws') {
        pay(run, JUMAK_PRICES.throws)
        run.mods.nextBoardThrows += 2
        finish(ev, '든든한 국밥 한 그릇. 다음 판 기본 던지기 +2.')
      } else if (optionId === 'momentum') {
        pay(run, JUMAK_PRICES.momentum)
        run.mods.nextBoardMomentum += 3
        finish(ev, '막걸리 한 사발에 신이 났다. 다음 판 모든 말 기세 +3으로 시작.')
      } else if (optionId === 'consumable') {
        if (run.consumables.length >= run.consumableCapacity) throw new EngineError('소모품 칸이 가득 찼습니다')
        pay(run, JUMAK_PRICES.consumable)
        const def = CONSUMABLES[drawInt(run.rng, 'event', CONSUMABLES.length)]
        run.consumables.push(def.id)
        finish(ev, `주모가 「${def.name}」을(를) 챙겨 주었다.`)
      } else throw new EngineError('알 수 없는 선택입니다')
      return
    }
    case 'daejang': {
      if (optionId === 'reroll') {
        invariant(!ev.rerolled, '이미 다른 개조를 보았습니다')
        pay(run, DAEJANG_REROLL_PRICE)
        ev.modOffers = pickDistinct(run, STICK_MODS, 3).map((m) => m.id)
        ev.rerolled = true
        return
      }
      if (optionId === 'mod') {
        const modId = ev.modOffers[params.offerIndex ?? -1]
        invariant(modId, '개조를 고르세요')
        installStickMod(run, modId, params.stickIndex, params.twinOf)
        finish(ev, `${(params.stickIndex ?? 0) + 1}번 막대에 「${getStickMod(modId)?.name}」을(를) 달았다.`)
        return
      }
      throw new EngineError('알 수 없는 선택입니다')
    }
    case 'nolum': {
      invariant(optionId === 'gamble', '알 수 없는 선택입니다')
      const wager = params.wager ?? 0
      invariant((GAMBLE_WAGERS as readonly number[]).includes(wager), '걸 엽전을 고르세요')
      pay(run, wager)
      const setup = baseThrowSetup(run.sticks, [])
      const ctx = { backProb: setup.backProb.slice(), hauntedSyncChance: 0 }
      runHook(silentEnv(run, null), 'beforeThrow', ctx)
      const final = finalizeSetup({ ...setup, backProb: ctx.backProb, hauntedSyncChance: ctx.hauntedSyncChance })
      const rolled = rollThrow(final, () => draw(run.rng, 'event'))
      const kind = facesToResult(rolled.faces, final.markedIndex)
      const payout = wager * (GAMBLE_PAYOUT[kind] ?? 0)
      run.coins += payout
      ev.gamble = { faces: rolled.faces, kind, wager, payout }
      finish(ev, payout > 0 ? `${RESULT_NAMES[kind]}! 엽전 ${payout}냥을 땄다.` : `${RESULT_NAMES[kind]}… 엽전 ${wager}냥을 잃었다.`)
      return
    }
    case 'sansin': {
      invariant(optionId === 'bless', '알 수 없는 선택입니다')
      const id = ev.blessingOffers[params.offerIndex ?? -1]
      invariant(id, '축복을 고르세요')
      run.blessings.push(newTalismanInstance(run, id))
      finish(ev, `산신령이 「${getTalismanDef(id)?.name}」의 축복을 내렸다.`)
      return
    }
    case 'goblinMarket':
      return chooseMarket(run, ev, optionId, params)
    default:
      throw new EngineError('알 수 없는 만남입니다')
  }
}

function chooseMarket(run: RunState, ev: EventState, optionId: string, params: EventParams): void {
  if (optionId === 'buyCursed') {
    const offer = ev.cursedOffers[params.offerIndex ?? -1]
    invariant(offer, '고를 저주 부적이 없습니다')
    requireSlot(run)
    pay(run, offer.price)
    run.talismans.push(newTalismanInstance(run, offer.defId))
    ev.cursedOffers = ev.cursedOffers.filter((o) => o !== offer)
    ev.message = `「${getTalismanDef(offer.defId)?.name}」을(를) 샀다. 저주도 함께 따라온다.`
    return
  }
  invariant(ev.marketOffers.includes(optionId), '이 장터에서는 그 거래를 하지 않습니다')
  switch (optionId) {
    case 'throwsForLegend': {
      const defId = ev.talismanOffers[params.offerIndex ?? -1]
      invariant(defId, '받을 부적을 고르세요')
      requireSlot(run)
      run.mods.baseThrowDelta -= 1
      run.talismans.push(newTalismanInstance(run, defId))
      ev.message = `기본 던지기를 영원히 하나 잃고 「${getTalismanDef(defId)?.name}」을(를) 얻었다.`
      break
    }
    case 'slotForPower': {
      const inst = run.talismans[params.talismanIndex ?? -1]
      invariant(inst, '강화할 부적을 고르세요')
      invariant(inst.power === 1, '이미 강화된 부적입니다')
      if (run.talismans.length > run.talismanCapacity - 1) throw new EngineError('부적 칸을 줄이려면 빈 칸이 하나 있어야 합니다')
      run.talismanCapacity -= 1
      inst.power = 2
      ev.message = `부적 칸 하나를 내주고 「${getTalismanDef(inst.defId)?.name}」의 힘을 두 배로 키웠다.`
      break
    }
    case 'sealForMods': {
      const pieceId = params.pieceId ?? -1
      invariant(run.pieces[pieceId], '봉인할 말을 고르세요')
      const yard = yardOf(run.boardIndex)
      const sealedNext = run.mods.sealed.filter((s) => s.untilYard >= yard + 1).map((s) => s.pieceId)
      invariant(!sealedNext.includes(pieceId), '이미 봉인된 말입니다')
      invariant(run.pieces.length - sealedNext.length - 1 >= 1, '움직일 말이 하나는 남아야 합니다')
      invariant(params.stickIndex != null && params.stickIndex2 != null && params.stickIndex !== params.stickIndex2, '서로 다른 막대 두 개를 고르세요')
      const [m1, m2] = ev.modOffers
      installStickMod(run, m1, params.stickIndex, undefined)
      installStickMod(run, m2, params.stickIndex2, undefined)
      run.mods.sealed.push({ pieceId, untilYard: yard + 1 })
      ev.message = `${pieceId + 1}번 말을 다음 마당 동안 봉인하고 윷 개조 두 개를 얻었다.`
      break
    }
    case 'goblinForScore': {
      run.mods.permanentGoblins += 1
      run.mods.goalScoreMult = Math.round(run.mods.goalScoreMult * GOBLIN_SCORE_FACTOR * 10000) / 10000
      ev.message = `도깨비 하나가 영원히 따라붙는다. 모든 퇴근 점수 ×${run.mods.goalScoreMult}.`
      break
    }
    case 'coinsForCopy': {
      const inst = run.talismans[params.talismanIndex ?? -1]
      invariant(inst, '복제할 부적을 고르세요')
      const def = getTalismanDef(inst.defId)
      invariant(def && def.rarity !== 'legendary' && def.rarity !== 'cursed', '전설·저주 부적은 복제할 수 없습니다')
      requireSlot(run)
      const cost = Math.floor(run.coins / 2)
      run.coins -= cost
      run.talismans.push(newTalismanInstance(run, inst.defId))
      ev.message = `엽전 ${cost}냥을 내고 「${def.name}」을(를) 하나 더 얻었다.`
      break
    }
    default:
      throw new EngineError('알 수 없는 거래입니다')
  }
  // One structural exchange per market visit.
  ev.marketOffers = []
}
