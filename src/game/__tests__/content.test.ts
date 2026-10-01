// Every piece of content must do something observable. Each scenario is run with and without
// the item; the measured value must differ in the expected direction.
import { describe, expect, it } from 'vitest'
import { TALISMANS } from '../../data/talismans'
import { goblinPlan } from '../ai/goblinIntent'
import { silentEnv } from '../effects/effectEngine'
import { createEvent } from '../events'
import { computeScore, lapTableFor } from '../scoring'
import { priceOf } from '../shop'
import type { RunState } from '../types'
import { act, addGoblin, boardRun, finishTurn, groupOf, lastPendingId, moveLatest, place, setIntent, throwAs, ALL_UNLOCKS } from './helpers'
import { createRun } from '../run'
import { gameReducer } from '../reducer'
import { legalMovesForResult } from '../movement'

type Scenario = (talismans: string[]) => number

function cashOutScore(run: RunState, pid = 0): number {
  const g = groupOf(run, pid)
  return computeScore(run, run.board!, g, silentEnv(run, run.board!)).score
}

/** Cargo after one forced move of piece 0 from a placed position. */
function moveCargo(kind: Parameters<typeof throwAs>[1], node: string | null, route?: string[], pathIndex = 0): Scenario {
  return (talismans) => {
    let run = boardRun({ talismans })
    if (node) place(run, 0, node, route)
    run = throwAs(run, kind)
    run = act(run, { type: 'MOVE', resultId: lastPendingId(run), groupId: groupOf(run, 0).id, pathIndex })
    return groupOf(run, 0).cargo
  }
}

function moveMomentum(kind: Parameters<typeof throwAs>[1]): Scenario {
  return (talismans) => {
    let run = boardRun({ talismans })
    run = throwAs(run, kind)
    if (kind === 'yut' || kind === 'mo') run = throwAs(run, 'do')
    const id = run.board!.pending[0].id
    run = act(run, { type: 'MOVE', resultId: id, groupId: groupOf(run, 0).id, pathIndex: 0 })
    return run.board!.lastMove!.momentumGained
  }
}

function scoreWith(setup: (run: RunState) => void): Scenario {
  return (talismans) => {
    const run = boardRun({ talismans })
    const g = run.board!.groups[0]
    g.cargo = 100
    g.momentum = 10
    setup(run)
    return cashOutScore(run)
  }
}

function captureCargo(opts: { kind?: Parameters<typeof throwAs>[1]; members?: number; goblinCargo?: number; groupCargo?: number } = {}): Scenario {
  return (talismans) => {
    let run = boardRun({ talismans })
    const g = place(run, 0, 'o3')
    g.cargo = opts.groupCargo ?? 0
    if (opts.members) g.members = [0, 1, 2, 3].slice(0, opts.members)
    run.board!.groups = run.board!.groups.filter((x) => x === g || !g.members.includes(x.members[0]))
    const kind = opts.kind ?? 'do'
    addGoblin(run, kind === 'backdo' ? 'o2' : 'o4', { cargo: opts.goblinCargo ?? 20 })
    run = throwAs(run, kind)
    run = moveLatest(run, g.id)
    return groupOf(run, 0).cargo
  }
}

