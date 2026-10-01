// Shop (장터): talismans, consumables, one stick-mod/trait offer, rerolls, selling.

import { CONSUMABLES } from '../data/consumables'
import { PIECE_TRAITS, getTrait } from '../data/pieceTraits'
import { SYNERGY_TAGS, TALISMANS, getTalismanDef, talismanSellValue, type TalismanDef, type TalismanTag } from '../data/talismans'
import { STICK_MODS, getStickMod } from '../data/yutMods'
import { SHOP, STICKS, rerollCost } from './config'
import { runHook, silentEnv } from './effects/effectEngine'
import { EngineError, invariant } from './errors'
import { draw, drawInt, pickWeighted } from './rng'
import type { RunState, ShopBuyParams, ShopState, ShopTalismanOffer, TalismanInstance } from './types'

export function shopPriceFactor(run: RunState): number {
  const ctx = { factor: 1 }
  runHook(silentEnv(run, null), 'queryShopPrice', ctx)
  return ctx.factor
}

export function priceOf(run: RunState, base: number): number {
  return Math.max(1, Math.round(base * shopPriceFactor(run)))
}

export function newTalismanInstance(run: RunState, defId: string): TalismanInstance {
  run.seqInstance += 1
  return { uid: `t${run.seqInstance}`, defId, counter: 0, charges: 0, usedThisBoard: 0, power: 1 }
}

export function isUnlocked(run: RunState, unlock: string | undefined): boolean {
  return !unlock || run.unlocked.includes(unlock)
}

export function discoverTalisman(run: RunState, defId: string): void {
  if (!run.discovered.talismans.includes(defId)) run.discovered.talismans.push(defId)
}

