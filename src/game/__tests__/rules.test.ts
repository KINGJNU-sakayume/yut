import { describe, expect, it } from 'vitest'
import { allGoblinPlans, goblinPlan } from '../ai/goblinIntent'
import { computeScore } from '../scoring'
import { silentEnv } from '../effects/effectEngine'
import { act, addGoblin, boardRun, finishTurn, groupOf, lastPendingId, moveLatest, place, rejected, setIntent, throwAs } from './helpers'

describe('cargo collection', () => {
  it('collects 5 / 15 / 30 for normal, corner and center nodes', () => {
    let run = boardRun()
    const g = place(run, 0, 'o4')
    run = throwAs(run, 'do') // o5 corner
    run = moveLatest(run, g.id)
    expect(groupOf(run, 0).cargo).toBe(15)
    run = finishTurn(run)
    run = throwAs(run, 'geol') // shortcut: dA1, dA2, c
    run = act(run, { type: 'MOVE', resultId: lastPendingId(run), groupId: g.id, pathIndex: 1 })
    expect(groupOf(run, 0).node).toBe('c')
    expect(groupOf(run, 0).cargo).toBe(15 + 5 + 5 + 30)
  })

  it('never pays the same node twice in one lap, but a new lap resets the visited set', () => {
    let run = boardRun()
    const id = groupOf(run, 0).id
    run = throwAs(run, 'gae')
    run = moveLatest(run, id) // o1, o2 → 10
    run = finishTurn(run)
    run = throwAs(run, 'backdo')
    run = moveLatest(run, id) // back to o1 → 0
    run = finishTurn(run)
    run = throwAs(run, 'do')
    run = moveLatest(run, id) // o2 again → 0
    expect(groupOf(run, 0).cargo).toBe(10)
    expect(groupOf(run, 0).visited).toEqual(['o1', 'o2'])

    // Finish the lap and take One More Lap: visited resets and o1 pays again.
    run = finishTurn(run)
    const g = place(run, 0, 'o19')
    run = throwAs(run, 'do')
    run = moveLatest(run, g.id)
    expect(run.board!.phase).toBe('goalDecision')
    run = act(run, { type: 'GOAL_DECISION', choice: 'oneMoreLap' })
    expect(groupOf(run, 0).visited).toEqual([])
    const before = groupOf(run, 0).cargo
    run = finishTurn(run)
    run = throwAs(run, 'do')
    run = moveLatest(run, g.id)
    expect(groupOf(run, 0).cargo).toBe(before + 5)
  })
})

describe('stacking', () => {
  it('landing on your own group stacks: cargo sum, momentum max+1, merged members and visited sets', () => {
    let run = boardRun()
    const a = place(run, 0, 'o3')
    a.cargo = 40
    a.momentum = 7
    const bId = groupOf(run, 1).id
    run = throwAs(run, 'geol')
    run = moveLatest(run, bId)
    const merged = groupOf(run, 0)
    expect(merged).toBe(groupOf(run, 1))
    expect(merged.members).toEqual([0, 1])
    expect(merged.cargo).toBe(40 + 15)
    expect(merged.momentum).toBe(Math.max(7, 1 + 3) + 1)
    expect(merged.visited).toEqual(['o1', 'o2', 'o3'])
    expect(run.board!.groups.filter((g) => g.zone === 'board')).toHaveLength(1)
  })

  it('a stack moves together and a 4-stack is one group', () => {
    let run = boardRun()
    for (const pid of [1, 2, 3]) {
      place(run, 0, 'o2')
      run = throwAs(run, 'gae')
      run = moveLatest(run, groupOf(run, pid).id)
      run = finishTurn(run)
    }
    const g = groupOf(run, 0)
    expect(g.members).toEqual([0, 1, 2, 3])
    run = throwAs(run, 'do')
    run = moveLatest(run, g.id)
    expect(groupOf(run, 3).node).toBe('o3')
  })
})