const SCENARIOS: Record<string, { run: Scenario; expect: 'more' | 'less' }> = {
  hangeolum: { run: moveCargo('do', null), expect: 'more' },
  tikkeul: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      run = throwAs(run, 'do')
      run = moveLatest(run, groupOf(run, 0).id)
      run = finishTurn(run)
      run = throwAs(run, 'gae')
      run = moveLatest(run, groupOf(run, 0).id)
      return groupOf(run, 0).cargo
    },
    expect: 'more',
  },
  salgeum: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      const g = place(run, 0, 'o2')
      g.cargo = 30
      const goblin = addGoblin(run, 'o6', { prev: 'o7' })
      setIntent(goblin, 3) // o5, o4, o3
      run = throwAs(run, 'do')
      run = moveLatest(run, g.id) // o2 → o3 (into the landing node, but sneaking)
      run = act(run, { type: 'RESOLVE_GOBLINS' })
      return groupOf(run, 0).cargo
    },
    expect: 'more',
  },
  dodolipyo: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      let extra = 0
      for (let i = 0; i < 3; i++) {
        run = throwAs(run, 'do')
        extra += run.board!.extraThrows
        run = moveLatest(run, groupOf(run, i).id)
        run = finishTurn(run)
      }
      return extra
    },
    expect: 'more',
  },
  ssangbok: { run: moveMomentum('gae'), expect: 'more' },
  dumok: { run: moveCargo('gae', null), expect: 'more' },
  jjakpae: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      place(run, 0, 'o2')
      run = throwAs(run, 'gae')
      run = moveLatest(run, groupOf(run, 1).id)
      return groupOf(run, 0).momentum
    },
    expect: 'more',
  },
  iinsamgak: { run: scoreWith((r) => (r.board!.groups[0].members = [0, 1])), expect: 'more' },
  geolgeori: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      run = throwAs(run, 'geol')
      run.board!.groups[0].cargo = 100
      return cashOutScore(run)
    },
    expect: 'more',
  },
  samsebeon: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      for (let i = 0; i < 3; i++) {
        run = throwAs(run, 'geol')
        run = moveLatest(run, groupOf(run, 0).id)
        run = finishTurn(run)
      }
      return run.coins
    },
    expect: 'more',
  },
  samjogo: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      for (let i = 0; i < 3; i++) {
        run = throwAs(run, 'geol')
        run = moveLatest(run, groupOf(run, 0).id)
        run = finishTurn(run)
      }
      return groupOf(run, 0).cargo
    },
    expect: 'more',
  },
  jaksim: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      for (let i = 0; i < 3; i++) {
        run = throwAs(run, 'geol')
        if (i < 2) {
          run = moveLatest(run, groupOf(run, 0).id)
          run = finishTurn(run)
        }
      }
      return groupOf(run, 3).momentum
    },
    expect: 'more',
  },
  jangdan: { run: moveMomentum('yut'), expect: 'more' },
  pungmul: { run: moveMomentum('mo'), expect: 'more' },
  eolssu: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      run = throwAs(run, 'yut')
      run = throwAs(run, 'gae')
      return run.board!.heung
    },
    expect: 'more',
  },
  momomo: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      run = throwAs(run, 'mo')
      run = throwAs(run, 'mo')
      const g = run.board!.groups[0]
      g.cargo = 10
      g.momentum = 10
      return cashOutScore(run)
    },
    expect: 'more',
  },
  backdoGhost: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      place(run, 0, 'o3')
      run = throwAs(run, 'backdo')
      run = moveLatest(run, groupOf(run, 0).id)
      return run.board!.lastMove!.momentumGained
    },
    expect: 'more',
  },
  doejipgi: moveCargoBackdo(),
  domang: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      place(run, 0, 'o3')
      const goblin = addGoblin(run, 'o6', { prev: 'o7' })
      setIntent(goblin, 3)
      run = throwAs(run, 'backdo')
      run = moveLatest(run, groupOf(run, 0).id)
      return groupOf(run, 0).cargo
    },
    expect: 'more',
  },
  dwirojapgi: { run: captureCargo({ kind: 'backdo' }), expect: 'more' },
  gama: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      const g = place(run, 0, 'o2')
      g.members = [0, 1]
      run.board!.groups = run.board!.groups.filter((x) => x === g || x.members[0] !== 1)
      run = throwAs(run, 'gae')
      run = moveLatest(run, g.id)
      return groupOf(run, 0).cargo
    },
    expect: 'more',
  },
  eobuba: { run: scoreWith((r) => (r.board!.groups[0].members = [0, 1])), expect: 'more' },
  eopbo: { run: scoreWith((r) => (r.board!.groups[0].members = [0, 1, 2])), expect: 'more' },
  samchongsa: { run: captureCargo({ members: 3 }), expect: 'more' },
  manseon: {
    run: scoreWith((r) => {
      const g = r.board!.groups[0]
      g.members = [0, 1, 2, 3]
      g.cargo = 200
    }),
    expect: 'more',
  },
  hyeonsang: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      addGoblin(run, 'o1', { cargo: 5 })
      run = throwAs(run, 'do')
      run = moveLatest(run, groupOf(run, 0).id)
      return run.coins
    },
    expect: 'more',
  },
  podo: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      addGoblin(run, 'o1', { cargo: 5 })
      run = throwAs(run, 'do')
      run = moveLatest(run, groupOf(run, 0).id)
      return groupOf(run, 0).momentum
    },
    expect: 'more',
  },
  horangi: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      const g = place(run, 0, 'o3')
      g.visited = []
      const goblin = addGoblin(run, 'o6', { prev: 'o7' })
      setIntent(goblin, 3)
      run = throwAs(run, 'gae')
      run = moveLatest(run, g.id)
      return groupOf(run, 0).cargo
    },
    expect: 'more',
  },
  cheonha: { run: captureCargo({ goblinCargo: 50, groupCargo: 10 }), expect: 'more' },
  jireumgil: moveCargoFromCorner(1),
  jungang: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      place(run, 0, 'o5')
      run = throwAs(run, 'geol')
      run = moveLatest(run, groupOf(run, 0).id, 1) // dA1, dA2, c
      return cashOutScore(run)
    },
    expect: 'more',
  },
  paldo: scoreWithMoves(),
  yeongmasal: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      groupOf(run, 0).laps = 1
      run = throwAs(run, 'gae')
      run = moveLatest(run, groupOf(run, 0).id)
      return groupOf(run, 0).cargo
    },
    expect: 'more',
  },
  miryeon: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      place(run, 0, 'o19')
      run = throwAs(run, 'do')
      run = moveLatest(run, groupOf(run, 0).id)
      run = act(run, { type: 'GOAL_DECISION', choice: 'oneMoreLap' })
      return groupOf(run, 0).momentum
    },
    expect: 'more',
  },
  hangawi: { run: scoreWith((r) => (r.board!.groups[0].laps = 1)), expect: 'more' },
  samsepan: { run: scoreWith((r) => (r.board!.groups[0].laps = 3)), expect: 'more' },
  jipnaga: { run: scoreWith((r) => (r.board!.groups[0].laps = 1)), expect: 'more' },
  bokjori: boardEndCoins(),
  jangdol: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      place(run, 0, 'o4')
      run = throwAs(run, 'do')
      run = moveLatest(run, groupOf(run, 0).id)
      return run.coins
    },
    expect: 'more',
  },
  geumjul: {
    run: (t) => {
      let run = boardRun({ talismans: t, boardIndex: 2 })
      run.board!.target = 1
      const g = place(run, 0, 'o19')
      g.cargo = 10
      run = throwAs(run, 'do')
      run = moveLatest(run, g.id)
      run = act(run, { type: 'GOAL_DECISION', choice: 'cashOut' })
      return run.freeRerolls
    },
    expect: 'more',
  },
  nojatdon: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      place(run, 0, 'o19')
      run = throwAs(run, 'do')
      run = moveLatest(run, groupOf(run, 0).id)
      run = act(run, { type: 'GOAL_DECISION', choice: 'cashOut' })
      return run.coins
    },
    expect: 'more',
  },
  pimudeun: { run: captureCargo(), expect: 'more' },
  gwisin: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      run = throwAs(run, 'do')
      return run.board!.pending[0].kind === 'backdo' ? 1 : 0
    },
    expect: 'more',
  },
  yoksimhok: { run: scoreWith((r) => (r.board!.groups[0].laps = 1)), expect: 'more' },
  jeoseung: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      const g = place(run, 0, 'o3')
      g.cargo = 40
      const goblin = addGoblin(run, 'o6', { prev: 'o7' })
      setIntent(goblin, 3)
      run = throwAs(run, 'do')
      run = moveLatest(run, groupOf(run, 1).id)
      run = act(run, { type: 'RESOLVE_GOBLINS' })
      return groupOf(run, 0).cargo
    },
    expect: 'more',
  },
  sigan: {
    run: (t) => {
      let run = boardRun({ talismans: t })
      run = throwAs(run, 'gae')
      run = moveLatest(run, groupOf(run, 0).id)
      run = finishTurn(run)
      run = throwAs(run, 'backdo')
      const next = gameReducerSafe(run)
      return next
    },
    expect: 'more',
  },
}