/** Tags owned by at least SHOP.synergyMinOwned talismans (soft synergy weighting). */
export function synergyTags(run: RunState): TalismanTag[] {
  const counts = new Map<TalismanTag, number>()
  for (const inst of run.talismans) {
    const def = getTalismanDef(inst.defId)
    if (!def) continue
    for (const tag of def.tags) if (SYNERGY_TAGS.includes(tag)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return SYNERGY_TAGS.filter((t) => (counts.get(t) ?? 0) >= SHOP.synergyMinOwned)
}

function talismanPool(run: RunState, exclude: Set<string>): TalismanDef[] {
  const owned = new Set(run.talismans.map((t) => t.defId))
  return TALISMANS.filter((d) => d.pool === 'shop' && isUnlocked(run, d.unlock) && !owned.has(d.id) && !exclude.has(d.id))
}

function rollTalismanOffers(run: RunState): (ShopTalismanOffer | null)[] {
  const offers: (ShopTalismanOffer | null)[] = []
  const taken = new Set<string>()
  const synergy = synergyTags(run)
  for (let slot = 0; slot < SHOP.talismanSlots; slot++) {
    const pool = talismanPool(run, taken)
    // Only the first slot gets a modest synergy weight boost. Never a guarantee.
    const boosted = slot === 0 && synergy.length > 0
    const pick = pickWeighted(run.rng, 'shop', pool, (d) => {
      const base = SHOP.rarityWeights[d.rarity] ?? 0
      return boosted && d.tags.some((t) => synergy.includes(t)) ? base * SHOP.synergyWeight : base
    })
    if (!pick) {
      offers.push(null)
      continue
    }
    taken.add(pick.id)
    discoverTalisman(run, pick.id)
    offers.push({ defId: pick.id, price: priceOf(run, pick.price), synergy: boosted && pick.tags.some((t) => synergy.includes(t)) })
  }
  return offers
}

function rollOffers(run: RunState): Pick<ShopState, 'talismans' | 'consumables' | 'special'> {
  const talismans = rollTalismanOffers(run)
  const consumables = Array.from({ length: SHOP.consumableSlots }, () => {
    const def = CONSUMABLES[drawInt(run.rng, 'shop', CONSUMABLES.length)]
    return { id: def.id, price: priceOf(run, def.price) }
  })
  const special =
    draw(run.rng, 'shop') < 0.5
      ? (() => {
          const mod = STICK_MODS[drawInt(run.rng, 'shop', STICK_MODS.length)]
          return { kind: 'stickMod' as const, id: mod.id, price: priceOf(run, mod.price) }
        })()
      : (() => {
          const trait = PIECE_TRAITS[drawInt(run.rng, 'shop', PIECE_TRAITS.length)]
          return { kind: 'trait' as const, id: trait.id, price: priceOf(run, trait.price) }
        })()
  return { talismans, consumables, special }
}

export function createShop(run: RunState): ShopState {
  return { ...rollOffers(run), rerolls: 0, freeRerollUsed: false }
}

export function currentRerollCost(run: RunState, shop: ShopState): number {
  if (run.freeRerolls > 0 && !shop.freeRerollUsed) return 0
  return rerollCost(shop.rerolls)
}

export function rerollShop(run: RunState): void {
  const shop = run.shop
  invariant(shop && run.phase === 'shop', '상점이 열려 있지 않습니다')
  const cost = currentRerollCost(run, shop)
  if (run.coins < cost) throw new EngineError('엽전이 부족합니다')
  run.coins -= cost
  if (cost === 0 && run.freeRerolls > 0 && !shop.freeRerollUsed) {
    run.freeRerolls -= 1
    shop.freeRerollUsed = true
  } else shop.rerolls += 1
  Object.assign(shop, rollOffers(run))
}

export function installStickMod(run: RunState, modId: string, stickIndex: number | undefined, twinOf: number | undefined): void {
  const mod = getStickMod(modId)
  invariant(mod, '알 수 없는 개조입니다')
  invariant(stickIndex != null && stickIndex >= 0 && stickIndex < STICKS.count, '막대를 고르세요')
  if (mod.markedOnly) invariant(stickIndex === STICKS.markedIndex, `${mod.name}은(는) 뒷도 표시 막대(1번)에만 달 수 있습니다`)
  let twin: number | null = null
  if (mod.twin) {
    invariant(twinOf != null && twinOf >= 0 && twinOf < STICKS.count && twinOf !== stickIndex, '따라 할 다른 막대를 고르세요')
    invariant(!getStickMod(run.sticks[twinOf]?.modId)?.twin, '쌍둥이 윷끼리는 서로 따라 할 수 없습니다')
    const mirrored = run.sticks.some((s, i) => i !== stickIndex && s.twinOf === stickIndex && getStickMod(s.modId)?.twin)
    invariant(!mirrored, '다른 쌍둥이 윷이 따라 하는 막대에는 쌍둥이 윷을 달 수 없습니다')
    twin = twinOf
  }
  run.sticks[stickIndex] = { modId: mod.id, twinOf: twin }
}

export function setTrait(run: RunState, traitId: string, pieceId: number | undefined): void {
  invariant(getTrait(traitId), '알 수 없는 특성입니다')
  invariant(pieceId != null && run.pieces[pieceId], '말을 고르세요')
  run.pieces[pieceId] = { ...run.pieces[pieceId], traitId }
}

export function buyFromShop(run: RunState, section: 'talisman' | 'consumable' | 'special', index: number, params: ShopBuyParams = {}): void {
  const shop = run.shop
  invariant(shop && run.phase === 'shop', '상점이 열려 있지 않습니다')
  if (section === 'talisman') {
    const offer = shop.talismans[index]
    invariant(offer, '이미 팔린 물건입니다')
    if (run.talismans.length >= run.talismanCapacity) throw new EngineError('부적 칸이 가득 찼습니다. 먼저 하나를 파세요')
    if (run.coins < offer.price) throw new EngineError('엽전이 부족합니다')
    run.coins -= offer.price
    run.talismans.push(newTalismanInstance(run, offer.defId))
    discoverTalisman(run, offer.defId)
    shop.talismans[index] = null
    return
  }
  if (section === 'consumable') {
    const offer = shop.consumables[index]
    invariant(offer, '이미 팔린 물건입니다')
    if (run.consumables.length >= run.consumableCapacity) throw new EngineError('소모품 칸이 가득 찼습니다')
    if (run.coins < offer.price) throw new EngineError('엽전이 부족합니다')
    run.coins -= offer.price
    run.consumables.push(offer.id)
    shop.consumables[index] = null
    return
  }
  const offer = shop.special
  invariant(offer, '이미 팔린 물건입니다')
  if (run.coins < offer.price) throw new EngineError('엽전이 부족합니다')
  if (offer.kind === 'stickMod') installStickMod(run, offer.id, params.stickIndex, params.twinOf)
  else setTrait(run, offer.id, params.pieceId)
  run.coins -= offer.price
  shop.special = null
}

export function sellTalisman(run: RunState, index: number): void {
  invariant(run.phase === 'shop', '상점에서만 팔 수 있습니다')
  const inst = run.talismans[index]
  invariant(inst, '빈 칸입니다')
  const def = getTalismanDef(inst.defId)
  run.coins += def ? talismanSellValue(def) : 1
  run.talismans.splice(index, 1)
}
