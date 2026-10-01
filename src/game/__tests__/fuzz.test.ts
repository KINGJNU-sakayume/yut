// Plays full runs with the heuristic bot and checks engine invariants after every action.
import { describe, expect, it } from 'vitest'
import { botAction } from '../__sim__/bot'
import { GOBLINS, MAX_EXTRA_LAPS } from '../config'
import { gameReducer } from '../reducer'
import { createRun } from '../run'
import { isSealed } from '../state'
import type { RunState } from '../types'
import { ALL_UNLOCKS } from './helpers'

function checkInvariants(run: RunState): void {
  expect(run.coins).toBeGreaterThanOrEqual(0)
  expect(run.talismans.length).toBeLessThanOrEqual(run.talismanCapacity)
  expect(run.consumables.length).toBeLessThanOrEqual(run.consumableCapacity)
  const board = run.board
  if (!board || run.phase !== 'board') return
  const seen = new Map<number, number>()
  for (const g of board.groups) {
    for (const pid of g.members) seen.set(pid, (seen.get(pid) ?? 0) + 1)
    expect(g.cargo).toBeGreaterThanOrEqual(0)
    expect(g.momentum).toBeGreaterThanOrEqual(0)
    expect(g.laps).toBeLessThanOrEqual(MAX_EXTRA_LAPS)
    if (g.zone === 'board') expect(g.node).not.toBeNull()
    else expect(g.node).toBeNull()
    expect(g.members.length).toBeGreaterThan(0)
  }
  for (const piece of run.pieces) {
    if (isSealed(run, piece.id, board.yard)) expect(seen.get(piece.id) ?? 0).toBe(0)
    else expect(seen.get(piece.id)).toBe(1)
  }
  const nodes = board.groups.filter((g) => g.zone === 'board').map((g) => g.node)
  expect(new Set(nodes).size).toBe(nodes.length)
  expect(board.goblins.length).toBeLessThanOrEqual(GOBLINS.maxCount)
  if (board.phase === 'goalDecision') {
    const g = board.groups.find((x) => x.id === board.goalGroupId)
    expect(g?.zone).toBe('goal')
  } else {
    expect(board.groups.some((g) => g.zone === 'goal')).toBe(false)
  }
  expect(board.baseThrowsLeft).toBeGreaterThanOrEqual(0)
  expect(board.extraThrows).toBeGreaterThanOrEqual(0)
}

describe('fuzz: full runs keep invariants', () => {
  it('bot runs never reach an illegal or stuck state', { timeout: 120_000 }, () => {
    for (let i = 0; i < 12; i++) {
      let run = createRun({ seed: `fuzz-${i}`, unlocked: ALL_UNLOCKS })
      let steps = 0
      while (steps++ < 6000) {
        const action = botAction(run, { greed: i % 3, wager: (['safe', 'standard', 'allIn'] as const)[i % 3] })
        if (!action) break
        run = gameReducer(run, action)
        expect(run.notice, `seed fuzz-${i} step ${steps}: ${JSON.stringify(action)}`).toBeNull()
        checkInvariants(run)
      }
      expect(['victory', 'defeat']).toContain(run.phase)
    }
  })
})

/** Random (but seeded) actions that exercise events, the market, consumables and the shop. */
function chaosAction(run: RunState, rand: () => number): import('../types').GameAction | null {
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]
  const n = (k: number) => Math.floor(rand() * k)
  switch (run.phase) {
    case 'event': {
      const ev = run.event!
      const options = ['offerTalisman', 'offerCoins', 'throws', 'momentum', 'consumable', 'reroll', 'mod', 'gamble', 'bless', 'buyCursed', ...ev.marketOffers]
      return {
        type: 'EVENT_CHOOSE',
        optionId: pick(options),
        params: {
          talismanIndex: n(Math.max(1, run.talismans.length)),
          offerIndex: n(3),
          stickIndex: n(4),
          stickIndex2: n(4),
          twinOf: n(4),
          pieceId: n(4),
          wager: pick([2, 5, 10]),
        },
      }
    }
    case 'shop': {
      const r = rand()
      if (r < 0.25) return { type: 'SHOP_BUY', section: 'special', index: 0, params: { stickIndex: n(4), twinOf: n(4), pieceId: n(4) } }
      if (r < 0.45) return { type: 'SHOP_BUY', section: 'consumable', index: n(2) }
      if (r < 0.6) return { type: 'SHOP_BUY', section: 'talisman', index: n(3) }
      if (r < 0.7 && run.talismans.length > 0) return { type: 'SHOP_SELL', index: n(run.talismans.length) }
      if (r < 0.8 && run.talismans.length > 1) return { type: 'REORDER_TALISMAN', from: n(run.talismans.length), to: n(run.talismans.length) }
      if (r < 0.85) return { type: 'SHOP_REROLL' }
      return null
    }
    case 'board': {
      if (run.consumables.length > 0 && rand() < 0.2) {
        const goblin = run.board?.goblins[n(Math.max(1, run.board.goblins.length))]
        return {
          type: 'USE_CONSUMABLE',
          slot: n(run.consumables.length),
          params: {
            stickIndex: n(4),
            face: pick(['back', 'front'] as const),
            result: pick(['backdo', 'do', 'gae', 'geol', 'yut', 'mo'] as const),
            goblinId: rand() < 0.7 ? goblin?.id : undefined,
            status: pick(['suppression', 'blockade'] as const),
          },
        }
      }
      if (run.board?.phase === 'play' && rand() < 0.05) return { type: 'REWIND' }
      return null
    }
    default:
      return null
  }
}

describe('fuzz: chaotic choices (events, market, consumables, shop) keep invariants', () => {
  it('random legal and illegal choices never corrupt the state', { timeout: 120_000 }, () => {
    for (let i = 0; i < 10; i++) {
      let seed = 0x9e3779b9 ^ (i * 7919)
      const rand = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return seed / 4294967296
      }
      let run = createRun({ seed: `chaos-${i}`, unlocked: ALL_UNLOCKS })
      run.coins = 30
      let steps = 0
      while (steps++ < 8000) {
        const chaos = chaosAction(run, rand)
        if (chaos) {
          const next = gameReducer(run, chaos)
          if (next.notice) expect(next.board).toBe(run.board) // rejected actions change nothing
          run = { ...next, notice: null }
          checkInvariants(run)
          if (!next.notice) continue
        }
        const action = botAction(run, { greed: i % 3 })
        if (!action) break
        run = gameReducer(run, action)
        expect(run.notice, `chaos-${i} step ${steps}: ${JSON.stringify(action)}`).toBeNull()
        checkInvariants(run)
      }
      expect(['victory', 'defeat']).toContain(run.phase)
    }
  })
})