function gameReducerSafe(run: RunState): number {
  // 1 if the REWIND action is accepted, 0 otherwise.
  const after = gameReducer(run, { type: 'REWIND' })
  return after.notice == null && after.board!.flags.rewindUsed ? 1 : 0
}

function moveCargoBackdo(): { run: Scenario; expect: 'more' } {
  return {
    run: (t) => {
      let run = boardRun({ talismans: t })
      place(run, 0, 'o3')
      run = throwAs(run, 'backdo')
      run = moveLatest(run, groupOf(run, 0).id)
      return groupOf(run, 0).cargo
    },
    expect: 'more',
  }
}

function moveCargoFromCorner(pathIndex: number): { run: Scenario; expect: 'more' } {
  return {
    run: (t) => {
      let run = boardRun({ talismans: t })
      place(run, 0, 'o5')
      run = throwAs(run, 'do')
      run = moveLatest(run, groupOf(run, 0).id, pathIndex)
      return groupOf(run, 0).cargo
    },
    expect: 'more',
  }
}

function scoreWithMoves(): { run: Scenario; expect: 'more' } {
  return {
    run: (t) => {
      let run = boardRun({ talismans: t })
      run = throwAs(run, 'geol')
      run = moveLatest(run, groupOf(run, 0).id)
      return cashOutScore(run)
    },
    expect: 'more',
  }
}