describe('goblins: public intent and captures', () => {
  it('shows a deterministic path and landing node and executes exactly that plan', () => {
    let run = boardRun()
    const goblin = addGoblin(run, 'o8', { prev: 'o9' })
    setIntent(goblin, 3)
    const plan = goblinPlan(run, run.board!, goblin)
    expect(plan.path).toEqual(['o7', 'o6', 'o5'])
    expect(plan.landing).toBe('o5')
    run = throwAs(run, 'do')
    run = moveLatest(run, groupOf(run, 0).id)
    expect(run.board!.phase).toBe('goblinTurn')
    run = act(run, { type: 'RESOLVE_GOBLINS' })
    expect(run.board!.goblins[0].node).toBe('o5')
    // A fresh public intent is generated right away.
    expect(run.board!.goblins[0].intent).not.toBeNull()
  })

  it('a goblin landing on a player group captures it: cargo stolen, pieces home, momentum reset', () => {
    let run = boardRun()
    const g = place(run, 0, 'o3')
    g.cargo = 55
    g.momentum = 9
    const goblin = addGoblin(run, 'o6', { prev: 'o7', cargo: 10 })
    setIntent(goblin, 3)
    expect(allGoblinPlans(run, run.board!)[0].targetGroupId).toBe(g.id)
    run = throwAs(run, 'do')
    run = moveLatest(run, groupOf(run, 1).id)
    run = act(run, { type: 'RESOLVE_GOBLINS' })
    const back = groupOf(run, 0)
    expect(back.zone).toBe('home')
    expect(back.cargo).toBe(0)
    expect(back.momentum).toBe(1)
    const k = run.board!.goblins[0]
    expect(k.cargo).toBe(65)
    expect(k.heldCargo).toBe(55)
    expect(run.board!.lastGoblinPhase!.moves[0].captured).toEqual([0])
  })

  it('a captured stack splits back into single pieces at home', () => {
    let run = boardRun()
    place(run, 0, 'o3')
    place(run, 1, 'o2')
    run = throwAs(run, 'do')
    run = moveLatest(run, groupOf(run, 1).id) // stack on o3
    const goblin = addGoblin(run, 'o6', { prev: 'o7' })
    setIntent(goblin, 3)
    run = act(run, { type: 'RESOLVE_GOBLINS' })
    expect(groupOf(run, 0)).not.toBe(groupOf(run, 1))
    expect(groupOf(run, 0).zone).toBe('home')
    expect(groupOf(run, 1).zone).toBe('home')
  })

  it('capturing a goblin steals its cargo, grants an extra throw and sends it back to a spawn', () => {
    let run = boardRun()
    addGoblin(run, 'o2', { cargo: 33, spawn: 'o10' })
    run = throwAs(run, 'gae')
    run = moveLatest(run, groupOf(run, 0).id)
    expect(groupOf(run, 0).cargo).toBe(10 + 33)
    expect(run.board!.extraThrows).toBe(1)
    const k = run.board!.goblins[0]
    expect(k.node).toBe('o10')
    expect(k.cargo).toBe(k.baseCargo)
    expect(k.resting).toBe(true)
    expect(run.board!.phase).toBe('play')
    // The extra throw does not consume a base throw.
    const left = run.board!.baseThrowsLeft
    run = throwAs(run, 'do')
    expect(run.board!.baseThrowsLeft).toBe(left)
  })

  it('lost cargo can be recovered by capturing the goblin that took it', () => {
    let run = boardRun()
    const g = place(run, 0, 'o3')
    g.cargo = 60
    const goblin = addGoblin(run, 'o6', { prev: 'o7', cargo: 10 })
    setIntent(goblin, 3)
    run = throwAs(run, 'do')
    run = moveLatest(run, groupOf(run, 1).id) // piece 1 to o1, piece 0 stays exposed
    run = act(run, { type: 'RESOLVE_GOBLINS' })
    expect(run.board!.goblins[0].cargo).toBe(70)
    // Pin the goblin in place for the revenge.
    setIntent(run.board!.goblins[0], 1)
    run = throwAs(run, 'gae') // piece 1: o1 → o3
    run = moveLatest(run, groupOf(run, 1).id)
    expect(groupOf(run, 1).cargo).toBe(5 + 10 + 70)
    expect(run.board!.stats.recoveries).toBe(1)
    expect(run.stats.recoveries).toBe(1)
  })

  it('respawned goblins rest for one goblin phase (no unseen threats)', () => {
    let run = boardRun()
    addGoblin(run, 'o1', { spawn: 'o10' })
    run = throwAs(run, 'do')
    run = moveLatest(run, groupOf(run, 0).id)
    const plan = allGoblinPlans(run, run.board!)[0]
    expect(plan.resting).toBe(true)
    expect(plan.landing).toBeNull()
  })
})

describe('extra throws', () => {
  it('Yut and Mo grant a free throw', () => {
    let run = boardRun()
    run = throwAs(run, 'yut')
    expect(run.board!.extraThrows).toBe(1)
    expect(run.board!.pending[0].grantedExtra).toBe(true)
    run = throwAs(run, 'mo')
    expect(run.board!.extraThrows).toBe(1)
    expect(run.board!.pending).toHaveLength(2)
    run = throwAs(run, 'gae')
    expect(run.board!.extraThrows).toBe(0)
    expect(run.board!.baseThrowsUsed).toBe(1)
  })

  it('a base throw is refused while results are waiting', () => {
    let run = boardRun()
    run = throwAs(run, 'gae')
    rejected(run, { type: 'THROW' })
  })

  it('외눈 도깨비: Mo moves 5 but grants no free throw', () => {
    let run = boardRun({ bossId: 'oneEye' })
    run = throwAs(run, 'mo')
    expect(run.board!.extraThrows).toBe(0)
    run = moveLatest(run, groupOf(run, 0).id)
    expect(groupOf(run, 0).node).toBe('o5')
  })

  it('거꾸로 도깨비: Do becomes Backdo', () => {
    let run = boardRun({ bossId: 'upsideDown' })
    run = throwAs(run, 'do')
    expect(run.board!.pending[0].kind).toBe('backdo')
    expect(run.board!.pending[0].conversions).toContain('거꾸로 도깨비')
  })
})

