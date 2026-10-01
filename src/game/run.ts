// Run-level flow: run creation, boss schedule, wager → board → board end → event/shop → next board.

import { BOSSES, maxBossTier } from '../data/bosses'
import { getEvent } from '../data/events'
import { startBoard } from './board'
import { BOARD_KINDS, ECONOMY, RUN, SAVE_VERSION, STICKS } from './config'
import { invariant } from './errors'
import { createEvent, pickRandomEvent } from './events'
import { deriveStream, drawInt, seedToNumber } from './rng'
import { createShop, isUnlocked } from './shop'
import { emptyResultCounts, yardOf } from './state'
import type { RunState, WagerId } from './types'

export interface NewRunOptions {
  seed: string
  debtLevel?: number
  unlocked?: string[]
  /** Wall-clock start time; only used to build a unique run id for meta progression. */
  startedAt?: number
}

export const TOTAL_BOARDS = RUN.yards * RUN.boardsPerYard

/**
 * One boss per yard, drawn without repeats where possible. Gentle bosses open the run;
 * harsher ones (higher tier) only appear in later yards.
 */
function scheduleBosses(run: RunState): string[] {
  const unlocked = BOSSES.filter((b) => isUnlocked(run, b.unlock))
  const out: string[] = []
  for (let yard = 1; yard <= RUN.yards; yard++) {
    const allowed = unlocked.filter((b) => b.tier <= maxBossTier(yard))
    const fresh = allowed.filter((b) => !out.includes(b.id))
    const notLast = allowed.filter((b) => b.id !== out[out.length - 1])
    const pool = fresh.length > 0 ? fresh : notLast.length > 0 ? notLast : allowed
    out.push(pool[drawInt(run.rng, 'run', pool.length)].id)
  }
  return out
}

export function createRun(options: NewRunOptions): RunState {
  const seed = options.seed.trim() || '0'
  const seedNum = seedToNumber(seed)
  const run: RunState = {
    format: 'yut-roguelike-run',
    version: SAVE_VERSION,
    id: `${seed}-${options.startedAt ?? 0}`,
    seed,
    seedNum,
    debtLevel: options.debtLevel ?? 0,
    boardIndex: 0,
    phase: 'wager',
    coins: ECONOMY.startingCoins,
    talismans: [],
    talismanCapacity: RUN.talismanCapacity,
    consumables: [],
    consumableCapacity: RUN.consumableCapacity,
    sticks: Array.from({ length: STICKS.count }, () => ({ modId: null, twinOf: null })),
    pieces: Array.from({ length: RUN.pieces }, (_, id) => ({ id, traitId: null })),
    blessings: [],
    mods: {
      baseThrowDelta: 0,
      permanentGoblins: 0,
      goalScoreMult: 1,
      momentumBonus: emptyResultCounts(),
      nextBoardThrows: 0,
      nextBoardMomentum: 0,
      sealed: [],
    },
    board: null,
    boardEnd: null,
    shop: null,
    event: null,
    bosses: [],
    queue: [],
    history: [],
    stats: {
      cashOuts: 0,
      totalScore: 0,
      bestCashOut: 0,
      captures: 0,
      lostToGoblins: 0,
      recoveries: 0,
      boardsCleared: 0,
      maxLapsCashed: 0,
      fourStackCashOuts: 0,
      bestBoardCaptures: 0,
    },
    seqInstance: 0,
    rng: {
      run: deriveStream(seedNum, 'run'),
      shop: deriveStream(seedNum, 'shop'),
      event: deriveStream(seedNum, 'event'),
    },
    freeRerolls: 0,
    discovered: { talismans: [], bosses: [], events: [] },
    unlocked: [...(options.unlocked ?? [])],
    eventHistory: [],
    notice: null,
  }
  run.bosses = scheduleBosses(run)
  return run
}

export function currentYard(run: RunState): number {
  return yardOf(run.boardIndex)
}

export function chooseWager(run: RunState, wager: WagerId): void {
  invariant(run.phase === 'wager', '지금은 판돈을 고를 수 없습니다')
  startBoard(run, wager)
}

export function advanceQueue(run: RunState): void {
  run.shop = null
  run.event = null
  const next = run.queue.shift()
  if (!next) {
    run.boardIndex += 1
    run.board = null
    const yard = yardOf(run.boardIndex)
    run.mods.sealed = run.mods.sealed.filter((s) => s.untilYard >= yard)
    run.phase = 'wager'
    return
  }
  if (next === 'shop') {
    run.shop = createShop(run)
    run.phase = 'shop'
    return
  }
  if (next.startsWith('event:')) {
    const id = next.slice('event:'.length)
    invariant(getEvent(id), `알 수 없는 만남: ${id}`)
    run.event = createEvent(run, id)
    run.phase = 'event'
    return
  }
  advanceQueue(run)
}

export function continueAfterBoard(run: RunState): void {
  invariant(run.phase === 'boardEnd' && run.boardEnd, '판이 끝나지 않았습니다')
  const end = run.boardEnd
  run.history.push(end)
  if (!end.cleared) {
    run.phase = 'defeat'
    return
  }
  if (run.boardIndex >= TOTAL_BOARDS - 1) {
    run.phase = 'victory'
    return
  }
  const kind = BOARD_KINDS[run.boardIndex % 3]
  const yard = yardOf(run.boardIndex)
  run.queue = []
  if (kind === 'big' && RUN.eventAfterBig) run.queue.push(`event:${pickRandomEvent(run)}`)
  if (kind === 'boss' && RUN.goblinMarketYards.includes(yard)) run.queue.push('event:goblinMarket')
  run.queue.push('shop')
  run.boardEnd = null
  advanceQueue(run)
}