function boardEndCoins(): { run: Scenario; expect: 'more' } {
  return {
    run: (t) => {
      let run = boardRun({ talismans: t })
      run.board!.target = 1
      const g = place(run, 0, 'o19')
      g.cargo = 10
      run = throwAs(run, 'do')
      run = moveLatest(run, g.id)
      run = act(run, { type: 'GOAL_DECISION', choice: 'cashOut' })
      return run.coins
    },
    expect: 'more',
  }
}

// 먼 길이 복이다 and 황금 복주머니 / 모 아니면 죽음 reuse generic scenarios above.
SCENARIOS.meongil = { run: scoreWith(() => undefined), expect: 'more' }
SCENARIOS.hwanggeum = { run: moveCargo('gae', null), expect: 'more' }
SCENARIOS.moaniJugeum = { run: moveMomentum('mo'), expect: 'more' }

describe('every shop and cursed talisman has an observable effect', () => {
  const talismans = TALISMANS.filter((t) => t.pool !== 'blessing')
  it('a scenario exists for every talisman', () => {
    const missing = talismans.filter((t) => !SCENARIOS[t.id]).map((t) => t.id)
    expect(missing).toEqual([])
  })
  for (const def of talismans) {
    it(`${def.name} (${def.id})`, () => {
      const scenario = SCENARIOS[def.id]
      const without = scenario.run([])
      const withIt = scenario.run([def.id])
      if (scenario.expect === 'more') expect(withIt, `${def.id}: with=${withIt} without=${without}`).toBeGreaterThan(without)
      else expect(withIt).toBeLessThan(without)
    })
  }
})

