import { describe, expect, it } from 'vitest'
import { gameReducer } from '../reducer'
import { createRun } from '../run'
import { newTalismanInstance } from '../shop'
import { botAction } from './bot'
import { UNLOCKS } from '../../data/unlocks'

const BUILDS: Record<string, string[]> = {
  stack: ['gama', 'eobuba', 'eopbo', 'manseon', 'jjakpae'],
  lap: ['yeongmasal', 'miryeon', 'hangawi', 'jipnaga', 'samsepan'],
  mixed: ['tikkeul', 'geolgeori', 'meongil', 'iinsamgak', 'jungang'],
  cursed: ['hwanggeum', 'yoksimhok', 'eopbo', 'gama', 'meongil'],
}

describe.skipIf(!process.env.SIM)('late game reachability', () => {
  it('yard 8 board potential with strong builds', { timeout: 900_000 }, () => {
    for (const [name, build] of Object.entries(BUILDS)) {
      const scores: number[] = []
      for (let i = 0; i < 60; i++) {
        let run = createRun({ seed: `late-${name}-${i}`, unlocked: UNLOCKS.map((u) => u.id) })
        run.boardIndex = 21
        for (const id of build) run.talismans.push(newTalismanInstance(run, id))
        for (const t of run.talismans) if (t.defId === 'tikkeul' || t.defId === 'geolgeori') t.counter = 10
        run = gameReducer(run, { type: 'CHOOSE_WAGER', wager: 'standard' })
        run = gameReducer(run, { type: 'DEBUG', command: { cmd: 'setTarget', value: 1e12 } })
        let guard = 0
        while (run.phase === 'board' && guard++ < 3000) {
          const a = botAction(run, { greed: 2, buyTalismans: false })
          if (!a) break
          run = gameReducer(run, a)
        }
        scores.push(run.board!.score)
      }
      scores.sort((a, b) => a - b)
      const p = (q: number) => scores[Math.floor(q * (scores.length - 1))]
      console.log(`${name.padEnd(7)} p25=${p(0.25)} median=${p(0.5)} p75=${p(0.75)} p90=${p(0.9)} max=${p(1)}`)
    }
    expect(true).toBe(true)
  })
})
