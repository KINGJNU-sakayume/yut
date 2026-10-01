// Balance simulation (run with `npm run sim`). Skipped in the normal test run.
import { describe, expect, it } from 'vitest'
import { gameReducer } from '../reducer'
import { createRun } from '../run'
import type { RunState, WagerId } from '../types'
import { botAction, type BotOptions } from './bot'

function step(run: RunState, opts: BotOptions): RunState | null {
  const action = botAction(run, opts)
  if (!action) return null
  const next = gameReducer(run, action)
  if (next.notice) throw new Error(`bot made an illegal move: ${next.notice} (${JSON.stringify(action)})`)
  return next
}

/** Play one board with an unreachable target and report the score the bot reached. */
function boardPotential(seed: string, wager: WagerId, greed: number): { score: number; cashOuts: number; laps: number } {
  let run = createRun({ seed })
  run = gameReducer(run, { type: 'CHOOSE_WAGER', wager })
  run = gameReducer(run, { type: 'DEBUG', command: { cmd: 'setTarget', value: 1e12 } })
  let guard = 0
  while (run.phase === 'board' && guard++ < 2000) {
    const next = step(run, { wager, greed })
    if (!next) break
    run = next
  }
  const board = run.board!
  return {
    score: board.score,
    cashOuts: board.cashOuts.length,
    laps: Math.max(0, ...board.cashOuts.map((c) => c.breakdown.laps)),
  }
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]
}

describe.skipIf(!process.env.SIM)('balance simulation', () => {
  it('board potential without talismans', { timeout: 900_000 }, () => {
    for (const wager of ['safe', 'standard', 'allIn'] as WagerId[]) {
      for (const greed of [0, 1, 2]) {
        const scores: number[] = []
        let laps = 0
        for (let i = 0; i < 150; i++) {
          const r = boardPotential(`sim-${i}`, wager, greed)
          scores.push(r.score)
          laps += r.laps
        }
        console.log(
          `${wager.padEnd(8)} greed=${greed} p10=${percentile(scores, 0.1)} p25=${percentile(scores, 0.25)} median=${percentile(scores, 0.5)} p75=${percentile(scores, 0.75)} p90=${percentile(scores, 0.9)} avgMaxLaps=${(laps / scores.length).toFixed(2)}`,
        )
      }
    }
    expect(true).toBe(true)
  })

  it('full runs with a greedy shopping bot', { timeout: 900_000 }, () => {
    const reached: number[] = []
    for (let i = 0; i < 200; i++) {
      let run = createRun({ seed: `run-${i}` })
      let guard = 0
      while (guard++ < 20000) {
        const next = step(run, { greed: Number(process.env.GREED ?? 1), wager: (process.env.WAGER as 'safe' | 'standard' | 'allIn' | undefined) ?? 'standard' })
        if (!next) break
        run = next
      }
      reached.push(run.phase === 'victory' ? 24 : run.boardIndex)
    }
    const hist = new Map<number, number>()
    for (const r of reached) hist.set(r, (hist.get(r) ?? 0) + 1)
    console.log('boards reached (index of losing board):', [...hist.entries()].sort((a, b) => a[0] - b[0]))
    expect(reached.length).toBe(200)
  })
})