describe('blessings (산신령)', () => {
  const scoreRun = (blessing?: string) => {
    let run = boardRun()
    if (blessing) run = act(run, { type: 'DEBUG', command: { cmd: 'addTalisman', defId: blessing } })
    const g = run.board!.groups[0]
    g.cargo = 100
    g.momentum = 10
    g.laps = 1
    return cashOutScore(run)
  }
  it.each(['b_ginseng', 'b_peach', 'b_moon', 'b_rice'])('%s raises the cash-out', (id) => {
    expect(scoreRun(id)).toBeGreaterThan(scoreRun())
  })

  it('board-start blessings apply when the next board begins', () => {
    const withStart = (id: string) => {
      const run = createRun({ seed: 'b', unlocked: ALL_UNLOCKS })
      run.blessings.push({ uid: 'x', defId: id, counter: 0, charges: 0, usedThisBoard: 0, power: 1 })
      return gameStart(run)
    }
    expect(withStart('b_staff').board!.groups[0].momentum).toBe(3)
    expect(withStart('b_cloud').board!.baseThrowsTotal).toBe(13)
  })

  it('약초 보따리 lowers prices and 호랑이 수염 adds capture cargo', () => {
    const herbs = createRun({ seed: 'h' })
    herbs.blessings.push({ uid: 'y', defId: 'b_herbs', counter: 0, charges: 0, usedThisBoard: 0, power: 1 })
    expect(priceOf(herbs, 10)).toBe(9)
    let hunt = boardRun()
    hunt = act(hunt, { type: 'DEBUG', command: { cmd: 'addTalisman', defId: 'b_whisker' } })
    addGoblin(hunt, 'o1', { cargo: 5 })
    hunt = throwAs(hunt, 'do')
    hunt = moveLatest(hunt, groupOf(hunt, 0).id)
    expect(groupOf(hunt, 0).cargo).toBe(5 + 5 + 20)
  })
})

function gameStart(run: RunState): RunState {
  return act(run, { type: 'CHOOSE_WAGER', wager: 'standard' })
}

describe('piece traits', () => {
  it('무쇠말 blocks the first capture each board', () => {
    let run = boardRun()
    run.pieces[0].traitId = 'iron'
    const g = place(run, 0, 'o3')
    g.cargo = 30
    const goblin = addGoblin(run, 'o6', { prev: 'o7' })
    setIntent(goblin, 3)
    run = throwAs(run, 'do')
    run = moveLatest(run, groupOf(run, 1).id)
    run = act(run, { type: 'RESOLVE_GOBLINS' })
    expect(groupOf(run, 0).node).toBe('o3')
    expect(run.board!.lastGoblinPhase!.moves[0].prevented).toBe('무쇠말')
    expect(run.board!.flags.ironUsed).toEqual([0])
  })

  it('보따리말: +50% node cargo and cannot stack', () => {
    let run = boardRun()
    run.pieces[1].traitId = 'bundle'
    place(run, 0, 'o2')
    run = throwAs(run, 'gae')
    const legal = legalMovesForResult(run, run.board!, run.board!.pending[0])
    const bundleMove = legal.moves.find((m) => m.groupId === groupOf(run, 1).id)!
    expect(bundleMove.options).toHaveLength(0)
    expect(bundleMove.illegal[0].reason).toContain('보따리말')
    let solo = boardRun()
    solo.pieces[0].traitId = 'bundle'
    solo = throwAs(solo, 'gae')
    solo = moveLatest(solo, groupOf(solo, 0).id)
    expect(groupOf(solo, 0).cargo).toBe(Math.round(5 * 1.5) * 2)
  })

  it('장군말: capturing grants +2 momentum', () => {
    let run = boardRun()
    run.pieces[0].traitId = 'general'
    addGoblin(run, 'o1', { cargo: 5 })
    run = throwAs(run, 'do')
    run = moveLatest(run, groupOf(run, 0).id)
    expect(groupOf(run, 0).momentum).toBe(1 + 1 + 2)
  })

  it('역마말: stronger lap table', () => {
    const run = boardRun()
    run.pieces[0].traitId = 'wanderer'
    expect(lapTableFor(run, run.board!, run.board!.groups[0]).table).toEqual([1, 2, 3, 5])
  })

  it('날쌘말: one extra physical node, same result identity', () => {
    let run = boardRun()
    run.pieces[0].traitId = 'swift'
    run = throwAs(run, 'gae')
    run = moveLatest(run, groupOf(run, 0).id)
    expect(groupOf(run, 0).node).toBe('o3')
    expect(groupOf(run, 0).assigned.gae).toBe(1)
  })
})

