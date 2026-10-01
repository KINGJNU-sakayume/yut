import { describe, expect, it } from 'vitest'
import { BOSS_MAP, maxBossTier } from '../../data/bosses'
import { getTalismanDef, talismanSellValue } from '../../data/talismans'
import { botAction } from '../__sim__/bot'
import { SAVE_VERSION, rerollCost } from '../config'
import { buyUnlock, canBuyUnlock, createMeta, evaluateAchievements, recordRunEnd } from '../meta'
import { gameReducer } from '../reducer'
import { createRun } from '../run'
import {
  clearRun,
  deserializeMeta,
  deserializeRun,
  loadRun,
  memoryStorage,
  saveRun,
  serializeMeta,
  serializeRun,
} from '../save/saveManager'
import { createEvent } from '../events'
import { createShop } from '../shop'
import type { RunState } from '../types'
import { ALL_UNLOCKS, act, boardRun, rejected } from './helpers'

function playActions(seed: string, count: number): RunState {
  let run = createRun({ seed, unlocked: ALL_UNLOCKS })
  for (let i = 0; i < count; i++) {
    const action = botAction(run, { greed: 1 })
    if (!action) break
    run = gameReducer(run, action)
    expect(run.notice).toBeNull()
  }
  return run
}

describe('seeded runs', () => {
  it('the same seed and the same decisions reproduce the exact same run', () => {
    const a = playActions('repro-42', 160)
    const b = playActions('repro-42', 160)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('different seeds diverge', () => {
    const a = playActions('repro-42', 60)
    const b = playActions('repro-43', 60)
    expect(JSON.stringify(a.board?.history ?? a.history)).not.toBe(JSON.stringify(b.board?.history ?? b.history))
  })

  it('boss schedule is fixed by the seed and opens with gentle bosses', () => {
    expect(createRun({ seed: 'x' }).bosses).toEqual(createRun({ seed: 'x' }).bosses)
    for (let i = 0; i < 30; i++) {
      const bosses = createRun({ seed: `boss-${i}`, unlocked: ALL_UNLOCKS }).bosses
      expect(bosses).toHaveLength(8)
      bosses.forEach((id, yardIndex) => expect(BOSS_MAP[id].tier).toBeLessThanOrEqual(maxBossTier(yardIndex + 1)))
      for (let y = 1; y < 8; y++) expect(bosses[y]).not.toBe(bosses[y - 1])
    }
  })
})

describe('save / resume', () => {
  it('round-trips a run in the middle of a board', () => {
    const run = playActions('save-me', 40)
    const raw = serializeRun(run, 123)
    const loaded = deserializeRun(raw)
    expect(loaded.status).toBe('ok')
    if (loaded.status === 'ok') expect(loaded.value).toEqual(run)
  })

  it('a resumed run continues exactly like the original', () => {
    const original = playActions('resume-1', 30)
    const loaded = deserializeRun(serializeRun(original))
    expect(loaded.status).toBe('ok')
    if (loaded.status !== 'ok') return
    let a = original
    let b = loaded.value
    for (let i = 0; i < 40; i++) {
      const action = botAction(a)
      if (!action) break
      a = gameReducer(a, action)
      b = gameReducer(b, action)
    }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('handles empty, corrupt and incompatible saves gracefully', () => {
    expect(deserializeRun(null).status).toBe('empty')
    expect(deserializeRun('{not json').status).toBe('corrupt')
    expect(deserializeRun(JSON.stringify({ hello: 1 })).status).toBe('corrupt')
    const run = createRun({ seed: 'v' })
    const old = JSON.stringify({ kind: 'yut-roguelike-save', version: SAVE_VERSION + 1, savedAt: 0, run })
    expect(deserializeRun(old).status).toBe('incompatible')
    const broken = JSON.stringify({ kind: 'yut-roguelike-save', version: SAVE_VERSION, savedAt: 0, run: { ...run, pieces: 'nope' } })
    expect(deserializeRun(broken).status).toBe('corrupt')
  })

  it('saves to and clears from storage', () => {
    const storage = memoryStorage()
    const run = createRun({ seed: 'store' })
    expect(saveRun(storage, run)).toBe(true)
    const loaded = loadRun(storage)
    expect(loaded.status).toBe('ok')
    clearRun(storage)
    expect(loadRun(storage).status).toBe('empty')
  })

  it('meta progression survives serialization and resets on garbage', () => {
    const meta = createMeta()
    meta.dokkaebibul = 7
    expect(deserializeMeta(serializeMeta(meta)).meta.dokkaebibul).toBe(7)
    expect(deserializeMeta('garbage').status).toBe('reset')
  })
})

describe('shop', () => {
  function shopRun(coins = 100): RunState {
    const run = createRun({ seed: 'shop', unlocked: ALL_UNLOCKS })
    run.coins = coins
    run.shop = createShop(run)
    run.phase = 'shop'
    return run
  }

  it('reroll costs escalate 3 → 5 → 8 → 12 → 17', () => {
    expect([0, 1, 2, 3, 4].map(rerollCost)).toEqual([3, 5, 8, 12, 17])
    let run = shopRun(100)
    for (let i = 0; i < 5; i++) run = act(run, { type: 'SHOP_REROLL' })
    expect(run.coins).toBe(100 - (3 + 5 + 8 + 12 + 17))
  })

  it('buying and selling talismans, with capacity and coin checks', () => {
    let run = shopRun(100)
    const offer = run.shop!.talismans.find((o) => o != null)!
    const index = run.shop!.talismans.indexOf(offer)
    run = act(run, { type: 'SHOP_BUY', section: 'talisman', index })
    expect(run.talismans.map((t) => t.defId)).toEqual([offer.defId])
    expect(run.coins).toBe(100 - offer.price)
    expect(run.shop!.talismans[index]).toBeNull()
    const coins = run.coins
    run = act(run, { type: 'SHOP_SELL', index: 0 })
    expect(run.talismans).toHaveLength(0)
    expect(run.coins).toBe(coins + talismanSellValue(getTalismanDef(offer.defId)!))

    let poor = shopRun(0)
    const idx = poor.shop!.talismans.findIndex((o) => o != null)
    rejected(poor, { type: 'SHOP_BUY', section: 'talisman', index: idx })
    poor = act(poor, { type: 'SHOP_LEAVE' })
    expect(poor.phase).toBe('wager')
    expect(poor.boardIndex).toBe(1)
  })

  it('stick modifications and traits need a target', () => {
    let run = shopRun(100)
    run.shop!.special = { kind: 'stickMod', id: 'heavy', price: 6 }
    rejected(run, { type: 'SHOP_BUY', section: 'special', index: 0 })
    run = act(run, { type: 'SHOP_BUY', section: 'special', index: 0, params: { stickIndex: 2 } })
    expect(run.sticks[2].modId).toBe('heavy')
    run.shop!.special = { kind: 'trait', id: 'iron', price: 6 }
    run = act(run, { type: 'SHOP_BUY', section: 'special', index: 0, params: { pieceId: 3 } })
    expect(run.pieces[3].traitId).toBe('iron')
    run.shop!.special = { kind: 'stickMod', id: 'ghostGate', price: 6 }
    rejected(run, { type: 'SHOP_BUY', section: 'special', index: 0, params: { stickIndex: 1 } })
  })

  it('soft synergy marks at most the first slot and never guarantees it', () => {
    const run = createRun({ seed: 'syn', unlocked: ALL_UNLOCKS })
    const shop = createShop(run)
    expect(shop.talismans.slice(1).every((o) => !o?.synergy)).toBe(true)
  })
})

describe('events and the Goblin Market', () => {
  function eventRun(id: string, coins = 50): RunState {
    const run = createRun({ seed: `event-${id}`, unlocked: ALL_UNLOCKS })
    run.coins = coins
    run.event = createEvent(run, id)
    run.phase = 'event'
    return run
  }

  it('주막 sells extra base throws for the next board', () => {
    let run = eventRun('jumak')
    run = act(run, { type: 'EVENT_CHOOSE', optionId: 'throws' })
    expect(run.mods.nextBoardThrows).toBe(2)
    run = act(run, { type: 'EVENT_LEAVE' })
    run = act(run, { type: 'CHOOSE_WAGER', wager: 'standard' })
    expect(run.board!.baseThrowsTotal).toBe(14)
  })

  it('노름판 uses the shown payout table', () => {
    let run = eventRun('nolum', 20)
    run = act(run, { type: 'EVENT_CHOOSE', optionId: 'gamble', params: { wager: 5 } })
    const g = run.event!.gamble!
    expect(run.coins).toBe(20 - 5 + g.payout)
    expect(run.event!.stage).toBe('done')
  })

  it('도깨비 장터 exchanges are explicit and limited to one per visit', () => {
    let run = eventRun('goblinMarket')
    run.event!.marketOffers = ['goblinForScore', 'throwsForLegend', 'slotForPower']
    run = act(run, { type: 'EVENT_CHOOSE', optionId: 'goblinForScore' })
    expect(run.mods.permanentGoblins).toBe(1)
    expect(run.mods.goalScoreMult).toBe(1.25)
    rejected(run, { type: 'EVENT_CHOOSE', optionId: 'throwsForLegend', params: { offerIndex: 0 } })
  })

  it('cursed talismans can be bought at the market and show their downside', () => {
    let run = eventRun('goblinMarket')
    const offer = run.event!.cursedOffers[0]
    expect(getTalismanDef(offer.defId)!.downside).toBeTruthy()
    run = act(run, { type: 'EVENT_CHOOSE', optionId: 'buyCursed', params: { offerIndex: 0 } })
    expect(run.talismans.map((t) => t.defId)).toContain(offer.defId)
  })
})

describe('meta progression', () => {
  it('records a run once and awards 도깨비불', () => {
    const run = boardRun()
    run.stats.boardsCleared = 6
    run.phase = 'defeat'
    const { meta, reward } = recordRunEnd(createMeta(), run, 'loss', 1)
    expect(reward).toBe(2 * 2 + 1)
    expect(meta.stats.runs).toBe(1)
    expect(recordRunEnd(meta, run, 'loss', 2).reward).toBe(0)
  })

  it('achievements and unlocks', () => {
    const run = boardRun()
    run.stats.cashOuts = 1
    const { meta, earned } = evaluateAchievements(createMeta(), run)
    expect(earned.map((a) => a.id)).toContain('firstCashOut')
    expect(meta.dokkaebibul).toBeGreaterThan(0)
    const rich = { ...meta, dokkaebibul: 20 }
    expect(canBuyUnlock(rich, 'debt:2')).toBe(false)
    const bought = buyUnlock(rich, 'debt:1')
    expect(bought.unlocked).toContain('debt:1')
    expect(canBuyUnlock(bought, 'debt:2')).toBe(true)
  })
})