describe('goal scoring', () => {
  it('cash out = cargo × momentum × stack × lap', () => {
    let run = boardRun()
    const g = place(run, 0, 'o19')
    g.cargo = 100
    g.momentum = 10
    run = throwAs(run, 'do')
    run = moveLatest(run, g.id)
    expect(run.board!.phase).toBe('goalDecision')
    run = act(run, { type: 'GOAL_DECISION', choice: 'cashOut' })
    const bd = run.board!.lastCashOut!.breakdown
    expect(bd.cargo).toBe(115) // + goal corner 15
    expect(bd.momentum).toBe(11)
    expect(bd.stackMult).toBe(1)
    expect(bd.lapMult).toBe(1)
    expect(bd.score).toBe(115 * 11)
    expect(run.board!.score).toBe(1265)
    expect(groupOf(run, 0).zone).toBe('finished')
  })

  it('stack multipliers are ×1 / ×1.5 / ×2.25 / ×4', () => {
    const run = boardRun()
    const board = run.board!
    const g = board.groups[0]
    g.cargo = 10
    g.momentum = 10
    const expected = [1, 1.5, 2.25, 4]
    for (let size = 1; size <= 4; size++) {
      g.members = [0, 1, 2, 3].slice(0, size)
      const bd = computeScore(run, board, g, silentEnv(run, board))
      expect(bd.stackMult).toBe(expected[size - 1])
      expect(bd.score).toBe(Math.floor(100 * expected[size - 1]))
    }
  })

  it('the board clears immediately when the target is reached', () => {
    let run = boardRun()
    run.board!.target = 100
    const g = place(run, 0, 'o19')
    g.cargo = 100
    g.momentum = 5
    run = throwAs(run, 'yut') // extra throw pending, still clears on cash-out
    run = moveLatest(run, g.id)
    run = act(run, { type: 'GOAL_DECISION', choice: 'cashOut' })
    expect(run.phase).toBe('boardEnd')
    expect(run.boardEnd!.cleared).toBe(true)
    expect(run.boardEnd!.coinsTotal).toBeGreaterThan(0)
  })

  it('the board is lost when base throws run out', () => {
    let run = boardRun()
    run.board!.baseThrowsLeft = 1
    run = throwAs(run, 'do')
    run = moveLatest(run, groupOf(run, 0).id)
    expect(run.phase).toBe('boardEnd')
    expect(run.boardEnd!.cleared).toBe(false)
    run = act(run, { type: 'CONTINUE' })
    expect(run.phase).toBe('defeat')
  })
})

describe('One More Lap', () => {
  function toGoal(run: ReturnType<typeof boardRun>, pid: number) {
    const g = place(run, pid, 'o19')
    run = throwAs(run, 'do')
    return moveLatest(run, g.id)
  }

  it('multipliers ×1.5 / ×2.25 / ×4 and escalating, visible risk', () => {
    let run = boardRun({ keepGoblins: true })
    const goblinsAtStart = run.board!.goblins.length
    const lapsMult = [1, 1.5, 2.25, 4]
    for (let lap = 0; lap <= 3; lap++) {
      run = finishTurn(run)
      run = toGoal(run, 0)
      // Guard against a goblin having captured the runner in between.
      expect(run.board!.phase).toBe('goalDecision')
      const g = groupOf(run, 0)
      expect(g.laps).toBe(lap)
      const bd = computeScore(run, run.board!, g, silentEnv(run, run.board!))
      expect(bd.lapMult).toBe(lapsMult[lap])
      if (lap === 3) {
        rejected(run, { type: 'GOAL_DECISION', choice: 'oneMoreLap' })
        break
      }
      // Clear goblins' intents so they cannot interfere with the test runner.
      run = act(run, { type: 'GOAL_DECISION', choice: 'oneMoreLap' })
      for (const k of run.board!.goblins) k.intent = null
      expect(groupOf(run, 0).laps).toBe(lap + 1)
      expect(groupOf(run, 0).zone).toBe('home')
      if (lap + 1 === 2) expect(run.board!.goblins.length).toBe(goblinsAtStart + 1)
      if (lap + 1 === 3) {
        const goblin = run.board!.goblins[0]
        setIntent(goblin, 1)
        const plan = goblinPlan(run, run.board!, goblin)
        expect(plan.parts.map((p) => p.source)).toContain('세 번째 추가 바퀴')
        expect(plan.steps).toBe(2)
      }
      for (const k of run.board!.goblins) k.resting = true
    }
  })
})