describe('Yut stick modifications', () => {
  it('금 윷 adds cargo when it shows its flat face', () => {
    let run = boardRun()
    run.sticks[1] = { modId: 'gold', twinOf: null }
    run = throwAs(run, 'do') // forced Do uses stick 1's flat face
    run = moveLatest(run, groupOf(run, 0).id)
    expect(groupOf(run, 0).cargo).toBe(5 + 5)
  })

  it('귀문 윷 adds momentum when the marked stick makes Backdo', () => {
    let run = boardRun()
    run.sticks[0] = { modId: 'ghostGate', twinOf: null }
    place(run, 0, 'o3')
    run = throwAs(run, 'backdo')
    run = moveLatest(run, groupOf(run, 0).id)
    expect(run.board!.lastMove!.momentumGained).toBe(2 + 3)
  })
})

describe('consumables', () => {
  it('엿 locks a stick face for the next throw', () => {
    let run = boardRun()
    run.consumables = ['yeot']
    for (const i of [0, 1, 2, 3]) {
      run = act(run, { type: 'DEBUG', command: { cmd: 'addConsumable', id: 'yeot' } })
      run = act(run, { type: 'USE_CONSUMABLE', slot: 0, params: { stickIndex: i, face: 'back' } })
    }
    run = act(run, { type: 'USE_CONSUMABLE', slot: 0, params: { stickIndex: 0, face: 'back' } })
    run = act(run, { type: 'THROW' })
    expect(run.board!.pending[0].kind).toBe('yut')
    expect(run.board!.stickLocks.every((l) => l === null)).toBe(true)
  })

  it('부채 rerolls the latest throw before moving, without spending another base throw', () => {
    let run = boardRun()
    run.consumables = ['fan']
    run = throwAs(run, 'gae')
    const left = run.board!.baseThrowsLeft
    run = act(run, { type: 'USE_CONSUMABLE', slot: 0 })
    expect(run.board!.pending).toHaveLength(1)
    expect(run.board!.baseThrowsLeft).toBe(left)
    expect(run.consumables).toEqual([])
  })

  it('복주머니 permanently boosts one result’s momentum', () => {
    let run = boardRun()
    run.consumables = ['luckyPouch']
    run = act(run, { type: 'USE_CONSUMABLE', slot: 0, params: { result: 'gae' } })
    run = throwAs(run, 'gae')
    run = moveLatest(run, groupOf(run, 0).id)
    expect(run.board!.lastMove!.momentumGained).toBe(2 + 2)
  })

  it('소금 shortens a goblin move or clears a boss status', () => {
    let run = boardRun()
    run.consumables = ['salt', 'salt']
    const goblin = addGoblin(run, 'o8', { prev: 'o9' })
    setIntent(goblin, 3)
    run = act(run, { type: 'USE_CONSUMABLE', slot: 0, params: { goblinId: goblin.id } })
    expect(goblinPlan(run, run.board!, run.board!.goblins[0]).steps).toBe(2)
    run.board!.blockade = { current: 'o5>dA1', next: 'o10>dB1', switchAt: 9 }
    run = act(run, { type: 'USE_CONSUMABLE', slot: 0, params: { status: 'blockade' } })
    expect(run.board!.blockade).toBeNull()
  })
})

describe('events', () => {
  function eventRun(id: string): RunState {
    const run = createRun({ seed: `content-${id}`, unlocked: ALL_UNLOCKS })
    run.coins = 50
    run.talismans.push({ uid: 't900', defId: 'ssangbok', counter: 0, charges: 0, usedThisBoard: 0, power: 1 })
    run.talismans.push({ uid: 't901', defId: 'gama', counter: 0, charges: 0, usedThisBoard: 0, power: 1 })
    run.event = createEvent(run, id)
    run.phase = 'event'
    return run
  }

  it('성황당 trades a talisman for a rare one or coins', () => {
    const a = act(eventRun('seonghwang'), { type: 'EVENT_CHOOSE', optionId: 'offerTalisman', params: { talismanIndex: 0, offerIndex: 0 } })
    expect(a.talismans.map((t) => t.defId)).not.toContain('ssangbok')
    expect(a.talismans).toHaveLength(2)
    const b = act(eventRun('seonghwang'), { type: 'EVENT_CHOOSE', optionId: 'offerCoins', params: { talismanIndex: 1 } })
    expect(b.coins).toBe(50 + 10)
  })

  it('대장간 installs a chosen modification', () => {
    let run = eventRun('daejang')
    run.event!.modOffers = ['heavy', 'gold', 'invert']
    run = act(run, { type: 'EVENT_CHOOSE', optionId: 'mod', params: { offerIndex: 1, stickIndex: 3 } })
    expect(run.sticks[3].modId).toBe('gold')
  })

  it('산신령 grants a run-long blessing', () => {
    const run = act(eventRun('sansin'), { type: 'EVENT_CHOOSE', optionId: 'bless', params: { offerIndex: 2 } })
    expect(run.blessings).toHaveLength(1)
  })

  it('도깨비 장터: every exchange works and needs its parameters', () => {
    const market = (offers: string[]) => {
      const run = eventRun('goblinMarket')
      run.event!.marketOffers = offers
      return run
    }
    const legend = act(market(['throwsForLegend']), { type: 'EVENT_CHOOSE', optionId: 'throwsForLegend', params: { offerIndex: 0 } })
    expect(legend.mods.baseThrowDelta).toBe(-1)
    expect(legend.talismans).toHaveLength(3)
    const power = act(market(['slotForPower']), { type: 'EVENT_CHOOSE', optionId: 'slotForPower', params: { talismanIndex: 1 } })
    expect(power.talismanCapacity).toBe(4)
    expect(power.talismans[1].power).toBe(2)
    const seal = act(market(['sealForMods']), { type: 'EVENT_CHOOSE', optionId: 'sealForMods', params: { pieceId: 2, stickIndex: 1, stickIndex2: 2 } })
    expect(seal.mods.sealed).toEqual([{ pieceId: 2, untilYard: 2 }])
    expect(seal.sticks[1].modId).not.toBeNull()
    expect(seal.sticks[2].modId).not.toBeNull()
    const copy = act(market(['coinsForCopy']), { type: 'EVENT_CHOOSE', optionId: 'coinsForCopy', params: { talismanIndex: 0 } })
    expect(copy.coins).toBe(25)
    expect(copy.talismans.filter((t) => t.defId === 'ssangbok')).toHaveLength(2)
  })

  it('a sealed piece sits out the next yard', () => {
    let run = createRun({ seed: 'seal', unlocked: ALL_UNLOCKS })
    run.boardIndex = 3
    run.mods.sealed = [{ pieceId: 2, untilYard: 2 }]
    run = act(run, { type: 'CHOOSE_WAGER', wager: 'standard' })
    expect(run.board!.groups.some((g) => g.members.includes(2))).toBe(false)
    expect(run.board!.groups).toHaveLength(3)
  })
})
